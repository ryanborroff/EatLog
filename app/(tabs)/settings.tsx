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
import { DailyGoals } from '../../types';
import { getUserGoals, saveUserGoals } from '../../services/storageService';
import { signOut } from '../../services/authService';

export default function SettingsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCalories, setEditingCalories] = useState(false);
  const [caloriesInput, setCaloriesInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

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

  const openCaloriesEditor = () => {
    if (!goals) return;
    setCaloriesInput(String(goals.calories));
    setEditingCalories(true);
  };

  const handleSaveCalories = async () => {
    if (!goals) return;
    const parsed = parseInt(caloriesInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid value', 'Enter a whole number of calories greater than 0.');
      return;
    }

    const updatedGoals = { ...goals, calories: parsed };
    setSaving(true);
    try {
      await saveUserGoals(updatedGoals);
      setGoals(updatedGoals);
      setEditingCalories(false);
    } catch (error) {
      console.error('Error saving calorie target:', error);
      Alert.alert('Error', 'Failed to save your calorie target.');
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
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Name</Text>
            <Text style={styles.settingValue}>John Doe</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Targets</Text>
          <TouchableOpacity style={styles.settingItem} onPress={openCaloriesEditor}>
            <Text style={styles.settingLabel}>Calories</Text>
            <Text style={styles.settingValue}>{goals.calories} kcal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Protein</Text>
            <Text style={styles.settingValue}>{goals.protein}g</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Carbohydrates</Text>
            <Text style={styles.settingValue}>{goals.carbohydrate ?? 'Not set'}g</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Fat</Text>
            <Text style={styles.settingValue}>{goals.fat || 'Not set'}g</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            These are general guidelines, not medical advice. Recommended daily calorie needs
            vary by age, sex, weight, height, and activity level — consult a doctor or registered
            dietitian before changing your target, especially if you have a health condition.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal foods</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/settings/personal-foods')}
          >
            <Text style={styles.settingLabel}>Manage saved foods</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usual foods</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/settings/usual-foods')}
          >
            <Text style={styles.settingLabel}>Manage shortcuts</Text>
            <Text style={styles.settingArrow}>→</Text>
          </TouchableOpacity>
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
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleSignOut}
          >
            <Text style={[styles.settingLabel, styles.dangerText]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={editingCalories}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingCalories(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daily calorie target</Text>
            <TextInput
              style={styles.modalInput}
              value={caloriesInput}
              onChangeText={setCaloriesInput}
              keyboardType="number-pad"
              placeholder="e.g. 2000"
              autoFocus
            />
            <Text style={styles.disclaimer}>
              This is a general guideline, not medical advice. Consult a doctor or registered
              dietitian to determine the calorie target that's right for you.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setEditingCalories(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveCalories}
                disabled={saving}
              >
                <Text style={styles.modalButtonPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#000000',
  },
  settingValue: {
    fontSize: 16,
    color: '#666666',
  },
  settingArrow: {
    fontSize: 20,
    color: '#666666',
  },
  dangerItem: {
    marginTop: 8,
  },
  dangerText: {
    color: '#FF3B30',
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
  disclaimer: {
    fontSize: 12,
    color: '#999999',
    marginHorizontal: 20,
    marginTop: 12,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
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
    color: '#000000',
  },
  modalButtonPrimary: {
    backgroundColor: '#000000',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});