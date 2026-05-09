// Maps Firebase Auth error codes (the `code` field on FirebaseError)
// to short, user-facing messages. Falls back to the raw message when
// we don't have a translation yet.

const MAP: Record<string, string> = {
  'auth/invalid-email':         'That email address is invalid.',
  'auth/user-disabled':         'That account has been disabled.',
  'auth/user-not-found':        'No account matches that email.',
  'auth/wrong-password':        'Incorrect email or password.',
  'auth/invalid-credential':    'Incorrect email or password.',
  'auth/email-already-in-use':  'An account already exists for that email.',
  'auth/weak-password':         'Password should be at least 6 characters.',
  'auth/too-many-requests':     'Too many attempts — try again in a moment.',
  'auth/network-request-failed':'Network error — check your connection.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
};

export function friendlyAuthError(err: unknown): string {
  if (!err) return 'Sign-in failed.';
  const e = err as { code?: string; message?: string };
  if (e.code && MAP[e.code]) return MAP[e.code];
  if (e.message) return e.message.replace(/^Firebase:\s*/i, '');
  return 'Sign-in failed.';
}
