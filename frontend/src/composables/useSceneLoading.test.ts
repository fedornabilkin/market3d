import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSceneLoading } from './useSceneLoading';

describe('useSceneLoading', () => {
  afterEach(() => vi.useRealTimers());

  it('stays visible for the full delay after loading finishes', () => {
    vi.useFakeTimers();
    const loading = useSceneLoading(1000);

    loading.start();
    vi.advanceTimersByTime(1500);
    loading.finish();

    expect(loading.visible.value).toBe(true);
    vi.advanceTimersByTime(999);
    expect(loading.visible.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(loading.visible.value).toBe(false);
  });

  it('cancels pending hiding when a new load starts', () => {
    vi.useFakeTimers();
    const loading = useSceneLoading(1000);

    loading.start();
    loading.finish();
    vi.advanceTimersByTime(500);
    loading.start();
    vi.advanceTimersByTime(500);

    expect(loading.visible.value).toBe(true);
  });
});
