import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureDocumentJSON } from '@/v3d/constructor/features/types';

/** Isolates scene slot persistence from the constructor view. */
export class ScenePersistenceService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { index: number; document: FeatureDocument } | null = null;

  constructor(private readonly keys: readonly string[]) {}

  save(index: number, document: FeatureDocument): boolean {
    if ([...document.graph.values()].some((feature) => !!feature.error)) return false;
    localStorage.setItem(this.keys[index], JSON.stringify(document.toJSON()));
    return true;
  }

  load(index: number): FeatureDocumentJSON | null {
    const raw = localStorage.getItem(this.keys[index]);
    if (!raw) return null;
    try { return JSON.parse(raw) as FeatureDocumentJSON; } catch { return null; }
  }

  clear(index: number): void { localStorage.removeItem(this.keys[index]); }

  scheduleSave(index: number, document: FeatureDocument, delayMs = 300): void {
    if (this.timer) clearTimeout(this.timer);
    this.pending = { index, document };
    this.timer = setTimeout(() => this.flushPending(), delayMs);
  }

  flushPending(): boolean {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = this.pending;
    this.pending = null;
    return pending ? this.save(pending.index, pending.document) : false;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
