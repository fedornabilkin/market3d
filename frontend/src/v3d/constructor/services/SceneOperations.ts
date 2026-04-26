import type { BufferGeometry } from 'three';
import type { ModelNode } from '../nodes/ModelNode';
import { GroupNode } from '../nodes/GroupNode';
import type { PrimitiveType } from '../types';
import type { FeatureFactory } from './FeatureFactory';

/**
 * Контекст, который SceneOperations требует от хост-компонента
 * (Constructor.vue). Изолирует facade от Vue-реактивности и DOM —
 * передаём колбэки.
 */
export interface SceneOperationsContext {
  /** Корень текущего дерева. Должен быть `GroupNode`. */
  getRoot(): ModelNode | null;
  /** Найти родителя ноды в дереве для удаления/индексации. */
  getParentOf(target: ModelNode): GroupNode | null;
  /** Перерисовать сцену после мутации. */
  rebuildSceneFromTree(): void;
  /**
   * Обернуть мутацию в history-snapshot. Если undefined — мутация
   * выполняется без записи в историю (для внутренних/init операций).
   */
  withHistory?: (mutate: () => void) => void;
}

/**
 * Facade над высокоуровневыми мутациями сцены. Скрывает:
 *  - детали добавления в `root.children` (legacy ModelNode-tree),
 *  - оборачивание в history,
 *  - вызов rebuildSceneFromTree после мутации.
 *
 * Зачем нужен: каждое из этих действий повторяется в Constructor.vue
 * по 5+ раз с одинаковой структурой. Facade — single source of intent;
 * после P2-prep-2/3 source-of-truth flip эти методы перепишутся изнутри
 * (на FeatureDocument API), но сигнатуры останутся — caller'ы не меняются.
 *
 * Pattern: **Facade** + использует **Factory** (`FeatureFactory`).
 */
export class SceneOperations {
  constructor(
    private readonly factory: FeatureFactory,
    private readonly ctx: SceneOperationsContext,
  ) {}

  /**
   * Добавляет примитив выбранного типа в корень сцены.
   * Возвращает созданную ноду — caller обычно её селектит.
   */
  addPrimitive(type: PrimitiveType): ModelNode | null {
    const root = this.ctx.getRoot();
    if (!(root instanceof GroupNode)) return null;
    const node = this.factory.createPrimitive(type);
    this.runWithHistory(() => {
      root.children.push(node);
    });
    this.ctx.rebuildSceneFromTree();
    return node;
  }

  /**
   * Добавляет ImportedMesh-ноду из подготовленного BufferGeometry.
   * Caller-и (STL-import handler) уже распарсили STL → geometry +
   * сохранили binary в IDB → передают `binaryRef`.
   */
  addImportedMesh(
    filename: string,
    geometry: BufferGeometry,
    opts: { binaryRef?: string; stlBase64?: string; color?: string } = {},
  ): ModelNode | null {
    const root = this.ctx.getRoot();
    if (!(root instanceof GroupNode)) return null;
    const node = this.factory.createImportedMesh(filename, geometry, opts);
    this.runWithHistory(() => {
      root.children.push(node);
    });
    this.ctx.rebuildSceneFromTree();
    return node;
  }

  /**
   * Удаляет ноду из дерева. Вернёт false, если ноду удалить нельзя
   * (нет родителя, она и есть root, или uuid не совпадает).
   */
  removeNode(node: ModelNode): boolean {
    const parent = this.ctx.getParentOf(node);
    if (!(parent instanceof GroupNode)) return false;
    const idx = node.uuidMesh
      ? parent.children.findIndex((c) => c.uuidMesh === node.uuidMesh)
      : parent.children.indexOf(node);
    if (idx === -1) return false;
    this.runWithHistory(() => {
      parent.children.splice(idx, 1);
    });
    this.ctx.rebuildSceneFromTree();
    return true;
  }

  /**
   * Дублирует ноду в той же группе, сразу после оригинала. Возвращает
   * клон. Используется в Ctrl+D и smart-duplicate.
   */
  duplicateNode(node: ModelNode): ModelNode | null {
    const parent = this.ctx.getParentOf(node);
    if (!(parent instanceof GroupNode)) return null;
    const idx = node.uuidMesh
      ? parent.children.findIndex((c) => c.uuidMesh === node.uuidMesh)
      : parent.children.indexOf(node);
    if (idx === -1) return null;
    const cloned = this.factory.cloneNode(node);
    this.runWithHistory(() => {
      parent.children.splice(idx + 1, 0, cloned);
    });
    this.ctx.rebuildSceneFromTree();
    return cloned;
  }

  private runWithHistory(mutate: () => void): void {
    if (this.ctx.withHistory) this.ctx.withHistory(mutate);
    else mutate();
  }
}
