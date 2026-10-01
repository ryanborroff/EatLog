import {
  DEFAULT_REMINDER_SETTINGS,
  PLAN_HORIZON_DAYS,
  ReminderSettings,
  TodayLogState,
  WATER_INTERVAL_OPTIONS_MINUTES,
  formatMinuteOfDay,
  mealReminderText,
  planReminders,
  waterReminderText,
} from '../reminderSchedule';

// Local-time dates, so the tests hold in any timezone.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes);

const settings = (overrides: {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  water?: boolean;
}): ReminderSettings => ({
  meals: {
    breakfast: { ...DEFAULT_REMINDER_SETTINGS.meals.breakfast, enabled: !!overrides.breakfast },
    lunch: { ...DEFAULT_REMINDER_SETTINGS.meals.lunch, enabled: !!overrides.lunch },
    dinner: { ...DEFAULT_REMINDER_SETTINGS.meals.dinner, enabled: !!overrides.dinner },
  },
  water: { ...DEFAULT_REMINDER_SETTINGS.water, enabled: !!overrides.water },
});

const nothingLogged: TodayLogState = { meals: [], waterLoggedAt: [] };

const mealTimes = (plan: ReturnType<typeof planReminders>) =>
  plan.filter((r) => r.kind === 'meal').map((r) => [r.mealType, r.fireAt.getTime()]);

const waterTimes = (plan: ReturnType<typeof planReminders>) =>
  plan.filter((r) => r.kind === 'water').map((r) => r.fireAt.getTime());

describe('planReminders — meals', () => {
  it('schedules nothing when every reminder is off', () => {
    expect(planReminders(settings({}), nothingLogged, at(28, 7))).toEqual([]);
  });

  it('schedules each enabled meal for today and the following days', () => {
    const plan = planReminders(settings({ lunch: true }), nothingLogged, at(28, 7));
    expect(mealTimes(plan)).toEqual(
      Array.from({ length: PLAN_HORIZON_DAYS }, (_, i) => ['lunch', at(28 + i, 13, 30).getTime()])
    );
  });

  it("skips today's reminder once its time has passed", () => {
    const plan = planReminders(settings({ breakfast: true }), nothingLogged, at(28, 10));
    expect(mealTimes(plan)[0]).toEqual(['breakfast', at(29, 9, 30).getTime()]);
  });

  it('skips a meal already logged today but keeps tomorrow', () => {
    const today: TodayLogState = { meals: [{ type: 'lunch', loggedAt: at(28, 11) }], waterLoggedAt: [] };
    const plan = planReminders(settings({ lunch: true }), today, at(28, 11, 5));
    expect(mealTimes(plan)[0]).toEqual(['lunch', at(29, 13, 30).getTime()]);
  });

  it('counts any meal logged shortly before the reminder, whatever its type', () => {
    const today: TodayLogState = { meals: [{ type: 'snack', loggedAt: at(28, 12, 45) }], waterLoggedAt: [] };
    const plan = planReminders(settings({ lunch: true }), today, at(28, 12, 50));
    expect(mealTimes(plan)[0]).toEqual(['lunch', at(29, 13, 30).getTime()]);
  });

  it('does not count an earlier meal of a different type', () => {
    const today: TodayLogState = { meals: [{ type: 'breakfast', loggedAt: at(28, 8) }], waterLoggedAt: [] };
    const plan = planReminders(settings({ lunch: true }), today, at(28, 9));
    expect(mealTimes(plan)[0]).toEqual(['lunch', at(28, 13, 30).getTime()]);
  });
});

describe('planReminders — water', () => {
  it('starts at the beginning of the active window when nothing is logged', () => {
    const plan = planReminders(settings({ water: true }), nothingLogged, at(28, 6));
    expect(waterTimes(plan).slice(0, 7)).toEqual(
      [8, 10, 12, 14, 16, 18, 20].map((h) => at(28, h).getTime())
    );
  });

  it('restarts the interval from the latest drink', () => {
    const today: TodayLogState = { meals: [], waterLoggedAt: [at(28, 9), at(28, 10, 15)] };
    const plan = planReminders(settings({ water: true }), today, at(28, 10, 16));
    expect(waterTimes(plan).filter((t) => t < at(29, 0).getTime())).toEqual(
      [at(28, 12, 15), at(28, 14, 15), at(28, 16, 15), at(28, 18, 15), at(28, 20, 15)].map((d) => d.getTime())
    );
  });

  it('never schedules outside the active window', () => {
    const today: TodayLogState = { meals: [], waterLoggedAt: [at(28, 20)] };
    const plan = planReminders(settings({ water: true }), today, at(28, 20, 1));
    expect(waterTimes(plan)[0]).toEqual(at(29, 8).getTime());
    for (const reminder of plan) {
      const minute = reminder.fireAt.getHours() * 60 + reminder.fireAt.getMinutes();
      expect(minute).toBeGreaterThanOrEqual(8 * 60);
      expect(minute).toBeLessThanOrEqual(21 * 60);
    }
  });

  it("ignores yesterday's drinks", () => {
    const today: TodayLogState = { meals: [], waterLoggedAt: [at(27, 20)] };
    const plan = planReminders(settings({ water: true }), today, at(28, 6));
    expect(waterTimes(plan)[0]).toEqual(at(28, 8).getTime());
  });

  it('stays under the iOS pending-notification limit with everything on', () => {
    const everything = settings({ breakfast: true, lunch: true, dinner: true, water: true });
    everything.water = { enabled: true, intervalMinutes: 30, startMinuteOfDay: 0, endMinuteOfDay: 23 * 60 };
    const plan = planReminders(everything, nothingLogged, at(28, 0, 1));
    expect(plan.length).toBe(64);
    // The soonest are the ones kept.
    expect(plan[0].fireAt).toEqual(at(28, 0, 30));
    expect(plan.some((reminder) => reminder.mealType === 'breakfast' && reminder.fireAt.getDate() === 28)).toBe(true);
  });
});

describe('mealReminderText', () => {
  it('fills in the meal name, lowercase mid-sentence and capitalised at the start', () => {
    const bodies = [28, 29, 30].map((day) => mealReminderText('lunch', at(day, 13, 30)).body);
    expect(new Set(bodies)).toEqual(
      new Set(['Had lunch? Tap to log it.', 'Remember to log your lunch.', "Lunch finished? Don't forget to log it."])
    );
    expect(mealReminderText('lunch', at(28, 13, 30)).title).toBe('Lunch');
  });

  it('keeps the same message for a day however often reminders are re-planned', () => {
    expect(mealReminderText('dinner', at(28, 19))).toEqual(mealReminderText('dinner', at(28, 20)));
  });

  it('changes message from one day to the next', () => {
    expect(mealReminderText('breakfast', at(28, 9)).body).not.toBe(mealReminderText('breakfast', at(29, 9)).body);
  });
});

describe('waterReminderText', () => {
  it('keeps the same message for a reminder however often it is re-planned', () => {
    expect(waterReminderText(at(28, 10, 15))).toEqual(waterReminderText(at(28, 10, 15)));
    expect(waterReminderText(at(28, 10)).title).toBe('Water');
  });

  it.each(WATER_INTERVAL_OPTIONS_MINUTES)('never repeats back to back every %i minutes', (interval) => {
    const plan = planReminders(
      { ...settings({ water: true }), water: { ...DEFAULT_REMINDER_SETTINGS.water, enabled: true, intervalMinutes: interval } },
      nothingLogged,
      at(28, 0)
    );
    const bodies = plan.map((reminder) => waterReminderText(reminder.fireAt).body);
    for (let i = 1; i < bodies.length; i++) {
      if (plan[i].fireAt.getDate() === plan[i - 1].fireAt.getDate()) expect(bodies[i]).not.toBe(bodies[i - 1]);
    }
    expect(new Set(bodies).size).toBeGreaterThan(1);
  });
});

describe('formatMinuteOfDay', () => {
  it('pads hours and minutes', () => {
    expect(formatMinuteOfDay(9 * 60 + 5)).toBe('09:05');
    expect(formatMinuteOfDay(19 * 60 + 30)).toBe('19:30');
  });
});
