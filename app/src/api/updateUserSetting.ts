// updateUserSetting — client wrapper around the Firebase Functions
// callable of the same name. Centralizes the platform tag + reauth
// flag so the Settings screen doesn't have to know either.
//
// Optimistic UI pattern (used by SettingsScreen):
//   1. Render row from `settings.<path>` (live snapshot).
//   2. On change, set a `pending[path] = value` local map.
//   3. Render row from `pending[path] ?? settings.<path>`.
//   4. Call updateUserSetting; on success, delete from pending (let
//      the snapshot win); on error, delete from pending + surface.

import { Platform } from 'react-native';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth, firebaseConfigured } from '@/firebase';
import { REAUTH_REQUIRED_PATHS, type SettingsPath } from '@/shared/userSettings';

const clientPlatform: 'ios' | 'android' | 'web' =
  Platform.OS === 'ios' ? 'ios' :
  Platform.OS === 'android' ? 'android' : 'web';

export interface UpdateUserSettingArgs {
  path: SettingsPath;
  value: string | boolean;
  /**
   * Set to true once the client has already invoked
   * `reauthenticateWithCredential` for the current user. The callable
   * refuses email/phone writes without this flag.
   */
  acknowledgedReauth?: boolean;
}

export async function updateUserSetting(args: UpdateUserSettingArgs): Promise<void> {
  if (!firebaseConfigured || !app) {
    // Stub mode — no-op. The live snapshot path returns EMPTY defaults
    // and the screen renders without persistence. Tests run in this mode.
    return;
  }
  const fn = httpsCallable<UpdateUserSettingArgs, { ok: boolean }>(
    getFunctions(app, 'us-central1'),
    'updateUserSetting',
  );
  await fn({
    path: args.path,
    value: args.value,
    acknowledgedReauth: args.acknowledgedReauth === true,
    // The server uses this to stamp meta.updatedBy.
    // @ts-expect-error — clientPlatform isn't on the public type but
    // the callable reads it.
    clientPlatform,
  });
}

/**
 * Re-authenticate the current user using their email + password.
 * Required before writing email/phone settings. Throws if no current
 * user, no email, or wrong password — the Settings screen surfaces
 * the error to the user.
 */
export async function reauthWithPassword(password: string): Promise<void> {
  if (!firebaseConfigured || !app || !auth) {
    // No-op in stub mode; the subsequent write is also no-op.
    return;
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  if (!user.email) {
    // Non-password sign-in providers (Google, Apple) need a different
    // re-auth flow — skipping for v1; Settings screen disables the
    // password prompt in that case.
    throw new Error('Re-auth via password only — sign-in provider does not support it.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export function pathRequiresReauth(path: SettingsPath): boolean {
  return REAUTH_REQUIRED_PATHS.includes(path);
}
