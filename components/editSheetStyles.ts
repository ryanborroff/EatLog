import { StyleSheet } from 'react-native';
import { spacing, radii, ThemeColors } from '../constants/theme';

/** Bottom-sheet styles shared by the Settings edit modals (Profile, Daily targets). */
export const makeEditSheetStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    content: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: radii.card,
      borderTopRightRadius: radii.card,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
    },
    note: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: spacing.md,
      lineHeight: 20,
    },
    suggestion: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: colors.fill,
    },
    buttonSecondaryText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    // Black, not white: the primary button sits on the accent colour, and white
    // text on the light accent swatches fails WCAG AA contrast.
    buttonPrimaryText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.onAccent,
    },
    optionRow: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    optionRowText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    optionCancelButton: {
      marginTop: spacing.md,
    },
  });
