import React, { useEffect, useState } from 'react';
import { Stack, router, ThemeProvider as NavigationThemeProvider, DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, StyleSheet, AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getSession, onAuthStateChange, handleAuthRedirectUrl } from '../services/authService';
import { track } from '../services/analytics';
import { configureReminders, refreshReminders } from '../services/reminderService';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { palettes } from '../constants/theme';
import { OnboardingProvider, useOnboarding } from '../contexts/OnboardingContext';

// Feeds the app palette to React Navigation so screen and modal backgrounds
// (visible during transitions) match the active color scheme.
function NavigationTheme({ children }: { children: React.ReactNode }) {
  const { colorScheme, colors, accentColor } = useTheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: accentColor,
      background: colors.background,
      card: colors.background,
      text: colors.textPrimary,
      border: colors.divider,
      notification: colors.danger,
    },
  };
  return <NavigationThemeProvider value={theme}>{children}</NavigationThemeProvider>;
}

function RootNavigator() {
  const { ready: onboardingReady, completed: onboardingCompleted } = useOnboarding();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // ThemeProvider isn't mounted yet while loading, so read the system scheme directly.
  const loadingColors = palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];

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

  // Reminders are re-planned from today's diary whenever it might have changed
  // elsewhere: sign-in/out (signing out clears them) and returning to the app.
  const userId = session?.user.id;
  useEffect(() => {
    refreshReminders();
  }, [userId]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReminders();
    });
    return () => appStateSubscription.remove();
  }, []);

  if (loading || !onboardingReady) {
    return (
      <View style={[styles.loading, { backgroundColor: loadingColors.background }]}>
        <ActivityIndicator color={loadingColors.textPrimary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider>
        <NavigationTheme>
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
                <Stack.Screen name="settings/profile" options={{ headerShown: false }} />
                <Stack.Screen name="settings/targets" options={{ headerShown: false }} />
                <Stack.Screen name="settings/personal-foods" options={{ headerShown: false }} />
                <Stack.Screen name="settings/usual-foods" options={{ headerShown: false }} />
                <Stack.Screen name="settings/reminders" options={{ headerShown: false }} />
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
        </NavigationTheme>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

configureReminders();

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
  },
});
