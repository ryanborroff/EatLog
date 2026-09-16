import { getNutrientTargets, getAgeInYears, getLifeStageGroup } from '../nutrientTargets';

const asOf = '2026-06-15';

describe('getAgeInYears', () => {
  it('computes exact completed years, not calendar-year subtraction', () => {
    expect(getAgeInYears('2008-06-16', asOf)).toBe(17); // birthday tomorrow
    expect(getAgeInYears('2008-06-15', asOf)).toBe(18); // birthday today
    expect(getAgeInYears('2008-06-14', asOf)).toBe(18); // birthday yesterday
  });
});

describe('getLifeStageGroup', () => {
  it('buckets standard age brackets by sex', () => {
    expect(getLifeStageGroup(2, 'female')).toBe('child_1_3y');
    expect(getLifeStageGroup(6, 'male')).toBe('child_4_8y');
    expect(getLifeStageGroup(10, 'male')).toBe('male_9_13y');
    expect(getLifeStageGroup(25, 'female')).toBe('female_19_30y');
  });

  it('routes to pregnancy/lactation groups only when explicitly set', () => {
    expect(getLifeStageGroup(25, 'female', 'pregnant')).toBe('pregnancy_19_30');
    expect(getLifeStageGroup(25, 'female', 'lactating')).toBe('lactation_19_30');
    expect(getLifeStageGroup(25, 'female')).toBe('female_19_30y');
  });

  it('handles age-bracket boundaries correctly', () => {
    // 18 -> 14-18 bracket, 19 -> 19-30 bracket
    expect(getLifeStageGroup(18, 'male')).toBe('male_14_18y');
    expect(getLifeStageGroup(19, 'male')).toBe('male_19_30y');
    // 51 -> still 19-50's neighbor bracket boundary: 50 -> 31-50, 51 -> 51-70
    expect(getLifeStageGroup(50, 'female')).toBe('female_31_50y');
    expect(getLifeStageGroup(51, 'female')).toBe('female_51_70y');
    // 70 -> 51-70 bracket, 71 -> 70+ bracket
    expect(getLifeStageGroup(70, 'male')).toBe('male_51_70y');
    expect(getLifeStageGroup(71, 'male')).toBe('male_70plus');
  });
});

describe('getNutrientTargets', () => {
  it('returns correct targets for a 10-year-old boy', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '2016-06-15',
      sex: 'male',
      dailyCalorieTarget: 1800,
      asOf,
    });
    expect(targets.lifeStageGroup).toBe('male_9_13y');
    expect(targets.fiber.value).toBe(31);
    expect(targets.protein.value).toBe(34);
    expect(targets.sodium).toEqual({ ai: 1200, cdrr: 1800, target: 1800, unit: 'mg', type: 'AI_and_CDRR' });
  });

  it('returns correct targets for a 35-year-old woman', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1991-01-01',
      sex: 'female',
      dailyCalorieTarget: 2000,
      asOf,
    });
    expect(targets.lifeStageGroup).toBe('female_31_50y');
    expect(targets.calcium).toEqual({ value: 1000, ul: 2500, unit: 'mg', type: 'RDA' });
    expect(targets.iron).toEqual({ value: 18, ul: 45, unit: 'mg', type: 'RDA' });
  });

  it('returns correct targets for a 65-year-old man', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1961-01-01',
      sex: 'male',
      dailyCalorieTarget: 2200,
      asOf,
    });
    expect(targets.lifeStageGroup).toBe('male_51_70y');
    expect(targets.fiber.value).toBe(30);
    expect(targets.potassium.value).toBe(3400);
  });

  it('applies pregnancy values only when pregnancyStatus is set', () => {
    const pregnant = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      pregnancyStatus: 'pregnant',
      dailyCalorieTarget: 2200,
      asOf,
    });
    expect(pregnant.lifeStageGroup).toBe('pregnancy_19_30');
    expect(pregnant.iron.value).toBe(27);
    expect(pregnant.protein.value).toBe(71);

    const notPregnant = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      dailyCalorieTarget: 2200,
      asOf,
    });
    expect(notPregnant.lifeStageGroup).toBe('female_19_30y');
    expect(notPregnant.iron.value).toBe(18);
  });

  it('applies lactation values only when pregnancyStatus is set to lactating', () => {
    const lactating = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      pregnancyStatus: 'lactating',
      dailyCalorieTarget: 2500,
      asOf,
    });
    expect(lactating.lifeStageGroup).toBe('lactation_19_30');
    expect(lactating.carbohydrate.value).toBe(210);
    expect(lactating.vitaminC.value).toBe(120);
  });

  it('computes added sugar as 10% of calories / 4 kcal per gram, not a static lookup', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      dailyCalorieTarget: 2000,
      asOf,
    });
    expect(targets.addedSugar.value).toBe(50); // 10% of 2000 = 200 kcal / 4 = 50g

    const targets2 = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      dailyCalorieTarget: 1600,
      asOf,
    });
    expect(targets2.addedSugar.value).toBe(40);
  });

  it('defaults the sodium daily target to CDRR, not AI', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'male',
      dailyCalorieTarget: 2400,
      asOf,
    });
    expect(targets.sodium.target).toBe(targets.sodium.cdrr);
    expect(targets.sodium.target).not.toBe(targets.sodium.ai);
  });

  it('exposes UL fields separately from RDA/AI targets', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      dailyCalorieTarget: 2000,
      asOf,
    });
    expect(targets.calcium.ul).toBeGreaterThan(targets.calcium.value);
    expect(targets.iron.ul).toBeGreaterThan(targets.iron.value);
  });

  it('includes provenance metadata for data-review flagging', () => {
    const targets = getNutrientTargets({
      dateOfBirth: '1996-01-01',
      sex: 'female',
      dailyCalorieTarget: 2000,
      asOf,
    });
    expect(targets.lastVerified).toBe('2024-01-01');
    expect(targets.nextScheduledReview).toBe('2030-01-01');
  });

  it('handles age-bracket boundary edge cases end-to-end (exactly 18, 51, 70)', () => {
    expect(
      getNutrientTargets({ dateOfBirth: '2008-06-15', sex: 'male', dailyCalorieTarget: 2200, asOf }).lifeStageGroup
    ).toBe('male_14_18y');
    expect(
      getNutrientTargets({ dateOfBirth: '1975-06-15', sex: 'female', dailyCalorieTarget: 2200, asOf }).lifeStageGroup
    ).toBe('female_51_70y');
    expect(
      getNutrientTargets({ dateOfBirth: '1956-06-15', sex: 'male', dailyCalorieTarget: 2200, asOf }).lifeStageGroup
    ).toBe('male_51_70y');
    expect(
      getNutrientTargets({ dateOfBirth: '1955-06-14', sex: 'male', dailyCalorieTarget: 2200, asOf }).lifeStageGroup
    ).toBe('male_70plus');
  });
});
