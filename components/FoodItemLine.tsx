import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../constants/theme';
import { FoodItem } from '../types';
import { formatFoodItemLine } from '../utils/formatFoodItem';

interface FoodItemLineProps {
  item: Pick<FoodItem, 'quantity' | 'unit' | 'description' | 'portionAssumed'>;
  style?: StyleProp<TextStyle>;
}

/**
 * A food item's "2 slices of toast" line, marked when its amount was a guess
 * so the user knows which numbers to check (tapping the meal lets them fix it).
 */
const FoodItemLine: React.FC<FoodItemLineProps> = ({ item, style }) => (
  <Text style={style}>
    {formatFoodItemLine(item)}
    {item.portionAssumed ? <Text style={styles.guessed}> · portion guessed</Text> : null}
  </Text>
);

const styles = StyleSheet.create({
  guessed: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

export default FoodItemLine;
