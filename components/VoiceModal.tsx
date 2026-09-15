import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { processTranscript, FoodParseError } from '../services/foodPipeline';
import { track } from '../services/analytics';
import { Meal } from '../types';
import CalendarPicker from './CalendarPicker';

type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'clarification'
  | 'complete'
  | 'error';

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

const ERROR_COPY = {
  stt: "I didn't catch that.\nTry again or type what you ate.",
  network: "Couldn't connect.\nYour food hasn't been logged yet.",
  ai: "I couldn't work that out just now.\nTry again.",
} as const;

const VoiceModal: React.FC = () => {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>('idle');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>(ERROR_COPY.ai);
  const [clarification, setClarification] = useState<{ question: string; options: string[] } | null>(
    null
  );
  const [loggedMeal, setLoggedMeal] = useState<Meal | null>(null);
  const [wasCorrection, setWasCorrection] = useState(false);
  const [targetDate, setTargetDate] = useState(todayDate());
  const [showCalendar, setShowCalendar] = useState(false);
  const [lastSource, setLastSource] = useState<'voice' | 'text'>('text');

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    setTranscript(text);
    if (event.isFinal && text.trim().length > 0) {
      void submitTranscript(text, 'voice');
    }
  });

  useSpeechRecognitionEvent('error', () => {
    setErrorMessage(ERROR_COPY.stt);
    setState('error');
  });

  useSpeechRecognitionEvent('end', () => {
    setState((current) => (current === 'listening' ? 'error' : current));
  });

  const handleClose = () => {
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const startListening = async () => {
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

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const submitTranscript = async (text: string, source: 'voice' | 'text', mealHint?: string) => {
    setLastSource(source);
    setState('processing');
    try {
      const result = await processTranscript(text, targetDate, mealHint);
      if (result.status === 'needs_clarification') {
        setClarification({ question: result.question, options: result.options });
        setState('clarification');
        track('clarification_requested');
      } else {
        setLoggedMeal(result.meal);
        setWasCorrection(result.status === 'updated');
        setState('complete');
        if (source === 'voice') track('voice_log_completed');
        if (result.status === 'logged') {
          track('food_logged', { source, mealType: result.meal.type, itemCount: result.meal.items.length });
        } else {
          track('food_edited', { source });
        }
      }
    } catch (err) {
      if (err instanceof FoodParseError && err.message === 'Nothing to correct') {
        setErrorMessage("There's nothing recent to correct.\nTry logging the food instead.");
      } else if (err instanceof FoodParseError) {
        setErrorMessage(err.kind === 'network' ? ERROR_COPY.network : ERROR_COPY.ai);
      } else {
        setErrorMessage(ERROR_COPY.ai);
      }
      if (source === 'voice') track('voice_log_failed');
      // Preserve what the user said/typed so "Try again" doesn't force retyping.
      setTextValue(text);
      setShowTextInput(true);
      setState('error');
    }
  };

  const handleClarificationOption = (option: string) => {
    track('clarification_answered');
    void submitTranscript(`${transcript} (${option})`, lastSource);
  };

  const handleTextSubmit = () => {
    const value = textValue.trim();
    if (!value) return;
    setTranscript(value);
    void submitTranscript(value, 'text');
  };

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return (
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowCalendar(true)}
              accessibilityLabel="Change log date"
              accessibilityRole="button"
            >
              <Text style={styles.dateSelectorText}>Logging for {formatLogDate(targetDate)}</Text>
              <Text style={styles.dateSelectorChevron}>▾</Text>
            </TouchableOpacity>
            {showTextInput ? (
              <>
                <Text style={styles.instruction}>What did you eat?</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. a banana and a protein shake"
                  placeholderTextColor="#999999"
                  value={textValue}
                  onChangeText={setTextValue}
                  autoFocus
                  multiline
                />
                <TouchableOpacity style={styles.primaryButton} onPress={handleTextSubmit}>
                  <Text style={styles.primaryButtonText}>Log it</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTextInput(false)}>
                  <Text style={styles.linkText}>Use voice instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={startListening}
                  accessibilityLabel="Log food by voice"
                  accessibilityRole="button"
                >
                  <Text style={styles.micIcon}>🎤</Text>
                </TouchableOpacity>
                <Text style={styles.instruction}>Tap to start recording</Text>
                <TouchableOpacity onPress={() => setShowTextInput(true)}>
                  <Text style={styles.linkText}>or type it</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      case 'listening':
        return (
          <View style={styles.content}>
            <View style={[styles.micButton, styles.micButtonActive]}>
              <Text style={styles.micIcon}>🎤</Text>
            </View>
            <Text style={styles.instruction}>Listening...</Text>
            {transcript.length > 0 && <Text style={styles.transcript}>{transcript}</Text>}
            <TouchableOpacity style={styles.stopButton} onPress={stopListening}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.content}>
            <View style={styles.spinner}>
              <Text style={styles.spinnerText}>⟳</Text>
            </View>
            <Text style={styles.instruction}>Working it out...</Text>
            {transcript.length > 0 && <Text style={styles.transcript}>{transcript}</Text>}
          </View>
        );

      case 'clarification':
        return (
          <View style={styles.content}>
            <Text style={styles.clarificationTitle}>I need one detail:</Text>
            <Text style={styles.clarificationQuestion}>{clarification?.question}</Text>
            <ScrollView style={styles.optionsContainer}>
              {(clarification?.options ?? []).map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionButton}
                  onPress={() => handleClarificationOption(option)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleClarificationOption('not sure, use a standard estimate')}
              >
                <Text style={styles.optionText}>Not sure</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        );

      case 'error':
        return (
          <View style={styles.content}>
            <View style={[styles.successIcon, styles.errorIcon]}>
              <Text style={styles.successText}>!</Text>
            </View>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setState('idle');
                setShowTextInput(true);
              }}
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.content}>
            <View style={styles.successIcon}>
              <Text style={styles.successText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>{wasCorrection ? 'Updated' : 'Logged'}</Text>
            {loggedMeal && (
              <>
                <Text style={styles.successValue}>{Math.round(loggedMeal.totalCalories)} kcal</Text>
                <Text style={styles.successValue}>{Math.round(loggedMeal.totalProtein)}g protein</Text>
              </>
            )}
            <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} accessibilityLabel="Close" accessibilityRole="button">
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>{renderContent()}</View>
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
  },
  closeButton: {
    fontSize: 24,
    color: '#000000',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginBottom: 32,
  },
  dateSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginRight: 6,
  },
  dateSelectorChevron: {
    fontSize: 12,
    color: '#666666',
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
  },
  micIcon: {
    fontSize: 48,
    color: '#FFFFFF',
  },
  instruction: {
    fontSize: 18,
    color: '#000000',
    textAlign: 'center',
  },
  transcript: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  linkText: {
    fontSize: 15,
    color: '#666666',
    marginTop: 20,
    textDecorationLine: 'underline',
  },
  textInput: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    marginTop: 16,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  spinner: {
    marginBottom: 24,
  },
  spinnerText: {
    fontSize: 48,
    color: '#000000',
  },
  clarificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  clarificationQuestion: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    maxHeight: 300,
  },
  optionButton: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#000000',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIcon: {
    backgroundColor: '#FF3B30',
  },
  successText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  successValue: {
    fontSize: 20,
    color: '#000000',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  doneButton: {
    marginTop: 24,
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderRadius: 30,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default VoiceModal;
