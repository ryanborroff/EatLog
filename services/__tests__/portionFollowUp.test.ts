import { FoodItem } from '../../types';
import { applyPortions, portionQuestions, withUsualPortion } from '../portionFollowUp';

const item = (overrides: Partial<FoodItem>): FoodItem => ({
  id: '0',
  description: 'Pasta',
  quantity: 250,
  unit: 'g',
  calories: 420,
  protein: 14,
  carbohydrate: 80,
  fat: 2,
  confidence: 'medium',
  estimated: true,
  portionAssumed: true,
  ...overrides,
});

describe('portionQuestions', () => {
  it('asks about big items whose amount was assumed', () => {
    const [question] = portionQuestions([item({})]);
    expect(question.itemId).toBe('0');
    expect(question.options.map((o) => [o.label, o.quantity, o.grams, o.calories])).toEqual([
      ['Small', 150, 150, 252],
      ['Medium', 250, 250, 420],
      ['Large', 380, 380, 638.4],
    ]);
  });

  it('skips stated amounts and small items', () => {
    expect(portionQuestions([item({ portionAssumed: false }), item({ id: '1', calories: 90 })])).toEqual([]);
  });

  it('asks about at most three items, biggest first', () => {
    const items = [100, 400, 200, 300, 250].map((calories, i) => item({ id: String(i), calories: calories + 100 }));
    expect(portionQuestions(items).map((q) => q.itemId)).toEqual(['1', '3', '4']);
  });

  it('rounds count units to halves and gives no weight', () => {
    const [question] = portionQuestions([item({ quantity: 1, unit: 'bowl', calories: 300 })]);
    expect(question.options.map((o) => [o.quantity, o.grams])).toEqual([
      [0.5, null],
      [1, null],
      [1.5, null],
    ]);
    expect(question.options[0].calories).toBe(150);
  });
});

describe('applyPortions', () => {
  it('scales answered items and clears the guess', () => {
    const [pasta] = applyPortions([item({})], { '0': 'small' });
    expect(pasta).toMatchObject({ quantity: 150, calories: 252, protein: 8.4, portionAssumed: false });
  });

  it('keeps an unanswered item as a flagged guess', () => {
    const [pasta] = applyPortions([item({})], {});
    expect(pasta).toMatchObject({ quantity: 250, calories: 420, portionAssumed: true });
  });

  it('clears the guess on "medium" without changing the amount', () => {
    const [pasta] = applyPortions([item({})], { '0': 'medium' });
    expect(pasta).toMatchObject({ quantity: 250, calories: 420, portionAssumed: false });
  });
});

describe('withUsualPortion', () => {
  it("sets a guessed amount to the user's usual portion, which isn't a guess", () => {
    const updated = withUsualPortion(item({}), { quantity: 300, unit: 'g' });
    expect(updated).toMatchObject({ quantity: 300, unit: 'g', calories: 504, portionAssumed: false });
  });

  it('converts a usual portion given in another measured unit', () => {
    const updated = withUsualPortion(item({}), { quantity: 0.5, unit: 'kg' });
    expect(updated).toMatchObject({ quantity: 0.5, unit: 'kg', calories: 840 });
  });

  it("leaves the item alone when the units can't be converted", () => {
    const bowl = item({ quantity: 1, unit: 'bowl' });
    expect(withUsualPortion(bowl, { quantity: 300, unit: 'g' })).toBe(bowl);
  });

  it('never overrides an amount the user stated', () => {
    const stated = item({ portionAssumed: false });
    expect(withUsualPortion(stated, { quantity: 300, unit: 'g' })).toBe(stated);
  });
});
