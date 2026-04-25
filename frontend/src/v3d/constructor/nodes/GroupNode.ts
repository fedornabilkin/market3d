import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import type { CSGType } from '../types';
import type { ModelMemento } from '../memento/ModelMemento';
import type { GroupNodeJSON } from '../types';
import { ModelNode } from './ModelNode';
import type { ExportProgressCallback } from './ModelNode';
import { ModelMemento as ModelMementoClass } from '../memento/ModelMemento';

/**
 * Composite node: holds children and applies CSG operation to produce a merged mesh.
 *
 * CSG использовалась три-csg-ts, но на сложных сценах (вложенные группы с
 * множеством holes + non-uniform scale + rotation) BSP-классификация давала
 * артефакты — subtract'ы в областях уже-пробитых полостей отрабатывали как
 * union. Перешли на three-bvh-csg (manifold-friendly, BVH-ускорение) — он
 * устойчив к коплоскостным и пересекающимся операциям.
 *
 * В рантайме CSG вызывается только для групп с operation≠union ИЛИ наличием
 * hole-детей (см. ConstructorSceneService.buildNodeObject3D). Для обычных
 * union-групп без holes — дети просто кладутся в THREE.Group без CSG.
 * Экспорт в STL/OBJ всегда идёт через полный CSG (ModelExporter).
 *
 * Per-child isHole logic:
 *   - Children with params.isHole === true are always subtracted from the result.
 *   - Non-hole children are combined using the group's operation.
 *   - A GroupNode with params.isHole === true signals that the whole group
 *     should be treated as a void by its parent.
 */
export class GroupNode extends ModelNode {
  override children: ModelNode[] = [];
  override operation: CSGType = 'union';

  override clone(): GroupNode {
    const node = new GroupNode();
    node.operation = this.operation;
    node.name = this.name;
    node.children = this.children.map((c) => c.clone());
    if (this.params && Object.keys(this.params).length > 0) {
      node.params = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
        color: this.params.color,
        isHole: this.params.isHole,
      };
    }
    return node;
  }

  getMesh(): THREE.Mesh {
    const defaultMaterial = this.buildDefaultMaterial();

    if (this.children.length === 0) {
      return this.emptyResult(defaultMaterial);
    }

    const solidChildren = this.children.filter((c) => !c.params?.isHole);
    const holeChildren = this.children.filter((c) => !!c.params?.isHole);

    if (solidChildren.length === 0) {
      return this.emptyResult(defaultMaterial);
    }

    let result: THREE.Mesh;
    try {
      const evaluator = new Evaluator();
      evaluator.useGroups = false;

      let current: Brush = GroupNode.meshToBrush(solidChildren[0].getMesh());

      // Phase 1: combine solids using the group's operation.
      for (let i = 1; i < solidChildren.length; i++) {
        const next = GroupNode.meshToBrush(solidChildren[i].getMesh());
        current = evaluator.evaluate(current, next, GroupNode.bvhOp(this.operation));
      }

      // Phase 2: subtract each hole from the combined solid.
      for (const holeChild of holeChildren) {
        const holeBrush = GroupNode.meshToBrush(holeChild.getMesh());
        current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
      }

      result = GroupNode.finalizeBrush(current, defaultMaterial);
    } catch (e) {
      console.warn('[GroupNode] BVH CSG operation failed:', e);
      result = GroupNode.meshToBrush(solidChildren[0].getMesh());
      result.material = defaultMaterial;
    }

    this.applyParamsToMesh(result);
    return result;
  }

  override countCSGOperations(): number {
    let count = 0;
    for (const child of this.children) {
      count += child.countCSGOperations();
    }
    const solidCount = this.children.filter((c) => !c.params?.isHole).length;
    const holeCount = this.children.filter((c) => !!c.params?.isHole).length;
    if (solidCount > 1 || holeCount > 0) {
      count += Math.max(0, solidCount - 1) + holeCount;
    }
    return count;
  }

  /**
   * Async version that yields between CSG operations so the UI can repaint.
   * Uses a shared counter object to track progress across the recursive tree.
   */
  override async getMeshAsync(
    onProgress?: ExportProgressCallback,
    _counter?: { done: number; total: number },
  ): Promise<THREE.Mesh> {
    const defaultMaterial = this.buildDefaultMaterial();

    if (this.children.length === 0) {
      return this.emptyResult(defaultMaterial);
    }

    const solidChildren = this.children.filter((c) => !c.params?.isHole);
    const holeChildren = this.children.filter((c) => !!c.params?.isHole);

    if (solidChildren.length === 0) {
      return this.emptyResult(defaultMaterial);
    }

    const solidMeshes: THREE.Mesh[] = [];
    for (const child of solidChildren) {
      solidMeshes.push(await child.getMeshAsync(onProgress, _counter));
    }

    let result: THREE.Mesh;
    try {
      const evaluator = new Evaluator();
      evaluator.useGroups = false;

      let current: Brush = GroupNode.meshToBrush(solidMeshes[0]);

      for (let i = 1; i < solidMeshes.length; i++) {
        await new Promise((r) => setTimeout(r, 0));
        const next = GroupNode.meshToBrush(solidMeshes[i]);
        current = evaluator.evaluate(current, next, GroupNode.bvhOp(this.operation));
        if (_counter && onProgress) {
          _counter.done++;
          onProgress(_counter.done, _counter.total);
        }
      }

      for (const holeChild of holeChildren) {
        await new Promise((r) => setTimeout(r, 0));
        const holeMesh = await holeChild.getMeshAsync(onProgress, _counter);
        const holeBrush = GroupNode.meshToBrush(holeMesh);
        current = evaluator.evaluate(current, holeBrush, SUBTRACTION);
        if (_counter && onProgress) {
          _counter.done++;
          onProgress(_counter.done, _counter.total);
        }
      }

      result = GroupNode.finalizeBrush(current, defaultMaterial);
    } catch (e) {
      console.warn('[GroupNode] BVH CSG operation failed:', e);
      result = GroupNode.meshToBrush(solidMeshes[0]);
      result.material = defaultMaterial;
    }

    this.applyParamsToMesh(result);
    return result;
  }

  /** Дефолтный phong-материал для финального меша группы. */
  private buildDefaultMaterial(): THREE.MeshPhongMaterial {
    const groupColor = this.params?.color as string | undefined;
    return new THREE.MeshPhongMaterial({
      color: groupColor ? new THREE.Color(groupColor) : 0x00a5a4,
      shininess: 30,
      specular: 0x444444,
    });
  }

  /** Пустой результирующий меш (для групп без детей или только с holes). */
  private emptyResult(material: THREE.Material): THREE.Mesh {
    const empty = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.applyParamsToMesh(empty);
    return empty;
  }

  private static bvhOp(op: CSGType): number {
    if (op === 'subtract') return SUBTRACTION;
    if (op === 'intersect') return INTERSECTION;
    return ADDITION;
  }

  /**
   * Готовит геометрию для three-bvh-csg: оставляет только position/normal/uv,
   * склеивает совпадающие вершины (1e-5) — получаем индексированный манифолд.
   */
  private static prepGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let g = geometry.clone();
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    g = BufferGeometryUtils.mergeVertices(g, 1e-5);
    g.computeVertexNormals();
    return g;
  }

  /**
   * Запекает локальный transform меша в геометрию и оборачивает в Brush с
   * identity-трансформом. three-bvh-csg тогда оперирует только в мировом
   * пространстве вершин — никаких подводных камней с rotation+non-uniform scale.
   *
   * При det(matrix)<0 (mirror через отрицательный scale) triangle winding
   * после applyMatrix4 оказывается перевёрнутым. Флипаем индексы ДО
   * computeVertexNormals, иначе нормали посчитаются внутрь → CSG примет меш
   * за inside-out и subtract отработает как union.
   */
  private static meshToBrush(mesh: THREE.Mesh): Brush {
    mesh.updateMatrix();
    const geom = GroupNode.prepGeometry(mesh.geometry as THREE.BufferGeometry);
    if (!GroupNode.isIdentityMatrix(mesh.matrix)) {
      geom.applyMatrix4(mesh.matrix);
      if (mesh.matrix.determinant() < 0) GroupNode.flipWinding(geom);
      geom.computeVertexNormals();
    }
    const brush = new Brush(geom);
    brush.updateMatrixWorld();
    return brush;
  }

  /** Переворачивает порядок вершин в каждом треугольнике индексированной геометрии. */
  private static flipWinding(geom: THREE.BufferGeometry): void {
    const idx = geom.getIndex();
    if (idx) {
      const arr = idx.array as Uint16Array | Uint32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i];
        arr[i] = arr[i + 2];
        arr[i + 2] = t;
      }
      idx.needsUpdate = true;
    } else {
      const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (pos) {
        const a = pos.array as Float32Array;
        for (let i = 0; i < a.length; i += 9) {
          for (let j = 0; j < 3; j++) {
            const t = a[i + j];
            a[i + j] = a[i + 6 + j];
            a[i + 6 + j] = t;
          }
        }
        pos.needsUpdate = true;
      }
    }
  }

  /**
   * Доводит результат CSG до обычного THREE.Mesh: сшивает вершины (после
   * boolean-ов часто остаются почти совпадающие точки), перечитывает нормали.
   */
  private static finalizeBrush(brush: Brush, material: THREE.Material): THREE.Mesh {
    const finalGeom = BufferGeometryUtils.mergeVertices(brush.geometry, 1e-4);
    finalGeom.computeVertexNormals();
    return new THREE.Mesh(finalGeom, material);
  }

  private static isIdentityMatrix(m: THREE.Matrix4): boolean {
    const e = m.elements;
    return (
      e[0] === 1 && e[5] === 1 && e[10] === 1 && e[15] === 1 &&
      e[1] === 0 && e[2] === 0 && e[3] === 0 &&
      e[4] === 0 && e[6] === 0 && e[7] === 0 &&
      e[8] === 0 && e[9] === 0 && e[11] === 0 &&
      e[12] === 0 && e[13] === 0 && e[14] === 0
    );
  }

  private applyParamsToMesh(mesh: THREE.Mesh): void {
    const { position, scale, rotation } = this.params;
    if (position) {
      mesh.position.set(position.x, position.y, position.z);
    }
    if (scale) {
      mesh.scale.set(scale.x, scale.y, scale.z);
    }
    if (rotation) {
      mesh.rotation.set(
        rotation.x,
        rotation.y,
        rotation.z,
        (rotation.order as THREE.Euler['order']) ?? 'XYZ'
      );
    }
  }

  getMemento(): ModelMemento {
    const treeState: GroupNodeJSON = {
      kind: 'group',
      operation: this.operation,
      children: this.children.map((c) => c.getMemento().getState()),
    };
    if (this.name) treeState.name = this.name;
    if (this.params && Object.keys(this.params).length > 0) {
      treeState.nodeParams = {
        position: this.params.position && { ...this.params.position },
        scale: this.params.scale && { ...this.params.scale },
        rotation: this.params.rotation && { ...this.params.rotation },
        color: this.params.color,
        isHole: this.params.isHole,
      };
    }
    return new ModelMementoClass(treeState);
  }
}
