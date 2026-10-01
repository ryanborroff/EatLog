import { ACCENT_COLORS, darkColors, lightColors, ThemeColors } from '../../constants/theme';

// WCAG 2.1 relative luminance / contrast ratio for #RRGGBB colours.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA_TEXT = 4.5;
const textTokens = ['textPrimary', 'textSecondary', 'textMuted', 'warning'] as const;
const surfaces = ['background', 'card', 'sheet'] as const;

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as [string, ThemeColors][])('%s palette', (_name, palette) => {
  for (const text of textTokens) {
    for (const surface of surfaces) {
      it(`${text} on ${surface} meets AA`, () => {
        expect(contrast(palette[text], palette[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('inverseText on inverseBackground meets AA', () => {
    expect(contrast(palette.inverseText, palette.inverseBackground)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('onDestructive on destructive meets AA', () => {
    expect(contrast(palette.onDestructive, palette.destructive)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('textPrimary on fill meets AA', () => {
    expect(contrast(palette.textPrimary, palette.fill)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('textPrimary on observationTint and dangerTint meets AA', () => {
    expect(contrast(palette.textPrimary, palette.observationTint)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(palette.textPrimary, palette.dangerTint)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe.each(ACCENT_COLORS)('$label accent', (accent) => {
  it('onAccent text on the swatch meets AA in both palettes', () => {
    expect(contrast(lightColors.onAccent, accent.value)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(darkColors.onAccent, accent.value)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // Mirrors ThemeContext's accentTextColor: textOnLight in light mode, the swatch in dark mode.
  it('accent text meets AA on each surface', () => {
    for (const surface of surfaces) {
      expect(contrast(accent.textOnLight, lightColors[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(accent.value, darkColors[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
