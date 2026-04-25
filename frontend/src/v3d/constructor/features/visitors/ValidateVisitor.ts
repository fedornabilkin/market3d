import { FeatureVisitor } from '../FeatureVisitor';
import type { Feature } from '../Feature';
import type { CompositeFeature } from '../CompositeFeature';
import type { TransformFeature } from '../composite/TransformFeature';
import type { BooleanFeature } from '../composite/BooleanFeature';
import type { GroupFeature } from '../composite/GroupFeature';

export interface ValidationIssue {
  featureId: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Visitor статической валидации: проверяет структурные инварианты фичи
 * (количество входов, диапазоны параметров и т.п.). Не делает recompute,
 * не зависит от outputs других фич.
 *
 * FeatureGraph дополнительно проверяет циклы и отсутствующие ссылки —
 * это глобальные инварианты графа, они вне Visitor'а.
 *
 * Использование:
 *   const v = new ValidateVisitor();
 *   features.forEach(f => f.accept(v));
 *   if (v.issues.length > 0) ...
 */
export class ValidateVisitor extends FeatureVisitor<void> {
  readonly issues: ValidationIssue[] = [];

  protected visitFeature(_feature: Feature): void {
    // Дефолт: ничего не проверяем (примитивы валидируются тривиально через
    // builder.build() в EvaluateVisitor).
  }

  override visitTransform(f: TransformFeature): void {
    this.expectInputCount(f, 1);
  }

  override visitBoolean(f: BooleanFeature): void {
    this.expectMinInputs(f, 1);
    if (!['union', 'subtract', 'intersect'].includes(f.params.operation)) {
      this.issues.push({
        featureId: f.id,
        message: `[Boolean] неизвестная operation: ${String(f.params.operation)}`,
        severity: 'error',
      });
    }
  }

  override visitGroup(f: GroupFeature): void {
    this.expectMinInputs(f, 0);
  }

  private expectInputCount(f: CompositeFeature, expected: number): void {
    const got = f.getInputs().length;
    if (got !== expected) {
      this.issues.push({
        featureId: f.id,
        message: `[${f.type}] ожидалось ${expected} входов, получено ${got}`,
        severity: 'error',
      });
    }
  }

  private expectMinInputs(f: CompositeFeature, min: number): void {
    const got = f.getInputs().length;
    if (got < min) {
      this.issues.push({
        featureId: f.id,
        message: `[${f.type}] минимум ${min} входов, получено ${got}`,
        severity: 'error',
      });
    }
  }
}
