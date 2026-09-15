import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteAccount } from '../../services/authService';

export default function PrivacyScreen() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently erases your account, your entire food diary, and every saved food, default, and preference. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Are you absolutely sure?',
      "There's no way to recover your data after this. Your account will be deleted immediately.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // Signing out (inside deleteAccount) triggers the app's own
              // auth-state redirect back to sign-in — nothing more to do here.
            } catch (error) {
              setDeleting(false);
              Alert.alert('Error', "Couldn't delete your account. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Privacy</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How your data is used</Text>
          <Text style={styles.paragraph}>
            Your food diary — what you log, quantities, calories and macros — is stored against
            your account and never shared with third parties for advertising or sold to anyone.
          </Text>
          <Text style={styles.paragraph}>
            When you log food by voice, the audio itself never leaves your device — it's
            transcribed to text on-device. That text, and any question you ask in Ask, is sent to
            Groq, a third-party AI service, to interpret it. Groq doesn't receive your email or
            account identity, only the text of that one request.
          </Text>
          <Text style={styles.paragraph}>
            We also record a small set of anonymous-ish usage events (like "food logged") to
            understand how the app is used. These never include your diary text.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delete your account</Text>
          <Text style={styles.paragraph}>
            You can permanently delete your account and all associated data at any time. This
            cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
          >
            {deleting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete my account</Text>
            )}
          </TouchableOpacity>
        </View>
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
  section: { paddingHorizontal: 20, marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#666666', textTransform: 'uppercase', marginBottom: 12 },
  paragraph: { fontSize: 15, color: '#000000', lineHeight: 22, marginBottom: 12 },
  deleteButton: {
    backgroundColor: '#D64545',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
