import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { lookupBarcode, BarcodeProduct } from '../services/barcodeLookup';
import { ReferenceNutrition } from '../services/nutritionCalculator';
import { track } from '../services/analytics';
import { useTheme } from '../contexts/ThemeContext';
import { colors, spacing, radii, typography } from '../constants/theme';
import BarcodeScanner from './BarcodeScanner';

type FlowState = 'scanning' | 'not_found' | 'result';

interface Props {
  /** Called once the user confirms a scanned product and quantity. */
  onResolved: (name: string, reference: ReferenceNutrition, quantity: number) => void;
  /** Called when the user backs out of the flow entirely (camera closed, or gives up after a miss). */
  onCancel: () => void;
}

/**
 * Self-contained scan → look up → confirm quantity flow, shared by the voice
 * log flow and manual meal editing. Owns the camera and the Open Food Facts
 * lookup; callers only receive the final resolved product + quantity and
 * decide what to do with it (log a new meal vs. append to an existing one).
 */
const BarcodeScanFlow: React.FC<Props> = ({ onResolved, onCancel }) => {
  const { accentColor } = useTheme();
  const [state, setState] = useState<FlowState>('scanning');
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [gramsValue, setGramsValue] = useState('100');

  const handleScanned = async (barcode: string) => {
    track('barcode_scanned');
    const product = await lookupBarcode(barcode).catch(() => null);
    if (!product) {
      setState('not_found');
      return;
    }
    setScannedProduct(product);
    setNameValue(product.name);
    setGramsValue(String(product.reference.servingSize));
    setState('result');
  };

  const handleConfirm = () => {
    if (!scannedProduct) return;
    const grams = parseFloat(gramsValue);
    if (!grams || grams <= 0) return;
    onResolved(nameValue.trim() || scannedProduct.name, scannedProduct.reference, grams);
  };

  if (state === 'scanning') {
    return <BarcodeScanner onScanned={(barcode) => void handleScanned(barcode)} onClose={onCancel} />;
  }

  if (state === 'not_found') {
    return (
      <View style={styles.content}>
        <Text style={styles.message}>Couldn't find that product.</Text>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={() => setState('scanning')}>
          <Text style={styles.primaryButtonText}>Scan again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <TextInput style={styles.textInput} value={nameValue} onChangeText={setNameValue} />
      <Text style={styles.subPrompt}>How many grams?</Text>
      <TextInput
        style={styles.textInput}
        value={gramsValue}
        onChangeText={setGramsValue}
        keyboardType="numeric"
        autoFocus
      />
      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={handleConfirm}>
        <Text style={styles.primaryButtonText}>Use this</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setState('scanning')}>
        <Text style={styles.linkText}>Scan a different item</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel}>
        <Text style={styles.linkText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    width: '100%',
  },
  message: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subPrompt: {
    ...typography.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  textInput: {
    width: '100%',
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    ...typography.secondary,
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});

export default BarcodeScanFlow;
