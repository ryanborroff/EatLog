import { checkEstimate, plausibleGramsPerUnit } from '../estimateChecks';
import { EstimatedNutrition } from '../../types/foodParser';

const estimate = (overrides: Partial<EstimatedNutrition>): EstimatedNutrition => ({
  serving_size: 100,
  serving_unit: 'g',
  calories: 200,
  protein: 10,
  carbohydrate: 20,
  fat: 8.9,
  fibre: null,
  sodium: null,
  sugar: null,
  ...overrides,
});

describe('checkEstimate', () => {
  it('accepts an estimate whose calories match its macros', () => {
    expect(checkEstimate(estimate({}), 'chicken curry')).toBe('ok');
  });

  it('rejects more energy per gram than pure fat', () => {
    expect(checkEstimate(estimate({ calories: 1200, fat: 100, protein: 0, carbohydrate: 0 }), 'mystery')).toBe(
      'impossible'
    );
  });

  it('rejects more protein, carbs and fat than the serving weighs', () => {
    expect(checkEstimate(estimate({ protein: 60, carbohydrate: 60, fat: 5, calories: 525 }), 'x')).toBe('impossible');
  });

  it('rejects negative values', () => {
    expect(checkEstimate(estimate({ fat: -1 }), 'x')).toBe('impossible');
  });

  it('flags calories that disagree with the macros', () => {
    // Macros say ~200 kcal, calories say 450.
    expect(checkEstimate(estimate({ calories: 450 }), 'katsu curry')).toBe('inconsistent');
    expect(checkEstimate(estimate({ calories: 90 }), 'katsu curry')).toBe('inconsistent');
  });

  it('ignores small absolute differences', () => {
    expect(checkEstimate(estimate({ calories: 12, protein: 0.5, carbohydrate: 1, fat: 0.2 }), 'tea')).toBe('ok');
  });

  it('allows alcoholic drinks more calories than their macros explain', () => {
    const pint = estimate({ serving_size: 568, serving_unit: 'ml', calories: 240, protein: 2, carbohydrate: 20, fat: 0 });
    expect(checkEstimate(pint, 'Pint of lager')).toBe('ok');
    expect(checkEstimate(pint, 'Apple juice')).toBe('inconsistent');
  });

  it('checks per-gram limits only when the serving is a weight or volume', () => {
    expect(checkEstimate(estimate({ serving_size: 1, serving_unit: 'slice', calories: 300, protein: 10, carbohydrate: 30, fat: 15.5 }), 'pizza')).toBe('ok');
  });
});

describe('plausibleGramsPerUnit', () => {
  it('keeps sensible weights and drops missing or absurd ones', () => {
    expect(plausibleGramsPerUnit(50)).toBe(50);
    expect(plausibleGramsPerUnit(null)).toBeNull();
    expect(plausibleGramsPerUnit(0)).toBeNull();
    expect(plausibleGramsPerUnit(5000)).toBeNull();
  });
});
