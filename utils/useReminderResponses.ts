import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { handleReminderResponse } from '../services/reminderService';

/**
 * Follows tapped meal/water reminders — including the one that cold-launched
 * the app. Mount only inside the signed-in, onboarded navigator so the target
 * routes exist.
 */
export const useReminderResponses = () => {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const follow = (response: Notifications.NotificationResponse) => {
      handleReminderResponse(response)
        .then((url) => {
          if (url === '/modal') router.push('/modal');
          else if (url) router.navigate(url as Href);
        })
        .catch((error) => console.error('Error handling reminder:', error));
    };

    const initial = Notifications.getLastNotificationResponse();
    if (initial) {
      Notifications.clearLastNotificationResponse();
      follow(initial);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(follow);
    return () => subscription.remove();
  }, []);
};
