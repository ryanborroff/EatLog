import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AccentColorId = 'sage' | 'terracotta' | 'sky' | 'lavender' | 'honey';

export const ACCENT_COLORS: { id: AccentColorId; label: string; value: string }[] = [
  { id: 'sage', label: 'Sage', value: '#7A9B7E' },
  { id: 'terracotta', label: 'Terracotta', value: '#C97B5E' },
  { id: 'sky', label: 'Sky', value: '#6E9CC4' },
  { id: 'lavender', label: 'Lavender', value: '#9884B8' },
  { id: 'honey', label: 'Honey', value: '#D4A24C' },
];

const DEFAULT_ACCENT: AccentColorId = 'sage';
const STORAGE_KEY = 'eatlog.accentColor';

interface ThemeContextValue {
  accentColorId: AccentColorId;
  accentColor: string;
  setAccentColorId: (id: AccentColorId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  accentColorId: DEFAULT_ACCENT,
  accentColor: ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT)!.value,
  setAccentColorId: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accentColorId, setAccentColorIdState] = useState<AccentColorId>(DEFAULT_ACCENT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && ACCENT_COLORS.some((c) => c.id === stored)) {
        setAccentColorIdState(stored as AccentColorId);
      }
    });
  }, []);

  const setAccentColorId = (id: AccentColorId) => {
    setAccentColorIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch((error) => {
      console.error('Error saving accent color:', error);
    });
  };

  const accentColor = ACCENT_COLORS.find((c) => c.id === accentColorId)!.value;

  return (
    <ThemeContext.Provider value={{ accentColorId, accentColor, setAccentColorId }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
