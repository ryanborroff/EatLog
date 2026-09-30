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

  it('uses a known density for mass <-> volume', () => {
    expect(convertQuantity(1, 'cup', 'g', null, 0.36)).toEqual({ quantity: 90, approximate: true });
    expect(convertQuantity(90, 'g', 'ml', null, 0.36)?.quantity).toBeCloseTo(250);
  });

  it('derives a density from the weight of one spoon/cup measure', () => {
    expect(convertQuantity(2, 'tbsp', 'g', 16)).toEqual({ quantity: 32, approximate: true });
    // A known density wins over the estimate.
    expect(convertQuantity(1, 'cup', 'g', 250, 0.36)?.quantity).toBeCloseTo(90);
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
