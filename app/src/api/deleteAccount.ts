// Self-serve account deletion (Apple App Store requirement).
//
// Re-authenticates the user with their password (Firebase blocks
// sensitive operations on stale sessions), then invokes the server
// callable which fans out the cascading deletion across:
//   - users/{uid}/{favorites,following,followers,devices}
//   - mirrored followers/following entries on OTHER users
//   - diveLogs where uid == this user
//   - profile photos in Cloud Storage
//   - users/{uid} doc
//   - the Firebase Auth user itself
//
// After the callable returns, the client's auth session is no
// longer valid. We sign out explicitly for clean local state — the
// 3-phase navigator drops the user back to AuthNav.
//
// Email/password only for now. Social-auth re-auth would use
// reauthenticateWithPopup() / similar; we'll wire that when Apple /
// Google sign-in ships.

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth, firebaseConfigured } from '@/firebase';

export type DeleteAccountError =
  | 'not-configured'
  | 'not-signed-in'
  | 'wrong-password'
  | 'requires-recent-login'
  | 'network'
  | 'unknown';

export class AccountDeletionError extends Error {
  code: DeleteAccountError;
  constructor(code: DeleteAccountError, message: string) {
    super(message);
    this.code = code;
  }
}

export async function deleteAccount(password: string): Promise<void> {
  if (!firebaseConfigured || !auth || !app) {
    throw new AccountDeletionError(
      'not-configured',
      'Account deletion is unavailable in demo mode.',
    );
  }
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new AccountDeletionError('not-signed-in', 'Not signed in.');
  }

  // Re-auth — Firebase rejects deletion if the session is older than
  // ~5 min. EmailAuthProvider.credential is the email/password path.
  try {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) {
      throw new AccountDeletionError('wrong-password', 'Incorrect password.');
    }
    if (code.includes('network')) {
      throw new AccountDeletionError('network', 'Network error — try again.');
    }
    throw new AccountDeletionError('unknown', 'Could not verify your identity.');
  }

  // Server-side cascade + auth user deletion.
  try {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'deleteUserAccount');
    await fn();
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code.includes('unauthenticated')) {
      throw new AccountDeletionError('requires-recent-login', 'Session expired — sign in again.');
    }
    throw new AccountDeletionError('unknown', (err as Error).message || 'Deletion failed.');
  }

  // Server-side admin.auth().deleteUser invalidated the session;
  // sign out so the client's onAuthStateChanged listener drops the
  // user immediately and the navigator routes back to AuthNav.
  try { await signOut(auth); } catch { /* ignore — already gone */ }
}
