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
import { useRouter } from 'expo-router';
import { PersonalFood, UserDefault } from '../../types';
import {
  getUserDefaults,
  getUserFoods,
  createFoodDefault,
  createMealDefault,
  deleteUserDefault,
} from '../../services/storageService';
import { track } from '../../services/analytics';

interface DraftItem {
  food: PersonalFood;
  quantity: string;
  unit: string;
}

export default function UsualFoodsScreen() {
  const router = useRouter();
  const [defaults, setDefaults] = useState<UserDefault[]>([]);
  const [personalFoods, setPersonalFoods] = useState<PersonalFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'closed' | 'food' | 'meal'>('closed');
  const [name, setName] = useState('');
  const [singleFood, setSingleFood] = useState<PersonalFood | null>(null);
  const [singleQuantity, setSingleQuantity] = useState('1');
  const [singleUnit, setSingleUnit] = useState('serving');
  const [mealItems, setMealItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [d, f] = await Promise.all([getUserDefaults(), getUserFoods()]);
      setDefaults(d);
      setPersonalFoods(f);
    } catch (error) {
      console.error('Error loading defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setMode('closed');
    setName('');
    setSingleFood(null);
    setSingleQuantity('1');
    setSingleUnit('serving');
    setMealItems([]);
  };

  const handleSaveFoodDefault = async () => {
    if (!name.trim() || !singleFood) {
      Alert.alert('Missing info', 'Give it a name and pick a food.');
      return;
    }
    setSaving(true);
    try {
      await createFoodDefault({
        name: name.trim(),
        foodId: singleFood.foodId,
        quantity: Number(singleQuantity) || 1,
        unit: singleUnit.trim() || 'serving',
      });
      resetForm();
      await load();
      track('default_created', { type: 'food' });
    } catch {
      Alert.alert('Error', 'Could not save this default.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMealDefault = async () => {
    if (!name.trim() || mealItems.length === 0) {
      Alert.alert('Missing info', 'Give it a name and add at least one food.');
      return;
    }
    setSaving(true);
    try {
      await createMealDefault({
        name: name.trim(),
        items: mealItems.map((item) => ({
          foodId: item.food.foodId,
          description: item.food.name,
          quantity: Number(item.quantity) || 1,
          unit: item.unit.trim() || 'serving',
        })),
      });
      resetForm();
      await load();
      track('default_created', { type: 'meal' });
    } catch {
      Alert.alert('Error', 'Could not save this meal default.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (def: UserDefault) => {
    Alert.alert('Delete default', `Remove "${def.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUserDefault(def.id);
          await load();
        },
      },
    ]);
  };

  const addMealItem = (food: PersonalFood) => {
    setMealItems([...mealItems, { food, quantity: String(food.servingSize), unit: food.servingUnit }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Quick-log shortcuts</Text>
        </View>

        {!loading &&
          defaults.map((def) => (
            <TouchableOpacity key={def.id} style={styles.card} onPress={() => handleDelete(def)}>
              <Text style={styles.cardTitle}>{def.name}</Text>
              <Text style={styles.cardSubtitle}>
                {def.type === 'meal' ? `${def.items?.length ?? 0} items` : 'Single food'}
              </Text>
            </TouchableOpacity>
          ))}

        {!loading && defaults.length === 0 && mode === 'closed' && (
          <Text style={styles.emptyText}>No shortcuts saved yet.</Text>
        )}

        {personalFoods.length === 0 ? (
          mode === 'closed' && (
            <Text style={styles.hintText}>
              Add a food first (Settings → My foods), then build a shortcut from it.
            </Text>
          )
        ) : mode === 'closed' ? (
          <View style={styles.modeButtons}>
            <TouchableOpacity style={styles.addButton} onPress={() => setMode('food')}>
              <Text style={styles.addButtonText}>+ Add single-food default</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => setMode('meal')}>
              <Text style={styles.addButtonText}>+ Add meal default</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={mode === 'meal' ? 'Default name (e.g. usual breakfast)' : 'Default name (e.g. coffee)'}
              placeholderTextColor="#999999"
              value={name}
              onChangeText={setName}
            />

            {mode === 'food' ? (
              <>
                <Text style={styles.sectionLabel}>Pick a food</Text>
                {personalFoods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    style={[styles.foodOption, singleFood?.id === food.id && styles.foodOptionSelected]}
                    onPress={() => setSingleFood(food)}
                  >
                    <Text
                      style={[styles.foodOptionText, singleFood?.id === food.id && styles.foodOptionTextSelected]}
                    >
                      {food.nickname}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Quantity"
                    placeholderTextColor="#999999"
                    keyboardType="numeric"
                    value={singleQuantity}
                    onChangeText={setSingleQuantity}
                  />
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Unit"
                    placeholderTextColor="#999999"
                    value={singleUnit}
                    onChangeText={setSingleUnit}
                  />
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveFoodDefault} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save default'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {mealItems.map((item, index) => (
                  <View key={index} style={styles.mealItemRow}>
                    <Text style={styles.mealItemText}>
                      {item.quantity}
                      {item.unit} {item.food.nickname}
                    </Text>
                  </View>
                ))}
                <Text style={styles.sectionLabel}>Add a food</Text>
                {personalFoods.map((food) => (
                  <TouchableOpacity key={food.id} style={styles.foodOption} onPress={() => addMealItem(food)}>
                    <Text style={styles.foodOptionText}>+ {food.nickname}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveMealDefault} disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save meal default'}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollView: { flex: 1 },
  header: { padding: 20 },
  backButtonText: { fontSize: 16, color: '#000000', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#000000' },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#000000' },
  cardSubtitle: { fontSize: 14, color: '#666666', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#999999', marginTop: 20, marginBottom: 20 },
  hintText: { textAlign: 'center', color: '#999999', marginHorizontal: 20, marginTop: 20 },
  modeButtons: { paddingHorizontal: 20, gap: 12, marginTop: 8, marginBottom: 40 },
  form: { paddingHorizontal: 20, marginTop: 12 },
  sectionLabel: { fontSize: 14, color: '#666666', marginBottom: 8, marginTop: 4 },
  foodOption: {
    padding: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 8,
  },
  foodOptionSelected: { backgroundColor: '#000000' },
  foodOptionText: { fontSize: 15, color: '#000000' },
  foodOptionTextSelected: { color: '#FFFFFF' },
  mealItemRow: { paddingVertical: 8 },
  mealItemText: { fontSize: 15, color: '#000000' },
  row: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancelText: { textAlign: 'center', color: '#666666', marginTop: 16, marginBottom: 24 },
  addButton: {
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
  },
  addButtonText: { fontSize: 16, fontWeight: '600', color: '#000000' },
});
