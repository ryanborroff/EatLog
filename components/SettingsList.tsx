import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../constants/theme';

interface SettingsGroupProps {
  title?: string;
  /** Explanatory text under the card; pass a node for anything richer than plain text. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** An inset rounded card of rows, iOS "inset grouped" style, with hairline dividers between rows. */
export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title && (
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      )}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 && <View style={styles.divider} />}
            {row}
          </React.Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Text style={styles.footer}>{footer}</Text> : footer}
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  /** Defaults to showing a chevron whenever the row is tappable. */
  showChevron?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  /** Replaces the value, e.g. a Switch. */
  accessory?: React.ReactNode;
  accessibilityHint?: string;
}

export function SettingsRow({
  label,
  value,
  onPress,
  showChevron = !!onPress,
  labelStyle,
  accessory,
  accessibilityHint,
}: SettingsRowProps) {
  const content = (
    <>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      {accessory ??
        (value !== undefined && (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ))}
      {showChevron && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginHorizontal: spacing.lg + spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  value: {
    flexShrink: 1,
    fontSize: 16,
    color: colors.textSecondary,
  },
  chevron: {
    marginLeft: 4,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg + spacing.md,
    marginTop: spacing.xs,
  },
});

/** SettingsGroup's footer text style, for footers built from several pieces (e.g. with a link). */
export const settingsFooterTextStyle = styles.footer;
