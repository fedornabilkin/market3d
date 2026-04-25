import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { ModelNode } from '../nodes/ModelNode';
import type { ModificationGizmo, HandleMesh } from '../modes/ModificationGizmo';
import type { MirrorHandleMesh } from '../modes/MirrorGizmo';
import type { MirrorMode } from '../modes/MirrorMode';
import type { CruiseMode } from '../modes/CruiseMode';
import type { AlignmentMode } from '../modes/AlignmentMode';
import type { ChamferMode } from '../modes/ChamferMode';

/** Pixels a pointer must move before a click becomes a drag. */
export const DRAG_THRESHOLD = 4;

/**
 * Ближайший предок с `userData.selectAsUnit` (или сам объект). Для объединённых
 * групп, которые рендерятся без CSG — клик/драг по child-мешу должен
 * адресоваться всей группе целиком (как было у CSG-мерджа).
 */
function resolveSelectableTarget(object3D: THREE.Object3D): THREE.Object3D {
  let current: THREE.Object3D | null = object3D;
  while (current) {
    if ((current.userData as { selectAsUnit?: boolean }).selectAsUnit) {
      return current;
    }
    current = current.parent;
  }
  return object3D;
}

/**
 * Compute the angle on a rotation plane defined by its normal and two
 * tangent axes. The hit point is projected onto the plane through center,
 * then atan2 of the two tangent coordinates gives the angle.
 */
function planeAngle(
  hit: THREE.Vector3,
  center: THREE.Vector3,
  tangentU: THREE.Vector3,
  tangentV: THREE.Vector3,
): number {
  const d = hit.clone().sub(center);
  return Math.atan2(d.dot(tangentU), d.dot(tangentV));
}

/**
 * Build the world-space rotation-plane normal and tangent axes for a given
 * Euler handle.
 */
function rotationPlaneAxes(
  handleType: string,
): { normal: THREE.Vector3; tangentU: THREE.Vector3; tangentV: THREE.Vector3 } {
  // Z-up: для каждой оси вращения tangentV — «вертикаль» (Z для rotateX/Y),
  // tangentU — горизонтальное направление в плоскости вращения. Так атан2(u, v)
  // измеряет угол от «верха» (или соответствующего reference) в положительную сторону.
  let normal: THREE.Vector3;
  let tangentU: THREE.Vector3;
  let tangentV: THREE.Vector3;
  switch (handleType) {
    case 'rotateX':
      // Поворот вокруг X. Плоскость YZ. Reference — вверх (+Z).
      normal   = new THREE.Vector3(1, 0, 0);
      tangentU = new THREE.Vector3(0, 1, 0);
      tangentV = new THREE.Vector3(0, 0, 1);
      break;
    case 'rotateY':
      // Поворот вокруг Y. Плоскость XZ. Reference — вверх (+Z).
      normal   = new THREE.Vector3(0, 1, 0);
      tangentU = new THREE.Vector3(1, 0, 0);
      tangentV = new THREE.Vector3(0, 0, 1);
      break;
    case 'rotateZ':
      // Yaw вокруг Z. Плоскость XY. Reference — +Y (вперёд в Z-up).
      normal   = new THREE.Vector3(0, 0, 1);
      tangentU = new THREE.Vector3(1, 0, 0);
      tangentV = new THREE.Vector3(0, 1, 0);
      break;
    default:
      normal   = new THREE.Vector3(0, 0, 1);
      tangentU = new THREE.Vector3(1, 0, 0);
      tangentV = new THREE.Vector3(0, 1, 0);
  }
  return { normal, tangentU, tangentV };
}

export interface HandleDragState {
  handleType: string;
  node: ModelNode | null;
  plane: THREE.Plane;
  startWorldPoint: THREE.Vector3;
  worldAxis: THREE.Vector3;
  isVertical: boolean;
  isCorner: boolean;
  totalDeltaX: number;
  totalDeltaY: number;
  appliedDeltaX: number;
  appliedDeltaY: number;
  startClientX: number;
  startClientY: number;
  rotationPlane?: THREE.Plane;
  rotationCenter?: THREE.Vector3;
  startPlaneAngle?: number;
  startRotation?: number;
  rotationTangentU?: THREE.Vector3;
  rotationTangentV?: THREE.Vector3;
  /** Z-координата нижней грани bbox в момент старта drag — для re-anchor'a после поворота. */
  startBottomZ?: number;
  groupPivotWorld?: THREE.Vector3;
  groupPivotLocal?: THREE.Vector3;
  startQuaternion?: THREE.Quaternion;
  rotationWorldAxis?: THREE.Vector3;
  ringRadius?: number;
  rotationLastSnapDeg?: number;
  rotationLastTarget?: number;
  rotationPrevSnapDeg?: number;
  rotationPrevTarget?: number;
  screenCenter?: THREE.Vector2;
  startScreenAngle?: number;
  localAxisX?: THREE.Vector3;
  localAxisZ?: THREE.Vector3;
}

export interface ConstraintPlaneInfo {
  plane: THREE.Plane;
  worldAxis: THREE.Vector3;
  isVertical: boolean;
  isCorner: boolean;
  localAxisX?: THREE.Vector3;
  localAxisZ?: THREE.Vector3;
}

/**
 * Friend interface — exposes the ConstructorSceneService internals the
 * pointer handlers need. Cast `this` to it at the construction site so the
 * service's `private` modifiers stay intact in the rest of the codebase.
 */
export interface PointerEventHost {
  // ─── Three.js / scene state ────────────────────────────────────────────────
  modelRootGroup: THREE.Group | null;
  raycaster: THREE.Raycaster | null;
  mouse: THREE.Vector2 | null;
  camera: THREE.PerspectiveCamera | null;
  controls: OrbitControls | null;
  renderer: THREE.WebGLRenderer | null;
  containerEl: HTMLElement | null;

  // ─── Selection / gizmos ────────────────────────────────────────────────────
  selectedNode: ModelNode | null;
  selectedObject3D: THREE.Object3D | null;
  modificationGizmo: ModificationGizmo | null;
  mirrorMode: MirrorMode;
  alignmentMode: AlignmentMode;
  chamferMode: ChamferMode;

  // ─── Tunables ──────────────────────────────────────────────────────────────
  snapStep: number;
  zoomSpeed: number;
  cruiseModeCtrl: CruiseMode;

  // ─── Drag state owned by the service (read by other host methods) ──────────
  pointerDownHit: { object: THREE.Object3D; point: THREE.Vector3 } | null;
  pointerDownClient: { x: number; y: number };
  pointerDownShift: boolean;
  pointerDownHandle: HandleMesh | null;
  isHandleDragging: boolean;
  isPlaneDragging: boolean;
  handleDragState: HandleDragState | null;
  dragOffset: THREE.Vector2;
  dragPlane: THREE.Plane | null;
  dragTarget: THREE.Object3D | null;

  // ─── Lifecycle callbacks ───────────────────────────────────────────────────
  options: {
    onSelectNodeFromScene?: (node: ModelNode, opts: { shift: boolean }) => void;
    onDeselectAll?: () => void;
    onNodeParamsChanged?: (node: ModelNode) => void;
    onBeforeDrag?: () => void;
    onAfterDrag?: () => void;
    onAlignMarkerClick?: (mode: string) => void;
    onMarqueeSelect?: (nodes: ModelNode[]) => void;
  };

  // ─── Methods the handlers call back into ───────────────────────────────────
  getSelectableMeshes(): THREE.Mesh[];
  computeHandleConstraintPlane(handleType: string): ConstraintPlaneInfo;
  applyHandleDragDelta(node: ModelNode | null, handleType: string, dx: number, dy: number): void;
  bakeRotationIntoDimensions(node: ModelNode): void;
  collectNeighborEdges(exclude: THREE.Object3D): { xs: number[]; zs: number[] };
  applyCruiseSnap(
    target: THREE.Object3D,
    posX: number,
    posZ: number,
    edges: { xs: number[]; zs: number[] },
  ): { x: number; z: number; guideXs: number[]; guideZs: number[] };
  showCruiseGuides(xs: number[], zs: number[], y: number): void;
  clearCruiseGuides(): void;
  updateGizmoTarget(prevNodes?: ModelNode[]): void;
  rebuildSceneFromTree(): void;
}

/**
 * Owns the canvas pointerdown/move/up handlers (selection, drag, rotate,
 * mirror handles, middle-button camera cruise). Extracted from
 * ConstructorSceneService to keep that class focused on scene/state.
 *
 * The controller is stateless — all transient drag state lives on the host
 * because other host methods (e.g. applyHandleDragDelta) read it as well.
 */
export class PointerEventController {
  // Middle-button camera cruise (only the handlers care about it)
  private middleDragging = false;
  private middleLastX = 0;
  private middleLastY = 0;

  // Marquee (rectangle) selection
  private isMarqueeSelecting = false;
  private marqueeStartX = 0;
  private marqueeStartY = 0;
  private marqueeEl: HTMLDivElement | null = null;

  constructor(private readonly host: PointerEventHost) {}

  attach(el: HTMLElement): void {
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
  }

  detach(el: HTMLElement): void {
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
  }

  private updateMouseFromEvent(event: PointerEvent): void {
    const host = this.host;
    if (!host.containerEl || !host.mouse) return;
    const rect = host.containerEl.getBoundingClientRect();
    host.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    host.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const host = this.host;
    if (!host.modelRootGroup || !host.raycaster || !host.mouse) return;

    // Middle button: start camera cruise
    if (event.button === 1) {
      event.preventDefault();
      this.middleDragging = true;
      this.middleLastX = event.clientX;
      this.middleLastY = event.clientY;
      return;
    }

    if (event.button !== 0) return;
    this.updateMouseFromEvent(event);
    host.raycaster.setFromCamera(host.mouse, host.camera!);

    // Mirror handle click
    const mirrorGizmo = host.mirrorMode.getGizmo();
    if (host.mirrorMode.isActive() && mirrorGizmo?.isVisible() && host.selectedNode) {
      mirrorGizmo.updateMatrixWorld();
      const mirrorHits = host.raycaster.intersectObjects(mirrorGizmo.getHandles());
      if (mirrorHits.length > 0) {
        const handle = mirrorHits[0].object as MirrorHandleMesh;
        const axis = handle.userData?.axis;
        if (axis) {
          host.options.onBeforeDrag?.();
          const node = host.selectedNode;
          node.params = node.params || {};
          node.params.scale = node.params.scale || { x: 1, y: 1, z: 1 };
          node.params.scale[axis] *= -1;
          host.rebuildSceneFromTree();
          host.options.onNodeParamsChanged?.(node);
          host.options.onAfterDrag?.();
        }
        return;
      }
    }

    // Chamfer mode click: raycast to mesh, find nearest edge
    if (host.chamferMode.isActive()) {
      const meshes = host.getSelectableMeshes();
      const hits = host.raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        host.chamferMode.updateHover(hits[0].object, hits[0].point);
        host.chamferMode.handleClick();
      }
      return;
    }

    // Alignment marker click (screen-space)
    if (host.alignmentMode.isActive() && host.camera && host.containerEl) {
      const alignMarkers = host.alignmentMode.getMarkers();
      if (alignMarkers.length > 0) {
        const hitRadius = 12;
        const wp = new THREE.Vector3();
        const rect = host.containerEl.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        for (const marker of alignMarkers) {
          marker.getWorldPosition(wp);
          wp.project(host.camera);
          const sx = (wp.x * 0.5 + 0.5) * rect.width;
          const sy = (-wp.y * 0.5 + 0.5) * rect.height;
          if (Math.hypot(sx - mx, sy - my) < hitRadius) {
            const mode = marker.userData?.alignMode;
            if (mode) {
              host.options.onAlignMarkerClick?.(mode);
              return;
            }
          }
        }
      }
    }

    if (host.modificationGizmo?.getTarget()) {
      // Force matrix update so raycasting reflects the latest handle positions.
      host.modificationGizmo.updateMatrixWorldForHandles();
      const handleHits = host.raycaster.intersectObjects(host.modificationGizmo.getHandles(), false);
      let hitHandle: HandleMesh | null = null;
      if (handleHits.length > 0) {
        hitHandle = handleHits[0].object as HandleMesh;
      }
      // Fallback: screen-space proximity test (handles are small billboard quads)
      if (!hitHandle && host.camera && host.containerEl) {
        const rect = host.containerEl.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const wp = new THREE.Vector3();
        let closestDist = 16; // px radius
        for (const h of host.modificationGizmo.getHandles()) {
          h.getWorldPosition(wp);
          wp.project(host.camera);
          const sx = (wp.x * 0.5 + 0.5) * rect.width;
          const sy = (-wp.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - mx, sy - my);
          if (d < closestDist) {
            closestDist = d;
            hitHandle = h as HandleMesh;
          }
        }
      }
      if (hitHandle?.userData?.type) {
        host.pointerDownHandle = hitHandle;
        host.pointerDownClient = { x: event.clientX, y: event.clientY };
        host.pointerDownShift = !!event.shiftKey;
        return;
      }
    }

    const meshes = host.getSelectableMeshes();
    const hits = host.raycaster.intersectObjects(meshes);
    host.pointerDownClient = { x: event.clientX, y: event.clientY };
    host.pointerDownShift = !!event.shiftKey;
    host.pointerDownHandle = null;
    host.pointerDownHit = hits.length > 0
      ? { object: hits[0].object, point: hits[0].point }
      : null;
  };

  private onPointerMove = (event: PointerEvent): void => {
    const host = this.host;
    if (!host.modelRootGroup || !host.raycaster || !host.mouse) return;

    // ── Middle-button camera cruise ────────────────────────────────────────
    if (this.middleDragging && host.camera && host.controls) {
      const dx = event.clientX - this.middleLastX;
      const dy = event.clientY - this.middleLastY;
      this.middleLastX = event.clientX;
      this.middleLastY = event.clientY;

      const dist = host.camera.position.distanceTo(host.controls.target);
      const speed = dist * 0.002 * host.zoomSpeed;

      // Horizontal mouse → strafe (camera right), vertical → pan (camera up)
      const forward = new THREE.Vector3();
      host.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, host.camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();

      const offset = new THREE.Vector3();
      offset.addScaledVector(right, -dx * speed);
      offset.addScaledVector(up, dy * speed);

      host.camera.position.add(offset);
      host.controls.target.add(offset);
      host.controls.update();
      return;
    }

    this.updateMouseFromEvent(event);
    host.raycaster.setFromCamera(host.mouse, host.camera!);

    // ── Handle drag ────────────────────────────────────────────────────────
    if (host.isHandleDragging && host.handleDragState) {
      const isRotation = host.handleDragState.handleType.startsWith('rotate');

      if (isRotation) {
        const sc = host.handleDragState.screenCenter;
        const startSA = host.handleDragState.startScreenAngle;
        if (sc && startSA !== undefined && host.handleDragState.startPlaneAngle !== undefined) {
          // Screen-space angle for uniform stiffness across all axes
          const curScreenAngle = Math.atan2(
            -(event.clientY - sc.y), event.clientX - sc.x
          );
          let delta = curScreenAngle - startSA;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;

          // Check rotation direction: if camera looks at the back of the plane,
          // invert the rotation so it matches visual cursor direction
          const rc = host.handleDragState.rotationCenter;
          const normal = host.handleDragState.rotationWorldAxis;
          if (rc && normal && host.camera) {
            const camDir = host.camera.position.clone().sub(rc);
            if (camDir.dot(normal) < 0) delta = -delta;
          }

          // Triple-ring snap: use 3D raycast distance for snap zone detection
          let snapDeg = 5; // default
          const rp = host.handleDragState.rotationPlane;
          if (rp && rc) {
            const hitPoint = new THREE.Vector3();
            const didHit = host.raycaster.ray.intersectPlane(rp, hitPoint);
            if (didHit) {
              const ringRadius = host.handleDragState.ringRadius ?? 1;
              const distFromCenter = hitPoint.distanceTo(rc);
              const normalizedDist = distFromCenter / ringRadius;
              snapDeg = normalizedDist < 0.64 ? 22.5 : normalizedDist < 0.82 ? 5 : 1;
            }
          }
          const snapStep = (snapDeg * Math.PI) / 180;

          const startRot = host.handleDragState.startRotation ?? 0;
          const rawTarget = startRot + delta;
          const snappedTarget = snapStep > 0
            ? Math.round(rawTarget / snapStep) * snapStep
            : rawTarget;

          // Сохраняем кадр ДО apply, чтобы на pointerup можно было откатить
          // «дрифт отпускания»: если курсор уехал внутрь в последний момент,
          // шаг снапа становится грубее и накрученный угол схлопывается в 0.
          host.handleDragState.rotationPrevSnapDeg = host.handleDragState.rotationLastSnapDeg;
          host.handleDragState.rotationPrevTarget = host.handleDragState.rotationLastTarget;

          // Pass absolute angle
          host.applyHandleDragDelta(host.handleDragState.node, host.handleDragState.handleType, snappedTarget, 0);

          host.handleDragState.rotationLastSnapDeg = snapDeg;
          host.handleDragState.rotationLastTarget = snappedTarget;

          // Update sector visualization
          if (host.modificationGizmo) {
            host.modificationGizmo.updateRotationSector(
              host.handleDragState.handleType as import('../ModificationGizmo').HandleType,
              startRot,
              snappedTarget
            );
          }
        }
        return;
      }

      // Raycast cursor onto the constraint plane to get world-space position
      const worldPoint = new THREE.Vector3();
      const hit = host.raycaster.ray.intersectPlane(host.handleDragState.plane, worldPoint);
      if (!hit) return;

      // Project world delta onto the handle's axis
      const rawDelta = worldPoint.clone().sub(host.handleDragState.startWorldPoint);

      if (host.handleDragState.isVertical) {
        // Z-up: вертикальное смещение по Z.
        host.handleDragState.totalDeltaY = rawDelta.z;
      } else if (host.handleDragState.isCorner) {
        const lx = host.handleDragState.localAxisX;
        const lz = host.handleDragState.localAxisZ;
        if (lx && lz) {
          host.handleDragState.totalDeltaX = rawDelta.dot(lx);
          host.handleDragState.totalDeltaY = rawDelta.dot(lz);
        } else {
          // Z-up fallback: вторая горизонтальная — Y.
          host.handleDragState.totalDeltaX = rawDelta.x;
          host.handleDragState.totalDeltaY = rawDelta.y;
        }
      } else {
        const axisDot = rawDelta.dot(host.handleDragState.worldAxis);
        host.handleDragState.totalDeltaX = axisDot;
      }

      const snappedX = host.snapStep > 0
        ? Math.round(host.handleDragState.totalDeltaX / host.snapStep) * host.snapStep
        : host.handleDragState.totalDeltaX;
      const snappedY = host.snapStep > 0
        ? Math.round(host.handleDragState.totalDeltaY / host.snapStep) * host.snapStep
        : host.handleDragState.totalDeltaY;

      const deltaXToApply = snappedX - host.handleDragState.appliedDeltaX;
      const deltaYToApply = snappedY - host.handleDragState.appliedDeltaY;

      if (deltaXToApply !== 0 || deltaYToApply !== 0) {
        host.applyHandleDragDelta(
          host.handleDragState.node,
          host.handleDragState.handleType,
          deltaXToApply,
          deltaYToApply
        );
        host.handleDragState.appliedDeltaX = snappedX;
        host.handleDragState.appliedDeltaY = snappedY;
      }

      return;
    }

    // ── Plane drag ────────────────────────────────────────────────────────
    // Z-up: плоскость drag — XY (Z=0). Раньше была XZ (Y=0).
    if (host.isPlaneDragging && host.dragTarget && host.dragPlane) {
      const ray = host.raycaster.ray;
      const targetPoint = new THREE.Vector3();
      if (ray.intersectPlane(host.dragPlane, targetPoint)) {
        targetPoint.x -= host.dragOffset.x;
        targetPoint.y -= host.dragOffset.y;
        if (host.snapStep > 0) {
          // Snap left (min.x) и front (min.y) грани AABB к линиям сетки —
          // odd-sized объекты сохраняют видимую грань на сетке.
          const worldPos = new THREE.Vector3();
          host.dragTarget.getWorldPosition(worldPos);
          const bbox = new THREE.Box3().setFromObject(host.dragTarget);
          const offMinX = bbox.min.x - worldPos.x;
          const offMinY = bbox.min.y - worldPos.y;
          const snappedMinX = Math.round((targetPoint.x + offMinX) / host.snapStep) * host.snapStep;
          const snappedMinY = Math.round((targetPoint.y + offMinY) / host.snapStep) * host.snapStep;
          targetPoint.x = snappedMinX - offMinX;
          targetPoint.y = snappedMinY - offMinY;
        }

        // Cruise mode: snap to neighbor edges
        if (host.cruiseModeCtrl.isActive()) {
          const edges = host.collectNeighborEdges(host.dragTarget);
          if (host.dragTarget.parent) host.dragTarget.parent.worldToLocal(targetPoint);
          host.dragTarget.position.x = targetPoint.x;
          host.dragTarget.position.y = targetPoint.y;

          const worldPos = new THREE.Vector3();
          host.dragTarget.getWorldPosition(worldPos);
          const snap = host.applyCruiseSnap(host.dragTarget, worldPos.x, worldPos.y, edges);

          const snappedWorld = new THREE.Vector3(snap.x, snap.z, worldPos.z);
          if (host.dragTarget.parent) host.dragTarget.parent.worldToLocal(snappedWorld);
          host.dragTarget.position.x = snappedWorld.x;
          host.dragTarget.position.y = snappedWorld.y;

          if (snap.guideXs.length || snap.guideZs.length) {
            host.showCruiseGuides(snap.guideXs, snap.guideZs, worldPos.z);
          } else {
            host.clearCruiseGuides();
          }
        } else {
          if (host.dragTarget.parent) host.dragTarget.parent.worldToLocal(targetPoint);
          host.dragTarget.position.x = targetPoint.x;
          host.dragTarget.position.y = targetPoint.y;
        }

        // Update node params
        const node = (host.dragTarget.userData as { node?: ModelNode }).node;
        if (node?.params) {
          node.params.position = node.params.position || { x: 0, y: 0, z: 0 };
          node.params.position.x = host.dragTarget.position.x;
          node.params.position.y = host.dragTarget.position.y;
          host.options.onNodeParamsChanged?.(node);
        }
      }
      return;
    }

    // ── Begin handle drag ─────────────────────────────────────────────────
    if (host.pointerDownHandle && (event.buttons & 1) === 1 && !host.isHandleDragging) {
      const dx = event.clientX - host.pointerDownClient.x;
      const dy = event.clientY - host.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        host.isHandleDragging = true;
        if (host.controls) host.controls.enabled = false;
        host.options.onBeforeDrag?.();
        const node = host.modificationGizmo?.getNode() as ModelNode | null;
        const handleType = (host.pointerDownHandle.userData as { type: string }).type;

        const { plane, worldAxis, isVertical, isCorner, localAxisX, localAxisZ } =
          host.computeHandleConstraintPlane(handleType);

        const startWorldPoint = new THREE.Vector3();
        host.raycaster.ray.intersectPlane(plane, startWorldPoint);

        host.handleDragState = {
          handleType,
          node,
          plane,
          startWorldPoint,
          worldAxis,
          isVertical,
          isCorner,
          totalDeltaX: 0,
          totalDeltaY: 0,
          appliedDeltaX: 0,
          appliedDeltaY: 0,
          startClientX: event.clientX,
          startClientY: event.clientY,
          localAxisX,
          localAxisZ,
        };

        // For rotation handles: set up rotation plane and initial angle
        if (handleType.startsWith('rotate') && host.selectedObject3D && host.camera) {
          const obj = host.selectedObject3D;
          obj.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(obj);
          const center = new THREE.Vector3();
          box.getCenter(center);

          const { normal, tangentU, tangentV } = rotationPlaneAxes(handleType);
          const rotPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);

          const hitStart = new THREE.Vector3();
          const didHit = host.raycaster.ray.intersectPlane(rotPlane, hitStart);

          if (didHit) {
            const startAngle = planeAngle(hitStart, center, tangentU, tangentV);
            const axisKey = handleType === 'rotateX' ? 'x' : handleType === 'rotateY' ? 'y' : 'z';
            host.handleDragState.rotationPlane = rotPlane;
            host.handleDragState.rotationCenter = center;
            host.handleDragState.rotationTangentU = tangentU;
            host.handleDragState.rotationTangentV = tangentV;
            host.handleDragState.startPlaneAngle = startAngle;
            host.handleDragState.startRotation = host.handleDragState.node?.params?.rotation?.[axisKey] ?? 0;
            host.handleDragState.startQuaternion = obj.quaternion.clone();
            host.handleDragState.rotationWorldAxis = normal.clone();

            // Screen-space center and start angle for uniform stiffness
            const screenCenter = center.clone().project(host.camera);
            const rect = host.containerEl?.getBoundingClientRect();
            if (rect) {
              const sx = (screenCenter.x * 0.5 + 0.5) * rect.width + rect.left;
              const sy = (-screenCenter.y * 0.5 + 0.5) * rect.height + rect.top;
              host.handleDragState.screenCenter = new THREE.Vector2(sx, sy);
              host.handleDragState.startScreenAngle = Math.atan2(
                -(event.clientY - sy), event.clientX - sx
              );
            }
          }

          // Compute the ring radius for snap-zone detection
          const boxSize = new THREE.Vector3();
          box.getSize(boxSize);
          host.handleDragState.ringRadius = boxSize.length() * 1.0;

          // Cache the bbox center as fixed pivot for position correction
          const pivot = center.clone();
          host.handleDragState.groupPivotWorld = pivot;
          host.handleDragState.groupPivotLocal = obj.worldToLocal(pivot.clone());
          // Z-up: запоминаем нижнюю грань bbox — после поворота вокруг
          // горизонтальной оси (X/Y) объект расширяется по Z, и без re-anchor'a
          // его нижняя грань уехала бы вверх или вниз относительно сетки.
          host.handleDragState.startBottomZ = box.min.z;
        }
      }
    }

    // ── Begin plane drag ──────────────────────────────────────────────────
    if (host.pointerDownHit && !host.isPlaneDragging && !host.isHandleDragging && (event.buttons & 1) === 1) {
      const dx = event.clientX - host.pointerDownClient.x;
      const dy = event.clientY - host.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        host.isPlaneDragging = true;
        if (host.controls) host.controls.enabled = false;
        host.options.onBeforeDrag?.();
        host.dragTarget = resolveSelectableTarget(host.pointerDownHit.object);
        const worldPos = new THREE.Vector3();
        host.dragTarget.getWorldPosition(worldPos);
        // Z-up: drag в XY-плоскости. dragOffset хранит горизонтальный отступ.
        host.dragOffset.set(
          host.pointerDownHit.point.x - worldPos.x,
          host.pointerDownHit.point.y - worldPos.y,
        );
        host.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        host.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), worldPos);
      }
    }

    // ── Marquee selection (empty-space drag) ────────────────────────────
    if (this.isMarqueeSelecting) {
      this.updateMarqueeRect(event);
      return;
    }
    if (
      !host.pointerDownHit &&
      !host.pointerDownHandle &&
      !host.isHandleDragging &&
      !host.isPlaneDragging &&
      (event.buttons & 1) === 1
    ) {
      const dx = event.clientX - host.pointerDownClient.x;
      const dy = event.clientY - host.pointerDownClient.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.isMarqueeSelecting = true;
        this.marqueeStartX = host.pointerDownClient.x;
        this.marqueeStartY = host.pointerDownClient.y;
        if (host.controls) host.controls.enabled = false;
        this.createMarqueeEl();
        this.updateMarqueeRect(event);
        return;
      }
    }

    // ── Chamfer mode hover: highlight nearest edge ─────────────────────
    if (!host.isHandleDragging && !host.isPlaneDragging && host.chamferMode.isActive()) {
      const meshes = host.getSelectableMeshes();
      const hits = host.raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        host.chamferMode.updateHover(hits[0].object, hits[0].point);
        if (host.containerEl) host.containerEl.style.cursor = 'crosshair';
      } else {
        host.chamferMode.updateHover(null, null);
        if (host.containerEl) host.containerEl.style.cursor = '';
      }
    }

    // ── Alignment marker hover (screen-space distance) ─────────────────
    if (!host.isHandleDragging && !host.isPlaneDragging && host.alignmentMode.isActive() && host.camera && host.containerEl) {
      const alignMarkers = host.alignmentMode.getMarkers();
      const hitRadius = 14; // px
      let closest: THREE.Mesh | null = null;
      let closestDist = hitRadius;
      const wp = new THREE.Vector3();
      const rect = host.containerEl.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      for (const marker of alignMarkers) {
        marker.getWorldPosition(wp);
        wp.project(host.camera);
        const sx = (wp.x * 0.5 + 0.5) * rect.width;
        const sy = (-wp.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < closestDist) {
          closestDist = d;
          closest = marker;
        }
      }
      host.alignmentMode.setHovered(closest);
      if (closest) host.containerEl.style.cursor = 'pointer';
    } else if (host.alignmentMode.isActive()) {
      host.alignmentMode.setHovered(null);
    }

    // ── Handle hover highlight ────────────────────────────────────────────
    if (!host.isHandleDragging && !host.isPlaneDragging && host.modificationGizmo?.getTarget()) {
      host.modificationGizmo.updateMatrixWorldForHandles();
      const handleHits = host.raycaster.intersectObjects(host.modificationGizmo.getHandles(), false);
      const hovered = handleHits.length > 0 ? (handleHits[0].object as HandleMesh) : null;
      host.modificationGizmo.setHovered(hovered);
    }

    // ── Mirror handle hover highlight ─────────────────────────────────────
    const mg = host.mirrorMode.getGizmo();
    if (!host.isHandleDragging && !host.isPlaneDragging && host.mirrorMode.isActive() && mg?.isVisible()) {
      mg.updateMatrixWorld();
      const mirrorHits = host.raycaster.intersectObjects(mg.getHandles());
      const hovered = mirrorHits.length > 0 ? (mirrorHits[0].object as MirrorHandleMesh) : null;
      mg.setHovered(hovered);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const host = this.host;
    if (!host.renderer) return;

    // Middle button release: stop camera cruise
    if (event.button === 1) {
      this.middleDragging = false;
      return;
    }

    if (event.button !== 0) return;

    if (host.isHandleDragging) {
      const ds = host.handleDragState;
      const wasRotation = ds?.handleType?.startsWith('rotate');
      const rotNode = ds?.node ?? null;
      // Hide rotation sector
      if (wasRotation && host.modificationGizmo && ds?.handleType) {
        host.modificationGizmo.hideRotationSector(
          ds.handleType as import('../ModificationGizmo').HandleType
        );
      }
      // Откат «дрифта отпускания»: если в последний кадр snap стал крупнее
      // (курсор увёл в зону с большим шагом), последний snappedTarget мог
      // схлопнуть накрученный угол в 0. Применяем предпоследний target —
      // то значение, которое пользователь видел перед отпусканием.
      if (
        wasRotation && rotNode && ds &&
        ds.rotationLastSnapDeg !== undefined &&
        ds.rotationPrevSnapDeg !== undefined &&
        ds.rotationPrevTarget !== undefined &&
        ds.rotationLastSnapDeg > ds.rotationPrevSnapDeg
      ) {
        host.applyHandleDragDelta(rotNode, ds.handleType, ds.rotationPrevTarget, 0);
      }
      host.isHandleDragging = false;
      host.handleDragState = null;
      host.pointerDownHandle = null;
      if (host.controls) host.controls.enabled = true;
      if (wasRotation && rotNode) {
        host.bakeRotationIntoDimensions(rotNode);
      }
      host.options.onAfterDrag?.();
      return;
    }

    if (host.isPlaneDragging) {
      host.isPlaneDragging = false;
      if (host.controls) host.controls.enabled = true;
      host.dragTarget = null;
      host.pointerDownHit = null;
      host.clearCruiseGuides();
      host.updateGizmoTarget();
      host.options.onAfterDrag?.();
      return;
    }

    if (this.isMarqueeSelecting) {
      this.finishMarquee();
      if (host.controls) host.controls.enabled = true;
      host.pointerDownHit = null;
      host.pointerDownHandle = null;
      return;
    }

    const isCanvasRelease = host.renderer.domElement && event.target === host.renderer.domElement;
    if (isCanvasRelease) {
      const dx = event.clientX - host.pointerDownClient.x;
      const dy = event.clientY - host.pointerDownClient.y;
      const isClick = Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD;

      if (host.pointerDownHandle) {
        host.pointerDownHandle = null;
      } else if (host.pointerDownHit && isClick) {
        const target = resolveSelectableTarget(host.pointerDownHit.object);
        const node = (target.userData as { node?: ModelNode }).node;
        if (node && host.options.onSelectNodeFromScene) {
          host.options.onSelectNodeFromScene(node, { shift: host.pointerDownShift });
        }
      } else if (!host.pointerDownHit && isClick) {
        host.options.onDeselectAll?.();
      }
      event.stopPropagation();
    }
    host.pointerDownHit = null;
    host.pointerDownHandle = null;
  };

  // ── Marquee helpers ──────────────────────────────────────────────────

  private createMarqueeEl(): void {
    if (this.marqueeEl) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;border:2px dashed red;pointer-events:none;z-index:9999;box-sizing:border-box;';
    document.body.appendChild(el);
    this.marqueeEl = el;
  }

  private lastMarqueeX = 0;
  private lastMarqueeY = 0;

  private updateMarqueeRect(event: PointerEvent): void {
    this.lastMarqueeX = event.clientX;
    this.lastMarqueeY = event.clientY;
    if (!this.marqueeEl) return;
    const x1 = Math.min(this.marqueeStartX, event.clientX);
    const y1 = Math.min(this.marqueeStartY, event.clientY);
    const x2 = Math.max(this.marqueeStartX, event.clientX);
    const y2 = Math.max(this.marqueeStartY, event.clientY);
    this.marqueeEl.style.left = x1 + 'px';
    this.marqueeEl.style.top = y1 + 'px';
    this.marqueeEl.style.width = (x2 - x1) + 'px';
    this.marqueeEl.style.height = (y2 - y1) + 'px';
  }

  private finishMarquee(): void {
    this.isMarqueeSelecting = false;
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
    this.collectMarqueeNodes();
  }

  private collectMarqueeNodes(): void {
    const host = this.host;
    if (!host.camera || !host.containerEl) return;

    const rect = host.containerEl.getBoundingClientRect();
    const mx1 = Math.min(this.marqueeStartX, this.lastMarqueeX) - rect.left;
    const my1 = Math.min(this.marqueeStartY, this.lastMarqueeY) - rect.top;
    const mx2 = Math.max(this.marqueeStartX, this.lastMarqueeX) - rect.left;
    const my2 = Math.max(this.marqueeStartY, this.lastMarqueeY) - rect.top;

    const meshes = host.getSelectableMeshes();
    const camera = host.camera;
    const w = rect.width;
    const h = rect.height;

    const selected: ModelNode[] = [];
    const wp = new THREE.Vector3();

    for (const mesh of meshes) {
      // Project mesh center to screen
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      box.getCenter(wp);
      wp.project(camera);

      const sx = (wp.x * 0.5 + 0.5) * w;
      const sy = (-wp.y * 0.5 + 0.5) * h;

      if (sx >= mx1 && sx <= mx2 && sy >= my1 && sy <= my2) {
        const node = (mesh.userData as { node?: ModelNode }).node;
        if (node && !selected.includes(node)) {
          selected.push(node);
        }
      }
    }

    if (selected.length > 0) {
      host.options.onMarqueeSelect?.(selected);
    } else {
      host.options.onDeselectAll?.();
    }
  }
}
