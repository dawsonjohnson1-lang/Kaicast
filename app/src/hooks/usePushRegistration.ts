// Auto-register the signed-in user's push token if they've already
// granted notification permission. Does NOT prompt for permission —
// the prompt happens explicitly in Settings (or any future
// notification-enabling action) via registerForPush() so first launch
// doesn't ambush new users with a system dialog.
//
// Listens for incoming notifications while the app is open and logs
// taps so future deep-link handling has somewhere to plug in.

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { getExpoPushToken, persistDeviceToken } from '@/api/push';

export function usePushRegistration(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    (async () => {
      // Only refresh / re-persist the token when permission is
      // already granted. New users see no prompt until they enable
      // notifications themselves.
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      await persistDeviceToken(uid, token).catch(() => undefined);
    })();

    // Tap handler — when a user taps a notification while the app
    // is killed/backgrounded, the OS opens the app and fires this.
    // For now just log; real deep-link routing is a follow-up.
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      // intentionally empty — placeholder for future deep-link routing
    });

    return () => {
      cancelled = true;
      responseSub.remove();
    };
  }, [uid]);
}
