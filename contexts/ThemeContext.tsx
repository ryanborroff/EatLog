import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENT_COLORS, AccentColorId, palettes, ThemeColors } from '../constants/theme';

export { ACCENT_COLORS };
export type { AccentColorId };

export type WeekStartDay = 'sunday' | 'monday';

/** The user's choice; 'system' follows the device setting. */
export type ColorSchemePreference = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

const DEFAULT_ACCENT: AccentColorId = 'sage';
const DEFAULT_WEEK_START: WeekStartDay = 'sunday';
const STORAGE_KEY = 'eatlog.accentColor';
const WEEK_START_STORAGE_KEY = 'eatlog.weekStartsOn';
const COLOR_SCHEME_STORAGE_KEY = 'eatlog.colorScheme';

// Applied natively too, so the keyboard, alerts, switches and pickers match
// the app rather than the device setting.
const applyColorSchemePreference = (preference: ColorSchemePreference) => {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
};

interface ThemeContextValue {
  accentColorId: AccentColorId;
  accentColor: string;
  /** Accent variant safe to use as text on the current background (meets WCAG AA 4.5:1); use `accentColor` for backgrounds instead. */
  accentTextColor: string;
  colorScheme: ResolvedColorScheme;
  colors: ThemeColors;
  colorSchemePreference: ColorSchemePreference;
  setColorSchemePreference: (preference: ColorSchemePreference) => void;
  setAccentColorId: (id: AccentColorId) => void;
  weekStartsOn: WeekStartDay;
  setWeekStartsOn: (day: WeekStartDay) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accentColorId: DEFAULT_ACCENT,
  accentColor: ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT)!.value,
  accentTextColor: ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT)!.textOnLight,
  setAccentColorId: () => {},
  colorScheme: 'light',
  colors: palettes.light,
  colorSchemePreference: 'system',
  setColorSchemePreference: () => {},
  weekStartsOn: DEFAULT_WEEK_START,
  setWeekStartsOn: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentColorId, setAccentColorIdState] = useState<AccentColorId>(DEFAULT_ACCENT);
  const [weekStartsOn, setWeekStartsOnState] = useState<WeekStartDay>(DEFAULT_WEEK_START);
  const [colorSchemePreference, setColorSchemePreferenceState] = useState<ColorSchemePreference>('system');
  const [colorSchemeLoaded, setColorSchemeLoaded] = useState(false);
  const colorScheme: ResolvedColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && ACCENT_COLORS.some((c) => c.id === stored)) {
        setAccentColorIdState(stored as AccentColorId);
      }
    });
    AsyncStorage.getItem(WEEK_START_STORAGE_KEY).then((stored) => {
      if (stored === 'sunday' || stored === 'monday') {
        setWeekStartsOnState(stored);
      }
    });
    AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark') {
          setColorSchemePreferenceState(stored);
          applyColorSchemePreference(stored);
        }
      })
      .finally(() => setColorSchemeLoaded(true));
  }, []);

  const setColorSchemePreference = (preference: ColorSchemePreference) => {
    setColorSchemePreferenceState(preference);
    applyColorSchemePreference(preference);
    AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference).catch((error) => {
      console.error('Error saving color scheme:', error);
    });
  };

  const setAccentColorId = (id: AccentColorId) => {
    setAccentColorIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch((error) => {
      console.error('Error saving accent color:', error);
    });
  };

  const setWeekStartsOn = (day: WeekStartDay) => {
    setWeekStartsOnState(day);
    AsyncStorage.setItem(WEEK_START_STORAGE_KEY, day).catch((error) => {
      console.error('Error saving week start day:', error);
    });
  };

  const accent = ACCENT_COLORS.find((c) => c.id === accentColorId)!;
  const accentColor = accent.value;
  const accentTextColor = colorScheme === 'dark' ? accent.value : accent.textOnLight;
  const colors = palettes[colorScheme];

  // Hold the first render until a saved override is applied, so a dark-mode
  // user doesn't see one light frame on launch (or vice versa).
  if (!colorSchemeLoaded) return null;

  return (
    <ThemeContext.Provider
      value={{
        accentColorId,
        accentColor,
        accentTextColor,
        setAccentColorId,
        colorScheme,
        colors,
        colorSchemePreference,
        setColorSchemePreference,
        weekStartsOn,
        setWeekStartsOn,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

/** The palette for the active color scheme. */
export const useColors = () => useContext(ThemeContext).colors;

/**
 * Builds a component's styles from the active palette. Pass a factory defined
 * at module scope (not inline) so styles are only rebuilt when the scheme changes:
 *
 *   const makeStyles = (colors: ThemeColors) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
