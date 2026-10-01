// Groups History's days into weeks for the "This week / Last week / 21–27 September"
// headings, using the week start chosen in Settings.

export type WeekStartDay = 'sunday' | 'monday';

export interface WeekGroup<T> {
  /** Date key of the week's first day, e.g. "2026-09-27". */
  key: string;
  label: string;
  entries: T[];
  /** Average calories across the days logged in the week. */
  averageCalories: number;
  daysLogged: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stored day key ("2026-10-01") as a local calendar date. `new Date("2026-10-01")`
 * would instead mean UTC midnight, which is the previous day anywhere west of UTC.
 */
export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The first day of the week containing `date`. */
export const startOfWeek = (date: Date, weekStartsOn: WeekStartDay): Date => {
  const firstDay = weekStartsOn === 'monday' ? 1 : 0;
  const offset = (date.getDay() - firstDay + 7) % 7;
  return addDays(date, -offset);
};

const dayMonth = (date: Date, month: 'long' | 'short', withYear: boolean): string =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month, ...(withYear ? { year: 'numeric' } : {}) });

/**
 * "21–27 September" within one month, "28 Sep – 4 Oct" across two, and
 * "29 Dec 2025 – 4 Jan 2026" across a new year. Weeks from an earlier year than
 * today also show the year, so last September isn't mistaken for this one.
 */
export const formatWeekRange = (start: Date, today: Date): string => {
  const end = addDays(start, 6);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${dayMonth(start, 'short', true)} – ${dayMonth(end, 'short', true)}`;
  }
  const year = end.getFullYear() !== today.getFullYear() ? ` ${end.getFullYear()}` : '';
  if (start.getMonth() !== end.getMonth()) {
    return `${dayMonth(start, 'short', false)} – ${dayMonth(end, 'short', false)}${year}`;
  }
  return `${start.getDate()}–${dayMonth(end, 'long', false)}${year}`;
};

/**
 * Splits days (newest first, as History lists them) into weeks, keeping that order.
 * Weeks with nothing logged don't appear. `todayKey` uses the same day keys the
 * entries are stored with, so "This week" agrees with which day counts as today.
 */
export const groupByWeek = <T extends { date: string; totals: { calories: number } }>(
  entries: T[],
  weekStartsOn: WeekStartDay,
  todayKey: string
): WeekGroup<T>[] => {
  const today = parseDateKey(todayKey);
  const thisWeek = startOfWeek(today, weekStartsOn);
  const groups: WeekGroup<T>[] = [];

  for (const entry of entries) {
    const start = startOfWeek(parseDateKey(entry.date), weekStartsOn);
    const key = toDateKey(start);
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      const weeksAgo = Math.round((thisWeek.getTime() - start.getTime()) / (7 * MS_PER_DAY));
      const label = weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : formatWeekRange(start, today);
      group = { key, label, entries: [], averageCalories: 0, daysLogged: 0 };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  for (const group of groups) {
    group.daysLogged = group.entries.length;
    group.averageCalories =
      group.entries.reduce((sum, entry) => sum + entry.totals.calories, 0) / group.daysLogged;
  }
  return groups;
};
