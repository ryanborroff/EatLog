import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { DayEntry } from '../../types';
import { getHistory, getUserGoals } from '../../services/storageService';

export default function InsightsScreen() {
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [goals, setGoals] = useState<{ calories: number; protein: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [])
  );

  const loadInsights = async () => {
    try {
      const [storedHistory, userGoals] = await Promise.all([
        getHistory(),
        getUserGoals(),
      ]);

      setHistory(storedHistory);
      setGoals(userGoals);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate weekly averages
  const totalCalories = history.reduce((sum, entry) => sum + entry.totals.calories, 0);
  const totalProtein = history.reduce((sum, entry) => sum + entry.totals.protein, 0);
  const avgCalories = history.length > 0 ? Math.round(totalCalories / history.length) : 0;
  const avgProtein = history.length > 0 ? Math.round(totalProtein / history.length) : 0;

  // Calculate days within targets
  const daysWithinCalorieTarget = history.filter(
    (entry) => entry.totals.calories <= goals.calories
  ).length;
  const daysHittingProteinTarget = history.filter(
    (entry) => entry.totals.protein >= goals.protein
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This week</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Average calories</Text>
            <Text style={styles.insightValue}>{avgCalories} kcal</Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Average protein</Text>
            <Text style={styles.insightValue}>{avgProtein}g</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target progress</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Days within calorie target</Text>
            <Text style={styles.insightValue}>
              {daysWithinCalorieTarget} / {history.length}
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Days hitting protein target</Text>
            <Text style={styles.insightValue}>
              {daysHittingProteinTarget} / {history.length}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observations</Text>
          <View style={styles.observationCard}>
            <Text style={styles.observationText}>
              Your protein intake has been fairly consistent this week.
            </Text>
          </View>
          <View style={styles.observationCard}>
            <Text style={styles.observationText}>
              Most of your calorie variation is coming from evening meals.
            </Text>
          </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  insightCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  insightLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  observationCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  observationText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
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