import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signIn, signUp, requestPasswordReset } from '../../services/authService';

// Fixed dev-only account so local testing doesn't require a real inbox to
// click an email-confirmation link. __DEV__-gated: never present in a
// release build.
const DEV_EMAIL = 'dev-skip@eatlog.test';
const DEV_PASSWORD = 'dev-skip-password-1';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const handleForgotPassword = async () => {
    setError(null);
    setResetSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Root layout's auth listener redirects to (tabs) once the session updates.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevSkip = async () => {
    setError(null);
    setSubmitting(true);
    try {
      try {
        await signIn(DEV_EMAIL, DEV_PASSWORD);
      } catch {
        // First run: the dev account doesn't exist yet — create it, then
        // sign in (only works if the Supabase project has email
        // confirmation disabled; if it's on, this surfaces that error).
        await signUp(DEV_EMAIL, DEV_PASSWORD);
        await signIn(DEV_EMAIL, DEV_PASSWORD);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dev skip failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showForgotPassword) {
    if (resetSent) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              If an account exists for {email}, we've sent a link to reset your password.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowForgotPassword(false);
                setResetSent(false);
              }}
            >
              <Text style={styles.link}>Back to sign in</Text>
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
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999999"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, resetSubmitting && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={resetSubmitting}
            >
              <Text style={styles.buttonText}>
                {resetSubmitting ? 'Sending…' : 'Send reset link'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowForgotPassword(false)}>
              <Text style={styles.link}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
          <Image
            source={require('../../assets/wordmark.png')}
            style={styles.wordmark}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="EatLog"
          />
          <Text style={styles.subtitle}>Tell us what you ate. We'll do the maths.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999999"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999999"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowForgotPassword(true)}>
            <Text style={styles.link}>Forgot password or trouble signing in?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity onPress={handleDevSkip} disabled={submitting}>
              <Text style={styles.devLink}>Skip sign-in (dev)</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '700', color: '#000000', marginBottom: 8 },
  wordmark: { width: 150, height: 51, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666666', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 12,
  },
  error: { color: '#FF3B30', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  link: { color: '#000000', fontSize: 14, textAlign: 'center', marginTop: 24 },
  devLink: { color: '#6B6B6B', fontSize: 13, textAlign: 'center', marginTop: 16 },
});
