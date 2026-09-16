import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { processTranscript, logBarcodeItem, FoodParseError } from '../services/foodPipeline';
import { lookupBarcode, BarcodeProduct } from '../services/barcodeLookup';
import { track } from '../services/analytics';
import { Meal } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { colors, spacing, radii, typography } from '../constants/theme';
import { formatFoodItemLine } from '../utils/formatFoodItem';
import { formatAmount } from '../utils/formatNumber';
import CalendarPicker from './CalendarPicker';
import BarcodeScanner from './BarcodeScanner';
import ListeningIndicator from './ListeningIndicator';

// Flag: "I'm listening…" reads a bit "smart speaker" — worth A/B testing
// against a quieter/no-copy variant once we can measure drop-off here.
const LISTENING_COPY = "I'm listening…";

type FlowState =
  | 'listening'
  | 'transcribing'
  | 'confirmed'
  | 'processing'
  | 'logged'
  | 'clarification'
  | 'result'
  | 'error'
  | 'barcode_scanning'
  | 'barcode_result'
  | 'barcode_not_found';

const todayDate = (): string => new Date().toISOString().split('T')[0];

const formatLogDate = (date: string): string => {
  if (date === todayDate()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

// Same conversational voice for every failure mode — no system-error strings.
const ERROR_COPY = {
  stt: "Didn't catch that — try again, or type it instead.",
  network: "Couldn't connect. Nothing's been logged yet.",
  ai: "Couldn't work that out — try again.",
} as const;

const formatMealType = (type: Meal['type']): string => type.charAt(0).toUpperCase() + type.slice(1);

/**
 * Single continuous state-machine surface for voice logging. Starts
 * listening the instant it mounts (the triggering tap already happened on
 * the Today screen) — no intermediate "tap to record" screen.
 */
const VoiceLogFlow: React.FC = () => {
  const router = useRouter();
  const { accentColor } = useTheme();
  const [state, setState] = useState<FlowState>('listening');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>(ERROR_COPY.ai);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [loggedMeal, setLoggedMeal] = useState<Meal | null>(null);
  const [wasCorrection, setWasCorrection] = useState(false);
  const [targetDate, setTargetDate] = useState(todayDate());
  const [showCalendar, setShowCalendar] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);
  const [gramsValue, setGramsValue] = useState('100');
  const mealHintRef = useRef<string | undefined>(undefined);
  const startedRef = useRef(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;

  // Quick cross-fade whenever the state (and thus the rendered content) changes.
  useEffect(() => {
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [state, contentOpacity]);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    setTranscript(text);
    if (text.trim().length > 0) {
      setState((current) => (current === 'listening' ? 'transcribing' : current));
    }
    if (event.isFinal && text.trim().length > 0) {
      setState('confirmed');
      // Brief settle beat before the calc kicks off, so "Got it." is felt.
      setTimeout(() => void submitTranscript(text), 350);
    }
  });

  useSpeechRecognitionEvent('error', () => {
    setErrorMessage(ERROR_COPY.stt);
    setState('error');
  });

  useSpeechRecognitionEvent('end', () => {
    setState((current) => (current === 'listening' || current === 'transcribing' ? 'error' : current));
  });

  const handleClose = () => {
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const startListening = async (mealHint?: string) => {
    mealHintRef.current = mealHint;
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(ERROR_COPY.stt);
      setState('error');
      return;
    }

    setTranscript('');
    setState('listening');
    track('voice_log_started');
    ExpoSpeechRecognitionModule.start({
      lang: 'en-GB',
      interimResults: true,
      continuous: false,
    });
  };

  // Mount-time auto-start: the tap that opens this screen IS the tap that
  // starts listening — no separate "ready to record" step.
  if (!startedRef.current) {
    startedRef.current = true;
    void startListening();
  }

  const submitTranscript = async (text: string) => {
    setState('processing');
    try {
      const result = await processTranscript(text, targetDate, mealHintRef.current);
      if (result.status === 'needs_clarification') {
        setClarificationQuestion(result.question);
        setState('clarification');
        track('clarification_requested');
        void startListening();
      } else {
        setLoggedMeal(result.meal);
        setWasCorrection(result.status === 'updated');
        setState('logged');
        setTimeout(() => setState('result'), 450);
        track('voice_log_completed');
        if (result.status === 'logged') {
          track('food_logged', { source: 'voice', mealType: result.meal.type, itemCount: result.meal.items.length });
        } else {
          track('food_edited', { source: 'voice' });
        }
      }
    } catch (err) {
      if (err instanceof FoodParseError && err.message === 'Nothing to correct') {
        setErrorMessage("Nothing recent to correct — try logging the food instead.");
      } else if (err instanceof FoodParseError) {
        setErrorMessage(err.kind === 'network' ? ERROR_COPY.network : ERROR_COPY.ai);
      } else {
        setErrorMessage(ERROR_COPY.ai);
      }
      track('voice_log_failed');
      setTextValue(text);
      setShowTextInput(true);
      setState('error');
    }
  };

  const handleTextSubmit = () => {
    const value = textValue.trim();
    if (!value) return;
    setShowTextInput(false);
    setTextValue('');
    setTranscript(value);
    setState('confirmed');
    setTimeout(() => void submitTranscript(value), 200);
  };

  // Result → tap mic again to say a correction ("Actually it was three eggs").
  const handleFollowUp = () => {
    void startListening();
  };

  const handleBarcodeScanned = async (barcode: string) => {
    track('barcode_scanned');
    const product = await lookupBarcode(barcode).catch(() => null);
    if (!product) {
      setState('barcode_not_found');
      return;
    }
    setScannedProduct(product);
    setGramsValue(String(product.reference.servingSize));
    setState('barcode_result');
  };

  const handleBarcodeConfirm = async () => {
    if (!scannedProduct) return;
    const grams = parseFloat(gramsValue);
    if (!grams || grams <= 0) return;

    setState('processing');
    const meal = await logBarcodeItem(targetDate, 'snack', scannedProduct.name, scannedProduct.reference, grams);
    track('food_logged', { source: 'barcode', mealType: meal.type, itemCount: meal.items.length });
    setLoggedMeal(meal);
    setWasCorrection(false);
    setState('logged');
    setTimeout(() => setState('result'), 450);
  };

  const renderContent = () => {
    switch (state) {
      case 'listening':
      case 'transcribing':
        return (
          <View style={styles.content}>
            <ListeningIndicator
              active
              size={100}
              color={accentColor}
              showMicIcon={state === 'listening'}
            />
            {state === 'listening' ? (
              <Text style={styles.prompt}>{LISTENING_COPY}</Text>
            ) : (
              <Text style={styles.transcript}>{transcript}</Text>
            )}
          </View>
        );

      case 'confirmed':
        return (
          <View style={styles.content}>
            <ListeningIndicator active={false} size={72} color={accentColor} />
            <Text style={styles.prompt}>Got it.</Text>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.content}>
            <ListeningIndicator active={false} size={72} color={accentColor} />
          </View>
        );

      case 'logged':
        return (
          <View style={styles.content}>
            <ListeningIndicator active={false} size={72} color={accentColor} showCheckIcon />
            <Text style={styles.prompt}>Logged</Text>
          </View>
        );

      case 'clarification':
        return (
          <View style={styles.content}>
            <Text style={styles.prompt}>{clarificationQuestion}</Text>
            <ListeningIndicator active size={88} color={accentColor} />
            {transcript.length > 0 && <Text style={styles.transcript}>{transcript}</Text>}
          </View>
        );

      case 'error':
        return (
          <View style={styles.content}>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            {showTextInput ? (
              <>
                <TextInput
                  style={styles.textInput}
                  placeholder="Log what you've eaten"
                  placeholderTextColor={colors.textMuted}
                  value={textValue}
                  onChangeText={setTextValue}
                  autoFocus
                  multiline
                  onSubmitEditing={handleTextSubmit}
                />
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={handleTextSubmit}>
                  <Text style={styles.primaryButtonText}>Log it</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity onPress={() => void startListening()}>
              <Text style={styles.linkText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setState('barcode_scanning')}>
              <Text style={styles.linkText}>Scan barcode instead</Text>
            </TouchableOpacity>
          </View>
        );

      case 'barcode_not_found':
        return (
          <View style={styles.content}>
            <Text style={styles.errorMessage}>Couldn't find that product.</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={() => setState('barcode_scanning')}>
              <Text style={styles.primaryButtonText}>Scan again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void startListening()}>
              <Text style={styles.linkText}>Tell EatLog instead</Text>
            </TouchableOpacity>
          </View>
        );

      case 'barcode_result':
        return (
          <View style={styles.content}>
            <Text style={styles.prompt}>{scannedProduct?.name}</Text>
            <Text style={styles.subPrompt}>How many grams?</Text>
            <TextInput
              style={styles.textInput}
              value={gramsValue}
              onChangeText={setGramsValue}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={handleBarcodeConfirm}>
              <Text style={styles.primaryButtonText}>Log it</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setState('barcode_scanning')}>
              <Text style={styles.linkText}>Scan a different item</Text>
            </TouchableOpacity>
          </View>
        );

      case 'result': {
        if (!loggedMeal) return null;
        const kcal = formatAmount(loggedMeal.totalCalories);
        const protein = formatAmount(loggedMeal.totalProtein);
        return (
          <TouchableOpacity style={styles.content} activeOpacity={1} onPress={handleFollowUp}>
            <Text style={styles.resultMealType}>{formatMealType(loggedMeal.type)}</Text>
            {loggedMeal.items.map((item) => (
              <Text key={item.id} style={styles.resultItem}>
                {formatFoodItemLine(item)}
              </Text>
            ))}
            <Text style={styles.resultSummary}>
              {wasCorrection
                ? `Updated · ${kcal} kcal`
                : `${kcal} kcal · ${protein}g protein · Logged`}
            </Text>
            <Text style={styles.followUpHint}>Tap the mic to add or correct something</Text>
            <ListeningIndicator active={false} size={64} color={accentColor} showMicIcon />
          </TouchableOpacity>
        );
      }

      default:
        return null;
    }
  };

  if (state === 'barcode_scanning') {
    return (
      <BarcodeScanner
        onScanned={(barcode) => void handleBarcodeScanned(barcode)}
        onClose={() => setState('error')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowCalendar(true)}
          accessibilityLabel="Change log date"
          accessibilityRole="button"
        >
          <Text style={styles.dateSelectorText}>{formatLogDate(targetDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose} accessibilityLabel="Close" accessibilityRole="button">
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
          {renderContent()}
        </Animated.View>
      </KeyboardAvoidingView>
      <CalendarPicker
        visible={showCalendar}
        selectedDate={targetDate}
        onSelect={setTargetDate}
        onClose={() => setShowCalendar(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  closeButton: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  dateSelector: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
  },
  dateSelectorText: {
    ...typography.small,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  prompt: {
    ...typography.cardHeading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subPrompt: {
    ...typography.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  transcript: {
    ...typography.cardHeading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
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
  errorMessage: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resultMealType: {
    ...typography.sectionHeading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  resultItem: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  resultSummary: {
    ...typography.cardHeading,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  followUpHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
});

export default VoiceLogFlow;
