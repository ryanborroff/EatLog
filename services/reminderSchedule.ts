/**
 * Pure planning for meal and water reminders — which local notifications should
 * be pending right now, given the user's settings and what they've logged today.
 *
 * iOS can't run code when a local notification fires, so "don't nag if already
 * logged" works by re-planning (cancel everything, schedule this list) whenever
 * the app opens or the diary changes. See reminderService for the scheduling side.
 */

export type ReminderMealType = 'breakfast' | 'lunch' | 'dinner';

export const REMINDER_MEAL_TYPES: ReminderMealType[] = ['breakfast', 'lunch', 'dinner'];

export interface MealReminderSetting {
  enabled: boolean;
  /** Minutes after local midnight. */
  minuteOfDay: number;
}

export interface WaterReminderSetting {
  enabled: boolean;
  intervalMinutes: number;
  /** Active window, minutes after local midnight. Reminders fall within [start, end]. */
  startMinuteOfDay: number;
  endMinuteOfDay: number;
}

export interface ReminderSettings {
  meals: Record<ReminderMealType, MealReminderSetting>;
  water: WaterReminderSetting;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  meals: {
    breakfast: { enabled: false, minuteOfDay: 9 * 60 + 30 },
    lunch: { enabled: false, minuteOfDay: 13 * 60 + 30 },
    dinner: { enabled: false, minuteOfDay: 19 * 60 + 30 },
  },
  water: {
    enabled: false,
    intervalMinutes: 2 * 60,
    startMinuteOfDay: 8 * 60,
    endMinuteOfDay: 21 * 60,
  },
};

export const WATER_INTERVAL_OPTIONS_MINUTES = [90, 120, 180];

/** What's been logged today, as far as reminders care. */
export interface TodayLogState {
  meals: { type: string; loggedAt: Date }[];
  waterLoggedAt: Date[];
}

export interface PlannedReminder {
  kind: 'meal' | 'water';
  mealType?: ReminderMealType;
  fireAt: Date;
}

/** Days ahead (including today) to keep scheduled — stays well under iOS's 64 pending limit. */
export const PLAN_HORIZON_DAYS = 3;

/**
 * Any meal logged this long before a meal reminder counts as that meal, so a
 * lunchtime "snack" doesn't earn a lunch reminder.
 */
const MEAL_SATISFIED_WINDOW_MS = 2 * 60 * 60 * 1000;

const atMinuteOfDay = (day: Date, minuteOfDay: number): Date => {
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  date.setMinutes(minuteOfDay);
  return date;
};

const addDays = (day: Date, days: number): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isMealSatisfied = (mealType: ReminderMealType, fireAt: Date, today: TodayLogState): boolean =>
  today.meals.some(
    (meal) =>
      isSameLocalDay(meal.loggedAt, fireAt) &&
      (meal.type === mealType || fireAt.getTime() - meal.loggedAt.getTime() <= MEAL_SATISFIED_WINDOW_MS)
  );

const planWaterForDay = (
  day: Date,
  setting: WaterReminderSetting,
  now: Date,
  today: TodayLogState
): Date[] => {
  const windowStart = atMinuteOfDay(day, setting.startMinuteOfDay);
  const windowEnd = atMinuteOfDay(day, setting.endMinuteOfDay);
  const intervalMs = setting.intervalMinutes * 60 * 1000;

  // Logging water restarts the clock: the next nudge is a full interval after
  // the latest drink, not on a fixed grid.
  const lastDrink = today.waterLoggedAt
    .filter((loggedAt) => isSameLocalDay(loggedAt, day))
    .reduce<Date | null>((latest, loggedAt) => (!latest || loggedAt > latest ? loggedAt : latest), null);

  let next = lastDrink ? new Date(lastDrink.getTime() + intervalMs) : windowStart;
  if (next < windowStart) next = windowStart;

  const times: Date[] = [];
  for (; next <= windowEnd; next = new Date(next.getTime() + intervalMs)) {
    if (next > now) times.push(next);
  }
  return times;
};

export const planReminders = (
  settings: ReminderSettings,
  today: TodayLogState,
  now: Date
): PlannedReminder[] => {
  const planned: PlannedReminder[] = [];

  for (let offset = 0; offset < PLAN_HORIZON_DAYS; offset++) {
    const day = addDays(now, offset);

    for (const mealType of REMINDER_MEAL_TYPES) {
      const setting = settings.meals[mealType];
      if (!setting.enabled) continue;
      const fireAt = atMinuteOfDay(day, setting.minuteOfDay);
      if (fireAt <= now || isMealSatisfied(mealType, fireAt, today)) continue;
      planned.push({ kind: 'meal', mealType, fireAt });
    }

    if (settings.water.enabled) {
      for (const fireAt of planWaterForDay(day, settings.water, now, today)) {
        planned.push({ kind: 'water', fireAt });
      }
    }
  }

  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
};

const MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

// {meal} is the lowercase meal name, {Meal} the capitalised one.
const MEAL_MESSAGES = [
  'Had {meal}? Tap to log it.',
  'Remember to log your {meal}.',
  "{Meal} finished? Don't forget to log it.",
];

/** Whole days since the epoch for the local calendar date — stable however often reminders are re-planned. */
const localDayNumber = (date: Date): number =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000));

/** Title and body for a meal reminder, rotating through its messages one day at a time. */
export const mealReminderText = (
  mealType: ReminderMealType,
  fireAt: Date
): { title: string; body: string } => {
  const label = MEAL_LABELS[mealType];
  const template = MEAL_MESSAGES[localDayNumber(fireAt) % MEAL_MESSAGES.length];
  return {
    title: label,
    body: template.replace('{meal}', label.toLowerCase()).replace('{Meal}', label),
  };
};

const WATER_MESSAGES = [
  'Time for a glass of water?',
  'Quick water break?',
  'Top up your water.',
  'A glass of water now keeps you on track.',
];

/**
 * Title and body for a water reminder, rotating by the local hour it fires.
 * Every interval option is 1–3 hours, so back-to-back reminders never repeat
 * with four messages.
 */
export const waterReminderText = (fireAt: Date): { title: string; body: string } => {
  const hourNumber = localDayNumber(fireAt) * 24 + fireAt.getHours();
  return { title: 'Water', body: WATER_MESSAGES[hourNumber % WATER_MESSAGES.length] };
};

/** "09:30"-style label for a minute-of-day value. */
export const formatMinuteOfDay = (minuteOfDay: number): string => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
