import { DayEntry, DailyGoals, DailyTotals } from '../types';

export type ChartPeriod = 'day' | 'week' | 'month' | '6months' | 'year';

export type ChartMetricKey = 'protein' | 'carbohydrate' | 'fat' | 'fibre' | 'water';

export interface ChartMetric {
  key: ChartMetricKey;
  label: string;
  unit: string;
  color: string;
  /** Daily target — the user's own goal where one is set, otherwise a common general guideline. */
  target: number;
}

export interface ChartBucket {
  /** Short axis label, e.g. "M", "12", "Mar". */
  label: string;
  /** Average daily intake across the logged days in this bucket (0 when nothing was logged). */
  values: Record<ChartMetricKey, number>;
  hasData: boolean;
}

// Fallbacks match the general guidelines quoted in the Insights info popups.
const DEFAULT_CARBOHYDRATE = 260;
const DEFAULT_FAT = 70;
const DEFAULT_FIBRE = 30;
const DEFAULT_WATER_ML = 2000;

export const getChartMetrics = (goals: DailyGoals): ChartMetric[] => [
  { key: 'protein', label: 'Protein', unit: 'g', color: '#C97B5E', target: goals.protein },
  { key: 'carbohydrate', label: 'Carbs', unit: 'g', color: '#D4A24C', target: goals.carbohydrate ?? DEFAULT_CARBOHYDRATE },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#9884B8', target: goals.fat ?? DEFAULT_FAT },
  { key: 'fibre', label: 'Fibre', unit: 'g', color: '#7A9B7E', target: goals.fibre ?? DEFAULT_FIBRE },
  { key: 'water', label: 'Water', unit: 'ml', color: '#6E9CC4', target: DEFAULT_WATER_ML },
];

const METRIC_KEYS: ChartMetricKey[] = ['protein', 'carbohydrate', 'fat', 'fibre', 'water'];

// Dates are keyed the same way the rest of the app stores them (UTC day).
const toDateKey = (date: Date): string => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const averageOf = (entries: DailyTotals[]): Record<ChartMetricKey, number> => {
  const values = { protein: 0, carbohydrate: 0, fat: 0, fibre: 0, water: 0 };
  if (entries.length === 0) return values;
  for (const key of METRIC_KEYS) {
    values[key] = entries.reduce((sum, totals) => sum + totals[key], 0) / entries.length;
  }
  return values;
};

const buildBucket = (label: string, dates: string[], byDate: Map<string, DailyTotals>): ChartBucket => {
  const logged = dates.map((date) => byDate.get(date)).filter((t): t is DailyTotals => !!t);
  return { label, values: averageOf(logged), hasData: logged.length > 0 };
};

export interface PeriodRange {
  /** Short axis label, e.g. "Mon", "12", "Mar" — blank where the axis would crowd. */
  label: string;
  /** UTC day keys covered by this bar. */
  dates: string[];
}

/**
 * Splits a period into chart bars: one per day for Day/Week/Month, one per week
 * for 6 Months, and one per month for Year — so bars stay readable across a
 * landscape phone screen. Shared by the intake and weight charts so they line up.
 */
export const buildPeriodRanges = (period: ChartPeriod, now: Date = new Date()): PeriodRange[] => {
  if (period === 'day' || period === 'week' || period === 'month') {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    return Array.from({ length: days }, (_, index) => {
      const date = addDays(now, index - (days - 1));
      const label =
        period === 'month'
          ? String(date.getDate())
          : date.toLocaleDateString('en-GB', { weekday: 'short' });
      return { label, dates: [toDateKey(date)] };
    });
  }

  if (period === '6months') {
    const weeks = 26;
    return Array.from({ length: weeks }, (_, index) => {
      const weekEnd = addDays(now, -(weeks - 1 - index) * 7);
      const dates = Array.from({ length: 7 }, (_, day) => toDateKey(addDays(weekEnd, day - 6)));
      const weekStart = addDays(weekEnd, -6);
      // Label roughly every fourth week so the axis doesn't crowd.
      const label =
        index % 4 === 0 ? weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
      return { label, dates };
    });
  }

  const months = 12;
  return Array.from({ length: months }, (_, index) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, day) =>
      // Midday, so converting to a UTC day key can't slip into the neighbouring day.
      toDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), day + 1, 12))
    );
    const label = monthStart.toLocaleDateString('en-GB', { month: 'short' });
    return { label, dates };
  });
};

/** Groups history into one intake bar per period range (see buildPeriodRanges). */
export const buildChartBuckets = (
  history: DayEntry[],
  period: ChartPeriod,
  now: Date = new Date()
): ChartBucket[] => {
  const byDate = new Map(history.map((entry) => [entry.date, entry.totals]));
  return buildPeriodRanges(period, now).map(({ label, dates }) => buildBucket(label, dates, byDate));
};
