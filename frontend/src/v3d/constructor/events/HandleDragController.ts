import * as THREE from 'three';
import type { HandleDragState } from './PointerEventController';
import type { FeatureDocument } from '../features/FeatureDocument';
import type { FeatureId } from '../features/types';
import { TransformFeature } from '../features/composite/TransformFeature';
import { remapAxisForRotatedGroup } from '../primitiveTransforms';
import { normalizeAngle } from '../services/sceneObjectHelpers';

/**
 * Host-интерфейс для HandleDragController. ConstructorSceneService отдаёт
 * себя через cast `this as unknown as HandleDragHost`, чтобы поля читались
 * fresh на каждом drag-frame'е.
 */
export interface HandleDragHost {
  selectedObject3D: THREE.Object3D | null;
  handleDragState: HandleDragState | null;
  snapStep: number;
  /** Текущий FeatureDocument — primary source-of-truth для transform params. */
  getFeatureDocument(): FeatureDocument | null;
  options: { onNodeParamsChanged?: () => void };
  /** Показать индикатор Z=0 если объект сидит на сетке. Вызывается каждый frame. */
  showYZeroIndicatorIfNeeded(featureId: FeatureId | null): void;
}

/** Mutable scratch-params, мутируемые drag-математикой по фрейму. */
interface ScratchParams {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

/**
 * Применяет дельту с handle-ручки к Transform-feature: edge/corner-resize,
 * height-stretch, vertical translate, rotation X/Y/Z. Каждый handle-тип имеет
 * свой кейс в switch'е и набор побочных эффектов (drift-компенсация позиции
 * для сохранения фиксированной грани, snap к сетке для offsetY и т.д.).
 *
 * После flip'а оперирует НАПРЯМУЮ через FeatureDocument.updateParamsLive —
 * никакого ModelNode runtime'а не задействовано.
 */
export class HandleDragController {
  constructor(private readonly host: HandleDragHost) {}

  applyDragDelta(
    featureId: FeatureId | null,
    handleType: string,
    dx: number,
    dy: number,
  ): void {
    if (!featureId) return;
    const doc = this.host.getFeatureDocument();
    if (!doc) return;
    const transform = doc.graph.get(featureId);
    if (!(transform instanceof TransformFeature)) return;

    // Scratch params — копия текущих params, мутируется математикой ниже.
    // Tuple [x,y,z] из featureDoc → {x,y,z} вид (исторический контракт math'а).
    const tp = transform.params;
    const params: ScratchParams = {
      position: { x: tp.position[0], y: tp.position[1], z: tp.position[2] },
      rotation: { x: tp.rotation[0], y: tp.rotation[1], z: tp.rotation[2] },
      scale: { x: tp.scale[0], y: tp.scale[1], z: tp.scale[2] },
    };
    const p = params.position;
    const s = params.scale;

    // halfHeight примитива внутри Transform — для bottom-anchor sync 3D-объекта
    // во время drift compensation. visitTransform пробрасывает bottomAnchorOffsetZ
    // из inner-leaf'а, поэтому достаточно output этого Transform'а.
    const out = doc.getOutput(featureId);
    const halfH = (out && out.kind === 'leaf') ? (out.bottomAnchorOffsetZ ?? 0) : 0;

    // AABB и unrotated-bbox для scale-операций. Нужно для групп
    // (без geometryParams) и для примитивов где geomKey отсутствует
    // (cylinder/cone — handle resize'ит через scale, а не через geometryParams).
    let objBoxSize: THREE.Vector3 | null = null;
    let objBox: THREE.Box3 | null = null;
    if (this.host.selectedObject3D) {
      objBox = new THREE.Box3().setFromObject(this.host.selectedObject3D);
      const savedQ = this.host.selectedObject3D.quaternion.clone();
      this.host.selectedObject3D.quaternion.set(0, 0, 0, 1);
      this.host.selectedObject3D.updateMatrixWorld(true);
      const objBoxUnrotated = new THREE.Box3().setFromObject(this.host.selectedObject3D);
      this.host.selectedObject3D.quaternion.copy(savedQ);
      this.host.selectedObject3D.updateMatrixWorld(true);
      objBoxSize = new THREE.Vector3();
      objBoxUnrotated.getSize(objBoxSize);
    }

    const remapAxis = (worldAxis: 'x' | 'y' | 'z'): 'x' | 'y' | 'z' => {
      return remapAxisForRotatedGroup(params.rotation, worldAxis);
    };

    /**
     * "Before-after" подход: запомнить фиксированную грань → поменять
     * scale → измерить drift → компенсировать через position. Так
     * противоположная грань остаётся на месте при ресайзе.
     */
    const growDim = (
      delta: number,
      _geomKey: 'width' | 'height' | 'depth',
      scaleAxis: 'x' | 'y' | 'z',
      posAxis: 'x' | 'y' | 'z',
      posSign: number,
    ): void => {
      const effectiveScaleAxis = remapAxis(scaleAxis);
      const obj = this.host.selectedObject3D;
      if (!obj) return;

      const currentSize = objBoxSize ? objBoxSize[effectiveScaleAxis] : 0;
      if (currentSize > 0.01) {
        const fixedBefore = objBox
          ? (posSign > 0 ? objBox.min[posAxis] : objBox.max[posAxis])
          : p[posAxis];

        const oldScale = s[effectiveScaleAxis] ?? 1;
        const scaleDelta = delta / currentSize * oldScale;
        s[effectiveScaleAxis] = Math.max(0.01, oldScale + scaleDelta);

        obj.scale.set(s.x, s.y, s.z);
        obj.updateMatrixWorld(true);
        const newBox = new THREE.Box3().setFromObject(obj);
        const fixedAfter = posSign > 0 ? newBox.min[posAxis] : newBox.max[posAxis];

        const drift = fixedAfter - fixedBefore;
        p[posAxis] -= drift;

        // Sync 3D obj position для следующего growDim вызова (corners — 2 раза).
        obj.position.set(p.x, p.y, (p.z ?? 0) + halfH);
        obj.updateMatrixWorld(true);
        objBox = new THREE.Box3().setFromObject(obj);
      } else {
        s[effectiveScaleAxis] = Math.max(0.01, (s[effectiveScaleAxis] ?? 1) + delta * 0.01);
        p[posAxis] += (delta / 2) * posSign;
      }
    };

    switch (handleType) {
      // Edge handles: одна размерность, противоположная грань фиксирована.
      case 'edgeWidthRight':  growDim(dx,  'width', 'x', 'x', +1); break;
      case 'edgeWidthLeft':   growDim(-dx, 'width', 'x', 'x', -1); break;
      case 'edgeLengthFront': growDim(dx,  'depth', 'y', 'y', +1); break;
      case 'edgeLengthBack':  growDim(-dx, 'depth', 'y', 'y', -1); break;

      // Corner handles: dx — width, dy — depth.
      case 'cornerTR': { growDim(dx,  'width', 'x', 'x', +1); growDim(dy,  'depth', 'y', 'y', +1); break; }
      case 'cornerTL': { growDim(-dx, 'width', 'x', 'x', -1); growDim(dy,  'depth', 'y', 'y', +1); break; }
      case 'cornerBR': { growDim(dx,  'width', 'x', 'x', +1); growDim(-dy, 'depth', 'y', 'y', -1); break; }
      case 'cornerBL': { growDim(-dx, 'width', 'x', 'x', -1); growDim(-dy, 'depth', 'y', 'y', -1); break; }

      // Height: вертикальный stretch, нижняя грань фиксирована.
      case 'height': {
        const hObj = this.host.selectedObject3D;
        let bottomBefore: number | null = null;
        if (hObj) bottomBefore = new THREE.Box3().setFromObject(hObj).min.z;

        const heightAxis = remapAxis('z');
        const currentH = objBoxSize ? objBoxSize[heightAxis] : 0;
        if (currentH > 0.01) {
          const oldScaleH = s[heightAxis] ?? 1;
          s[heightAxis] = Math.max(0.01, oldScaleH + dy / currentH * oldScaleH);
        } else {
          s[heightAxis] = Math.max(0.01, (s[heightAxis] ?? 1) + dy * 0.01);
        }

        if (hObj && bottomBefore !== null) {
          // Удаляем устаревшие edge-lines от предыдущей геометрии — их bbox
          // раздувает setFromObject и ломает drift-вычисление.
          const staleEdges = hObj.children.filter((c) => c.userData.isEdgeLine);
          for (const c of staleEdges) {
            (c as THREE.LineSegments).geometry?.dispose();
            hObj.remove(c);
          }
          hObj.position.set(p.x, p.y, (p.z ?? 0) + halfH);
          hObj.scale.set(s.x, s.y, s.z);
          hObj.updateMatrixWorld(true);
          const drift = new THREE.Box3().setFromObject(hObj).min.z - bottomBefore;
          if (Math.abs(drift) > 0.0001) p.z -= drift;
        }
        break;
      }

      // Vertical translation (Z в Z-up; имя 'offsetY' — историческое).
      case 'offsetY':
        p.z = (p.z ?? 0) + dy;
        break;

      // Axis-constrained rotation.
      case 'rotateX':
      case 'rotateY':
      case 'rotateZ': {
        const ds = this.host.handleDragState;
        if (ds?.startQuaternion && ds.rotationWorldAxis) {
          const startRot = ds.startRotation ?? 0;
          const deltaAngle = dx - startRot;
          const deltaQuat = new THREE.Quaternion().setFromAxisAngle(ds.rotationWorldAxis, deltaAngle);
          const newQuat = deltaQuat.multiply(ds.startQuaternion.clone());
          const euler = new THREE.Euler().setFromQuaternion(newQuat, 'XYZ');
          params.rotation.x = normalizeAngle(euler.x);
          params.rotation.y = normalizeAngle(euler.y);
          params.rotation.z = normalizeAngle(euler.z);
        }
        break;
      }
      default:
        break;
    }

    // Snap для вертикали — снэпим визуальную нижнюю грань (не raw p.z),
    // т.к. при scale.z != 1 у нас p.z != bbox.min.z (drift-компенсация в
    // growDim сдвигает p.z, чтобы bbox.min.z остался на месте). Снэп-на-p.z
    // в этом случае промахивается мимо сетки на halfH*(1-scale.z).
    if (this.host.snapStep > 0 && handleType === 'offsetY') {
      const scaleZ = Math.abs(s.z);
      const offset = halfH * (1 - scaleZ);
      const bottom = p.z + offset;
      const snappedBottom = Math.round(bottom / this.host.snapStep) * this.host.snapStep;
      p.z = snappedBottom - offset;
    }

    // Apply scratch params → 3D-объект для немедленного visual feedback.
    // FeatureRenderer на updateParamsLive повторно выставит трансформ, но
    // совпадающие значения дают тот же результат — без visible flicker'а.
    const obj = this.host.selectedObject3D;
    if (obj) {
      obj.position.set(p.x, p.y, p.z + halfH);
      obj.scale.set(s.x, s.y, s.z);
      const ds = this.host.handleDragState;
      if (ds?.groupPivotWorld && ds?.groupPivotLocal) {
        const pivotWorld = ds.groupPivotWorld;
        const pivotLocal = ds.groupPivotLocal;

        obj.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
        obj.updateMatrixWorld(true);

        // Rotation вокруг pivot'а (= world bbox-центр на момент начала drag'а):
        // localToWorld = R*v + P. Сохраняем визуальный центр объекта на месте.
        const rotatedOffset = obj.localToWorld(pivotLocal.clone()).sub(obj.position);
        obj.position.copy(pivotWorld).sub(rotatedOffset);
        obj.updateMatrixWorld(true);

        params.position.x = obj.position.x;
        params.position.y = obj.position.y;
        params.position.z = obj.position.z - halfH;
      } else {
        obj.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
      }
    }

    // Sync scratch → featureDoc.updateParamsLive (single-feature targeted).
    doc.updateParamsLive(featureId, {
      position: [params.position.x, params.position.y, params.position.z],
      rotation: [params.rotation.x, params.rotation.y, params.rotation.z],
      scale: [params.scale.x, params.scale.y, params.scale.z],
    });

    this.host.showYZeroIndicatorIfNeeded(featureId);
    this.host.options.onNodeParamsChanged?.();
  }
}
