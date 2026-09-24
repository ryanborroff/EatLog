import { buildChartBuckets, getChartMetrics } from '../intakeChart';
import { DayEntry } from '../../types';

const day = (date: string, protein: number, water = 0): DayEntry => ({
  date,
  meals: [],
  waterLogs: [],
  totals: { calories: 0, protein, carbohydrate: 0, fat: 0, fibre: 0, sodium: 0, sugar: 0, water },
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
