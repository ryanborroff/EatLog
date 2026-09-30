import { DayEntry, DailyGoals, DailyTotals } from '../types';

export type ChartPeriod = 'day' | 'week' | 'month' | '6months' | 'year';

export type ChartMetricKey = keyof DailyTotals;

/**
 * Which side of the target is the good one: 'min' goals (protein, fibre, water)
 * should be reached, 'max' limits (calories, sodium, sugar, carbs, fat) shouldn't
 * be overshot.
 */
export type TargetKind = 'min' | 'max';

export type TargetStatus = 'onTrack' | 'below' | 'above';

export interface ChartMetric {
  key: ChartMetricKey;
  label: string;
  unit: string;
  color: string;
  /** Daily target — the user's own goal where one is set, otherwise a common general guideline. */
  target: number;
  kind: TargetKind;
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
export const DEFAULT_WATER_ML = 2000;
const DEFAULT_SODIUM_MG = 2300;
const DEFAULT_SUGAR_G = 50;

/** The panels of the landscape intake chart. */
export const getChartMetrics = (goals: DailyGoals): ChartMetric[] => [
  { key: 'protein', label: 'Protein', unit: 'g', color: '#C97B5E', target: goals.protein, kind: 'min' },
  { key: 'carbohydrate', label: 'Carbs', unit: 'g', color: '#D4A24C', target: goals.carbohydrate ?? DEFAULT_CARBOHYDRATE, kind: 'max' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#9884B8', target: goals.fat ?? DEFAULT_FAT, kind: 'max' },
  { key: 'fibre', label: 'Fibre', unit: 'g', color: '#7A9B7E', target: goals.fibre ?? DEFAULT_FIBRE, kind: 'min' },
  { key: 'water', label: 'Water', unit: 'ml', color: '#6E9CC4', target: DEFAULT_WATER_ML, kind: 'min' },
];

export const getCalorieMetric = (goals: DailyGoals): ChartMetric => ({
  key: 'calories',
  label: 'Calories',
  unit: 'kcal',
  color: '#5E8C8A',
  target: goals.calories,
  kind: 'max',
});

/** Everything Insights lists in portrait: the landscape panels plus sodium and sugar. */
export const getNutrientMetrics = (goals: DailyGoals): ChartMetric[] => [
  ...getChartMetrics(goals),
  { key: 'sodium', label: 'Sodium', unit: 'mg', color: '#8C8C8C', target: DEFAULT_SODIUM_MG, kind: 'max' },
  { key: 'sugar', label: 'Sugar', unit: 'g', color: '#C97A9A', target: DEFAULT_SUGAR_G, kind: 'max' },
];

// Slack either side of the target before a value counts as off-target, so a
// day a few grams short of a goal isn't flagged.
const MIN_TOLERANCE = 0.8;
const MAX_TOLERANCE = 1.1;

export const getTargetStatus = (metric: ChartMetric, value: number): TargetStatus => {
  if (metric.target <= 0) return 'onTrack';
  if (metric.kind === 'min') return value < metric.target * MIN_TOLERANCE ? 'below' : 'onTrack';
  return value > metric.target * MAX_TOLERANCE ? 'above' : 'onTrack';
};

const METRIC_KEYS: ChartMetricKey[] = ['calories', 'protein', 'carbohydrate', 'fat', 'fibre', 'sodium', 'sugar', 'water'];

// Dates are keyed the same way the rest of the app stores them (UTC day).
const toDateKey = (date: Date): string => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const averageOf = (entries: DailyTotals[]): Record<ChartMetricKey, number> => {
  const values = { calories: 0, protein: 0, carbohydrate: 0, fat: 0, fibre: 0, sodium: 0, sugar: 0, water: 0 };
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

export type MacroKey = 'protein' | 'carbohydrate' | 'fat';

// Atwater factors: kcal per gram.
const KCAL_PER_GRAM: Record<MacroKey, number> = { protein: 4, carbohydrate: 4, fat: 9 };

/**
 * Share of the day's macro calories from protein, carbs and fat, each 0–1 and
 * summing to 1 — or all 0 when nothing was eaten. Worked out from grams rather
 * than the logged calorie total, so alcohol and rounding can't push it past 100%.
 */
export const getMacroCalorieSplit = (totals: Pick<DailyTotals, MacroKey>): Record<MacroKey, number> => {
  const kcal = {
    protein: totals.protein * KCAL_PER_GRAM.protein,
    carbohydrate: totals.carbohydrate * KCAL_PER_GRAM.carbohydrate,
    fat: totals.fat * KCAL_PER_GRAM.fat,
  };
  const sum = kcal.protein + kcal.carbohydrate + kcal.fat;
  if (sum <= 0) return { protein: 0, carbohydrate: 0, fat: 0 };
  return { protein: kcal.protein / sum, carbohydrate: kcal.carbohydrate / sum, fat: kcal.fat / sum };
};
