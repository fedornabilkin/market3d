import * as THREE from 'three';
import type { Feature } from '../Feature';
import type { FeatureDocument, FeatureDocumentEvent } from '../FeatureDocument';
import type { FeatureId, FeatureOutput, LeafOutput, CompositeOutput } from '../types';
import { applyHoleStyle } from '../../holeMaterial';

/**
 * Рендер-слой: связывает FeatureDocument с three.js-сценой.
 *
 * Подписывается на события FeatureDocument (recompute-done, feature-removed),
 * и для каждого root-id строит/обновляет соответствующий THREE.Object3D в
 * `rootGroup`. Узлы хранятся в `objectsByFeatureId` для targeted-обновлений.
 *
 * Принципы:
 *  - Параллельный legacy-пути ConstructorSceneService.buildNodeObject3D —
 *    оба могут сосуществовать (этот слой работает на feature-document'ах,
 *    legacy — на ModelNode-tree).
 *  - Targeted update: при изменении одной фичи пересобираем только её
 *    под-граф в сцене, не всё.
 *  - userData.featureId на каждом меше → раскрутка обратно из 3d-объекта в
 *    феичу (для drag-handle, click-select и т.п.).
 *
 * Использование:
 *   const renderer = new FeatureRenderer(rootGroup);
 *   renderer.bindDocument(featureDocument);
 *   // ... документ эмитит recompute-done — рендер обновляет сцену.
 *   renderer.dispose();
 */
export class FeatureRenderer {
  private rootGroup: THREE.Group;
  /** id фичи → корневой three.js объект в сцене */
  private objectsByFeatureId = new Map<FeatureId, THREE.Object3D>();
  private document: FeatureDocument | null = null;
  private unsubscribe: (() => void) | null = null;

  /**
   * Все материалы — per-mesh, без шаринга. Шаринг ломал updateNodeMaterial
   * (изменение цвета одного меша протекало на соседей с тем же цветом).
   * Стоимость: ~30 материалов на типичную сцену = десятки микросекунд.
   */

  /** Общий материал для edge-lines всех мешей. */
  private static edgeLineMaterial = new THREE.LineBasicMaterial({
    color: 0x222222,
    transparent: true,
    opacity: 0.25,
  });

  constructor(rootGroup: THREE.Group) {
    this.rootGroup = rootGroup;
  }

  /** Тёмная обводка рёбер на меше (порог 20°). Не перехватывает raycast. */
  private static addEdgeLines(mesh: THREE.Mesh): void {
    const existing = mesh.children.filter((c) => c.userData.isEdgeLine);
    for (const c of existing) {
      (c as THREE.LineSegments).geometry.dispose();
      mesh.remove(c);
    }
    const edges = new THREE.EdgesGeometry(mesh.geometry, 20);
    const lines = new THREE.LineSegments(edges, FeatureRenderer.edgeLineMaterial);
    lines.userData.isEdgeLine = true;
    lines.raycast = () => {};
    lines.matrixAutoUpdate = false;
    lines.updateMatrix();
    mesh.add(lines);
  }

  /**
   * Подключиться к документу: подписаться на события и сделать первичный
   * рендер всех корневых фич. Если уже подключён к другому — отписывается.
   */
  bindDocument(doc: FeatureDocument): void {
    this.unbindDocument();
    this.document = doc;
    this.unsubscribe = doc.subscribe((event) => this.handleEvent(event));
    this.fullRebuild();
  }

  unbindDocument(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.document = null;
    this.clearScene();
  }

  /** Найти feature по three.js объекту (для click/select). */
  findFeatureIdByObject(obj: THREE.Object3D): FeatureId | undefined {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const fid = (cur.userData as { featureId?: FeatureId }).featureId;
      if (fid !== undefined) return fid;
      cur = cur.parent;
    }
    return undefined;
  }

  /** three.js объект для feature-id (для гизмо, drag-target). */
  getObject3D(id: FeatureId): THREE.Object3D | undefined {
    return this.objectsByFeatureId.get(id);
  }

  dispose(): void {
    this.unbindDocument();
  }

  // ─── Internal ──────────────────────────────────────────────

  private handleEvent(event: FeatureDocumentEvent): void {
    if (!this.document) return;

    if (event.type === 'recompute-done') {
      // Полная пересборка корней — простая и предсказуемая стратегия для
      // структурных мутаций (add/remove/updateInputs или полный updateParams).
      // High-frequency путь идёт через `feature-updated` (см. ниже).
      this.fullRebuild();
      return;
    }

    if (event.type === 'feature-updated') {
      // Live targeted-update от FeatureDocument.updateParamsLive: меняем
      // только transform у уже существующих мешей, БЕЗ полной пересборки
      // и без re-create геометрии. Caller гарантирует, что изменился только
      // transform (для геометрических правок нужен полный updateParams).
      for (const id of event.featureIds ?? []) {
        this.applyLiveUpdate(id);
      }
      return;
    }

    if (event.type === 'feature-removed') {
      for (const id of event.featureIds ?? []) {
        this.removeObjectByFeatureId(id);
      }
      return;
    }
  }

  /**
   * Targeted live-update: получает свежий FeatureOutput из graph.cachedOutputs
   * (его обновил `recomputeOne` внутри updateParamsLive) и пересчитывает
   * transform у соответствующего THREE.Object3D — без disposal'а / rebuild'а
   * меша.
   *
   * Пропускает фичи, не входящие в rootIds (их меши не существуют как
   * top-level Object3D). На практике для drag-handles обновляется именно
   * корневая Transform-фича, и она в rootIds.
   */
  private applyLiveUpdate(featureId: FeatureId): void {
    if (!this.document) return;
    const obj = this.objectsByFeatureId.get(featureId);
    if (!obj) return;
    const output = this.document.getOutput(featureId);
    if (!output) return;
    output.transform.decompose(obj.position, obj.quaternion, obj.scale);
    if (output.kind === 'leaf' && output.bottomAnchorOffsetZ) {
      obj.position.z += output.bottomAnchorOffsetZ;
    }
    obj.updateMatrixWorld(true);
  }

  /** Полная пересборка: чистим сцену и строим все корни. */
  private fullRebuild(): void {
    this.clearScene();
    if (!this.document) return;
    for (const id of this.document.rootIds) {
      const output = this.document.getOutput(id);
      if (!output) continue;
      const obj = this.buildSceneObjectFromOutput(output, id, true);
      if (obj) {
        this.objectsByFeatureId.set(id, obj);
        this.rootGroup.add(obj);
      }
    }
  }

  private clearScene(): void {
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children[0];
      this.rootGroup.remove(child);
      this.disposeObject(child);
    }
    this.objectsByFeatureId.clear();
  }

  private removeObjectByFeatureId(id: FeatureId): void {
    const obj = this.objectsByFeatureId.get(id);
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    this.disposeObject(obj);
    this.objectsByFeatureId.delete(id);
  }

  /**
   * Превращает FeatureOutput в three.js Object3D.
   * Leaf → THREE.Mesh с применённым transform.
   * Composite → THREE.Group с рекурсивно построенными детьми + selectAsUnit.
   *
   * @param isRoot — `true` для top-level выходов из rootIds. Для root-композита
   *                selectAsUnit НЕ выставляется (как в legacy: клик по ребёнку
   *                root-группы выделяет ребёнка, а не всю сцену).
   */
  private buildSceneObjectFromOutput(
    output: FeatureOutput,
    featureId: FeatureId,
    isRoot = false,
  ): THREE.Object3D | null {
    if (output.kind === 'leaf') {
      return this.buildLeaf(output, featureId);
    }
    return this.buildComposite(output, featureId, isRoot);
  }

  private buildLeaf(output: LeafOutput, featureId: FeatureId): THREE.Mesh {
    const material = this.getMaterial(output.color, output.isHole);
    const mesh = new THREE.Mesh(output.geometry, material);

    // Применяем transform фичи к мешу.
    output.transform.decompose(mesh.position, mesh.quaternion, mesh.scale);
    // bottomAnchorOffsetZ — внешний Z-сдвиг СНАРУЖИ user-transform'а (legacy
    // applyParamsToMesh: `mesh.position.z = params.position.z + halfHeight`).
    // Применяется после decompose, чтобы быть в мировом Z (не вращается user
    // transform'ом). Для не-примитивных leaf (CSG-результат Boolean) — undefined,
    // там геометрия уже в мировой позиции после CSG-bake.
    if (output.bottomAnchorOffsetZ) {
      mesh.position.z += output.bottomAnchorOffsetZ;
    }

    // userData для обратной связи 3d → feature и для безопасного dispose.
    mesh.userData.featureId = featureId;
    if (output.sharedGeometry) mesh.userData.sharedGeometry = true;

    // Edge-lines: тёмная обводка рёбер с порогом угла 20°. Не интерактивны.
    // Синхронизация трансформа — через mesh.matrix (matrixAutoUpdate=false).
    FeatureRenderer.addEdgeLines(mesh);
    return mesh;
  }

  private buildComposite(output: CompositeOutput, featureId: FeatureId, isRoot = false): THREE.Group {
    const group = new THREE.Group();
    output.transform.decompose(group.position, group.quaternion, group.scale);
    group.userData.featureId = featureId;
    // Маркер для PointerEventController: клик по любому ребёнку выделяет
    // эту группу целиком, как у legacy union-merged групп. Для root-группы
    // НЕ выставляем — иначе клик по примитиву-ребёнку выделил бы всю сцену.
    if (!isRoot) group.userData.selectAsUnit = true;

    for (let i = 0; i < output.children.length; i++) {
      // Если у выхода ребёнка проставлен sourceFeatureId (визитор GroupFeature
      // его выставляет), используем его — тогда `userData.featureId` точно
      // ссылается на реальный node графа (нужно для селекшена и trace mapping
      // в render-cutover'е). Иначе — fallback на синтезированный id, как раньше.
      const child = output.children[i];
      const childId = child.sourceFeatureId ?? `${featureId}:${i}`;
      const childObj = this.buildSceneObjectFromOutput(child, childId);
      if (childObj) group.add(childObj);
    }

    // Пропагация цвета родителя на детей-меши, у которых нет своего цвета
    // (output.color === undefined). Совпадает с поведением
    // ConstructorSceneService.buildNodeObject3D: groupColor → дети без своего color.
    if (output.color) {
      const parentHexColor = output.color;
      const visit = (out: FeatureOutput, obj: THREE.Object3D): void => {
        if (out.kind === 'leaf' && !out.color && obj instanceof THREE.Mesh) {
          // Дочерний меш материала ещё не «знает» о родительском color — берём
          // материал с правильным колором из кэша (с учётом isHole).
          const newMat = this.getMaterial(parentHexColor, out.isHole);
          obj.material = newMat;
        } else if (out.kind === 'composite' && obj instanceof THREE.Group) {
          for (let i = 0; i < out.children.length && i < obj.children.length; i++) {
            visit(out.children[i], obj.children[i]);
          }
        }
      };
      for (let i = 0; i < output.children.length && i < group.children.length; i++) {
        visit(output.children[i], group.children[i]);
      }
    }

    // Если контейнер сам помечен как hole — применяем zebra-style ко всем
    // дочерним мешам (как у legacy GroupNode рендера). Материалы per-mesh
    // (без шаринга), мутировать безопасно.
    if (output.isHole) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          applyHoleStyle(child.material as THREE.MeshPhongMaterial);
        }
      });
    }

    return group;
  }

  private getMaterial(color: string | undefined, isHole: boolean): THREE.MeshPhongMaterial {
    const mat = new THREE.MeshPhongMaterial({
      color: color ? new THREE.Color(color) : 0x00a5a4,
      shininess: 30,
      specular: 0x444444,
    });
    if (isHole) applyHoleStyle(mat);
    return mat;
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Шаренные геометрии (ImportedMesh) не диспозим — переиспользуются
        // между билдами (живут в ImportedMeshNode/Feature).
        const shared = (child.userData as { sharedGeometry?: boolean }).sharedGeometry;
        if (!shared) child.geometry?.dispose();
        // Материалы per-mesh, без шаринга — диспозим всегда.
        (child.material as THREE.Material | undefined)?.dispose();
      } else if (child instanceof THREE.LineSegments) {
        // Edge-lines: геометрия per-mesh (диспозим), материал общий
        // (FeatureRenderer.edgeLineMaterial — НЕ диспозим, шарится).
        child.geometry?.dispose();
      }
    });
  }
}
