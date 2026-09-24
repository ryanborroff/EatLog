import {
  buildWeightBuckets,
  formatKgChange,
  generateWeightObservation,
  summarizeWeight,
} from '../weightInsights';

// Midday so the UTC day key matches the local calendar day in any test timezone.
const NOW = new Date(2026, 8, 24, 12);

describe('summarizeWeight', () => {
  const entries = [
    { date: '2026-09-24', weightKg: 79.2 },
    { date: '2026-08-01', weightKg: 82 },
    { date: '2026-09-18', weightKg: 80 },
  ];

  it('compares the first and last weigh-ins inside the period', () => {
    const summary = summarizeWeight(entries, '2026-09-17');
    expect(summary.latest).toEqual({ date: '2026-09-24', weightKg: 79.2 });
    expect(summary.change).toBeCloseTo(-0.8);
  });

  it('has no change with fewer than two weigh-ins in the period, but keeps the latest', () => {
    const summary = summarizeWeight(entries, '2026-09-20');
    expect(summary.latest?.weightKg).toBe(79.2);
    expect(summary.change).toBeNull();
  });

  it('handles no entries at all', () => {
    expect(summarizeWeight([], '2026-09-17')).toEqual({ latest: null, change: null });
  });
});

describe('buildWeightBuckets', () => {
  it('lines up with the week chart and leaves gaps as null', () => {
    const buckets = buildWeightBuckets(
      [{ date: '2026-09-24', weightKg: 79 }, { date: '2026-09-18', weightKg: 80 }],
      'week',
      NOW
    );
    expect(buckets).toHaveLength(7);
    expect(buckets[0].weightKg).toBe(80);
    expect(buckets[6].weightKg).toBe(79);
    expect(buckets.filter((b) => b.weightKg === null)).toHaveLength(5);
  });

  it('averages weigh-ins within a month for Year', () => {
    const buckets = buildWeightBuckets(
      [{ date: '2026-09-01', weightKg: 80 }, { date: '2026-09-20', weightKg: 79 }],
      'year',
      NOW
    );
    expect(buckets[11].weightKg).toBe(79.5);
  });
});

describe('formatKgChange', () => {
  it('signs the change and treats tiny changes as none', () => {
    expect(formatKgChange(-0.8)).toBe('−0.8 kg');
    expect(formatKgChange(1.25)).toBe('+1.3 kg');
    expect(formatKgChange(0.04)).toBe('No change');
  });
});

describe('generateWeightObservation', () => {
  it('describes intake alongside the change', () => {
    expect(generateWeightObservation(1850.4, 20, -0.8, 'this month')).toBe(
      'You averaged 1,850 kcal a day on the days you logged this month, and your weight went down by 0.8 kg.'
    );
  });

  it('says when weight held steady', () => {
    expect(generateWeightObservation(2100, 5, 0.05, 'this week')).toContain('stayed about the same');
  });

  it('says nothing without a change or enough logged days', () => {
    expect(generateWeightObservation(1850, 20, null, 'this month')).toBeNull();
    expect(generateWeightObservation(1850, 1, -0.5, 'this month')).toBeNull();
  });
});
