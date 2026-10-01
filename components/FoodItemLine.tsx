import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../contexts/ThemeContext';
import { FoodItem } from '../types';
import { formatFoodItemLine } from '../utils/formatFoodItem';

interface FoodItemLineProps {
  item: Pick<FoodItem, 'quantity' | 'unit' | 'description' | 'portionAssumed'> &
    Partial<Pick<FoodItem, 'source' | 'confidence'>>;
  style?: StyleProp<TextStyle>;
}

/** The one caveat worth showing on an item, if any: a guessed amount first, then shaky nutrition. */
const caveat = (item: FoodItemLineProps['item']): string | null => {
  if (item.portionAssumed) return 'portion guessed';
  // Only the AI vouches for these numbers, and they didn't add up.
  if (item.source === 'ai_estimate' && item.confidence === 'low') return 'rough estimate';
  return null;
};

/**
 * A food item's "2 slices of toast" line, marked when its amount was a guess
 * or its nutrition is a rough estimate, so the user knows which numbers to
 * check (tapping the meal lets them fix it).
 */
const FoodItemLine: React.FC<FoodItemLineProps> = ({ item, style }) => {
  const styles = useThemedStyles(makeStyles);
  const note = caveat(item);
  return (
    <Text style={style}>
      {formatFoodItemLine(item)}
      {note ? <Text style={styles.guessed}> · {note}</Text> : null}
    </Text>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // textSecondary, not textMuted: this is information the user should act on,
    // so it needs AA contrast (4.5:1), which the muted grey doesn't reach.
    guessed: {
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  });

export default FoodItemLine;
