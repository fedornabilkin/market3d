import { Command } from '../../commands/Command';
import type { FeatureDocument } from '../FeatureDocument';
import type { FeatureDocumentJSON } from '../types';

/**
 * Snapshot-based undo/redo для FeatureDocument.
 *
 * Хранит before/after JSON целиком (FeatureDocumentJSON v2). На undo/redo
 * восстанавливает состояние через `FeatureDocument.loadFromJSON`
 * (in-place restore с сохранением подписок; renderer реагирует на события
 * документа автоматически).
 *
 * execute() — no-op: мутация уже произошла к моменту push в HistoryManager
 * (HistoryManager.push сам зовёт execute).
 */
export class FeatureSnapshotCommand extends Command {
  constructor(
    private readonly beforeJSON: FeatureDocumentJSON,
    private readonly afterJSON: FeatureDocumentJSON,
    private readonly target: FeatureDocument,
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
    this.target.loadFromJSON(json);
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
