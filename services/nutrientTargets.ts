// Dietary Reference Intake (DRI) data and personalized nutrient targets.
// Source data transcribed from docs/dri_reference_data.md (NASEM DRI tables,
// cross-referenced with Dietary Guidelines for Americans 2020-2025).

export type LifeStageGroup =
  | 'child_1_3y'
  | 'child_4_8y'
  | 'male_9_13y'
  | 'male_14_18y'
  | 'male_19_30y'
  | 'male_31_50y'
  | 'male_51_70y'
  | 'male_70plus'
  | 'female_9_13y'
  | 'female_14_18y'
  | 'female_19_30y'
  | 'female_31_50y'
  | 'female_51_70y'
  | 'female_70plus'
  | 'pregnancy_under18'
  | 'pregnancy_19_30'
  | 'pregnancy_31_50'
  | 'lactation_under18'
  | 'lactation_19_30'
  | 'lactation_31_50';

export type Sex = 'male' | 'female';
export type PregnancyStatus = 'pregnant' | 'lactating';

export interface NutrientTargetInput {
  /** ISO date string (YYYY-MM-DD) or Date. */
  dateOfBirth: string | Date;
  sex: Sex;
  /** Only applied when explicitly set — standard adult values are used otherwise. */
  pregnancyStatus?: PregnancyStatus;
  dailyCalorieTarget: number;
  /** Defaults to now; pass explicitly in tests to pin the "as of" age calculation. */
  asOf?: string | Date;
}

// Dietary Guidelines for Americans is on a 5-year review cycle; the 2020-2025
// edition (which set the added-sugar/CDRR guidance used here) is due to be
// superseded by the 2025-2030 edition, and NASEM DRI reports update on no
// fixed schedule. Flag this data for review by then.
const LAST_VERIFIED = '2024-01-01';
const NEXT_SCHEDULED_REVIEW = '2030-01-01';

type NutrientValues = Record<LifeStageGroup, number>;

const FIBER_G: NutrientValues = {
  child_1_3y: 19, child_4_8y: 25,
  male_9_13y: 31, male_14_18y: 38, male_19_30y: 38, male_31_50y: 38, male_51_70y: 30, male_70plus: 30,
  female_9_13y: 26, female_14_18y: 25, female_19_30y: 25, female_31_50y: 25, female_51_70y: 21, female_70plus: 21,
  pregnancy_under18: 28, pregnancy_19_30: 28, pregnancy_31_50: 28,
  lactation_under18: 29, lactation_19_30: 29, lactation_31_50: 29,
};

const SODIUM_AI_MG: NutrientValues = {
  child_1_3y: 800, child_4_8y: 1000,
  male_9_13y: 1200, male_14_18y: 1500, male_19_30y: 1500, male_31_50y: 1500, male_51_70y: 1300, male_70plus: 1200,
  female_9_13y: 1200, female_14_18y: 1500, female_19_30y: 1500, female_31_50y: 1500, female_51_70y: 1300, female_70plus: 1200,
  pregnancy_under18: 1500, pregnancy_19_30: 1500, pregnancy_31_50: 1500,
  lactation_under18: 1500, lactation_19_30: 1500, lactation_31_50: 1500,
};

const SODIUM_CDRR_MG: NutrientValues = {
  child_1_3y: 1200, child_4_8y: 1500,
  male_9_13y: 1800, male_14_18y: 2300, male_19_30y: 2300, male_31_50y: 2300, male_51_70y: 2300, male_70plus: 2300,
  female_9_13y: 1800, female_14_18y: 2300, female_19_30y: 2300, female_31_50y: 2300, female_51_70y: 2300, female_70plus: 2300,
  pregnancy_under18: 2300, pregnancy_19_30: 2300, pregnancy_31_50: 2300,
  lactation_under18: 2300, lactation_19_30: 2300, lactation_31_50: 2300,
};

const PROTEIN_G: NutrientValues = {
  child_1_3y: 13, child_4_8y: 19,
  male_9_13y: 34, male_14_18y: 52, male_19_30y: 56, male_31_50y: 56, male_51_70y: 56, male_70plus: 56,
  female_9_13y: 34, female_14_18y: 46, female_19_30y: 46, female_31_50y: 46, female_51_70y: 46, female_70plus: 46,
  pregnancy_under18: 71, pregnancy_19_30: 71, pregnancy_31_50: 71,
  lactation_under18: 71, lactation_19_30: 71, lactation_31_50: 71,
};

const CARBOHYDRATE_G: NutrientValues = {
  child_1_3y: 130, child_4_8y: 130,
  male_9_13y: 130, male_14_18y: 130, male_19_30y: 130, male_31_50y: 130, male_51_70y: 130, male_70plus: 130,
  female_9_13y: 130, female_14_18y: 130, female_19_30y: 130, female_31_50y: 130, female_51_70y: 130, female_70plus: 130,
  pregnancy_under18: 175, pregnancy_19_30: 175, pregnancy_31_50: 175,
  lactation_under18: 210, lactation_19_30: 210, lactation_31_50: 210,
};

const CALCIUM_MG: NutrientValues = {
  child_1_3y: 700, child_4_8y: 1000,
  male_9_13y: 1300, male_14_18y: 1300, male_19_30y: 1000, male_31_50y: 1000, male_51_70y: 1000, male_70plus: 1200,
  female_9_13y: 1300, female_14_18y: 1300, female_19_30y: 1000, female_31_50y: 1000, female_51_70y: 1200, female_70plus: 1200,
  pregnancy_under18: 1300, pregnancy_19_30: 1000, pregnancy_31_50: 1000,
  lactation_under18: 1300, lactation_19_30: 1000, lactation_31_50: 1000,
};

// Calcium UL (mg/day) — safety ceiling, never surfaced as a target.
const CALCIUM_UL_MG: NutrientValues = {
  child_1_3y: 2500, child_4_8y: 2500,
  male_9_13y: 3000, male_14_18y: 3000, male_19_30y: 2500, male_31_50y: 2500, male_51_70y: 2000, male_70plus: 2000,
  female_9_13y: 3000, female_14_18y: 3000, female_19_30y: 2500, female_31_50y: 2500, female_51_70y: 2000, female_70plus: 2000,
  pregnancy_under18: 3000, pregnancy_19_30: 2500, pregnancy_31_50: 2500,
  lactation_under18: 3000, lactation_19_30: 2500, lactation_31_50: 2500,
};

const POTASSIUM_MG: NutrientValues = {
  child_1_3y: 2000, child_4_8y: 2300,
  male_9_13y: 2300, male_14_18y: 3000, male_19_30y: 3400, male_31_50y: 3400, male_51_70y: 3400, male_70plus: 3400,
  female_9_13y: 2500, female_14_18y: 2300, female_19_30y: 2600, female_31_50y: 2600, female_51_70y: 2600, female_70plus: 2600,
  pregnancy_under18: 2600, pregnancy_19_30: 2900, pregnancy_31_50: 2900,
  lactation_under18: 2500, lactation_19_30: 2800, lactation_31_50: 2800,
};

const IRON_MG: NutrientValues = {
  child_1_3y: 7, child_4_8y: 10,
  male_9_13y: 8, male_14_18y: 11, male_19_30y: 8, male_31_50y: 8, male_51_70y: 8, male_70plus: 8,
  female_9_13y: 8, female_14_18y: 15, female_19_30y: 18, female_31_50y: 18, female_51_70y: 8, female_70plus: 8,
  pregnancy_under18: 27, pregnancy_19_30: 27, pregnancy_31_50: 27,
  lactation_under18: 10, lactation_19_30: 9, lactation_31_50: 9,
};

// Iron UL (mg/day) is only published as a flat adult figure in the source
// data (45mg), not broken out per life-stage group.
const IRON_UL_MG_ADULT = 45;

const VITAMIN_C_MG: NutrientValues = {
  child_1_3y: 15, child_4_8y: 25,
  male_9_13y: 45, male_14_18y: 75, male_19_30y: 90, male_31_50y: 90, male_51_70y: 90, male_70plus: 90,
  female_9_13y: 45, female_14_18y: 65, female_19_30y: 75, female_31_50y: 75, female_51_70y: 75, female_70plus: 75,
  pregnancy_under18: 80, pregnancy_19_30: 85, pregnancy_31_50: 85,
  lactation_under18: 115, lactation_19_30: 120, lactation_31_50: 120,
};

const VITAMIN_D_MCG: NutrientValues = {
  child_1_3y: 15, child_4_8y: 15,
  male_9_13y: 15, male_14_18y: 15, male_19_30y: 15, male_31_50y: 15, male_51_70y: 15, male_70plus: 20,
  female_9_13y: 15, female_14_18y: 15, female_19_30y: 15, female_31_50y: 15, female_51_70y: 15, female_70plus: 20,
  pregnancy_under18: 15, pregnancy_19_30: 15, pregnancy_31_50: 15,
  lactation_under18: 15, lactation_19_30: 15, lactation_31_50: 15,
};

const ADDED_SUGAR_PCT_CALORIES = 10;
const KCAL_PER_GRAM_SUGAR = 4;

// --- Life-stage bucketing -------------------------------------------------

type StandardAgeBracket = '1_3y' | '4_8y' | '9_13y' | '14_18y' | '19_30y' | '31_50y' | '51_70y' | '70plus';
type PregnancyLactationBracket = 'under18' | '19_30' | '31_50';

/** Exact completed years as of `asOf`, not a rounded/calendar-year subtraction. */
export const getAgeInYears = (dateOfBirth: string | Date, asOf: string | Date = new Date()): number => {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const ref = typeof asOf === 'string' ? new Date(asOf) : asOf;

  let age = ref.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    ref.getMonth() > dob.getMonth() ||
    (ref.getMonth() === dob.getMonth() && ref.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
};

const standardAgeBracket = (age: number): StandardAgeBracket => {
  if (age < 1) throw new RangeError(`getNutrientTargets: age ${age} is below the supported range (infant DRI values are not included in this dataset).`);
  if (age <= 3) return '1_3y';
  if (age <= 8) return '4_8y';
  if (age <= 13) return '9_13y';
  if (age <= 18) return '14_18y';
  if (age <= 30) return '19_30y';
  if (age <= 50) return '31_50y';
  if (age <= 70) return '51_70y';
  return '70plus';
};

const pregnancyLactationBracket = (age: number): PregnancyLactationBracket => {
  if (age < 19) return 'under18';
  if (age <= 30) return '19_30';
  return '31_50';
};

export const getLifeStageGroup = (
  age: number,
  sex: Sex,
  pregnancyStatus?: PregnancyStatus
): LifeStageGroup => {
  if (pregnancyStatus === 'pregnant') {
    return `pregnancy_${pregnancyLactationBracket(age)}` as LifeStageGroup;
  }
  if (pregnancyStatus === 'lactating') {
    return `lactation_${pregnancyLactationBracket(age)}` as LifeStageGroup;
  }

  const bracket = standardAgeBracket(age);
  if (bracket === '1_3y') return 'child_1_3y';
  if (bracket === '4_8y') return 'child_4_8y';
  return `${sex}_${bracket}` as LifeStageGroup;
};

// --- Public API ------------------------------------------------------------

export interface NutrientTargets {
  lifeStageGroup: LifeStageGroup;
  ageYears: number;
  lastVerified: string;
  nextScheduledReview: string;
  fiber: { value: number; unit: 'g'; type: 'AI' };
  sodium: { ai: number; cdrr: number; target: number; unit: 'mg'; type: 'AI_and_CDRR' };
  protein: { value: number; unit: 'g'; type: 'RDA' };
  carbohydrate: { value: number; unit: 'g'; type: 'RDA' };
  calcium: { value: number; ul: number; unit: 'mg'; type: 'RDA' };
  potassium: { value: number; unit: 'mg'; type: 'AI' };
  iron: { value: number; ul: number; unit: 'mg'; type: 'RDA' };
  vitaminC: { value: number; unit: 'mg'; type: 'RDA' };
  vitaminD: { value: number; unit: 'mcg'; type: 'RDA' };
  addedSugar: { value: number; unit: 'g'; type: 'guideline_not_DRI'; pctOfCalories: number };
}

export const getNutrientTargets = (input: NutrientTargetInput): NutrientTargets => {
  const age = getAgeInYears(input.dateOfBirth, input.asOf);
  const group = getLifeStageGroup(age, input.sex, input.pregnancyStatus);

  const addedSugarGrams = (ADDED_SUGAR_PCT_CALORIES / 100) * input.dailyCalorieTarget / KCAL_PER_GRAM_SUGAR;

  return {
    lifeStageGroup: group,
    ageYears: age,
    lastVerified: LAST_VERIFIED,
    nextScheduledReview: NEXT_SCHEDULED_REVIEW,
    fiber: { value: FIBER_G[group], unit: 'g', type: 'AI' },
    sodium: {
      ai: SODIUM_AI_MG[group],
      cdrr: SODIUM_CDRR_MG[group],
      target: SODIUM_CDRR_MG[group],
      unit: 'mg',
      type: 'AI_and_CDRR',
    },
    protein: { value: PROTEIN_G[group], unit: 'g', type: 'RDA' },
    carbohydrate: { value: CARBOHYDRATE_G[group], unit: 'g', type: 'RDA' },
    calcium: { value: CALCIUM_MG[group], ul: CALCIUM_UL_MG[group], unit: 'mg', type: 'RDA' },
    potassium: { value: POTASSIUM_MG[group], unit: 'mg', type: 'AI' },
    iron: { value: IRON_MG[group], ul: IRON_UL_MG_ADULT, unit: 'mg', type: 'RDA' },
    vitaminC: { value: VITAMIN_C_MG[group], unit: 'mg', type: 'RDA' },
    vitaminD: { value: VITAMIN_D_MCG[group], unit: 'mcg', type: 'RDA' },
    addedSugar: { value: Math.round(addedSugarGrams), unit: 'g', type: 'guideline_not_DRI', pctOfCalories: ADDED_SUGAR_PCT_CALORIES },
  };
};
