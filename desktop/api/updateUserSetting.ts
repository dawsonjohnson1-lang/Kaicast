// updateUserSetting (desktop) — mirror of app/src/api/updateUserSetting.ts.
// Same callable, same shape, just uses the web `firebase/auth` re-auth API.

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth, firebaseConfigured } from '../firebase';
import { REAUTH_REQUIRED_PATHS, type SettingsPath } from '../shared/userSettings';

const clientPlatform: 'web' = 'web';

export interface UpdateUserSettingArgs {
  path: SettingsPath;
  value: string | boolean;
  acknowledgedReauth?: boolean;
}

export async function updateUserSetting(args: UpdateUserSettingArgs): Promise<void> {
  if (!firebaseConfigured || !app) return;
  const fn = httpsCallable<UpdateUserSettingArgs, { ok: boolean }>(
    getFunctions(app, 'us-central1'),
    'updateUserSetting',
  );
  await fn({
    path: args.path,
    value: args.value,
    acknowledgedReauth: args.acknowledgedReauth === true,
    // @ts-expect-error — clientPlatform isn't on the public type but
    // the callable reads it for meta.updatedBy.
    clientPlatform,
  });
}

export async function reauthWithPassword(password: string): Promise<void> {
  if (!firebaseConfigured || !auth) return;
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  if (!user.email) {
    throw new Error('Re-auth via password only — sign-in provider does not support it.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export function pathRequiresReauth(path: SettingsPath): boolean {
  return REAUTH_REQUIRED_PATHS.includes(path);
}
