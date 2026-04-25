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

  /** Кэш материалов: одинаковые color+isHole переиспользуются. */
  private materialCache = new Map<string, THREE.MeshPhongMaterial>();

  constructor(rootGroup: THREE.Group) {
    this.rootGroup = rootGroup;
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
    for (const mat of this.materialCache.values()) mat.dispose();
    this.materialCache.clear();
  }

  // ─── Internal ──────────────────────────────────────────────

  private handleEvent(event: FeatureDocumentEvent): void {
    if (!this.document) return;

    if (event.type === 'recompute-done') {
      // Собираем ids с обновлёнными outputs + всех корней (на случай, если
      // изменилась roots-композиция). Точечно перерисовываем только их под-графы.
      const updated = new Set(event.featureIds ?? []);
      // Для простоты Шага 1.5: если обновился любой узел, переинициализируем
      // ВСЕХ корней, чьи поддеревья пересекаются с updated. На практике обычно
      // это просто все root'ы — затраты приемлемы для типичных размеров сцен.
      // Targeted-update в один меш — оптимизация Шага 1.5+.
      this.fullRebuild();
      void updated; // отметим, что use не нужен сейчас
      return;
    }

    if (event.type === 'feature-removed') {
      for (const id of event.featureIds ?? []) {
        this.removeObjectByFeatureId(id);
      }
      return;
    }
  }

  /** Полная пересборка: чистим сцену и строим все корни. */
  private fullRebuild(): void {
    this.clearScene();
    if (!this.document) return;
    for (const id of this.document.rootIds) {
      const output = this.document.getOutput(id);
      if (!output) continue;
      const obj = this.buildSceneObjectFromOutput(output, id);
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
   */
  private buildSceneObjectFromOutput(
    output: FeatureOutput,
    featureId: FeatureId,
  ): THREE.Object3D | null {
    if (output.kind === 'leaf') {
      return this.buildLeaf(output, featureId);
    }
    return this.buildComposite(output, featureId);
  }

  private buildLeaf(output: LeafOutput, featureId: FeatureId): THREE.Mesh {
    const material = this.getMaterial(output.color, output.isHole);
    const mesh = new THREE.Mesh(output.geometry, material);

    // Применяем transform фичи к мешу.
    output.transform.decompose(mesh.position, mesh.quaternion, mesh.scale);

    // userData для обратной связи 3d → feature и для безопасного dispose.
    mesh.userData.featureId = featureId;
    if (output.sharedGeometry) mesh.userData.sharedGeometry = true;
    return mesh;
  }

  private buildComposite(output: CompositeOutput, featureId: FeatureId): THREE.Group {
    const group = new THREE.Group();
    output.transform.decompose(group.position, group.quaternion, group.scale);
    group.userData.featureId = featureId;
    // Маркер для PointerEventController: клик по любому ребёнку выделяет
    // эту группу целиком, как у legacy union-merged групп.
    group.userData.selectAsUnit = true;

    for (let i = 0; i < output.children.length; i++) {
      // У детей нет своего featureId на этом уровне (они часть композита) —
      // даём им синтезированный id «<parent>:<index>», чтобы хотя бы dispose
      // и select-traversal работали. Для прямой адресации фич лучше использовать
      // отдельные feature-id на детях через rootIds.
      const childObj = this.buildSceneObjectFromOutput(output.children[i], `${featureId}:${i}`);
      if (childObj) group.add(childObj);
    }

    // Если контейнер сам помечен как hole — применяем zebra-style ко всем
    // дочерним мешам (как у legacy GroupNode рендера).
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
    const key = `${color ?? 'default'}|${isHole ? '1' : '0'}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;

    const mat = new THREE.MeshPhongMaterial({
      color: color ? new THREE.Color(color) : 0x00a5a4,
      shininess: 30,
      specular: 0x444444,
    });
    if (isHole) applyHoleStyle(mat);
    this.materialCache.set(key, mat);
    return mat;
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Шаренные геометрии (ImportedMesh) не диспозим — переиспользуются между
        // билдами; материалы кэшируются в materialCache, тоже не диспозим тут.
        const shared = (child.userData as { sharedGeometry?: boolean }).sharedGeometry;
        if (!shared) child.geometry?.dispose();
      } else if (child instanceof THREE.LineSegments) {
        child.geometry?.dispose();
        (child.material as THREE.Material | undefined)?.dispose();
      }
    });
  }
}
