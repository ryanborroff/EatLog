import {
  buildChartBuckets,
  getCalorieMetric,
  getChartMetrics,
  getNutrientMetrics,
  getTargetStatus,
} from '../intakeChart';
import { DayEntry } from '../../types';

const day = (date: string, protein: number, water = 0, calories = 0): DayEntry => ({
  date,
  meals: [],
  waterLogs: [],
  totals: { calories, protein, carbohydrate: 0, fat: 0, fibre: 0, sodium: 0, sugar: 0, water },
});

// Midday so the UTC day key matches the local calendar day in any test timezone.
const NOW = new Date(2026, 8, 24, 12);

describe('buildChartBuckets', () => {
  it('gives one bar per day for the week, oldest first, ending today', () => {
    const history = [day('2026-09-24', 100, 1500), day('2026-09-18', 40)];
    const buckets = buildChartBuckets(history, 'week', NOW);

    expect(buckets).toHaveLength(7);
    expect(buckets[0].values.protein).toBe(40);
    expect(buckets[6].values.protein).toBe(100);
    expect(buckets[6].values.water).toBe(1500);
    expect(buckets.filter((b) => b.hasData)).toHaveLength(2);
  });

  it('averages calories alongside the other nutrients', () => {
    const history = [day('2026-09-24', 100, 0, 1800), day('2026-09-22', 50, 0, 2200)];
    const buckets = buildChartBuckets(history, 'week', NOW);

    expect(buckets[6].values.calories).toBe(1800);
    expect(buckets[4].values.calories).toBe(2200);
    expect(buckets[5].values.calories).toBe(0);
  });

  it('ignores entries older than the period', () => {
    const buckets = buildChartBuckets([day('2026-09-10', 80)], 'week', NOW);
    expect(buckets.every((b) => !b.hasData)).toBe(true);
  });

  it('averages only logged days within a week for 6 Months', () => {
    const history = [day('2026-09-24', 100), day('2026-09-22', 50)];
    const buckets = buildChartBuckets(history, '6months', NOW);

    expect(buckets).toHaveLength(26);
    expect(buckets[25].values.protein).toBe(75);
  });

  it('groups by calendar month for Year', () => {
    const history = [day('2026-09-01', 60), day('2026-09-30', 90), day('2025-10-15', 30)];
    const buckets = buildChartBuckets(history, 'year', NOW);

    expect(buckets).toHaveLength(12);
    expect(buckets[0].values.protein).toBe(30);
    expect(buckets[11].values.protein).toBe(75);
  });
});

describe('getChartMetrics', () => {
  it('uses the user goals where set and guidelines otherwise', () => {
    const metrics = getChartMetrics({ calories: 2000, protein: 120, fibre: 35 });
    const target = (key: string) => metrics.find((m) => m.key === key)!.target;

    expect(target('protein')).toBe(120);
    expect(target('fibre')).toBe(35);
    expect(target('carbohydrate')).toBe(260);
    expect(target('fat')).toBe(70);
    expect(target('water')).toBe(2000);
  });
});

describe('getNutrientMetrics', () => {
  it('adds sodium and sugar to the landscape chart metrics, in order', () => {
    const keys = getNutrientMetrics({ calories: 2000, protein: 120 }).map((m) => m.key);
    expect(keys).toEqual(['protein', 'carbohydrate', 'fat', 'fibre', 'water', 'sodium', 'sugar']);
  });
});

describe('getTargetStatus', () => {
  const goals = { calories: 2000, protein: 100 };
  const protein = getChartMetrics(goals).find((m) => m.key === 'protein')!;
  const calories = getCalorieMetric(goals);

  it('flags a goal only when well short of it', () => {
    expect(getTargetStatus(protein, 85)).toBe('onTrack');
    expect(getTargetStatus(protein, 79)).toBe('below');
    expect(getTargetStatus(protein, 150)).toBe('onTrack');
  });

  it('flags a limit only when clearly over it', () => {
    expect(getTargetStatus(calories, 2150)).toBe('onTrack');
    expect(getTargetStatus(calories, 2300)).toBe('above');
    expect(getTargetStatus(calories, 500)).toBe('onTrack');
  });

  it('never flags a metric without a target', () => {
    expect(getTargetStatus({ ...calories, target: 0 }, 3000)).toBe('onTrack');
  });
});
