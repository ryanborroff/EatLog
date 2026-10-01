import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyGoals, UserProfile } from '../../types';
import { getUserGoals, saveUserGoals, getUserProfile } from '../../services/storageService';
import { estimateMaintenanceCalories } from '../../services/calorieTarget';
import { getNutrientTargets } from '../../services/nutrientTargets';
import { useTheme, useThemedStyles, useColors } from '../../contexts/ThemeContext';
import { spacing, ThemeColors } from '../../constants/theme';
import { SettingsGroup, SettingsRow } from '../../components/SettingsList';
import { makeEditSheetStyles } from '../../components/editSheetStyles';
import ScreenHeader from '../../components/ScreenHeader';

type MacroKey = 'calories' | 'protein' | 'carbohydrate' | 'fat' | 'fibre';

const MACRO_CONFIG: Record<
  MacroKey,
  {
    label: string;
    unit: string;
    caloriesPerGram: number | null;
    calorieShare: number | null;
    defaultPlaceholder: number;
  }
> = {
  calories: { label: 'Calories', unit: 'kcal', caloriesPerGram: null, calorieShare: null, defaultPlaceholder: 2000 },
  protein: { label: 'Protein', unit: 'g', caloriesPerGram: 4, calorieShare: 0.3, defaultPlaceholder: 130 },
  carbohydrate: { label: 'Carbohydrates', unit: 'g', caloriesPerGram: 4, calorieShare: 0.4, defaultPlaceholder: 260 },
  fat: { label: 'Fat', unit: 'g', caloriesPerGram: 9, calorieShare: 0.3, defaultPlaceholder: 70 },
  fibre: { label: 'Fibre', unit: 'g', caloriesPerGram: null, calorieShare: null, defaultPlaceholder: 30 },
};

// Standard 30/40/30 protein/carb/fat split of the calorie target, for a suggested starting point only.
const suggestedGrams = (macro: MacroKey, calorieTarget: number): number | null => {
  const config = MACRO_CONFIG[macro];
  if (config.caloriesPerGram === null || config.calorieShare === null) return null;
  return Math.round((calorieTarget * config.calorieShare) / config.caloriesPerGram);
};

const TARGETS_DISCLAIMER =
  'These are general guidelines, not medical advice. Recommended daily calorie needs vary by age, sex, weight, height, and activity level – consult a doctor or registered dietitian before changing your target, especially if you have a health condition.';

export default function TargetsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const sheet = useThemedStyles(makeEditSheetStyles);
  const { accentColor, accentTextColor } = useTheme();
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingMacro, setEditingMacro] = useState<MacroKey | null>(null);
  const [macroInput, setMacroInput] = useState('');
  const [macroSuggestionOverride, setMacroSuggestionOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUserGoals()
      .then(setGoals)
      .catch((error) => console.error('Error loading goals:', error));
    getUserProfile()
      .then(setProfile)
      .catch((error) => console.error('Error loading profile:', error));
  }, []);

  const openMacroEditor = (macro: MacroKey, suggestion?: number) => {
    if (!goals) return;
    const currentValue = suggestion ?? goals[macro];
    setMacroInput(currentValue ? String(currentValue) : '');
    setMacroSuggestionOverride(suggestion ?? null);
    setEditingMacro(macro);
  };

  const openSuggestedMacros = () => {
    if (!profile || !goals) return;
    const calorieSuggestion = estimateMaintenanceCalories(profile, new Date().getFullYear());
    if (calorieSuggestion === null) {
      Alert.alert(
        'Missing info',
        'Add your sex, birth year, height, weight, and activity level in Profile first so we can suggest your targets.'
      );
      return;
    }

    const proteinSuggestion = suggestedGrams('protein', calorieSuggestion)!;
    const carbSuggestion = suggestedGrams('carbohydrate', calorieSuggestion)!;
    const fatSuggestion = suggestedGrams('fat', calorieSuggestion)!;

    Alert.alert(
      'Suggested targets',
      `Calories: ${calorieSuggestion} kcal\nProtein: ${proteinSuggestion}g\nCarbohydrates: ${carbSuggestion}g\nFat: ${fatSuggestion}g\n\nEstimated from your profile (Mifflin-St Jeor formula) and a standard 30/40/30 protein/carb/fat split. Not medical advice — tap any target to fine-tune it individually.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use these',
          onPress: async () => {
            const updatedGoals = {
              ...goals,
              calories: calorieSuggestion,
              protein: proteinSuggestion,
              carbohydrate: carbSuggestion,
              fat: fatSuggestion,
            };
            setSaving(true);
            try {
              await saveUserGoals(updatedGoals);
              setGoals(updatedGoals);
            } catch (error) {
              console.error('Error saving suggested targets:', error);
              Alert.alert('Error', 'Failed to save your targets.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const openSuggestedFibre = () => {
    if (!profile || !goals) return;
    if (!profile.sex || !profile.birthYear) {
      Alert.alert('Missing info', 'Add your sex and birth year in Profile first so we can suggest a fibre target.');
      return;
    }
    const targets = getNutrientTargets({
      // Only the birth year is collected, so July 1st is used as a
      // reasonable midpoint — this can misjudge someone's age bracket by
      // at most a few months near a life-stage boundary.
      dateOfBirth: `${profile.birthYear}-07-01`,
      sex: profile.sex,
      dailyCalorieTarget: goals.calories,
    });
    openMacroEditor('fibre', targets.fiber.value);
  };

  const handleSaveMacro = async () => {
    if (!goals || !editingMacro) return;
    const parsed = parseInt(macroInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid value', `Enter a whole number of ${MACRO_CONFIG[editingMacro].unit} greater than 0.`);
      return;
    }

    const updatedGoals = { ...goals, [editingMacro]: parsed };
    setSaving(true);
    try {
      await saveUserGoals(updatedGoals);
      setGoals(updatedGoals);
      setEditingMacro(null);
    } catch (error) {
      console.error('Error saving target:', error);
      Alert.alert('Error', 'Failed to save your target.');
    } finally {
      setSaving(false);
    }
  };

  const grams = (value: number | undefined) => (value ? `${value}g` : 'Not set');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ScreenHeader title="Daily targets" />

        {goals && (
          <>
            <SettingsGroup>
              <SettingsRow label="Calories" value={`${goals.calories} kcal`} onPress={() => openMacroEditor('calories')} />
              <SettingsRow label="Protein" value={grams(goals.protein)} onPress={() => openMacroEditor('protein')} />
              <SettingsRow
                label="Carbohydrates"
                value={grams(goals.carbohydrate)}
                onPress={() => openMacroEditor('carbohydrate')}
              />
              <SettingsRow label="Fat" value={grams(goals.fat)} onPress={() => openMacroEditor('fat')} />
              <SettingsRow label="Fibre" value={grams(goals.fibre)} onPress={() => openMacroEditor('fibre')} />
            </SettingsGroup>

            <SettingsGroup title="Suggestions" footer={TARGETS_DISCLAIMER}>
              <SettingsRow
                label="Suggest calories and macros"
                labelStyle={[styles.linkLabel, { color: accentTextColor }]}
                onPress={openSuggestedMacros}
                showChevron={false}
                accessibilityHint="Estimates targets from your profile"
              />
              <SettingsRow
                label="Suggest a fibre target"
                labelStyle={[styles.linkLabel, { color: accentTextColor }]}
                onPress={openSuggestedFibre}
                showChevron={false}
                accessibilityHint="Estimates a target from your age and sex"
              />
            </SettingsGroup>
          </>
        )}
      </ScrollView>

      <Modal
        visible={editingMacro !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingMacro(null)}
      >
        <KeyboardAvoidingView style={sheet.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {editingMacro && goals && (
            <View style={sheet.content}>
              <Text style={sheet.title}>Daily {MACRO_CONFIG[editingMacro].label.toLowerCase()} target</Text>
              <TextInput
                style={sheet.input}
                value={macroInput}
                onChangeText={setMacroInput}
                keyboardType="number-pad"
                placeholder={`e.g. ${suggestedGrams(editingMacro, goals.calories) ?? MACRO_CONFIG[editingMacro].defaultPlaceholder}`}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              {macroSuggestionOverride !== null && editingMacro === 'calories' && (
                <Text style={sheet.suggestion}>
                  Suggested: {macroSuggestionOverride} kcal to maintain your current weight, estimated from your
                  profile (Mifflin-St Jeor formula). Adjust up or down depending on your goal, then confirm below.
                </Text>
              )}
              {macroSuggestionOverride !== null && editingMacro === 'fibre' && (
                <Text style={sheet.suggestion}>
                  Suggested: {macroSuggestionOverride}g/day, based on NASEM Dietary Reference Intakes for your age and
                  sex. Adjust up or down depending on your goal, then confirm below.
                </Text>
              )}
              {macroSuggestionOverride === null && suggestedGrams(editingMacro, goals.calories) !== null && (
                <Text style={sheet.suggestion}>
                  Suggested: {suggestedGrams(editingMacro, goals.calories)}
                  {MACRO_CONFIG[editingMacro].unit} based on a standard 30/40/30 protein/carb/fat split of your calorie
                  target
                </Text>
              )}
              <Text style={sheet.note}>
                This is a general guideline, not medical advice. Recommended daily targets vary by age, sex, weight,
                height, and activity level – consult a doctor or registered dietitian to determine what's right for
                you.
              </Text>
              <View style={sheet.actions}>
                <TouchableOpacity
                  style={[sheet.button, sheet.buttonSecondary]}
                  onPress={() => {
                    setEditingMacro(null);
                    setMacroSuggestionOverride(null);
                  }}
                  disabled={saving}
                >
                  <Text style={sheet.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sheet.button, { backgroundColor: accentColor }]}
                  onPress={async () => {
                    await handleSaveMacro();
                    setMacroSuggestionOverride(null);
                  }}
                  disabled={saving}
                >
                  <Text style={sheet.buttonPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.lg,
    },
    linkLabel: {
      fontWeight: '600',
    },
  });
