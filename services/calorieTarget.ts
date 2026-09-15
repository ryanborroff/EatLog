import { ActivityLevel, Sex, UserProfile } from '../types';

// Multiplies BMR to estimate total daily energy expenditure (TDEE).
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (exercise 1-3 days/week)',
  moderate: 'Moderate (exercise 3-5 days/week)',
  active: 'Active (exercise 6-7 days/week)',
  very_active: 'Very active (hard exercise + physical job)',
};

const mifflinStJeorBmr = (sex: Sex, weightKg: number, heightCm: number, age: number): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
};

/**
 * Estimates a maintenance-calorie target from Mifflin-St Jeor BMR x activity
 * level. Returns null when the profile is missing a required field. This is a
 * starting-point estimate only, not a medical recommendation.
 */
export const estimateMaintenanceCalories = (
  profile: UserProfile,
  currentYear: number
): number | null => {
  const { sex, birthYear, heightCm, weightKg, activityLevel } = profile;
  if (!sex || !birthYear || !heightCm || !weightKg || !activityLevel) return null;

  const age = currentYear - birthYear;
  if (age <= 0 || age > 120) return null;

  const bmr = mifflinStJeorBmr(sex, weightKg, heightCm, age);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
};
