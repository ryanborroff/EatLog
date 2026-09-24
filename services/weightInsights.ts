import { WeightEntry } from '../types';
import { buildPeriodRanges, ChartPeriod } from './intakeChart';

export interface WeightSummary {
  /** Most recent weigh-in overall, even if it's older than the period. */
  latest: WeightEntry | null;
  /** Change from the first to the last weigh-in within the period; null with fewer than two. */
  change: number | null;
}

export interface WeightBucket {
  label: string;
  /** Average of the weigh-ins in this bar, or null when there were none. */
  weightKg: number | null;
}

// Changes smaller than this read as "about the same" — day-to-day scale noise.
const STEADY_THRESHOLD_KG = 0.1;

export const formatKg = (kg: number): string => `${kg.toFixed(1)} kg`;

export const formatKgChange = (change: number): string =>
  Math.abs(change) < STEADY_THRESHOLD_KG
    ? 'No change'
    : `${change > 0 ? '+' : '−'}${formatKg(Math.abs(change))}`;

const sortByDate = (entries: WeightEntry[]): WeightEntry[] =>
  [...entries].sort((a, b) => a.date.localeCompare(b.date));

/** Summarises weigh-ins on or after `cutoffDate` (a UTC day key, as Insights filters history). */
export const summarizeWeight = (entries: WeightEntry[], cutoffDate: string): WeightSummary => {
  const sorted = sortByDate(entries);
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const inPeriod = sorted.filter((entry) => entry.date >= cutoffDate);
  const change =
    inPeriod.length >= 2 ? inPeriod[inPeriod.length - 1].weightKg - inPeriod[0].weightKg : null;
  return { latest, change };
};

/** One point per chart bar, aligned with the intake chart's bars for the same period. */
export const buildWeightBuckets = (
  entries: WeightEntry[],
  period: ChartPeriod,
  now: Date = new Date()
): WeightBucket[] => {
  const byDate = new Map(entries.map((entry) => [entry.date, entry.weightKg]));
  return buildPeriodRanges(period, now).map(({ label, dates }) => {
    const weights = dates.map((date) => byDate.get(date)).filter((w): w is number => w !== undefined);
    return {
      label,
      weightKg: weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : null,
    };
  });
};

/**
 * A neutral, descriptive sentence pairing average intake with weight change —
 * no judgement or advice. Null when there isn't enough of either to say anything.
 */
export const generateWeightObservation = (
  averageCalories: number,
  loggedDays: number,
  change: number | null,
  periodLabel: string
): string | null => {
  if (change === null || loggedDays < 2 || averageCalories <= 0) return null;

  const calories = Math.round(averageCalories).toLocaleString('en-GB');
  const weightPart =
    Math.abs(change) < STEADY_THRESHOLD_KG
      ? 'your weight stayed about the same'
      : `your weight went ${change < 0 ? 'down' : 'up'} by ${formatKg(Math.abs(change))}`;

  return `You averaged ${calories} kcal a day on the days you logged ${periodLabel}, and ${weightPart}.`;
};
