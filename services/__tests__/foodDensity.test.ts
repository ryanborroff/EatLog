import { densityFor } from '../foodDensity';

describe('densityFor', () => {
  it('knows foods that are much lighter or heavier than water', () => {
    expect(densityFor('Oats')).toBe(0.36);
    expect(densityFor('porridge oats')).toBe(0.36);
    expect(densityFor('Grated cheddar cheese')).toBe(0.45);
    expect(densityFor('honey')).toBe(1.42);
    expect(densityFor('blueberries')).toBe(0.6);
  });

  it('prefers the more specific rule', () => {
    expect(densityFor('cream cheese')).toBe(1.0);
    expect(densityFor('icing sugar')).toBe(0.5);
    expect(densityFor('peanut butter')).toBe(1.07);
    expect(densityFor('peanuts')).toBe(0.6);
  });

  it('matches on the head noun, so drinks made from a food are not caught', () => {
    expect(densityFor('oat milk')).toBeNull();
    expect(densityFor('almond milk')).toBeNull();
    expect(densityFor('rice pudding')).toBeNull();
    expect(densityFor('doughnut')).toBeNull();
  });

  it('leaves mixed dishes alone', () => {
    expect(densityFor('oats with milk')).toBeNull();
    expect(densityFor('rice and beans')).toBeNull();
  });
});
