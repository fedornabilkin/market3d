import { describe, expect, it } from 'vitest';
import { parseCalculatorUrlState, serializeCalculatorUrlState } from './urlState';

const allowed = ['phone', 'pet', 'qr'];

describe('keychain calculator URL state', () => {
  it('serializes selections in stable slug order', () => {
    expect(serializeCalculatorUrlState([
      { productSlug: 'qr', quantity: 3 },
      { productSlug: 'phone', quantity: 2 },
    ])).toEqual({
      v: '1',
      items: 'phone:2,qr:3',
    });
  });

  it('round-trips a valid state', () => {
    const serialized = serializeCalculatorUrlState([
      { productSlug: 'pet', quantity: 1 },
      { productSlug: 'phone', quantity: 4 },
    ]);

    expect(parseCalculatorUrlState(serialized, allowed, 100)).toEqual([
      { productSlug: 'pet', quantity: 1 },
      { productSlug: 'phone', quantity: 4 },
    ]);
  });

  it('ignores unknown products and damaged entries', () => {
    expect(parseCalculatorUrlState({
      v: '1',
      items: 'phone:2,unknown:3,qr:-1,pet:1.5,broken',
    }, allowed, 100)).toEqual([
      { productSlug: 'phone', quantity: 2 },
    ]);
  });

  it('merges duplicates and caps quantity', () => {
    expect(parseCalculatorUrlState({
      items: 'phone:8,phone:8',
    }, allowed, 10)).toEqual([
      { productSlug: 'phone', quantity: 10 },
    ]);
  });

  it('returns an empty state for an unknown version', () => {
    expect(parseCalculatorUrlState({
      v: '99',
      items: 'phone:2',
    }, allowed, 100)).toEqual([]);
  });
});
