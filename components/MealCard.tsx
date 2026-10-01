import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Meal } from '../types';
import { colors, spacing, radii } from '../constants/theme';
import { formatCalories } from '../utils/formatNumber';
import { formatLoggedTime } from '../utils/formatTime';
import FoodItemLine from './FoodItemLine';

interface MealCardProps {
  meal: Meal;
  /** Opens the meal for editing. */
  onPress: () => void;
}

const formatMealType = (type: string): string => type.charAt(0).toUpperCase() + type.slice(1);

/** A logged meal: type, time, total calories and its items. Shared by Today and a History day. */
export default function MealCard({ meal, onPress }: MealCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityLabel={`Edit ${formatMealType(meal.type)}`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.type}>{formatMealType(meal.type)}</Text>
          <Text style={styles.time}>{formatLoggedTime(meal.loggedAt)}</Text>
        </View>
        <Text style={styles.calories}>{formatCalories(meal.totalCalories)} kcal</Text>
      </View>
      {meal.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <FoodItemLine item={item} style={styles.description} />
        </View>
      ))}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  type: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  time: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  calories: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  // A small gap between items and a fixed line height, so the space between
  // two items is only slightly bigger than a wrapped line within one.
  item: {
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
