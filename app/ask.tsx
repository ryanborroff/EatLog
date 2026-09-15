import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { askDiary, DiaryAssistantError } from '../services/diaryAssistant';

interface Bubble {
  id: string;
  role: 'question' | 'answer' | 'error';
  text: string;
}

export default function AskScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [sending, setSending] = useState(false);

  const handleAsk = async () => {
    const question = input.trim();
    if (!question || sending) return;

    setInput('');
    setBubbles((prev) => [...prev, { id: `${Date.now()}-q`, role: 'question', text: question }]);
    setSending(true);

    try {
      const answer = await askDiary(question);
      setBubbles((prev) => [...prev, { id: `${Date.now()}-a`, role: 'answer', text: answer }]);
    } catch (err) {
      const message =
        err instanceof DiaryAssistantError
          ? "I couldn't work that out just now. Try again."
          : "Couldn't connect. Try again.";
      setBubbles((prev) => [...prev, { id: `${Date.now()}-e`, role: 'error', text: message }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ask EatLog</Text>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Close" accessibilityRole="button">
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {bubbles.length === 0 && (
            <Text style={styles.emptyText}>
              Ask things like "how much protein have I had today?" or "what was my highest calorie meal this week?"
            </Text>
          )}
          {bubbles.map((bubble) => (
            <View
              key={bubble.id}
              style={[
                styles.bubble,
                bubble.role === 'question' ? styles.questionBubble : styles.answerBubble,
                bubble.role === 'error' && styles.errorBubble,
              ]}
            >
              <Text style={bubble.role === 'question' ? styles.questionText : styles.answerText}>
                {bubble.text}
              </Text>
            </View>
          ))}
          {sending && <Text style={styles.thinkingText}>Thinking…</Text>}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your diary"
            placeholderTextColor="#999999"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAsk}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleAsk} disabled={sending}>
            <Text style={styles.sendButtonText}>Ask</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#000000' },
  closeButton: { fontSize: 22, color: '#000000' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },
  emptyText: { color: '#999999', fontSize: 15, textAlign: 'center', marginTop: 40 },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  questionBubble: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
  },
  answerBubble: {
    backgroundColor: '#F5F5F5',
    alignSelf: 'flex-start',
  },
  errorBubble: {
    backgroundColor: '#FFF0EF',
  },
  questionText: { color: '#FFFFFF', fontSize: 15 },
  answerText: { color: '#000000', fontSize: 15, lineHeight: 21 },
  thinkingText: { color: '#999999', fontSize: 14, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    backgroundColor: '#000000',
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
