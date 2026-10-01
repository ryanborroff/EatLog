import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signUp, handleAuthRedirectUrl } from '../../services/authService';
import { ThemeColors } from '../../constants/theme';
import { useColors, useThemedStyles } from '../../contexts/ThemeContext';

export default function SignUpScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // DEV BYPASS — remove once the emailRedirectTo/deep-link fix is confirmed
  // working in production. Lets testers paste the confirmation email's link
  // in manually, since older TestFlight builds sent it to localhost:3000.
  const [pastedLink, setPastedLink] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const handlePasteConfirm = async () => {
    setPasteError(null);
    try {
      await handleAuthRedirectUrl(pastedLink.trim());
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : 'Could not confirm with that link.');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const data = await signUp(email.trim(), password);
      if (!data.session) {
        // Email confirmation is required before a session is issued.
        setConfirmationSent(true);
      }
      // If a session was returned immediately, the root layout's auth
      // listener redirects to (tabs) once it picks up the new session.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign up.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We've sent a confirmation link to {email}. Confirm your address, then sign in.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.link}>Back to sign in</Text>
          </TouchableOpacity>

          {/* DEV BYPASS — delete this block along with the state/handler above
              once the deep-link confirmation flow is verified in production. */}
          <View style={styles.devBypass}>
            <Text style={styles.devBypassLabel}>Dev: paste confirmation link</Text>
            <TextInput
              style={styles.input}
              placeholder="http://localhost:3000/#access_token=..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoComplete="off"
              value={pastedLink}
              onChangeText={setPastedLink}
            />
            {pasteError && <Text style={styles.error}>{pasteError}</Text>}
            <TouchableOpacity style={styles.button} onPress={handlePasteConfirm}>
              <Text style={styles.buttonText}>Confirm with pasted link</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start logging your food in seconds</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Creating account…' : 'Sign up'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
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
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32 },
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
    link: { color: colors.textPrimary, fontSize: 14, textAlign: 'center', marginTop: 24 },
    devBypass: {
      marginTop: 40,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    devBypassLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  });
