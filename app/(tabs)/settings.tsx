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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ActivityLevel, DailyGoals, Sex, UserProfile } from '../../types';
import {
  getUserGoals,
  saveUserGoals,
  getUserProfile,
  saveUserProfile,
} from '../../services/storageService';
import { signOut } from '../../services/authService';
import { ACTIVITY_LEVEL_LABELS, estimateMaintenanceCalories } from '../../services/calorieTarget';
import { getNutrientTargets } from '../../services/nutrientTargets';
import { ACCENT_COLORS, WeekStartDay, useTheme } from '../../contexts/ThemeContext';
import { colors as theme, spacing, radii } from '../../constants/theme';
import { getAppleHealthSyncEnabled, setAppleHealthSyncEnabled } from '../../services/healthSyncPreference';
import { requestHealthKitAuthorization } from '../../services/healthKitService';

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

type NumericProfileField = 'birthYear' | 'heightCm' | 'weightKg';
type ChoiceProfileField = 'sex' | 'activityLevel';

const NUMERIC_PROFILE_CONFIG: Record<
  NumericProfileField,
  { label: string; unit: string; placeholder: string }
> = {
  birthYear: { label: 'Birth year', unit: '', placeholder: 'e.g. 1990' },
  heightCm: { label: 'Height', unit: 'cm', placeholder: 'e.g. 170' },
  weightKg: { label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = (
  Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]
).map((value) => ({ value, label: ACTIVITY_LEVEL_LABELS[value] }));

export default function SettingsScreen() {
  const router = useRouter();
  const { accentColor, accentTextColor, accentColorId, setAccentColorId, weekStartsOn, setWeekStartsOn } = useTheme();
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingMacro, setEditingMacro] = useState<MacroKey | null>(null);
  const [macroInput, setMacroInput] = useState('');
  const [macroSuggestionOverride, setMacroSuggestionOverride] = useState<number | null>(null);
  const [editingNumericField, setEditingNumericField] = useState<NumericProfileField | null>(
    null
  );
  const [numericFieldInput, setNumericFieldInput] = useState('');
  const [editingChoiceField, setEditingChoiceField] = useState<ChoiceProfileField | null>(null);
  const [saving, setSaving] = useState(false);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(false);
  const [healthSyncBusy, setHealthSyncBusy] = useState(false);

  useEffect(() => {
    loadGoals();
    loadProfile();
    getAppleHealthSyncEnabled().then(setHealthSyncEnabled);
  }, []);

  const handleToggleHealthSync = async (value: boolean) => {
    if (value) {
      setHealthSyncBusy(true);
      try {
        const granted = await requestHealthKitAuthorization();
        if (!granted) {
          Alert.alert(
            'Apple Health access needed',
            'EatLog needs permission to write to Apple Health. You can grant it in Settings → Privacy & Security → Health → EatLog.'
          );
          return;
        }
        await setAppleHealthSyncEnabled(true);
        setHealthSyncEnabled(true);
      } catch (error) {
        console.error('Error enabling Apple Health sync:', error);
        Alert.alert('Error', 'Could not connect to Apple Health.');
      } finally {
        setHealthSyncBusy(false);
      }
    } else {
      await setAppleHealthSyncEnabled(false);
      setHealthSyncEnabled(false);
    }
  };

  const loadGoals = async () => {
    try {
      const userGoals = await getUserGoals();
      setGoals(userGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const userProfile = await getUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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
      `Calories: ${calorieSuggestion} kcal\nProtein: ${proteinSuggestion}g\nCarbohydrates: ${carbSuggestion}g\nFat: ${fatSuggestion}g\n\nEstimated from your profile (Mifflin-St Jeor formula) and a standard 30/40/30 protein/carb/fat split. Not medical advice — use Targets below to fine-tune any of these individually.`,
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
      Alert.alert(
        'Missing info',
        'Add your sex and birth year in Profile first so we can suggest a fibre target.'
      );
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
      Alert.alert(
        'Invalid value',
        `Enter a whole number of ${MACRO_CONFIG[editingMacro].unit} greater than 0.`
      );
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

  const openNumericFieldEditor = (field: NumericProfileField) => {
    if (!profile) return;
    const currentValue = profile[field];
    setNumericFieldInput(currentValue ? String(currentValue) : '');
    setEditingNumericField(field);
  };

  const handleSaveNumericField = async () => {
    if (!profile || !editingNumericField) return;
    const parsed = parseInt(numericFieldInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid value', 'Enter a whole number greater than 0.');
      return;
    }

    const updatedProfile = { ...profile, [editingNumericField]: parsed };
    setSaving(true);
    try {
      await saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      setEditingNumericField(null);
    } catch (error) {
      console.error('Error saving profile field:', error);
      Alert.alert('Error', 'Failed to save that value.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectChoiceField = async (field: ChoiceProfileField, value: string) => {
    if (!profile) return;
    const updatedProfile = { ...profile, [field]: value };
    setSaving(true);
    try {
      await saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      setEditingChoiceField(null);
    } catch (error) {
      console.error('Error saving profile field:', error);
      Alert.alert('Error', 'Failed to save that value.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out.');
          }
        },
      },
    ]);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Name</Text>
            <Text style={styles.settingValue}>John Doe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setEditingChoiceField('sex')}
          >
            <Text style={styles.settingLabel}>Sex</Text>
            <Text style={styles.settingValue}>
              {profile?.sex ? SEX_OPTIONS.find((o) => o.value === profile.sex)?.label : 'Not set'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openNumericFieldEditor('birthYear')}>
            <Text style={styles.settingLabel}>Birth year</Text>
            <Text style={styles.settingValue}>{profile?.birthYear ?? 'Not set'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openNumericFieldEditor('heightCm')}>
            <Text style={styles.settingLabel}>Height</Text>
            <Text style={styles.settingValue}>
              {profile?.heightCm ? `${profile.heightCm} cm` : 'Not set'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openNumericFieldEditor('weightKg')}>
            <Text style={styles.settingLabel}>Weight</Text>
            <Text style={styles.settingValue}>
              {profile?.weightKg ? `${profile.weightKg} kg` : 'Not set'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setEditingChoiceField('activityLevel')}
          >
            <Text style={styles.settingLabel}>Activity level</Text>
            <Text style={styles.settingValue}>
              {profile?.activityLevel
                ? ACTIVITY_LEVEL_LABELS[profile.activityLevel].split(' (')[0]
                : 'Not set'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            We’ll use this information to suggest your starting calorie and nutrition targets. This isn’t medical advice, and you can skip it if you prefer.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Targets</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => openMacroEditor('calories')}>
            <Text style={styles.settingLabel}>Calories</Text>
            <Text style={styles.settingValue}>{goals.calories} kcal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={openSuggestedMacros}>
            <Text style={[styles.settingLabelLink, { color: accentTextColor }]}>
              Suggest my macros target
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openMacroEditor('protein')}>
            <Text style={styles.settingLabel}>Protein</Text>
            <Text style={styles.settingValue}>{goals.protein}g</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => openMacroEditor('carbohydrate')}
          >
            <Text style={styles.settingLabel}>Carbohydrates</Text>
            <Text style={styles.settingValue}>{goals.carbohydrate ? `${goals.carbohydrate}g` : 'Not set'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openMacroEditor('fat')}>
            <Text style={styles.settingLabel}>Fat</Text>
            <Text style={styles.settingValue}>{goals.fat ? `${goals.fat}g` : 'Not set'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openMacroEditor('fibre')}>
            <Text style={styles.settingLabel}>Fibre</Text>
            <Text style={styles.settingValue}>{goals.fibre ? `${goals.fibre}g` : 'Not set'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={openSuggestedFibre}>
            <Text style={[styles.settingLabelLink, { color: accentTextColor }]}>
              Suggest my fibre target
            </Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            These are general guidelines, not medical advice. Recommended daily calorie needs
            vary by age, sex, weight, height, and activity level – consult a doctor or registered
            dietitian before changing your target, especially if you have a health condition.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.colorSwatchRow}>
            {ACCENT_COLORS.map((color) => (
              <TouchableOpacity
                key={color.id}
                style={styles.colorSwatchWrapper}
                onPress={() => setAccentColorId(color.id)}
                accessibilityLabel={`${color.label} accent color`}
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color.value },
                    accentColorId === color.id && styles.colorSwatchSelected,
                  ]}
                />
                <Text style={styles.colorSwatchLabel}>{color.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <Text style={styles.weekStartLabel}>Week begins on</Text>
          <View style={styles.weekStartRow}>
            {WEEK_START_OPTIONS.map((option) => {
              const selected = option.value === weekStartsOn;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.weekStartChip,
                    selected && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}
                  onPress={() => setWeekStartsOn(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.weekStartChipText, selected && styles.weekStartChipTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Apple Health</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Sync to Apple Health</Text>
              <Switch
                value={healthSyncEnabled}
                onValueChange={handleToggleHealthSync}
                disabled={healthSyncBusy}
              />
            </View>
            <Text style={styles.disclaimer}>
              When on, EatLog writes the calories and macros you log to Apple Health. EatLog never
              reads data from Apple Health.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My foods</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/settings/personal-foods')}
          >
            <Text style={styles.settingLabel}>Manage my foods</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Add the exact nutrition of a food by scanning the barcode or type entry. EatLog uses
            these figures instead of estimating whenever it recognises the food.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick-log shortcuts</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/settings/usual-foods')}
          >
            <Text style={styles.settingLabel}>Manage shortcuts</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Say a shortcut name, like "my usual breakfast", and EatLog logs the exact foods and
            amounts instantly. Built from your saved foods above.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary preferences</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Preferences</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/settings/privacy')}
            accessibilityRole="button"
          >
            <Text style={styles.settingLabel}>Privacy</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleSignOut}
          >
            <Text style={[styles.settingLabel, styles.dangerText]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={editingMacro !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingMacro(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {editingMacro && goals && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Daily {MACRO_CONFIG[editingMacro].label.toLowerCase()} target</Text>
              <TextInput
                style={styles.modalInput}
                value={macroInput}
                onChangeText={setMacroInput}
                keyboardType="number-pad"
                placeholder={`e.g. ${suggestedGrams(editingMacro, goals.calories) ?? MACRO_CONFIG[editingMacro].defaultPlaceholder}`}
                autoFocus
              />
              {macroSuggestionOverride !== null && editingMacro === 'calories' && (
                <Text style={styles.suggestion}>
                  Suggested: {macroSuggestionOverride} kcal to maintain your current weight,
                  estimated from your profile (Mifflin-St Jeor formula). Adjust up or down
                  depending on your goal, then confirm below.
                </Text>
              )}
              {macroSuggestionOverride !== null && editingMacro === 'fibre' && (
                <Text style={styles.suggestion}>
                  Suggested: {macroSuggestionOverride}g/day, based on NASEM Dietary Reference
                  Intakes for your age and sex. Adjust up or down depending on your goal, then
                  confirm below.
                </Text>
              )}
              {macroSuggestionOverride === null && suggestedGrams(editingMacro, goals.calories) !== null && (
                <Text style={styles.suggestion}>
                  Suggested: {suggestedGrams(editingMacro, goals.calories)}
                  {MACRO_CONFIG[editingMacro].unit} based on a standard 30/40/30
                  protein/carb/fat split of your calorie target
                </Text>
              )}
              <Text style={styles.disclaimer}>
                This is a general guideline, not medical advice. Recommended daily targets vary
                by age, sex, weight, height, and activity level – consult a doctor or registered
                dietitian to determine what's right for you.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => {
                    setEditingMacro(null);
                    setMacroSuggestionOverride(null);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: accentColor }]}
                  onPress={async () => {
                    await handleSaveMacro();
                    setMacroSuggestionOverride(null);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.modalButtonPrimaryText}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingNumericField !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingNumericField(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {editingNumericField && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {NUMERIC_PROFILE_CONFIG[editingNumericField].label}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={numericFieldInput}
                onChangeText={setNumericFieldInput}
                keyboardType="number-pad"
                placeholder={NUMERIC_PROFILE_CONFIG[editingNumericField].placeholder}
                autoFocus
              />
              <Text style={styles.disclaimer}>
                We’ll use this information to suggest your starting calorie and nutrition targets. This isn’t medical advice, and you can skip it if you prefer.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setEditingNumericField(null)}
                  disabled={saving}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: accentColor }]}
                  onPress={handleSaveNumericField}
                  disabled={saving}
                >
                  <Text style={styles.modalButtonPrimaryText}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editingChoiceField !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingChoiceField(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingChoiceField === 'sex' ? 'Sex' : 'Activity level'}
            </Text>
            {(editingChoiceField === 'sex' ? SEX_OPTIONS : ACTIVITY_OPTIONS).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.optionRow}
                onPress={() => editingChoiceField && handleSelectChoiceField(editingChoiceField, option.value)}
                disabled={saving}
              >
                <Text style={styles.optionRowText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary, styles.optionCancelButton]}
              onPress={() => setEditingChoiceField(null)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
    color: theme.textPrimary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: theme.textPrimary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  settingValue: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  settingArrow: {
    fontSize: 20,
    color: theme.textSecondary,
  },
  settingLabelLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  optionRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  optionRowText: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  optionCancelButton: {
    marginTop: spacing.md,
  },
  dangerItem: {
    marginTop: spacing.xs,
  },
  dangerText: {
    color: theme.danger,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: theme.textSecondary,
  },
  disclaimer: {
    fontSize: 14,
    color: theme.textMuted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  suggestion: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F2F2F2',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  modalButtonPrimary: {
    backgroundColor: '#000000',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '500',
    // Black, not white: this button's background is sometimes an accent
    // color, and white text on the light accent swatches fails WCAG AA
    // contrast (see docs/accessibility-audit.md).
    color: '#000000',
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  colorSwatchWrapper: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: theme.textPrimary,
  },
  colorSwatchLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
  },
  weekStartLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  weekStartRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  weekStartChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  weekStartChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  weekStartChipTextSelected: {
    color: '#FFFFFF',
  },
});