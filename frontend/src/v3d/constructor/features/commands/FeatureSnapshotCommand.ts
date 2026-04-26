import { Command } from '../../commands/Command';
import type { FeatureDocument } from '../FeatureDocument';
import type { FeatureDocumentJSON } from '../types';

/**
 * Snapshot-based undo/redo для FeatureDocument.
 *
 * Хранит before/after JSON целиком (FeatureDocumentJSON v2). На undo/redo
 * восстанавливает состояние через `target`:
 *  - Если `target` — `FeatureDocument`, вызывается `target.loadFromJSON`
 *    (in-place restore с подписками, sceneRender реагирует автоматом).
 *  - Если `target` — функция `(json) => void`, вызывается она. Этот режим
 *    используется в Phase 1 cutover'е: ModelNode-tree остаётся primary
 *    in-memory, callback derive'ит его из featureDoc-JSON через
 *    featureDocumentToLegacy и triggers rebuildSceneFromTree.
 *
 * execute() — no-op: мутация уже произошла к моменту push в HistoryManager
 * (HistoryManager.push сам зовёт execute).
 */
export class FeatureSnapshotCommand extends Command {
  constructor(
    private readonly beforeJSON: FeatureDocumentJSON,
    private readonly afterJSON: FeatureDocumentJSON,
    private readonly target: FeatureDocument | ((json: FeatureDocumentJSON) => void),
  ) {
    super();
  }

  execute(): void {}

  undo(): void {
    this.applyTarget(this.beforeJSON);
  }

  redo(): void {
    this.applyTarget(this.afterJSON);
  }

  private applyTarget(json: FeatureDocumentJSON): void {
    if (typeof this.target === 'function') this.target(json);
    else this.target.loadFromJSON(json);
  }
}

/**
 * Утилитный helper «оборачиваем мутацию снапшотом».
 *   const cmd = withSnapshot(doc, () => { doc.updateParams(id, { width: 20 }); });
 *   history.push(cmd);
 * Захватывает before-снапшот, выполняет mutation, захватывает after.
 */
export function captureSnapshot(
  doc: FeatureDocument,
  mutation: () => void,
): FeatureSnapshotCommand {
  const before = doc.toJSON();
  mutation();
  const after = doc.toJSON();
  return new FeatureSnapshotCommand(before, after, doc);
}
