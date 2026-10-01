import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../constants/theme';
import ScreenHeader from '../../components/ScreenHeader';
import { PersonalFood } from '../../types';
import { getUserFoods, createUserFood, deleteUserFood } from '../../services/storageService';
import { calculateNutrition, ReferenceNutrition } from '../../services/nutritionCalculator';
import { track } from '../../services/analytics';
import BarcodeScanFlow from '../../components/BarcodeScanFlow';

const emptyForm = {
  name: '',
  nickname: '',
  servingSize: '100',
  servingUnit: 'g',
  calories: '',
  protein: '',
  carbohydrate: '',
  fat: '',
};

export default function PersonalFoodsScreen() {
  const [foods, setFoods] = useState<PersonalFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setFoods(await getUserFoods());
    } catch (error) {
      console.error('Error loading personal foods:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.nickname.trim()) {
      Alert.alert('Missing info', 'Name and nickname are required.');
      return;
    }
    setSaving(true);
    try {
      await createUserFood({
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        servingSize: Number(form.servingSize) || 100,
        servingUnit: form.servingUnit.trim() || 'g',
        nutrition: {
          calories: Number(form.calories) || 0,
          protein: Number(form.protein) || 0,
          carbohydrate: Number(form.carbohydrate) || 0,
          fat: Number(form.fat) || 0,
        },
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
      track('personal_food_created');
    } catch (error) {
      console.error('Error saving personal food:', error);
      Alert.alert('Error', 'Could not save this food.');
    } finally {
      setSaving(false);
    }
  };

  const handleBarcodeResolved = (name: string, reference: ReferenceNutrition, quantity: number) => {
    const calculated = calculateNutrition(reference, quantity);
    setForm({
      name,
      nickname: name,
      servingSize: String(quantity),
      servingUnit: reference.servingUnit,
      calories: String(calculated.calories),
      protein: String(calculated.protein),
      carbohydrate: String(calculated.carbohydrate),
      fat: String(calculated.fat),
    });
    setShowScanner(false);
    setShowForm(true);
    track('personal_food_scanned');
  };

  const handleDelete = (food: PersonalFood) => {
    Alert.alert('Delete food', `Remove "${food.nickname}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUserFood(food.id);
          await load();
        },
      },
    ]);
  };

  if (showScanner) {
    return (
      <SafeAreaView style={styles.container}>
        <BarcodeScanFlow onResolved={handleBarcodeResolved} onCancel={() => setShowScanner(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ScreenHeader title="My foods" />

        {!loading &&
          foods.map((food) => (
            <TouchableOpacity key={food.id} style={styles.card} onPress={() => handleDelete(food)}>
              <Text style={styles.cardTitle}>{food.nickname}</Text>
              <Text style={styles.cardSubtitle}>
                {food.calories} kcal / {food.servingSize}
                {food.servingUnit}
              </Text>
            </TouchableOpacity>
          ))}

        {!loading && foods.length === 0 && !showForm && (
          <Text style={styles.emptyText}>No foods saved yet.</Text>
        )}

        {showForm ? (
          <View style={styles.form}>
            <Text style={styles.label}>Food name</Text>
            <TextInput
              style={styles.input}
              placeholder="Food name (e.g. My Greek yoghurt)"
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <Text style={styles.label}>Nickname – what you'll call it when logging</Text>
            <TextInput
              style={styles.input}
              placeholder="Nickname (e.g. my yoghurt)"
              placeholderTextColor={colors.textMuted}
              value={form.nickname}
              onChangeText={(v) => setForm({ ...form, nickname: v })}
            />
            <View style={styles.row}>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>Serving size</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={form.servingSize}
                  onChangeText={(v) => setForm({ ...form, servingSize: v })}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="g, ml…"
                  placeholderTextColor={colors.textMuted}
                  value={form.servingUnit}
                  onChangeText={(v) => setForm({ ...form, servingUnit: v })}
                />
              </View>
            </View>
            <Text style={styles.label}>Calories (kcal)</Text>
            <TextInput
              style={styles.input}
              placeholder="Calories"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={form.calories}
              onChangeText={(v) => setForm({ ...form, calories: v })}
            />
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Protein (g)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={form.protein}
              onChangeText={(v) => setForm({ ...form, protein: v })}
            />
            <Text style={styles.label}>Carbohydrate (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Carbohydrate (g)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={form.carbohydrate}
              onChangeText={(v) => setForm({ ...form, carbohydrate: v })}
            />
            <Text style={styles.label}>Fat (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Fat (g)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={form.fat}
              onChangeText={(v) => setForm({ ...form, fat: v })}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save food'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addButtonRow}>
            <TouchableOpacity style={[styles.addButton, styles.addButtonFlex]} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>+ Add manually</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, styles.addButtonFlex]} onPress={() => setShowScanner(true)}>
              <Text style={styles.addButtonText}>Scan barcode</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 20, marginBottom: 20 },
  form: { paddingHorizontal: spacing.lg, marginTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancelText: { textAlign: 'center', color: colors.textSecondary, marginTop: 16, marginBottom: 24 },
  addButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: spacing.lg,
    marginTop: 8,
    marginBottom: 40,
  },
  addButtonFlex: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  addButton: {
    marginHorizontal: spacing.lg,
    marginTop: 8,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
});
