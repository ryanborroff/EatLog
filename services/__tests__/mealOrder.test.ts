import { sortMealsForDisplay } from '../../utils/mealOrder';
import { Meal } from '../../types';

const meal = (id: string, type: Meal['type'], time: string): Meal => ({
  id,
  type,
  items: [],
  totalCalories: 0,
  totalProtein: 0,
  totalCarbohydrate: 0,
  totalFat: 0,
  totalFibre: 0,
  totalSodium: 0,
  totalSugar: 0,
  loggedAt: `2026-09-25T${time}:00.000Z`,
});

const order = (meals: Meal[]) => sortMealsForDisplay(meals).map((m) => m.id);

describe('sortMealsForDisplay', () => {
  it('puts dinner above lunch above breakfast regardless of log time', () => {
    expect(
      order([meal('d', 'dinner', '12:00'), meal('b', 'breakfast', '20:00'), meal('l', 'lunch', '08:00')])
    ).toEqual(['d', 'l', 'b']);
  });

  it('slots snacks after the latest main meal logged before them', () => {
    expect(
      order([
        meal('b', 'breakfast', '08:00'),
        meal('s1', 'snack', '10:30'),
        meal('l', 'lunch', '13:00'),
        meal('s2', 'snack', '16:15'),
        meal('d', 'dinner', '19:00'),
        meal('s3', 'snack', '21:00'),
      ])
    ).toEqual(['s3', 'd', 's2', 'l', 's1', 'b']);
  });

  it('puts a snack before any main meal at the bottom', () => {
    expect(order([meal('s', 'snack', '07:00'), meal('b', 'breakfast', '08:00')])).toEqual(['b', 's']);
  });
});
