import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayEntry } from '../../types';
import { getHistory } from '../../services/storageService';

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const storedHistory = await getHistory();
      setHistory(storedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
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

  const selectedEntry = selectedDate
    ? history.find((entry) => entry.date === selectedDate)
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedDate && selectedEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedDate(null)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.date}>{formatDate(selectedEntry.date)}</Text>
          </View>

          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Calories</Text>
              <Text style={styles.totalValue}>{selectedEntry.totals.calories} kcal</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Protein</Text>
              <Text style={styles.totalValue}>{selectedEntry.totals.protein}g</Text>
            </View>
          </View>

          {selectedEntry.meals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealType}>{formatMealType(meal.type)}</Text>
                <Text style={styles.mealCalories}>{meal.totalCalories} kcal</Text>
              </View>
              {meal.items.map((item) => (
                <View key={item.id} style={styles.foodItem}>
                  <Text style={styles.foodDescription}>
                    {item.quantity > 1 ? `${item.quantity} ` : ''}
                    {item.description}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>

        {history.map((entry) => (
          <TouchableOpacity
            key={entry.date}
            style={styles.dayCard}
            onPress={() => setSelectedDate(entry.date)}
          >
            <Text style={styles.dayDate}>{formatDate(entry.date)}</Text>
            <View style={styles.dayTotals}>
              <Text style={styles.dayCalories}>{entry.totals.calories} kcal</Text>
              <Text style={styles.dayProtein}>{entry.totals.protein}g protein</Text>
            </View>
            {entry.meals.map((meal) => (
              <View key={meal.id} style={styles.dayMeal}>
                <Text style={styles.dayMealType}>{formatMealType(meal.type)}</Text>
                <Text style={styles.dayMealCalories}>{meal.totalCalories}</Text>
              </View>
            ))}
          </TouchableOpacity>
        ))}
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
  backButton: {
    padding: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  date: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  totalsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666666',
  },
  totalValue: {
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
  dayCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  dayTotals: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 16,
  },
  dayProtein: {
    fontSize: 16,
    color: '#666666',
  },
  dayMeal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayMealType: {
    fontSize: 14,
    color: '#666666',
  },
  dayMealCalories: {
    fontSize: 14,
    color: '#666666',
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