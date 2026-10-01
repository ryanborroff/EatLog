import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { updatePassword } from '../services/authService';
import { ThemeColors } from '../constants/theme';
import { useColors, useThemedStyles } from '../contexts/ThemeContext';

export default function ResetPasswordScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.subtitle}>You're all set.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>

          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Updating…' : 'Update password'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 32 },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
    button: {
      backgroundColor: colors.inverseBackground,
      borderRadius: 30,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.inverseText, fontSize: 16, fontWeight: '600' },
  });
