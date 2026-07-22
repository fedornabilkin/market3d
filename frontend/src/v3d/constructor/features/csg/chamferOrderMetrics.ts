export type ChamferOrderMetrics = {
  triangles: number;
  volume: number;
  bounds: number[];
  failedFeatures: number;
};

export function compareChamferOrderMetrics(
  original: ChamferOrderMetrics,
  reversed: ChamferOrderMetrics,
): { volumeDelta: number; boundsDelta: number; passed: boolean } {
  const volumeDelta = Math.abs(original.volume - reversed.volume);
  const boundsDelta = original.bounds.reduce(
    (maximum, value, index) => Math.max(
      maximum,
      Math.abs(value - reversed.bounds[index]),
    ),
    0,
  );
  return {
    volumeDelta,
    boundsDelta,
    passed: original.failedFeatures === 0
      && reversed.failedFeatures === 0
      && original.triangles === reversed.triangles
      && volumeDelta < 1e-6
      && boundsDelta < 1e-6,
  };
}
