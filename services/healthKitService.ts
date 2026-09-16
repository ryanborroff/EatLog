import { Platform } from 'react-native';
import { Meal } from '../types';

const WRITE_TYPES = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
] as const;

// Tags every sample EatLog writes with the meal's database id, so an edit can find and
// remove its previous samples before writing fresh ones instead of piling up duplicates.
const MEAL_ID_METADATA_KEY = 'eatlog_meal_id';

// Lazily required: the native module only exists in a custom dev client / prod build, never in Expo Go.
let healthKit: typeof import('@kingstinct/react-native-healthkit') | null = null;
const getHealthKit = () => {
  if (Platform.OS !== 'ios') return null;
  if (!healthKit) {
    try {
      healthKit = require('@kingstinct/react-native-healthkit');
    } catch {
      return null;
    }
  }
  return healthKit;
};

export const isHealthKitAvailable = (): boolean => {
  const hk = getHealthKit();
  return hk ? hk.isHealthDataAvailable() : false;
};

export const requestHealthKitAuthorization = async (): Promise<boolean> => {
  const hk = getHealthKit();
  if (!hk) return false;
  return hk.requestAuthorization({ toShare: WRITE_TYPES });
};

// Removes any samples previously written for this meal (used before re-writing on edit,
// so corrections don't leave stale duplicates behind in Apple Health).
export const deleteMealFromHealthKit = async (mealId: string): Promise<void> => {
  const hk = getHealthKit();
  if (!hk || !mealId) return;

  const filter = {
    metadata: {
      withMetadataKey: MEAL_ID_METADATA_KEY,
      operatorType: hk.ComparisonPredicateOperator.equalTo,
      value: mealId,
    },
  };

  await Promise.all(WRITE_TYPES.map((identifier) => hk.deleteObjects(identifier, filter)));
};

// Writes each macro as a separate dietary sample at the meal's logged time, mirroring how
// Apple's own Health app and MyFitnessPal record food entries (one sample per nutrient, same timestamp).
export const writeMealToHealthKit = async (meal: Meal): Promise<void> => {
  const hk = getHealthKit();
  if (!hk) return;

  const loggedAt = new Date(meal.loggedAt);
  const metadata = meal.id ? { [MEAL_ID_METADATA_KEY]: meal.id } : undefined;

  await Promise.all([
    hk.saveQuantitySample('HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', meal.totalCalories, loggedAt, loggedAt, metadata),
    hk.saveQuantitySample('HKQuantityTypeIdentifierDietaryProtein', 'g', meal.totalProtein, loggedAt, loggedAt, metadata),
    hk.saveQuantitySample('HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', meal.totalCarbohydrate, loggedAt, loggedAt, metadata),
    hk.saveQuantitySample('HKQuantityTypeIdentifierDietaryFatTotal', 'g', meal.totalFat, loggedAt, loggedAt, metadata),
  ]);
};

// Deletes any prior samples for this meal, then writes the current totals — the safe
// path for an edit/correction, where a plain write would double-count in Apple Health.
export const resyncMealToHealthKit = async (meal: Meal): Promise<void> => {
  if (meal.id) {
    await deleteMealFromHealthKit(meal.id);
  }
  await writeMealToHealthKit(meal);
};
