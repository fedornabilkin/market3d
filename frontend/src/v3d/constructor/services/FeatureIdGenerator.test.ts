import { describe, it, expect } from 'vitest';
import { SequentialFeatureIdGenerator } from './FeatureIdGenerator';

describe('SequentialFeatureIdGenerator', () => {
  it('генерирует id с дефолтным префиксом f_', () => {
    const gen = new SequentialFeatureIdGenerator();
    expect(gen.next()).toBe('f_1');
    expect(gen.next()).toBe('f_2');
    expect(gen.next()).toBe('f_3');
  });

  it('использует переданный префикс', () => {
    const gen = new SequentialFeatureIdGenerator();
    expect(gen.next('box')).toBe('box_1');
    expect(gen.next('sphere')).toBe('sphere_2');
    expect(gen.next('xf')).toBe('xf_3');
  });

  it('счётчик сквозной (id уникальны независимо от префикса)', () => {
    const gen = new SequentialFeatureIdGenerator();
    gen.next('box');
    gen.next('sphere');
    expect(gen.current()).toBe(2);
  });

  it('инициализация с initialSeq позволяет resume после restore', () => {
    const gen = new SequentialFeatureIdGenerator(42);
    expect(gen.next('box')).toBe('box_43');
    expect(gen.current()).toBe(43);
  });
});
