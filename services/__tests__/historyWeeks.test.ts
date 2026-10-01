import { formatWeekRange, groupByWeek, parseDateKey, startOfWeek } from '../historyWeeks';

const day = (date: string, calories = 2000) => ({ date, totals: { calories } });

// Thursday 1 October 2026.
const TODAY = '2026-10-01';

describe('parseDateKey', () => {
  it('reads a day key as that calendar day, not UTC midnight', () => {
    const date = parseDateKey('2026-10-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 1]);
  });
});

describe('startOfWeek', () => {
  it('goes back to Sunday or Monday depending on the setting', () => {
    const thursday = parseDateKey('2026-10-01');
    expect(startOfWeek(thursday, 'sunday').getDate()).toBe(27); // Sun 27 Sep
    expect(startOfWeek(thursday, 'monday').getDate()).toBe(28); // Mon 28 Sep
  });

  it('keeps a day that is itself the first day of the week', () => {
    const sunday = parseDateKey('2026-09-27');
    expect(startOfWeek(sunday, 'sunday').getDate()).toBe(27);
    // ...but with Monday starts, a Sunday ends the previous week.
    expect(startOfWeek(sunday, 'monday').getDate()).toBe(21);
  });
});

describe('formatWeekRange', () => {
  const today = parseDateKey(TODAY);

  it('names one month once', () => {
    expect(formatWeekRange(parseDateKey('2026-09-13'), today)).toBe('13–19 September');
  });

  it('shortens both months when the week crosses them', () => {
    expect(formatWeekRange(parseDateKey('2026-08-30'), today)).toBe('30 Aug – 5 Sept');
  });

  it('shows both years when the week crosses a new year', () => {
    expect(formatWeekRange(parseDateKey('2025-12-28'), today)).toBe('28 Dec 2025 – 3 Jan 2026');
  });

  it('adds the year to weeks from an earlier year', () => {
    expect(formatWeekRange(parseDateKey('2025-09-14'), today)).toBe('14–20 September 2025');
  });
});

describe('groupByWeek', () => {
  it('labels this week and last week, and dates older weeks', () => {
    const groups = groupByWeek(
      [day('2026-10-01'), day('2026-09-27'), day('2026-09-26'), day('2026-09-15')],
      'sunday',
      TODAY
    );
    expect(groups.map((g) => g.label)).toEqual(['This week', 'Last week', '13–19 September']);
    expect(groups[0].entries.map((e) => e.date)).toEqual(['2026-10-01', '2026-09-27']);
  });

  it('follows the week start setting', () => {
    // Sunday 27 Sep is "this week" for Sunday starts but "last week" for Monday starts.
    const entries = [day('2026-10-01'), day('2026-09-27')];
    expect(groupByWeek(entries, 'sunday', TODAY).map((g) => g.label)).toEqual(['This week']);
    expect(groupByWeek(entries, 'monday', TODAY).map((g) => g.label)).toEqual(['This week', 'Last week']);
  });

  it('skips weeks with nothing logged', () => {
    const groups = groupByWeek([day('2026-10-01'), day('2026-09-01')], 'monday', TODAY);
    expect(groups.map((g) => g.label)).toEqual(['This week', '31 Aug – 6 Sept']);
  });

  it('averages calories over the days logged in each week', () => {
    const [week] = groupByWeek([day('2026-10-01', 1800), day('2026-09-29', 2200), day('2026-09-28', 1600)], 'monday', TODAY);
    expect(week.daysLogged).toBe(3);
    expect(week.averageCalories).toBe(1866.6666666666667);
  });

  it('is empty when nothing is logged', () => {
    expect(groupByWeek([], 'monday', TODAY)).toEqual([]);
  });
});
