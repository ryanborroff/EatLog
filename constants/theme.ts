// Shared visual design tokens for the EatLog UI refinement.
// Note: the primary accent color remains user-selectable via ThemeContext/useTheme();
// these tokens cover everything else (neutrals, spacing, radii, typography).

export const colors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  cardBorder: '#D9D9D9',
  divider: '#DDDDDD',
  textPrimary: '#000000',
  textSecondary: '#6B6B6B',
  textMuted: '#8A8A8A',
  danger: '#FF3B30',
  observationTint: '#EAF4FB',
};

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
  secondary: { fontSize: 16, fontWeight: '400' as const, color: colors.textSecondary },
  small: { fontSize: 14, fontWeight: '400' as const },
};
