import { convertQuantity } from '../unitConversion';

describe('convertQuantity', () => {
  it('passes through identical units, ignoring case and plurals', () => {
    expect(convertQuantity(2, 'Slices', 'slice')).toEqual({ quantity: 2, approximate: false });
    expect(convertQuantity(250, 'ml', 'ML')).toEqual({ quantity: 250, approximate: false });
  });

  it('converts exactly within mass and within volume', () => {
    expect(convertQuantity(0.5, 'kg', 'g')).toEqual({ quantity: 500, approximate: false });
    expect(convertQuantity(1, 'pint', 'ml')?.quantity).toBeCloseTo(568.261);
    expect(convertQuantity(2, 'tbsp', 'ml')).toEqual({ quantity: 30, approximate: false });
  });

  it('treats ml as g (water density) but flags it approximate', () => {
    expect(convertQuantity(250, 'ml', 'g')).toEqual({ quantity: 250, approximate: true });
  });

  it('converts a count unit via its per-unit weight', () => {
    expect(convertQuantity(1, 'whole', 'g', 50)).toEqual({ quantity: 50, approximate: true });
    expect(convertQuantity(100, 'g', 'whole', 50)).toEqual({ quantity: 2, approximate: true });
  });

  it('refuses to convert a count unit with no per-unit weight', () => {
    expect(convertQuantity(1, 'whole', 'g')).toBeNull();
    expect(convertQuantity(1, 'whole', 'g', 0)).toBeNull();
    expect(convertQuantity(1, 'slice', 'whole', 36)).toBeNull();
  });
});
