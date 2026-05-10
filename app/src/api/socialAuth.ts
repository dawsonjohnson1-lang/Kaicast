// Apple + Google sign-in via Firebase Auth.
//
// Apple's App Store rules require Sign in with Apple any time you
// offer Google / Facebook / similar third-party sign-in. Both flows
// here exchange a provider OAuth credential for a Firebase Auth
// session, so onAuthStateChanged downstream is the same as for the
// email/password path — useUserProfile and the navigator just work.
//
// Config required (see docs/APP-STORE-SETUP.md):
//
//   Apple:
//     - Apple Developer Program membership (required for production)
//     - Service ID + Sign in with Apple capability in Xcode
//     - Apple provider enabled in Firebase Auth console with the
//       Service ID, Team ID, Key ID, and private key
//     - iOS only — Android shows a "not supported" error per Apple's
//       published behavior
//
//   Google:
//     - OAuth 2.0 client IDs created in Google Cloud Console (one
//       per platform: Web, iOS, Android)
//     - Google provider enabled in Firebase Auth console
//     - EXPO_PUBLIC_GOOGLE_CLIENT_ID_{IOS,ANDROID,WEB} env vars set
//
// Until the env vars / capabilities are wired, the helpers below
// throw a structured error that the UI surfaces as
// "Sign-in with X is not yet configured."

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import {
  OAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';

import { auth, firebaseConfigured } from '@/firebase';

WebBrowser.maybeCompleteAuthSession();

export type SocialAuthErrorCode =
  | 'not-configured'
  | 'cancelled'
  | 'unsupported-platform'
  | 'unknown';

export class SocialAuthError extends Error {
  code: SocialAuthErrorCode;
  constructor(code: SocialAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// ── Apple Sign In ──────────────────────────────────────────────────
export async function signInWithApple(): Promise<void> {
  if (!firebaseConfigured || !auth) {
    throw new SocialAuthError('not-configured', 'Sign in with Apple is unavailable in demo mode.');
  }
  if (Platform.OS !== 'ios') {
    throw new SocialAuthError('unsupported-platform', 'Sign in with Apple is iOS-only.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new SocialAuthError(
      'not-configured',
      'Sign in with Apple is not available on this device. Add the capability in Xcode and rebuild.',
    );
  }

  // Generate a nonce so Firebase can verify the identity token wasn't
  // tampered with. Apple requires the sha256 of the nonce in the
  // request and the raw nonce in the Firebase credential.
  const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'ERR_REQUEST_CANCELED') {
      throw new SocialAuthError('cancelled', 'Sign-in cancelled.');
    }
    throw new SocialAuthError('unknown', (err as Error).message || 'Apple sign-in failed.');
  }

  if (!credential.identityToken) {
    throw new SocialAuthError('unknown', 'Apple did not return an identity token.');
  }

  const provider = new OAuthProvider('apple.com');
  const fbCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce,
  });
  await signInWithCredential(auth, fbCredential);
}

// ── Google Sign In ─────────────────────────────────────────────────
//
// Uses expo-auth-session's PKCE OAuth flow against Google's authorize
// endpoint. No client secret on the device. The id_token returned is
// exchanged for a Firebase credential.
//
// The right client ID per platform comes from the EXPO_PUBLIC_GOOGLE_*
// env vars; missing values throw `not-configured`.
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
  revocationEndpoint:    'https://oauth2.googleapis.com/revoke',
};

function googleClientId(): string | null {
  if (Platform.OS === 'ios')     return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS     || null;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || null;
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || null;
}

export async function signInWithGoogle(): Promise<void> {
  if (!firebaseConfigured || !auth) {
    throw new SocialAuthError('not-configured', 'Sign in with Google is unavailable in demo mode.');
  }
  const clientId = googleClientId();
  if (!clientId) {
    throw new SocialAuthError(
      'not-configured',
      'Sign in with Google is not yet configured.',
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kaicast' });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'email', 'profile'],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: {
      // Google requires a nonce when using id_token response mode.
      nonce: Math.random().toString(36).slice(2),
    },
  });
  await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new SocialAuthError('cancelled', 'Sign-in cancelled.');
  }
  if (result.type !== 'success') {
    throw new SocialAuthError('unknown', 'Google sign-in failed.');
  }
  const idToken = (result.params as Record<string, string>).id_token;
  if (!idToken) {
    throw new SocialAuthError('unknown', 'Google did not return an id_token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

// ── Capability probes (UI uses these to hide buttons that won't work)
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try { return await AppleAuthentication.isAvailableAsync(); }
  catch { return false; }
}

export function isGoogleSignInConfigured(): boolean {
  return !!googleClientId();
}
