// Shared visual design tokens for the EatLog UI refinement.
// Note: the primary accent color remains user-selectable via ThemeContext/useTheme();
// these tokens cover everything else (neutrals, spacing, radii, typography).

export const lightColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  // Bottom sheets and dialogs that float over a dimmed screen.
  sheet: '#FFFFFF',
  // Low-emphasis control fill, e.g. a Cancel button on a sheet.
  fill: '#F2F2F2',
  cardBorder: '#D9D9D9',
  divider: '#DDDDDD',
  textPrimary: '#000000',
  // Both greys clear WCAG AA (4.5:1) on white and on colors.card, so either
  // can be used for real text. Muted is the lighter step, for hints,
  // placeholders and chart labels; secondary for labels and supporting text.
  textSecondary: '#5C5C5C',
  textMuted: '#707070',
  // Unavailable options (e.g. future days in the calendar). Deliberately faint;
  // WCAG exempts disabled controls from the contrast minimum.
  textDisabled: '#DDDDDD',
  danger: '#FF3B30',
  // Light wash behind error text (e.g. a failed answer in Ask).
  dangerTint: '#FFF0EF',
  // Filled destructive actions (Delete buttons, swipe-to-delete), with white
  // text/icons at about 4.7:1. Same in both schemes.
  destructive: '#D04040',
  onDestructive: '#FFFFFF',
  // Off-target flag. Dark enough to use as text too: about 4.7:1 on card,
  // 5.1:1 on white.
  warning: '#A95909',
  progressTrack: '#E4E4E4',
  // Text and icons on an accent-coloured fill. None of the light accent
  // swatches reach 4.5:1 with white text, but all of them do with black.
  onAccent: '#000000',
  observationTint: '#EAF4FB',
  // High-emphasis fills that flip with the scheme: black buttons with white
  // text in light mode, white buttons with black text in dark mode.
  inverseBackground: '#000000',
  inverseText: '#FFFFFF',
  // Scrim behind bottom sheets and modals.
  overlay: 'rgba(0, 0, 0, 0.4)',
  shadow: '#000000',
};

export type ThemeColors = typeof lightColors;

// Pure black background to match iOS's own dark mode (and save power on OLED).
// Cards step up to iOS's secondary grouped background so they still read as
// raised surfaces. Text greys are chosen to clear 4.5:1 on both background
// and card, matching the guarantee the light palette makes.
export const darkColors: ThemeColors = {
  background: '#000000',
  card: '#1C1C1E',
  // Raised above the black background so sheets don't vanish into the scrim.
  sheet: '#1C1C1E',
  fill: '#2C2C2E',
  cardBorder: '#38383A',
  divider: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  textDisabled: '#48484A',
  danger: '#FF453A',
  dangerTint: '#3A1A18',
  destructive: '#D04040',
  onDestructive: '#FFFFFF',
  // The light-mode amber is too dark on black; this one is about 8:1.
  warning: '#F0A04B',
  progressTrack: '#2C2C2E',
  // The accent swatches are light in both schemes, so black text still wins.
  onAccent: '#000000',
  observationTint: '#14283A',
  inverseBackground: '#FFFFFF',
  inverseText: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

export const palettes = { light: lightColors, dark: darkColors };

// Static light palette for screens not yet moved to useColors()/useThemedStyles().
// New code should read colors from those hooks so it follows the color scheme.
export const colors = lightColors;

export type AccentColorId = 'sage' | 'terracotta' | 'sky' | 'lavender' | 'honey';

// `value` is the light swatch used for backgrounds (buttons, tab icons,
// selection dots) — those only need ~3:1 contrast against white as UI
// components, which all five already clear. `textOnLight` is a darkened
// variant of the same hue for when the color is used AS text on a white
// background (links, active tab label) — those need WCAG AA's 4.5:1 for
// normal text, which none of the light swatches reach on their own. On the
// dark palette the light swatch itself clears 4.5:1, so it doubles as text.
export const ACCENT_COLORS: { id: AccentColorId; label: string; value: string; textOnLight: string }[] = [
  { id: 'sage', label: 'Sage', value: '#7A9B7E', textOnLight: '#4F7154' },
  { id: 'terracotta', label: 'Terracotta', value: '#C97B5E', textOnLight: '#A85436' },
  { id: 'sky', label: 'Sky', value: '#6E9CC4', textOnLight: '#3D6D9E' },
  { id: 'lavender', label: 'Lavender', value: '#9884B8', textOnLight: '#6F5A94' },
  { id: 'honey', label: 'Honey', value: '#D4A24C', textOnLight: '#8C6318' },
];

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  card: 16,
  pill: 24,
};

export const typography = {
  screenTitle: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  sectionHeading: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  cardHeading: { fontSize: 20, fontWeight: '700' as const },
  largeMetric: { fontSize: 32, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  // No color here: pair with colors.textSecondary from the active palette.
  secondary: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
};
