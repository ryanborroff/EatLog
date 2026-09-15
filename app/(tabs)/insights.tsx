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
import { track } from '../../services/analytics';
import { colors, spacing, radii } from '../../constants/theme';

export default function InsightsScreen() {
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [goals, setGoals] = useState<{ calories: number; protein: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
      track('weekly_summary_viewed');
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

  const calorieProgressRatio = history.length > 0 ? daysWithinCalorieTarget / history.length : 0;
  const proteinProgressRatio = history.length > 0 ? daysHittingProteinTarget / history.length : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This week</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Average calories</Text>
            <Text style={styles.insightValue}>{avgCalories} kcal</Text>
          </View>
          <View style={[styles.insightCard, styles.insightCardLast]}>
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
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(calorieProgressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
          <View style={[styles.insightCard, styles.insightCardLast]}>
            <Text style={styles.insightLabel}>Days hitting protein target</Text>
            <Text style={styles.insightValue}>
              {daysHittingProteinTarget} / {history.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(proteinProgressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.sectionTitle}>Observations</Text>
          <View style={styles.observationCard}>
            <Text style={styles.observationText}>
              Your protein intake has been fairly consistent this week.
            </Text>
          </View>
          <View style={[styles.observationCard, styles.observationCardLast]}>
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLast: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  insightCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    minHeight: 110,
    justifyContent: 'center',
  },
  insightCardLast: {
    marginBottom: 0,
  },
  insightLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
  observationCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.observationTint,
    borderRadius: radii.card,
  },
  observationCardLast: {
    marginBottom: 0,
  },
  observationText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
