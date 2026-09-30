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
import { useRouter } from 'expo-router';
import { ActivityLevel, Sex, UserProfile } from '../../types';
import { getUserProfile, saveUserProfile, logWeight } from '../../services/storageService';
import { ACTIVITY_LEVEL_LABELS } from '../../services/calorieTarget';
import { useTheme } from '../../contexts/ThemeContext';
import { colors, spacing } from '../../constants/theme';
import { SettingsGroup, SettingsRow } from '../../components/SettingsList';
import { editSheetStyles as sheet } from '../../components/editSheetStyles';

type NumericProfileField = 'birthYear' | 'heightCm' | 'weightKg';
type ChoiceProfileField = 'sex' | 'activityLevel';

const NUMERIC_PROFILE_CONFIG: Record<NumericProfileField, { label: string; unit: string; placeholder: string }> = {
  birthYear: { label: 'Birth year', unit: '', placeholder: 'e.g. 1990' },
  heightCm: { label: 'Height', unit: 'cm', placeholder: 'e.g. 170' },
  weightKg: { label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = (
  Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]
).map((value) => ({ value, label: ACTIVITY_LEVEL_LABELS[value] }));

const PROFILE_DISCLAIMER =
  'We’ll use this information to suggest your starting calorie and nutrition targets. This isn’t medical advice, and you can skip it if you prefer.';

export default function ProfileScreen() {
  const router = useRouter();
  const { accentColor } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingNumericField, setEditingNumericField] = useState<NumericProfileField | null>(null);
  const [numericFieldInput, setNumericFieldInput] = useState('');
  const [editingChoiceField, setEditingChoiceField] = useState<ChoiceProfileField | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUserProfile()
      .then(setProfile)
      .catch((error) => console.error('Error loading profile:', error));
  }, []);

  const openNumericFieldEditor = (field: NumericProfileField) => {
    if (!profile) return;
    const currentValue = profile[field];
    setNumericFieldInput(currentValue ? String(currentValue) : '');
    setEditingNumericField(field);
  };

  const handleSaveNumericField = async () => {
    if (!profile || !editingNumericField) return;
    const isWeight = editingNumericField === 'weightKg';
    // Weight allows one decimal place (e.g. 72.5); the other fields are whole numbers.
    const parsed = isWeight
      ? Math.round(parseFloat(numericFieldInput.replace(',', '.')) * 10) / 10
      : parseInt(numericFieldInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid value', isWeight ? 'Enter a number greater than 0.' : 'Enter a whole number greater than 0.');
      return;
    }

    const updatedProfile = { ...profile, [editingNumericField]: parsed };
    setSaving(true);
    try {
      await saveUserProfile(updatedProfile);
      if (isWeight) {
        // Also record it as today's weigh-in, so it shows up in weight Insights.
        await logWeight(new Date().toISOString().split('T')[0], parsed);
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.backButtonText}>← Settings</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
        </View>

        <SettingsGroup footer={PROFILE_DISCLAIMER}>
          <SettingsRow
            label="Sex"
            value={profile?.sex ? SEX_OPTIONS.find((o) => o.value === profile.sex)?.label : 'Not set'}
            onPress={() => setEditingChoiceField('sex')}
          />
          <SettingsRow
            label="Birth year"
            value={profile?.birthYear ? String(profile.birthYear) : 'Not set'}
            onPress={() => openNumericFieldEditor('birthYear')}
          />
          <SettingsRow
            label="Height"
            value={profile?.heightCm ? `${profile.heightCm} cm` : 'Not set'}
            onPress={() => openNumericFieldEditor('heightCm')}
          />
          <SettingsRow
            label="Weight"
            value={profile?.weightKg ? `${profile.weightKg} kg` : 'Not set'}
            onPress={() => openNumericFieldEditor('weightKg')}
          />
          <SettingsRow
            label="Activity level"
            value={profile?.activityLevel ? ACTIVITY_LEVEL_LABELS[profile.activityLevel].split(' (')[0] : 'Not set'}
            onPress={() => setEditingChoiceField('activityLevel')}
          />
        </SettingsGroup>
      </ScrollView>

      <Modal
        visible={editingNumericField !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingNumericField(null)}
      >
        <KeyboardAvoidingView style={sheet.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {editingNumericField && (
            <View style={sheet.content}>
              <Text style={sheet.title}>{NUMERIC_PROFILE_CONFIG[editingNumericField].label}</Text>
              <TextInput
                style={sheet.input}
                value={numericFieldInput}
                onChangeText={setNumericFieldInput}
                keyboardType={editingNumericField === 'weightKg' ? 'decimal-pad' : 'number-pad'}
                placeholder={NUMERIC_PROFILE_CONFIG[editingNumericField].placeholder}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <Text style={sheet.note}>{PROFILE_DISCLAIMER}</Text>
              <View style={sheet.actions}>
                <TouchableOpacity
                  style={[sheet.button, sheet.buttonSecondary]}
                  onPress={() => setEditingNumericField(null)}
                  disabled={saving}
                >
                  <Text style={sheet.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sheet.button, { backgroundColor: accentColor }]}
                  onPress={handleSaveNumericField}
                  disabled={saving}
                >
                  <Text style={sheet.buttonPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
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
        <View style={sheet.overlay}>
          <View style={sheet.content}>
            <Text style={sheet.title}>{editingChoiceField === 'sex' ? 'Sex' : 'Activity level'}</Text>
            {(editingChoiceField === 'sex' ? SEX_OPTIONS : ACTIVITY_OPTIONS).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={sheet.optionRow}
                onPress={() => editingChoiceField && handleSelectChoiceField(editingChoiceField, option.value)}
                disabled={saving}
              >
                <Text style={sheet.optionRowText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[sheet.button, sheet.buttonSecondary, sheet.optionCancelButton]}
              onPress={() => setEditingChoiceField(null)}
            >
              <Text style={sheet.buttonSecondaryText}>Cancel</Text>
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors.textPrimary,
  },
});
