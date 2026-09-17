import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FoodItem, Meal } from '../types';
import { getMealsForDate, updateMeal } from '../services/storageService';
import { recalculateMealTotals } from '../services/correctionApplier';
import { getAppleHealthSyncEnabled } from '../services/healthSyncPreference';
import { resyncMealToHealthKit } from '../services/healthKitService';
import { searchFoods, foodRowToItem, FoodRow } from '../services/foodResolver';
import { calculateNutrition, ReferenceNutrition } from '../services/nutritionCalculator';
import { formatFoodItemLine } from '../utils/formatFoodItem';
import { formatCalories } from '../utils/formatNumber';
import { useTheme } from '../contexts/ThemeContext';
import { colors, spacing, radii, typography } from '../constants/theme';
import BarcodeScanFlow from '../components/BarcodeScanFlow';

const MEAL_TYPES: Meal['type'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

const formatMealType = (type: string): string => type.charAt(0).toUpperCase() + type.slice(1);

export default function EditMealScreen() {
  const router = useRouter();
  const { accentColor, accentTextColor } = useTheme();
  const { date, mealId } = useLocalSearchParams<{ date: string; mealId: string }>();

  const [meal, setMeal] = useState<Meal | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [mealType, setMealType] = useState<Meal['type']>('breakfast');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodRow[]>([]);
  const [searching, setSearching] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');
  const [draftUnit, setDraftUnit] = useState('');

  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meals = await getMealsForDate(date);
        const found = meals.find((m) => m.id === mealId) ?? null;
        if (found) {
          setMeal(found);
          setItems(found.items);
          setMealType(found.type);
        }
      } catch (error) {
        console.error('Error loading meal:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [date, mealId]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        setSearchResults(await searchFoods(searchQuery));
      } catch (error) {
        console.error('Error searching foods:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchQuery]);

  const handleRemoveItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingItemId === id) setEditingItemId(null);
  };

  const handleStartEditItem = (item: FoodItem) => {
    setEditingItemId(item.id);
    setDraftDescription(item.description);
    setDraftQuantity(String(item.quantity));
    setDraftUnit(item.unit);
  };

  const handleCommitEditItem = () => {
    const id = editingItemId;
    if (!id) return;
    setEditingItemId(null);

    const newQuantity = parseFloat(draftQuantity);
    const description = draftDescription.trim();
    const unit = draftUnit.trim();

    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const validQuantity = Number.isFinite(newQuantity) && newQuantity > 0 ? newQuantity : item.quantity;
        const scale = item.quantity > 0 ? validQuantity / item.quantity : 1;

        return {
          ...item,
          description: description || item.description,
          quantity: validQuantity,
          unit: unit || item.unit,
          calories: Math.round(item.calories * scale * 10) / 10,
          protein: Math.round(item.protein * scale * 10) / 10,
          carbohydrate: Math.round(item.carbohydrate * scale * 10) / 10,
          fat: Math.round(item.fat * scale * 10) / 10,
          fibre: item.fibre !== undefined ? Math.round(item.fibre * scale * 10) / 10 : undefined,
          sodium: item.sodium !== undefined ? Math.round(item.sodium * scale * 10) / 10 : undefined,
          sugar: item.sugar !== undefined ? Math.round(item.sugar * scale * 10) / 10 : undefined,
        };
      })
    );
  };

  const handleAddItem = (food: FoodRow) => {
    setItems((current) => [...current, foodRowToItem(food)]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBarcodeResolved = (name: string, reference: ReferenceNutrition, quantity: number) => {
    const calculated = calculateNutrition(reference, quantity);
    setItems((current) => [
      ...current,
      {
        id: String(Date.now()),
        description: name,
        quantity,
        unit: reference.servingUnit,
        ...calculated,
        confidence: 'high',
        estimated: false,
      },
    ]);
    setShowScanner(false);
  };

  const handleSave = useCallback(async () => {
    if (!meal) return;

    if (items.length === 0) {
      Alert.alert('No items', 'A meal needs at least one food item. Remove the meal from the diary instead if you want it gone entirely.');
      return;
    }

    setSaving(true);
    try {
      const updated = recalculateMealTotals(meal, items, mealType);
      await updateMeal(date, meal.id, updated);
      try {
        if (await getAppleHealthSyncEnabled()) {
          await resyncMealToHealthKit(updated);
        }
      } catch (error) {
        console.error('Error syncing meal to Apple Health:', error);
      }
      router.back();
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [meal, items, mealType, date, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!meal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>This meal could no longer be found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.doneText, { color: accentTextColor }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showScanner) {
    return (
      <SafeAreaView style={styles.container}>
        <BarcodeScanFlow onResolved={handleBarcodeResolved} onCancel={() => setShowScanner(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit meal</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {saving ? (
              <ActivityIndicator color={accentTextColor} />
            ) : (
              <Text style={[styles.doneText, { color: accentTextColor }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Meal type</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map((type) => {
              const selected = type === mealType;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeChip,
                    selected && { backgroundColor: accentColor },
                  ]}
                  onPress={() => setMealType(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.mealTypeChipText, selected && { color: accentTextColor }]}>
                    {formatMealType(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Items</Text>
          <View style={styles.itemsCard}>
            {items.length === 0 && <Text style={styles.emptyText}>No items – add something below.</Text>}
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <View key={item.id} style={styles.itemRow}>
                  {isEditing ? (
                    <View style={styles.itemEditWrap}>
                      <TextInput
                        style={styles.itemEditInput}
                        value={draftDescription}
                        onChangeText={setDraftDescription}
                        placeholder="Description"
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                      />
                      <View style={styles.itemEditRow}>
                        <TextInput
                          style={[styles.itemEditInput, styles.itemEditQuantity]}
                          value={draftQuantity}
                          onChangeText={setDraftQuantity}
                          placeholder="Qty"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                        <TextInput
                          style={[styles.itemEditInput, styles.itemEditUnit]}
                          value={draftUnit}
                          onChangeText={setDraftUnit}
                          placeholder="Unit"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TouchableOpacity
                          onPress={handleCommitEditItem}
                          accessibilityLabel="Done editing item"
                          accessibilityRole="button"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="checkmark-circle" size={24} color={accentColor} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.itemTextWrap}
                      onPress={() => handleStartEditItem(item)}
                      accessibilityLabel={`Edit ${item.description}`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.itemDescription}>{formatFoodItemLine(item)}</Text>
                      <Text style={styles.itemCalories}>{formatCalories(item.calories)} kcal</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(item.id)}
                    accessibilityLabel={`Remove ${item.description}`}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Add food</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, styles.searchInputFlex]}
              placeholder="Search foods…"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setShowScanner(true)}
              accessibilityLabel="Scan a barcode"
              accessibilityRole="button"
            >
              <Ionicons name="barcode-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {searching && <ActivityIndicator style={styles.searchSpinner} color={colors.textSecondary} />}
          {searchResults.map((food) => (
            <TouchableOpacity key={food.id} style={styles.searchResultRow} onPress={() => handleAddItem(food)}>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemDescription}>{food.name}</Text>
                <Text style={styles.itemCalories}>
                  {formatCalories(food.calories)} kcal / {food.serving_size}{food.serving_unit}
                </Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={accentColor} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    ...typography.cardHeading,
    color: colors.textPrimary,
  },
  cancelText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  mealTypeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  mealTypeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemsCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  itemTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemDescription: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  itemCalories: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemEditWrap: {
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  itemEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemEditInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    color: colors.textPrimary,
  },
  itemEditQuantity: {
    width: 60,
  },
  itemEditUnit: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchInputFlex: {
    flex: 1,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.sm,
  },
  searchSpinner: {
    marginTop: spacing.sm,
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
