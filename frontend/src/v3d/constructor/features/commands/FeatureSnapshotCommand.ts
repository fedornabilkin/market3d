import { Command } from '../../commands/Command';
import type { FeatureDocument } from '../FeatureDocument';
import type { FeatureDocumentJSON } from '../types';

/**
 * Snapshot-based undo/redo для FeatureDocument: хранит before/after JSON
 * целиком (FeatureDocumentJSON v2) и при undo/redo вызывает doc.loadFromJSON.
 *
 * execute() — no-op: мутация уже произошла к моменту push в HistoryManager
 * (HistoryManager.push сам зовёт execute). Это совпадает с контрактом
 * legacy-команды SnapshotCommand для ModelTreeJSON.
 */
export class FeatureSnapshotCommand extends Command {
  constructor(
    private readonly beforeJSON: FeatureDocumentJSON,
    private readonly afterJSON: FeatureDocumentJSON,
    private readonly doc: FeatureDocument,
  ) {
    super();
  }

  execute(): void {}

  undo(): void {
    this.doc.loadFromJSON(this.beforeJSON);
  }

  redo(): void {
    this.doc.loadFromJSON(this.afterJSON);
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
