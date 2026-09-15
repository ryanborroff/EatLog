import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { DayEntry, DailyGoals, Meal } from '../../types';
import {
  getUserGoals,
  getMealsForDate,
  createDayEntry,
} from '../../services/storageService';
import { useTheme } from '../../contexts/ThemeContext';
import { formatFoodItemLine } from '../../utils/formatFoodItem';

type VoiceState = 'idle' | 'listening' | 'processing' | 'clarification' | 'complete';

export default function TodayScreen() {
  const router = useRouter();
  const { accentColor } = useTheme();
  const [todayEntry, setTodayEntry] = useState<DayEntry | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [loading, setLoading] = useState(true);

  const todayDate = new Date().toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [userGoals, meals] = await Promise.all([
        getUserGoals(),
        getMealsForDate(todayDate),
      ]);

      const entry = await createDayEntry(todayDate);
      
      setGoals(userGoals);
      setTodayEntry(entry);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatMealType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleVoiceLog = () => {
    router.push('/modal');
  };

  const handleAsk = () => {
    router.push('/ask');
  };

  if (loading || !todayEntry || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remainingCalories = goals.calories - todayEntry.totals.calories;
  const remainingProtein = goals.protein - todayEntry.totals.protein;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.date}>{formatDate(todayEntry.date)}</Text>
          <TouchableOpacity
            onPress={handleAsk}
            accessibilityLabel="Ask about your diary"
            accessibilityRole="button"
          >
            <Text style={[styles.askButton, { color: accentColor }]}>Ask</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.calorieSection}>
            <Text style={styles.calorieValue}>{todayEntry.totals.calories} kcal</Text>
            <Text style={styles.calorieTarget}>of {goals.calories} kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>
              {todayEntry.totals.protein}g / {goals.protein}g
            </Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Carbohydrates</Text>
            <Text style={styles.macroValue}>{todayEntry.totals.carbohydrate}g</Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{todayEntry.totals.fat}g</Text>
          </View>
        </View>

        <View style={styles.remainingSection}>
          <Text style={styles.remainingLabel}>Calories remaining</Text>
          <Text style={styles.remainingValue}>
            {remainingCalories >= 0 ? remainingCalories : `+${Math.abs(remainingCalories)}`} kcal
          </Text>
        </View>

        <View style={styles.remainingSection}>
          <Text style={styles.remainingLabel}>Protein remaining</Text>
          <Text style={styles.remainingValue}>
            {remainingProtein >= 0 ? remainingProtein : `+${Math.abs(remainingProtein)}`}g
          </Text>
        </View>

        {todayEntry.meals.map((meal) => (
          <View key={meal.id} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealType}>{formatMealType(meal.type)}</Text>
              <Text style={styles.mealCalories}>{meal.totalCalories} kcal</Text>
            </View>
            {meal.items.map((item) => (
              <View key={item.id} style={styles.foodItem}>
                <Text style={styles.foodDescription}>
                  {formatFoodItemLine(item)}
                  {item.estimated && (
                    <Text style={styles.estimatedText}> (Estimated)</Text>
                  )}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.voiceButtonContainer}>
          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: accentColor }]}
            onPress={handleVoiceLog}
          >
            <Text style={styles.voiceButtonText}>LOG FOOD</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  askButton: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  totalsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  calorieSection: {
    marginBottom: 16,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
  },
  calorieTarget: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  macroSection: {
    marginBottom: 12,
  },
  macroLabel: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 4,
  },
  remainingSection: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingLabel: {
    fontSize: 16,
    color: '#666666',
  },
  remainingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  mealCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  mealCalories: {
    fontSize: 16,
    color: '#666666',
  },
  foodItem: {
    marginBottom: 8,
  },
  foodDescription: {
    fontSize: 16,
    color: '#000000',
  },
  estimatedText: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },
  voiceButtonContainer: {
    padding: 20,
    alignItems: 'center',
  },
  voiceButton: {
    backgroundColor: '#000000',
    borderRadius: 50,
    paddingVertical: 20,
    paddingHorizontal: 60,
    minWidth: 200,
    alignItems: 'center',
  },
  voiceButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
  },
});