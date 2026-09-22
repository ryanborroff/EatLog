import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'eatlog.onboardingComplete';

interface OnboardingContextValue {
  /** False until the stored flag has been read, so the app never flashes the wrong screen. */
  ready: boolean;
  completed: boolean;
  /** True when onboarding ended via "Start speaking" — Today consumes this to open the voice modal. */
  launchVoiceLogPending: boolean;
  completeOnboarding: (options?: { launchVoiceLog?: boolean }) => void;
  clearLaunchVoiceLog: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  ready: false,
  completed: false,
  launchVoiceLogPending: false,
  completeOnboarding: () => {},
  clearLaunchVoiceLog: () => {},
});

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [launchVoiceLogPending, setLaunchVoiceLogPending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setCompleted(stored === 'true'))
      .catch((error) => console.error('Error reading onboarding flag:', error))
      .finally(() => setReady(true));
  }, []);

  const completeOnboarding = useCallback((options?: { launchVoiceLog?: boolean }) => {
    setLaunchVoiceLogPending(options?.launchVoiceLog === true);
    setCompleted(true);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch((error) => {
      console.error('Error saving onboarding flag:', error);
    });
  }, []);

  const clearLaunchVoiceLog = useCallback(() => setLaunchVoiceLogPending(false), []);

  return (
    <OnboardingContext.Provider
      value={{ ready, completed, launchVoiceLogPending, completeOnboarding, clearLaunchVoiceLog }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => useContext(OnboardingContext);
