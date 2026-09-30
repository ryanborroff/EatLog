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
  NativeModules,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  processTranscript,
  confirmPortions,
  logBarcodeItem,
  FoodParseError,
  LoggedOutcome,
  PendingMeal,
  UpdatedOutcome,
} from '../services/foodPipeline';
import { PortionQuestion, PortionSize } from '../services/portionFollowUp';
import { CookingQuestion } from '../services/cookingFollowUp';
import { formatFoodItemLine } from '../utils/formatFoodItem';
import { ReferenceNutrition } from '../services/nutritionCalculator';
import { track } from '../services/analytics';
import { CookingChoice, Meal } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { colors, spacing, radii, typography } from '../constants/theme';
import { formatAmount, formatCalories } from '../utils/formatNumber';
import CalendarPicker from './CalendarPicker';
import BarcodeScanFlow from './BarcodeScanFlow';
import ListeningIndicator from './ListeningIndicator';
import FoodItemLine from './FoodItemLine';

// Flag: "I'm listening…" reads a bit "smart speaker" — worth A/B testing
// against a quieter/no-copy variant once we can measure drop-off here.
const LISTENING_COPY = "I'm listening…";

// How long to wait after the speaker goes quiet before treating the
// utterance as finished. Longer than each platform's own default (~1.5-2s)
// so a mid-sentence pause doesn't cut someone off.
const SILENCE_TIMEOUT_MS = 3500;

// Rotating status lines while the pipeline runs, so a multi-second wait
// reads as progress rather than a frozen screen. The last line holds.
const PROCESSING_COPY = ['Reading your meal…', 'Looking up nutrition…', 'Adding it up…', 'Almost there…'];
const PROCESSING_STEP_MS = 1800;

const ProcessingStatus: React.FC = () => {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (index >= PROCESSING_COPY.length - 1) return;
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setIndex((i) => i + 1);
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, PROCESSING_STEP_MS);
    return () => clearTimeout(timer);
  }, [index, opacity]);

  return (
    <Animated.Text style={[styles.prompt, { opacity }]} accessibilityLiveRegion="polite">
      {PROCESSING_COPY[index]}
    </Animated.Text>
  );
};

type FlowState =
  | 'listening'
  | 'transcribing'
  | 'confirmed'
  | 'processing'
  | 'logged'
  | 'clarification'
  | 'portion'
  | 'result'
  | 'error'
  | 'barcode';

// Recognition was set to a hardcoded 'en-GB', which mismatches the device's
// actual keyboard/locale for a lot of users and quietly hurts accuracy —
// SFSpeechRecognizer (iOS) and SpeechRecognizer (Android) both do noticeably
// better when the requested locale matches what the speaker is actually
// speaking. Fall back to en-GB only if the device locale can't be read.
const deviceLocale = (): string => {
  try {
    const iosLocale =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    const androidLocale = NativeModules.I18nManager?.localeIdentifier;
    return (iosLocale || androidLocale || 'en-GB').replace('_', '-');
  } catch {
    return 'en-GB';
  }
};

// Biases recognition toward the vocabulary we actually expect to hear, via
// SFSpeechRecognitionRequest.contextualStrings on iOS (and the Android
// equivalent where supported). This is the main lever for "it keeps
// mishearing food words" — generic dictation models have no reason to
// prefer "quinoa" over "kin-wa" without a hint.
const FOOD_CONTEXTUAL_STRINGS = [
  'calories', 'protein', 'carbs', 'carbohydrates', 'fat', 'fibre', 'fiber',
  'grams', 'ounces', 'tablespoon', 'teaspoon', 'cup', 'serving', 'scoop',
  'quinoa', 'yoghurt', 'yogurt', 'granola', 'hummus', 'avocado', 'tofu',
  'edamame', 'protein shake', 'protein bar', 'smoothie', 'oat milk',
  'almond milk', 'greek yogurt', 'chicken breast', 'salmon', 'broccoli',
  'sweet potato', 'brown rice', 'peanut butter', 'olive oil',
  'breakfast', 'lunch', 'dinner', 'snack',
];

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
  stt: "Didn't quite catch that. Tap the mic to try again, or type it below.",
  permission: 'EatLog needs speech recognition to hear you. You can turn it on in the Settings app, or type it below.',
  network: "Couldn't connect. Nothing's been logged yet.",
  ai: "Couldn't work that out – try again.",
} as const;

const formatMealType = (type: Meal['type']): string => type.charAt(0).toUpperCase() + type.slice(1);

/**
 * Single continuous state-machine surface for voice logging. Starts
 * listening the instant it mounts (the triggering tap already happened on
 * the Today screen) — no intermediate "tap to record" screen.
 */
interface VoiceLogFlowProps {
  // Set when this screen was opened by the "Log food in EatLog" Siri
  // Shortcut / App Intent rather than a manual mic tap — skips straight to
  // submitting this text instead of listening for speech.
  initialTranscript?: string;
}

const VoiceLogFlow: React.FC<VoiceLogFlowProps> = ({ initialTranscript }) => {
  const router = useRouter();
  const { accentColor } = useTheme();
  const [state, setState] = useState<FlowState>(initialTranscript ? 'confirmed' : 'listening');
  const [showTextInput, setShowTextInput] = useState(false);
  // False once speech permission is refused — retrying by voice can't work then.
  const [voiceAllowed, setVoiceAllowed] = useState(true);
  const [textValue, setTextValue] = useState('');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>(ERROR_COPY.ai);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [clarificationOptions, setClarificationOptions] = useState<string[]>([]);
  // The entry a clarification question is about. The answer on its own
  // ("about 100g") means nothing to the parser, so it's submitted together
  // with the original description and the question.
  const pendingClarificationRef = useRef<{ transcript: string; question: string } | null>(null);
  // A parsed meal held back while the user sizes its guessed portions.
  const pendingMealRef = useRef<PendingMeal | null>(null);
  const [portionQuestions, setPortionQuestions] = useState<PortionQuestion[]>([]);
  const [portionChoices, setPortionChoices] = useState<Record<string, PortionSize>>({});
  // Grains weighed without saying dry or cooked, and the user's answers.
  const [cookingQuestions, setCookingQuestions] = useState<CookingQuestion[]>([]);
  const [cookingChoices, setCookingChoices] = useState<Record<string, CookingChoice>>({});
  const [portionSaveFailed, setPortionSaveFailed] = useState(false);
  // Whether to remember the chosen sizes as this user's usual portions.
  const [rememberPortions, setRememberPortions] = useState(false);
  const [loggedMeal, setLoggedMeal] = useState<Meal | null>(null);
  const [wasCorrection, setWasCorrection] = useState(false);
  const [skippedItems, setSkippedItems] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState(todayDate());
  const [showCalendar, setShowCalendar] = useState(false);
  const mealHintRef = useRef<string | undefined>(undefined);
  const startedRef = useRef(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  // Mic loudness, 0–1, for the listening halo.
  const voiceLevel = useRef(new Animated.Value(0)).current;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef('');
  // Silence timer, the native isFinal result, and the "tap to finish" button
  // can all fire for one utterance (stop() itself triggers a final result),
  // so only the first one submits. Reset per listening session.
  const submittedRef = useRef(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const finishWith = (text: string, delay = 350) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearSilenceTimer();
    setState('confirmed');
    // Brief settle beat before the calc kicks off, so "Got it." is felt.
    setTimeout(() => void submitTranscript(text), delay);
  };

  const stopAndFinish = () => {
    clearSilenceTimer();
    if (submittedRef.current) return;
    ExpoSpeechRecognitionModule.stop();
    const finalText = transcriptRef.current.trim();
    if (finalText.length > 0) {
      finishWith(finalText);
    } else {
      setErrorMessage(ERROR_COPY.stt);
      setShowTextInput(true);
      setState('error');
    }
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(stopAndFinish, SILENCE_TIMEOUT_MS);
  };

  useEffect(() => () => clearSilenceTimer(), []);

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
    if (submittedRef.current) return;
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
    if (text.trim().length > 0) {
      setState((current) => (current === 'listening' ? 'transcribing' : current));
      resetSilenceTimer();
    }
    if (event.isFinal && text.trim().length > 0) {
      finishWith(text);
    }
  });

  // Reported from -2 to 10, with anything below 0 inaudible. Normal speech sits
  // around 2–8, so scale 0–8 to the halo's full range.
  useSpeechRecognitionEvent('volumechange', (event) => {
    const target = Math.min(Math.max(event.value, 0) / 8, 1);
    Animated.timing(voiceLevel, { toValue: target, duration: 100, useNativeDriver: true }).start();
  });

  useSpeechRecognitionEvent('error', () => {
    clearSilenceTimer();
    if (submittedRef.current) return;
    setErrorMessage(ERROR_COPY.stt);
    setShowTextInput(true);
    setState('error');
  });

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer();
    if (submittedRef.current) return;
    if (state === 'listening' || state === 'transcribing') {
      setErrorMessage(ERROR_COPY.stt);
      setShowTextInput(true);
      setState('error');
    }
  });

  const handleClose = () => {
    clearSilenceTimer();
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const startListening = async (mealHint?: string) => {
    mealHintRef.current = mealHint;
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setVoiceAllowed(false);
      setErrorMessage(ERROR_COPY.permission);
      setShowTextInput(true);
      setState('error');
      return;
    }

    setTranscript('');
    transcriptRef.current = '';
    submittedRef.current = false;
    voiceLevel.setValue(0);
    setState('listening');
    track('voice_log_started');
    // `continuous: true` on both platforms hands end-of-speech detection to
    // our own silence timer instead of each platform's short native default.
    ExpoSpeechRecognitionModule.start({
      lang: deviceLocale(),
      interimResults: true,
      continuous: true,
      contextualStrings: FOOD_CONTEXTUAL_STRINGS,
      addsPunctuation: false,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_TIMEOUT_MS,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_TIMEOUT_MS,
      },
    });
    resetSilenceTimer();
  };

  // Mount-time auto-start: the tap that opens this screen IS the tap that
  // starts listening — no separate "ready to record" step. Skipped when a
  // Siri Shortcut already supplied a transcript (see initialTranscript).
  if (!startedRef.current) {
    startedRef.current = true;
    if (initialTranscript) {
      setTranscript(initialTranscript);
      track('voice_log_started', { source: 'siri' });
      finishWith(initialTranscript);
    } else {
      void startListening();
    }
  }

  const submitTranscript = async (text: string) => {
    setState('processing');
    const pending = pendingClarificationRef.current;
    pendingClarificationRef.current = null;
    const fullText = pending ? `${pending.transcript}. ${pending.question} ${text}` : text;
    try {
      const result = await processTranscript(fullText, targetDate, mealHintRef.current);
      if (result.status === 'needs_clarification') {
        // Wait for an answer on the clarification screen — listening straight
        // away would replace the question with "I'm listening…".
        pendingClarificationRef.current = { transcript: fullText, question: result.question };
        submittedRef.current = false;
        setClarificationQuestion(result.question);
        setClarificationOptions(result.options);
        setTextValue('');
        setState('clarification');
        track('clarification_requested');
      } else if (result.status === 'needs_portion') {
        pendingMealRef.current = result.pending;
        submittedRef.current = false;
        setPortionQuestions(result.questions);
        setPortionChoices({});
        setCookingQuestions(result.cookingQuestions);
        setCookingChoices({});
        setPortionSaveFailed(false);
        setRememberPortions(false);
        setState('portion');
        track('portion_requested', {
          itemCount: result.questions.length,
          cookingCount: result.cookingQuestions.length,
        });
      } else {
        showLogged(result);
      }
    } catch (err) {
      if (err instanceof FoodParseError && err.message === 'Nothing to correct') {
        setErrorMessage("Nothing recent to correct – try logging the food instead.");
      } else if (err instanceof FoodParseError && err.unresolvedItems?.length) {
        // Names the items that couldn't be identified, so it's written for the user.
        setErrorMessage(err.message);
      } else if (err instanceof FoodParseError) {
        setErrorMessage(err.kind === 'network' ? ERROR_COPY.network : ERROR_COPY.ai);
      } else {
        setErrorMessage(ERROR_COPY.ai);
      }
      track('voice_log_failed');
      // Let the typed-text fallback submit.
      submittedRef.current = false;
      setTextValue(text);
      setShowTextInput(true);
      setState('error');
    }
  };

  const showLogged = (result: LoggedOutcome | UpdatedOutcome) => {
    setLoggedMeal(result.meal);
    setWasCorrection(result.status === 'updated');
    setSkippedItems(result.status === 'logged' ? result.skipped : []);
    setState('logged');
    setTimeout(() => setState('result'), 450);
    track('voice_log_completed');
    if (result.status === 'logged') {
      track('food_logged', { source: 'voice', mealType: result.meal.type, itemCount: result.meal.items.length });
    } else {
      track('food_edited', { source: 'voice' });
    }
  };

  // Unanswered questions keep the typical portion, marked as a guess.
  const handlePortionConfirm = async () => {
    const pending = pendingMealRef.current;
    if (!pending) return;
    setState('processing');
    track('portion_answered', {
      itemCount: portionQuestions.length,
      answeredCount: Object.keys(portionChoices).length,
      cookingCount: cookingQuestions.length,
      cookingAnsweredCount: Object.keys(cookingChoices).length,
      remember: rememberPortions,
    });
    try {
      const result = await confirmPortions(pending, portionChoices, rememberPortions, cookingChoices);
      pendingMealRef.current = null;
      showLogged(result);
    } catch (err) {
      console.error('Error saving meal after portion question:', err);
      setPortionSaveFailed(true);
      setState('portion');
    }
  };

  const handleTextSubmit = () => {
    const value = textValue.trim();
    if (!value) return;
    setShowTextInput(false);
    setTextValue('');
    setTranscript(value);
    finishWith(value, 200);
  };

  const handleClarificationOption = (option: string) => {
    setTranscript(option);
    finishWith(option, 200);
  };

  // Result → tap mic again to say a correction ("Actually it was three eggs").
  const handleFollowUp = () => {
    void startListening();
  };

  // Lets the user tap the mic again while it's listening to say "I'm done"
  // instead of waiting out SILENCE_TIMEOUT_MS — useful when there's
  // background noise keeping the mic "hearing" something, or the user just
  // doesn't want to wait the full 3.5s pause.
  const handleFinishListening = stopAndFinish;

  const handleBarcodeResolved = async (name: string, reference: ReferenceNutrition, quantity: number) => {
    setTranscript('');
    setState('processing');
    const meal = await logBarcodeItem(targetDate, 'snack', name, reference, quantity);
    track('food_logged', { source: 'barcode', mealType: meal.type, itemCount: meal.items.length });
    setLoggedMeal(meal);
    setWasCorrection(false);
    setSkippedItems([]);
    setState('logged');
    setTimeout(() => setState('result'), 450);
  };

  /** One follow-up question: the item, then a row of answers to pick from. */
  const renderChoices = (
    itemId: string,
    itemLabel: string,
    options: { key: string; label: string; detail: string; calories: number }[],
    selectedKey: string | undefined,
    onSelect: (key: string) => void
  ) => (
    <View key={itemId} style={styles.portionQuestion}>
      <Text style={styles.portionItem}>{itemLabel}</Text>
      <View style={styles.portionOptions}>
        {options.map((option) => {
          const selected = selectedKey === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.portionChip, { borderColor: accentColor }, selected && { backgroundColor: accentColor }]}
              onPress={() => onSelect(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${formatCalories(option.calories)} calories`}
            >
              <Text style={[styles.portionChipLabel, selected && styles.portionChipTextSelected]}>{option.label}</Text>
              <Text style={[styles.portionChipDetail, selected && styles.portionChipTextSelected]}>{option.detail}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderContent = () => {
    switch (state) {
      case 'listening':
      case 'transcribing':
        return (
          <View style={styles.content}>
            <TouchableOpacity
              onPress={handleFinishListening}
              accessibilityLabel="Finish talking and log this"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <ListeningIndicator
                active
                size={100}
                color={accentColor}
                showMicIcon={state === 'listening'}
                level={voiceLevel}
              />
            </TouchableOpacity>
            {pendingClarificationRef.current && (
              <Text style={styles.prompt}>{pendingClarificationRef.current.question}</Text>
            )}
            {state === 'listening' ? (
              <>
                <Text style={styles.prompt}>{LISTENING_COPY}</Text>
                {!pendingClarificationRef.current && (
                  // Amounts make the biggest difference to accuracy, so show how to give one.
                  <Text style={styles.exampleHint}>Say how much, e.g. "two slices of toast and a large latte"</Text>
                )}
              </>
            ) : (
              <Text style={styles.transcript}>{transcript}</Text>
            )}
            <Text style={styles.tapToFinishHint}>Tap the mic when you're done</Text>
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
            <ListeningIndicator active={false} thinking size={72} color={accentColor} />
            <ProcessingStatus />
            {transcript.length > 0 && (
              <Text style={styles.processingTranscript} numberOfLines={3}>
                “{transcript}”
              </Text>
            )}
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
            <View style={styles.optionList}>
              {clarificationOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionChip, { borderColor: accentColor }]}
                  onPress={() => handleClarificationOption(option)}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Or type your answer"
              placeholderTextColor={colors.textMuted}
              value={textValue}
              onChangeText={setTextValue}
              onSubmitEditing={handleTextSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => void startListening()}>
              <Text style={styles.linkText}>Answer by voice</Text>
            </TouchableOpacity>
          </View>
        );

      case 'portion': {
        const answered = Object.keys(portionChoices).length + Object.keys(cookingChoices).length;
        const hasCooking = cookingQuestions.length > 0;
        const rememberLabel = Object.keys(cookingChoices).length === 0
          ? 'Remember as my usual portion'
          : answered === 1
            ? 'Remember my answer'
            : 'Remember my answers';
        return (
          <View style={styles.content}>
            <Text style={styles.prompt}>
              {portionQuestions.length === 0
                ? 'Dry or cooked?'
                : hasCooking
                  ? 'A couple of quick questions'
                  : portionQuestions.length === 1
                    ? 'How big a portion?'
                    : 'How big were the portions?'}
            </Text>
            <Text style={styles.subPrompt}>
              {portionQuestions.length === 0
                ? "Weighed before or after cooking? Not sure? Just log it – we'll make a best guess."
                : hasCooking
                  ? "Not sure? Just log it – we'll make a best guess."
                  : "Not sure? Just log it – we'll use a typical portion."}
            </Text>
            {cookingQuestions.map((question) =>
              renderChoices(
                question.itemId,
                formatFoodItemLine(question.item),
                question.options.map((option) => ({
                  key: option.choice,
                  label: option.label,
                  detail: `${formatCalories(option.calories)} kcal`,
                  calories: option.calories,
                })),
                cookingChoices[question.itemId],
                (choice) =>
                  setCookingChoices((current) => ({ ...current, [question.itemId]: choice as CookingChoice }))
              )
            )}
            {portionQuestions.map((question) =>
              renderChoices(
                question.itemId,
                question.item.description,
                question.options.map((option) => ({
                  key: option.size,
                  label: option.label,
                  detail: `${option.grams !== null ? `${formatAmount(option.grams)}g · ` : ''}${formatCalories(option.calories)} kcal`,
                  calories: option.calories,
                })),
                portionChoices[question.itemId],
                (size) => setPortionChoices((current) => ({ ...current, [question.itemId]: size as PortionSize }))
              )
            )}
            {answered > 0 && (
              <View style={styles.rememberRow}>
                <Text style={styles.rememberLabel}>{rememberLabel}</Text>
                <Switch value={rememberPortions} onValueChange={setRememberPortions} accessibilityLabel={rememberLabel} />
              </View>
            )}
            {portionSaveFailed && <Text style={styles.skippedNotice}>{ERROR_COPY.network}</Text>}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: accentColor }]}
              onPress={() => void handlePortionConfirm()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Log it</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'error':
        // Voice stays the main way forward: a failed attempt shows the mic
        // again, with typing as the alternative rather than the replacement.
        return (
          <View style={styles.content}>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            {voiceAllowed && (
              <>
                <TouchableOpacity
                  onPress={() => void startListening()}
                  accessibilityRole="button"
                  accessibilityLabel="Try again by voice"
                  activeOpacity={0.7}
                >
                  <ListeningIndicator active={false} size={80} color={accentColor} showMicIcon />
                </TouchableOpacity>
                <Text style={styles.retryLabel}>Tap to try again</Text>
              </>
            )}
            {showTextInput ? (
              <>
                <TextInput
                  style={styles.textInput}
                  placeholder="Or type it, e.g. 2 slices of toast and a large latte"
                  placeholderTextColor={colors.textMuted}
                  value={textValue}
                  onChangeText={setTextValue}
                  multiline
                  onSubmitEditing={handleTextSubmit}
                  accessibilityLabel="Type what you ate"
                />
                {textValue.trim().length > 0 && (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: accentColor }]}
                    onPress={handleTextSubmit}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryButtonText}>Log it</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            <TouchableOpacity onPress={() => setState('barcode')} accessibilityRole="button">
              <Text style={styles.linkText}>Scan barcode instead</Text>
            </TouchableOpacity>
          </View>
        );

      case 'result': {
        if (!loggedMeal) return null;
        const kcal = formatCalories(loggedMeal.totalCalories);
        const protein = formatAmount(loggedMeal.totalProtein);
        return (
          <TouchableOpacity style={styles.content} activeOpacity={1} onPress={handleFollowUp}>
            <Text style={styles.resultMealType}>{formatMealType(loggedMeal.type)}</Text>
            {loggedMeal.items.map((item) => (
              <FoodItemLine key={item.id} item={item} style={styles.resultItem} />
            ))}
            <Text style={styles.resultSummary}>
              {wasCorrection
                ? `Updated · ${kcal} kcal`
                : `${kcal} kcal · ${protein}g protein · Logged`}
            </Text>
            {skippedItems.length > 0 && (
              <Text style={styles.skippedNotice}>
                Couldn't work out: {skippedItems.join(', ')} – tap the mic to add {skippedItems.length === 1 ? 'it' : 'them'}.
              </Text>
            )}
            <Text style={styles.followUpHint}>Tap the mic to add or correct something</Text>
            <ListeningIndicator active={false} size={64} color={accentColor} showMicIcon />
          </TouchableOpacity>
        );
      }

      default:
        return null;
    }
  };

  if (state === 'barcode') {
    return (
      <BarcodeScanFlow
        onResolved={(name, reference, quantity) => void handleBarcodeResolved(name, reference, quantity)}
        onCancel={() => setState('error')}
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
    alignSelf: 'stretch',
  },
  prompt: {
    ...typography.cardHeading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subPrompt: {
    ...typography.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  exampleHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rememberLabel: {
    ...typography.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  tapToFinishHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  transcript: {
    ...typography.cardHeading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  processingTranscript: {
    ...typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  textInput: {
    alignSelf: 'stretch',
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
    color: colors.onAccent,
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
    marginBottom: spacing.xs,
  },
  retryLabel: {
    ...typography.small,
    color: colors.textSecondary,
    // Pulls the label up into the indicator's padding (it's sized for rings the idle mic doesn't show).
    marginTop: -spacing.md,
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
  optionList: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  portionQuestion: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  portionItem: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  portionOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  portionChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  portionChipLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  portionChipDetail: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  portionChipTextSelected: {
    color: '#FFFFFF',
  },
  skippedNotice: {
    ...typography.secondary,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  followUpHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
});

export default VoiceLogFlow;
