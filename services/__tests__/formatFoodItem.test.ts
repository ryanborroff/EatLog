import { formatFoodItemLine } from '../../utils/formatFoodItem';

describe('formatFoodItemLine', () => {
  it("doesn't capitalize the unit after a leading quantity", () => {
    expect(formatFoodItemLine({ quantity: 2, unit: 'slice', description: 'sourdough toast' })).toBe(
      '2 slices of sourdough toast'
    );
    expect(formatFoodItemLine({ quantity: 2, unit: 'cup', description: 'tea with whole milk' })).toBe(
      '2 cups of tea with whole milk'
    );
  });

  it('capitalizes a line that starts with the description', () => {
    expect(formatFoodItemLine({ quantity: 1, unit: 'bowl', description: 'porridge' })).toBe('Porridge');
  });

  it('keeps the capitals in brand names', () => {
    expect(formatFoodItemLine({ quantity: 1, unit: 'bowl', description: 'Special K cereal with whole milk' })).toBe(
      'Special K cereal with whole milk'
    );
    expect(formatFoodItemLine({ quantity: 3, unit: 'whole', description: 'Weetabix' })).toBe('3 Weetabix');
  });

  it("doesn't repeat a quantity the description already states", () => {
    expect(formatFoodItemLine({ quantity: 3, unit: 'whole', description: '3 weetabix' })).toBe('3 weetabix');
  });

  it('glues weight units to the number', () => {
    expect(formatFoodItemLine({ quantity: 250, unit: 'ml', description: 'whole milk' })).toBe('250ml whole milk');
  });
});
