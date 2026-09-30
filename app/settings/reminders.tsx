import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { colors as theme, spacing, radii } from '../../constants/theme';
import {
  ReminderPermission,
  getReminderPermission,
  getReminderSettings,
  requestReminderPermission,
  saveReminderSettings,
} from '../../services/reminderService';
import {
  REMINDER_MEAL_TYPES,
  ReminderMealType,
  ReminderSettings,
  WATER_INTERVAL_OPTIONS_MINUTES,
  formatMinuteOfDay,
} from '../../services/reminderSchedule';

const MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const MEAL_STEP_MINUTES = 30;
const WATER_WINDOW_STEP_MINUTES = 60;
const LATEST_MINUTE_OF_DAY = 23 * 60 + 30;

const formatInterval = (minutes: number): string =>
  minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function TimeStepper({ label, value, step, min, max, onChange }: StepperProps) {
  return (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => onChange(clamp(value - step, min, max))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`${label} earlier`}
        >
          <Text style={[styles.stepperButtonText, value <= min && styles.stepperButtonDisabled]}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue} accessibilityLabel={`${label} ${formatMinuteOfDay(value)}`}>
          {formatMinuteOfDay(value)}
        </Text>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => onChange(clamp(value + step, min, max))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`${label} later`}
        >
          <Text style={[styles.stepperButtonText, value >= max && styles.stepperButtonDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const router = useRouter();
  const { accentColor } = useTheme();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');

  // Re-read on focus: the user may have come back from iOS Settings.
  useFocusEffect(
    useCallback(() => {
      getReminderSettings().then(setSettings);
      getReminderPermission().then(setPermission);
    }, [])
  );

  const update = (next: ReminderSettings) => {
    setSettings(next);
    saveReminderSettings(next).catch((error) => console.error('Error saving reminders:', error));
  };

  /** Turning a reminder on needs notification permission first. */
  const ensurePermission = async (): Promise<boolean> => {
    if (permission === 'granted') return true;
    if (permission === 'undetermined') {
      const granted = await requestReminderPermission();
      setPermission(granted ? 'granted' : await getReminderPermission());
      if (granted) return true;
    }
    Alert.alert(
      'Notifications are off',
      'To get reminders, allow notifications for EatLog in your phone’s Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  };

  if (!settings) {
    return <SafeAreaView style={styles.container} />;
  }

  const setMealEnabled = async (mealType: ReminderMealType, enabled: boolean) => {
    if (enabled && !(await ensurePermission())) return;
    update({
      ...settings,
      meals: { ...settings.meals, [mealType]: { ...settings.meals[mealType], enabled } },
    });
  };

  const setMealTime = (mealType: ReminderMealType, minuteOfDay: number) => {
    update({
      ...settings,
      meals: { ...settings.meals, [mealType]: { ...settings.meals[mealType], minuteOfDay } },
    });
  };

  const setWater = async (changes: Partial<ReminderSettings['water']>) => {
    if (changes.enabled && !(await ensurePermission())) return;
    update({ ...settings, water: { ...settings.water, ...changes } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reminders</Text>
        </View>

        {permission === 'denied' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Notifications are turned off for EatLog, so reminders can’t be delivered.
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
              <Text style={styles.noticeLink}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meals</Text>
          {REMINDER_MEAL_TYPES.map((mealType) => {
            const meal = settings.meals[mealType];
            return (
              <View key={mealType}>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{MEAL_LABELS[mealType]}</Text>
                  <Switch
                    value={meal.enabled}
                    onValueChange={(enabled) => setMealEnabled(mealType, enabled)}
                    accessibilityLabel={`${MEAL_LABELS[mealType]} reminder`}
                  />
                </View>
                {meal.enabled && (
                  <TimeStepper
                    label="Remind at"
                    value={meal.minuteOfDay}
                    step={MEAL_STEP_MINUTES}
                    min={0}
                    max={LATEST_MINUTE_OF_DAY}
                    onChange={(minuteOfDay) => setMealTime(mealType, minuteOfDay)}
                  />
                )}
              </View>
            );
          })}
          <Text style={styles.disclaimer}>
            A reminder is skipped if you’ve already logged that meal. Tapping it opens voice logging.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Water</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Remind me to drink water</Text>
            <Switch
              value={settings.water.enabled}
              onValueChange={(enabled) => setWater({ enabled })}
              accessibilityLabel="Water reminders"
            />
          </View>
          {settings.water.enabled && (
            <>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Every</Text>
                <View style={styles.chipRow}>
                  {WATER_INTERVAL_OPTIONS_MINUTES.map((minutes) => {
                    const selected = settings.water.intervalMinutes === minutes;
                    return (
                      <TouchableOpacity
                        key={minutes}
                        style={[styles.chip, selected && { backgroundColor: accentColor, borderColor: accentColor }]}
                        onPress={() => setWater({ intervalMinutes: minutes })}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Every ${formatInterval(minutes)}`}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {formatInterval(minutes)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TimeStepper
                label="From"
                value={settings.water.startMinuteOfDay}
                step={WATER_WINDOW_STEP_MINUTES}
                min={0}
                max={settings.water.endMinuteOfDay - WATER_WINDOW_STEP_MINUTES}
                onChange={(startMinuteOfDay) => setWater({ startMinuteOfDay })}
              />
              <TimeStepper
                label="Until"
                value={settings.water.endMinuteOfDay}
                step={WATER_WINDOW_STEP_MINUTES}
                min={settings.water.startMinuteOfDay + WATER_WINDOW_STEP_MINUTES}
                max={23 * 60}
                onChange={(endMinuteOfDay) => setWater({ endMinuteOfDay })}
              />
            </>
          )}
          <Text style={styles.disclaimer}>
            The timer restarts each time you log a drink, so you won’t be nudged if you’re keeping
            up. Use “Add 250ml” on a reminder to log a glass straight away.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  header: { padding: 20 },
  backButtonText: { fontSize: 16, color: theme.textPrimary, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  notice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: theme.card,
    borderRadius: radii.card,
  },
  noticeText: { fontSize: 15, color: theme.textPrimary, lineHeight: 21 },
  noticeLink: { fontSize: 15, fontWeight: '600', color: '#007AFF', marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: theme.textPrimary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  settingLabel: { fontSize: 16, color: theme.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 24, fontWeight: '500', color: theme.textPrimary },
  stepperButtonDisabled: { color: theme.divider },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    minWidth: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  chipTextSelected: { color: '#FFFFFF' },
  disclaimer: {
    fontSize: 14,
    color: theme.textMuted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
