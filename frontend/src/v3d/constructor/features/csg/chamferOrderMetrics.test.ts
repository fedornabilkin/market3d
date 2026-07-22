import { describe, expect, it } from 'vitest';
import { compareChamferOrderMetrics, type ChamferOrderMetrics } from './chamferOrderMetrics';

const metrics = (patch: Partial<ChamferOrderMetrics> = {}): ChamferOrderMetrics => ({
  triangles: 100,
  volume: 250,
  bounds: [0, 0, 0, 10, 10, 10],
  failedFeatures: 0,
  ...patch,
});

describe('compareChamferOrderMetrics', () => {
  it('passes equivalent successful evaluations', () => {
    expect(compareChamferOrderMetrics(metrics(), metrics()).passed).toBe(true);
  });

  it('fails when either evaluation contains failed features', () => {
    expect(compareChamferOrderMetrics(metrics({ failedFeatures: 1 }), metrics()).passed).toBe(false);
    expect(compareChamferOrderMetrics(metrics(), metrics({ failedFeatures: 1 })).passed).toBe(false);
  });
});
