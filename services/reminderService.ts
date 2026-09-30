import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';
import { addWater, getMealsForDate, getWaterLogsForDate, onDiaryChanged } from './storageService';
import {
  DEFAULT_REMINDER_SETTINGS,
  PlannedReminder,
  ReminderSettings,
  TodayLogState,
  planReminders,
} from './reminderSchedule';

const SETTINGS_KEY = 'eatlog.reminderSettings';
const PROMPT_SHOWN_KEY = 'eatlog.reminderPromptShown';

const ANDROID_CHANNEL_ID = 'reminders';
const WATER_CATEGORY_ID = 'water-reminder';
const ADD_WATER_ACTION_ID = 'add-water-250';
const QUICK_WATER_ML = 250;

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

// Settings

export const getReminderSettings = async (): Promise<ReminderSettings> => {
  const stored = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!stored) return DEFAULT_REMINDER_SETTINGS;
  try {
    const parsed = JSON.parse(stored) as Partial<ReminderSettings>;
    return {
      meals: { ...DEFAULT_REMINDER_SETTINGS.meals, ...parsed.meals },
      water: { ...DEFAULT_REMINDER_SETTINGS.water, ...parsed.water },
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
};

export const saveReminderSettings = async (settings: ReminderSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  await refreshReminders();
};

export const hasAnyReminderEnabled = (settings: ReminderSettings): boolean =>
  settings.water.enabled || Object.values(settings.meals).some((meal) => meal.enabled);

/** Turns on the default meal and water reminders — used when the user accepts the first-log prompt. */
export const enableDefaultReminders = async (): Promise<void> => {
  const settings = await getReminderSettings();
  await saveReminderSettings({
    meals: {
      breakfast: { ...settings.meals.breakfast, enabled: true },
      lunch: { ...settings.meals.lunch, enabled: true },
      dinner: { ...settings.meals.dinner, enabled: true },
    },
    water: { ...settings.water, enabled: true },
  });
};

// Permission

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

export const getReminderPermission = async (): Promise<ReminderPermission> => {
  if (!isSupported) return 'denied';
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted) return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
};

export const requestReminderPermission = async (): Promise<boolean> => {
  if (!isSupported) return false;
  const { granted } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return granted;
};

/**
 * Whether to offer reminders after the user's first logged meal: only once,
 * and only while the system prompt hasn't been answered yet.
 */
export const shouldOfferReminders = async (): Promise<boolean> => {
  if (!isSupported) return false;
  if ((await AsyncStorage.getItem(PROMPT_SHOWN_KEY)) === 'true') return false;
  return (await getReminderPermission()) === 'undetermined';
};

export const markReminderOfferShown = async (): Promise<void> => {
  await AsyncStorage.setItem(PROMPT_SHOWN_KEY, 'true');
};

// Scheduling

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' } as const;

// Deliberately neutral wording, and no calorie or weight figures, because these
// show on the lock screen.
const contentFor = (reminder: PlannedReminder): Notifications.NotificationContentInput => {
  if (reminder.kind === 'meal' && reminder.mealType) {
    const label = MEAL_LABELS[reminder.mealType];
    return {
      title: label,
      body: `Had ${label.toLowerCase()}? Tap to log it.`,
      data: { url: '/modal' },
    };
  }
  return {
    title: 'Water',
    body: 'Time for a glass of water?',
    data: { url: '/' },
    categoryIdentifier: WATER_CATEGORY_ID,
  };
};

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Today's meals and water. Diary days are keyed by UTC date, which can differ
 * from the local date near midnight, so both keys are read; the planner filters
 * to the local day itself.
 */
const loadTodayLogState = async (now: Date): Promise<TodayLogState> => {
  const keys = Array.from(new Set([now.toISOString().split('T')[0], localDayKey(now)]));
  const [meals, water] = await Promise.all([
    Promise.all(keys.map(getMealsForDate)).then((days) => days.flat()),
    Promise.all(keys.map(getWaterLogsForDate)).then((days) => days.flat()),
  ]);
  return {
    meals: meals.map((meal) => ({ type: meal.type, loggedAt: new Date(meal.loggedAt) })),
    waterLoggedAt: water.map((log) => new Date(log.loggedAt)),
  };
};

const replan = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const settings = await getReminderSettings();
  if (!hasAnyReminderEnabled(settings)) return;
  if ((await getReminderPermission()) !== 'granted') return;

  const now = new Date();
  const plan = planReminders(settings, await loadTodayLogState(now), now);

  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: contentFor(reminder),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
};

// Re-plans run one at a time; requests that arrive mid-run collapse into one
// follow-up run so a burst of diary changes doesn't schedule duplicates.
let running: Promise<void> | null = null;
let rerunRequested = false;

export const refreshReminders = async (): Promise<void> => {
  if (!isSupported) return;
  if (running) {
    rerunRequested = true;
    return running;
  }
  running = (async () => {
    do {
      rerunRequested = false;
      try {
        await replan();
      } catch (error) {
        console.error('Error scheduling reminders:', error);
      }
    } while (rerunRequested);
  })().finally(() => {
    running = null;
  });
  return running;
};

// Setup

let configured = false;

/** One-time setup: foreground display, Android channel, the water action, and re-planning on diary changes. */
export const configureReminders = (): void => {
  if (!isSupported || configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }

  Notifications.setNotificationCategoryAsync(WATER_CATEGORY_ID, [
    {
      identifier: ADD_WATER_ACTION_ID,
      buttonTitle: `Add ${QUICK_WATER_ML}ml`,
      // Opens the app so the write runs with the signed-in session.
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {});

  onDiaryChanged(() => {
    refreshReminders();
  });
};

// Responses

const handledResponses = new Set<string>();

/**
 * Acts on a tapped reminder once. Returns the route to open, if any.
 * "Add 250ml" logs the water directly; a plain tap follows the reminder's url.
 */
export const handleReminderResponse = async (
  response: Notifications.NotificationResponse
): Promise<string | null> => {
  const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
  if (handledResponses.has(key)) return null;
  handledResponses.add(key);

  if (response.actionIdentifier === ADD_WATER_ACTION_ID) {
    await addWater(new Date().toISOString().split('T')[0], QUICK_WATER_ML);
    return '/';
  }

  const url = response.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
};
