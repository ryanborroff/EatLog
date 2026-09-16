import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AccentColorId = 'sage' | 'terracotta' | 'sky' | 'lavender' | 'honey';

// `value` is the light swatch used for backgrounds (buttons, tab icons,
// selection dots) — those only need ~3:1 contrast against white as UI
// components, which all five already clear. `textOnLight` is a darkened
// variant of the same hue for when the color is used AS text on a white
// background (links, active tab label) — those need WCAG AA's 4.5:1 for
// normal text, which none of the light swatches reach on their own.
export const ACCENT_COLORS: { id: AccentColorId; label: string; value: string; textOnLight: string }[] = [
  { id: 'sage', label: 'Sage', value: '#7A9B7E', textOnLight: '#4F7154' },
  { id: 'terracotta', label: 'Terracotta', value: '#C97B5E', textOnLight: '#A85436' },
  { id: 'sky', label: 'Sky', value: '#6E9CC4', textOnLight: '#3D6D9E' },
  { id: 'lavender', label: 'Lavender', value: '#9884B8', textOnLight: '#6F5A94' },
  { id: 'honey', label: 'Honey', value: '#D4A24C', textOnLight: '#8C6318' },
];

export type WeekStartDay = 'sunday' | 'monday';

const DEFAULT_ACCENT: AccentColorId = 'sage';
const DEFAULT_WEEK_START: WeekStartDay = 'sunday';
const STORAGE_KEY = 'eatlog.accentColor';
const WEEK_START_STORAGE_KEY = 'eatlog.weekStartsOn';

interface ThemeContextValue {
  accentColorId: AccentColorId;
  accentColor: string;
  /** Darkened accent variant for text-on-white use (meets WCAG AA 4.5:1); use `accentColor` for backgrounds instead. */
  accentTextColor: string;
  setAccentColorId: (id: AccentColorId) => void;
  weekStartsOn: WeekStartDay;
  setWeekStartsOn: (day: WeekStartDay) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accentColorId: DEFAULT_ACCENT,
  accentColor: ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT)!.value,
  accentTextColor: ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT)!.textOnLight,
  setAccentColorId: () => {},
  weekStartsOn: DEFAULT_WEEK_START,
  setWeekStartsOn: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentColorId, setAccentColorIdState] = useState<AccentColorId>(DEFAULT_ACCENT);
  const [weekStartsOn, setWeekStartsOnState] = useState<WeekStartDay>(DEFAULT_WEEK_START);

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
  }, []);

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
  const accentTextColor = accent.textOnLight;

  return (
    <ThemeContext.Provider
      value={{
        accentColorId,
        accentColor,
        accentTextColor,
        setAccentColorId,
        weekStartsOn,
        setWeekStartsOn,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
