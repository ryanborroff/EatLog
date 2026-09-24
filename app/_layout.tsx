import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getSession, onAuthStateChange, handleAuthRedirectUrl } from '../services/authService';
import { track } from '../services/analytics';
import { ThemeProvider } from '../contexts/ThemeContext';
import { OnboardingProvider, useOnboarding } from '../contexts/OnboardingContext';

function RootNavigator() {
  const { ready: onboardingReady, completed: onboardingCompleted } = useOnboarding();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((initialSession) => {
        setSession(initialSession);
        if (initialSession) track('app_opened');
      })
      .finally(() => setLoading(false));

    const subscription = onAuthStateChange(setSession);

    const routeIfRecovery = (type: string | null) => {
      if (type === 'recovery') router.push('/reset-password');
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleAuthRedirectUrl(url).then(routeIfRecovery).catch(() => {});
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthRedirectUrl(url).then(routeIfRecovery).catch(() => {});
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  if (loading || !onboardingReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#000000" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Protected guard={onboardingCompleted}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ask"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="edit-meal"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen name="settings/personal-foods" options={{ headerShown: false }} />
              <Stack.Screen name="settings/usual-foods" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={!onboardingCompleted}>
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen
            name="reset-password"
            options={{ presentation: 'modal', headerShown: false }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  // The app is portrait-only; the Insights tab unlocks rotation while it's focused
  // so turning the phone sideways shows the intake chart.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <OnboardingProvider>
      <RootNavigator />
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
