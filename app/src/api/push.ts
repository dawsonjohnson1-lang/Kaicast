// Push notification registration + token persistence.
//
// Schema:
//   users/{uid}/devices/{tokenSafeId}: {
//     token, platform, model, osVersion, lastSeenAt, createdAt
//   }
//
// The token IS the doc id (slugified to be Firestore-safe). One doc
// per token per user, deduplicated automatically by setDoc(merge).
// When a user signs out and another signs in on the same device,
// each user gets their own device doc — server-side delivery just
// queries `users/{uid}/devices` to find every token for that user.
//
// All flows no-op gracefully when:
//   - Firebase isn't configured (stub mode)
//   - Running on a simulator (Expo Push doesn't work without APNs)
//   - User declines notification permission
//
// Permission UX is intentionally lazy — we ask only when something
// genuinely needs notifications (a setting toggle, a "follow" action,
// etc.) so first-launch doesn't spam a permission prompt.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';

// Foreground handler — show banner + sound + badge so notifications
// land visibly while the app is open. Without this Expo silently
// drops them. Set once at module load; harmless to call repeatedly.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ANDROID_DEFAULT_CHANNEL = 'default';

/**
 * Ensure the Android default channel exists. iOS is no-op. Safe to
 * call repeatedly — Expo dedupes.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL, {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#09A1FB',
  });
}

/**
 * Request notification permission from the user. Returns true if
 * granted (or already granted), false if denied. iOS shows the
 * native prompt the first time; Android (12+) shows a runtime prompt.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulator — Expo Push doesn't work here, but don't break flows.
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get the Expo push token for this device. Returns null when
 * permission isn't granted, on a simulator, or when Expo's project
 * id isn't configured.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;

  await ensureAndroidChannel();

  // Expo SDK ≥48 requires the EAS / Expo project id at token time.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.expoConfig as { eas?: { projectId?: string } })?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data || null;
  } catch (err) {
    // Don't crash — happens on simulator, in Expo Go without proper
    // dev client setup, or when push is server-side disabled.
    // eslint-disable-next-line no-console
    console.warn('[push] getExpoPushTokenAsync failed:', (err as Error).message);
    return null;
  }
}

/**
 * Persist a token under users/{uid}/devices/{safeId}. Merge-set so
 * lastSeenAt updates on every call without overwriting createdAt.
 */
export async function persistDeviceToken(uid: string, token: string): Promise<void> {
  if (!firebaseConfigured || !db) return;
  if (!uid || !token) return;

  // Firestore doc IDs can't contain '/', and can't exceed 1500 bytes.
  // Expo tokens use brackets which are fine, but we slugify anyway
  // to be safe against any future format changes.
  const safeId = encodeURIComponent(token).replace(/%/g, '_');

  await setDoc(
    doc(db, 'users', uid, 'devices', safeId),
    {
      token,
      platform:  Platform.OS,
      model:     Device.modelName ?? null,
      osVersion: Device.osVersion ?? null,
      lastSeenAt: serverTimestamp(),
      createdAt:  serverTimestamp(), // first write wins via merge
    },
    { merge: true },
  );
}

/**
 * One-shot: ask for permission, get token, persist it. Returns the
 * token string if everything succeeded, null otherwise. Designed to
 * be called when the user does something that benefits from push
 * (toggling a notifications setting, following a spot, etc.) so
 * first-launch isn't ambushed by a permission prompt.
 */
export async function registerForPush(uid: string): Promise<string | null> {
  if (!uid) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  const token = await getExpoPushToken();
  if (!token) return null;
  await persistDeviceToken(uid, token);
  return token;
}
