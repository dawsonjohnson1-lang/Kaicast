/**
 * Auth context for the desktop preview.
 *
 * Wraps Firebase Auth's onAuthStateChanged + exposes a typed `useAuth()`
 * hook for screens. Holds the current user + a loading flag so guards
 * can wait until Firebase has reported in (otherwise a brief flash of
 * "signed-out UI" hits before Firebase rehydrates the session).
 *
 * Sign-in / sign-up helpers live here too so screens don't import
 * firebase directly — keeps the auth surface in one file.
 */

import React from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '../firebase';

/** Account type.
 *
 *  - `consumer` — default for anyone who signed up via the regular flow.
 *  - `charter`  — org owner / admin, provisioned via the
 *                 `provisionCharterOperator` callable which sets
 *                 `accountType: 'charter'` + `orgId` on users/{uid}.
 *  - `crew`     — invited crew member; account created via the
 *                 invite-accept flow. Their org-side data lives in
 *                 `orgMemberships[]` rather than the top-level `orgId`.
 *
 *  Route gates in App.tsx + router.ts use this to land each kind of
 *  user on the right surface (consumer → /dashboard, charter → /charter,
 *  crew → /crew). */
export type AccountType = 'consumer' | 'charter' | 'crew';

/** Role inside a charter org. Mirrors CrewRole in
 *  desktop/charter/types.ts minus 'owner' (only the provisioning
 *  callable can set 'owner'; it never rides through an invite). */
export type OrgRole = 'captain' | 'divemaster' | 'deckhand' | 'manager' | 'instructor';

/** Lifecycle state of an org membership. `invited` is created by the
 *  charter admin via the invite-crew modal; flips to `active` when the
 *  invitee accepts. `inactive` is set when the admin removes the member
 *  or the member leaves the org (kept in the array as audit trail). */
export type OrgMembershipStatus = 'active' | 'invited' | 'inactive';

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  status: OrgMembershipStatus;
  /** ms epoch — server writes a Timestamp, we coerce to number on read. */
  invitedAt: number | null;
  /** ms epoch when the user accepted the invite. `null` until accepted. */
  acceptedAt: number | null;
}

/** What's actually unlocking Pro for this user.
 *  - `subscription`     — paid directly (Stripe / IAP subscription).
 *  - `crew_membership`  — Pro is comped because they're an active crew member.
 *  - `null`             — no Pro access. */
export type ProSource = 'subscription' | 'crew_membership' | null;

/** Currently-selected context for the global account switcher.
 *
 *  Format:
 *    `'consumer'`        — Personal context (consumer dashboard).
 *    `'crew:{orgId}'`    — Crew context for a specific org.
 *
 *  Charter-admin context is NOT encoded here — charter admins keep
 *  `accountType: 'charter'` + a top-level `orgId`, and the switcher
 *  surfaces "Charter Admin" as a separate entry that routes to /charter
 *  without flipping `activeContext`. (Spec is explicit about this
 *  asymmetry: activeContext only persists consumer vs crew.) */
export type ActiveContext = 'consumer' | `crew:${string}`;

interface AuthCtx {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** `consumer` unless users/{uid}.accountType is set to 'charter' or 'crew'. */
  accountType: AccountType;
  /** Org id from users/{uid}.orgId. Only meaningful for charter
   *  (admin) accounts — that's the org they own/admin. `null` for
   *  consumer and crew accounts; crew users carry their org list in
   *  `orgMemberships` instead. */
  orgId: string | null;
  /** Crew memberships across orgs. A user can be crew at multiple
   *  orgs at once, and a charter admin can ALSO carry memberships if
   *  they crew on their own boats. Empty for plain consumer accounts. */
  orgMemberships: OrgMembership[];
  /** Whether this user has Pro features unlocked, by ANY source. */
  proAccess: boolean;
  /** What's currently providing Pro access. `null` when proAccess is false. */
  proSource: ProSource;
  /** When proSource === 'crew_membership' and the user has just lost
   *  all active memberships, the entitlement Function arms a 7-day
   *  grace clock — proAccess stays true, proExpiresAt is set to the
   *  revocation deadline, and the daily sweep flips proAccess to
   *  false once we cross it. Null when no grace is pending. */
  proExpiresAt: number | null;
  /** Last-used context (persisted to users/{uid}.activeContext so it
   *  survives device switches per the spec). Always 'consumer' for
   *  brand-new users until they switch contexts. */
  activeContext: ActiveContext;
  /** Persist a new activeContext. Writes through to Firestore so other
   *  devices/tabs see the same selection on next load. Optimistic — the
   *  local state updates immediately and the Firestore write happens
   *  in the background. */
  setActiveContext: (ctx: ActiveContext) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(firebaseConfigured);
  // Role + org are populated from users/{uid} via onSnapshot. We track
  // their loading state separately so the combined `loading` flag below
  // covers BOTH Firebase Auth's loading AND the role lookup — otherwise
  // a charter user would briefly see the consumer dashboard render
  // before the role doc arrives and the gate kicks in.
  const [accountType, setAccountType] = React.useState<AccountType>('consumer');
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [orgMemberships, setOrgMemberships] = React.useState<OrgMembership[]>([]);
  const [proAccess, setProAccess] = React.useState<boolean>(false);
  const [proSource, setProSource] = React.useState<ProSource>(null);
  const [proExpiresAt, setProExpiresAt] = React.useState<number | null>(null);
  const [activeContext, setActiveContextState] = React.useState<ActiveContext>('consumer');
  const [roleLoading, setRoleLoading] = React.useState(false);

  React.useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    getRedirectResult(auth)
      .then((cred) => {
        // cred is null when the page wasn't reached via a redirect
        // flow (i.e. normal load). When non-null we just completed
        // signInWithRedirect and may have a brand-new user that
        // needs their Firestore doc seeded with consumer defaults.
        if (cred) {
          void seedUserDocIfNew(cred);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[auth] redirect result error', err);
      });
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Subscribe to users/{uid} so a role upgrade (consumer → charter / crew)
  // or org reassignment takes effect without a sign-out/in cycle. Defaults
  // to consumer / empty when the doc doesn't exist OR the field is
  // missing, so the gate fails closed against the more-permissive side
  // (consumer routes are public-ish; charter / crew are the privileged
  // sections).
  React.useEffect(() => {
    if (!user || !db || !firebaseConfigured) {
      setAccountType('consumer');
      setOrgId(null);
      setOrgMemberships([]);
      setProAccess(false);
      setProSource(null);
      setProExpiresAt(null);
      setActiveContextState('consumer');
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        const at: AccountType =
          data?.accountType === 'charter' ? 'charter'
          : data?.accountType === 'crew' ? 'crew'
          : 'consumer';
        const oid = typeof data?.orgId === 'string' && data.orgId.length > 0 ? data.orgId : null;
        setAccountType(at);
        setOrgId(oid);
        setOrgMemberships(coerceOrgMemberships(data?.orgMemberships));
        setProAccess(data?.proAccess === true);
        setProSource(coerceProSource(data?.proSource));
        setProExpiresAt(tsToMs(data?.proExpiresAt));
        setActiveContextState(coerceActiveContext(data?.activeContext));
        setRoleLoading(false);
      },
      () => {
        // Doc read denied or network error — fall back to consumer so
        // we don't strand the user behind a closed charter gate.
        setAccountType('consumer');
        setOrgId(null);
        setOrgMemberships([]);
        setProAccess(false);
        setProSource(null);
        setProExpiresAt(null);
        setActiveContextState('consumer');
        setRoleLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const requireAuth = () => {
    if (!auth) throw new Error('Auth not configured. Set VITE_FIREBASE_* env vars.');
    return auth;
  };

  const loading = authLoading || roleLoading;

  const setActiveContext = React.useCallback(
    async (ctx: ActiveContext) => {
      // Optimistic local update so the UI flips immediately. The
      // Firestore write happens in the background; onSnapshot will
      // re-affirm the value on the next tick. If the write fails
      // (offline, permission), we surface it but keep the local
      // selection — the user's intent on this device still applies.
      setActiveContextState(ctx);
      if (!user || !db || !firebaseConfigured) return;
      try {
        await updateDoc(doc(db, 'users', user.uid), { activeContext: ctx });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[auth] setActiveContext write failed', err);
      }
    },
    [user],
  );

  const value: AuthCtx = {
    user,
    loading,
    configured: firebaseConfigured,
    accountType,
    orgId,
    orgMemberships,
    proAccess,
    proSource,
    proExpiresAt,
    activeContext,
    setActiveContext,
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    signUpEmail: async (email, password, displayName) => {
      const a = requireAuth();
      const cred = await createUserWithEmailAndPassword(a, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await seedUserDocIfNew(cred);
    },
    signInGoogle: async () => {
      const a = requireAuth();
      const provider = new GoogleAuthProvider();
      // Some browsers (Safari with strict tracking, or any environment
      // with popup blockers) silently kill the popup. We try popup
      // first because it's better UX (no full-page redirect), but fall
      // back to redirect for the second try.
      try {
        const cred = await signInWithPopup(a, provider);
        await seedUserDocIfNew(cred);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          // Redirect path — the credential comes back on next page
          // load via getRedirectResult, which calls seedUserDocIfNew
          // above. We just kick off the redirect here.
          await signInWithRedirect(a, provider);
          return;
        }
        throw err;
      }
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(requireAuth(), email);
    },
    signOut: async () => {
      await fbSignOut(requireAuth());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// Helper for components that just need initials from a display name or email.
export function initialsFromUser(u: User | null, fallback = '?'): string {
  if (!u) return fallback;
  if (u.displayName) {
    const parts = u.displayName.trim().split(/\s+/);
    return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
  }
  if (u.email) return u.email[0].toUpperCase();
  return fallback;
}

// ── Firestore schema coercion + seed helpers ─────────────────────────
//
// The users/{uid} doc is owner-readable via the rules but the entitlement
// + role fields (accountType, orgId, orgMemberships, proAccess, proSource)
// are server-only after creation. These helpers normalize the raw
// snapshot data into the typed shape useAuth exposes, defaulting safely
// when fields are missing — which is the common case for accounts that
// existed before the schema landed.

function coerceOrgMemberships(raw: unknown): OrgMembership[] {
  if (!Array.isArray(raw)) return [];
  const out: OrgMembership[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (typeof m.orgId !== 'string' || !m.orgId) continue;
    const role: OrgRole | null = (
      m.role === 'captain'    || m.role === 'divemaster' || m.role === 'deckhand'
      || m.role === 'manager' || m.role === 'instructor'
    ) ? (m.role as OrgRole) : null;
    const status = m.status === 'active' || m.status === 'invited' || m.status === 'inactive'
      ? (m.status as OrgMembershipStatus)
      : null;
    if (!role || !status) continue;
    out.push({
      orgId: m.orgId,
      orgName: typeof m.orgName === 'string' ? m.orgName : m.orgId,
      role,
      status,
      invitedAt: tsToMs(m.invitedAt),
      acceptedAt: tsToMs(m.acceptedAt),
    });
  }
  return out;
}

function coerceProSource(raw: unknown): ProSource {
  if (raw === 'subscription' || raw === 'crew_membership') return raw;
  return null;
}

function coerceActiveContext(raw: unknown): ActiveContext {
  if (typeof raw !== 'string') return 'consumer';
  if (raw === 'consumer') return 'consumer';
  if (raw.startsWith('crew:') && raw.length > 5) return raw as ActiveContext;
  return 'consumer';
}

function tsToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  // Firestore Timestamp serializes with a toMillis() method.
  if (typeof raw === 'object' && raw && 'toMillis' in raw) {
    const ts = raw as { toMillis: () => number };
    try { return ts.toMillis(); } catch { return null; }
  }
  return null;
}

/** Seed defaults into users/{uid} the first time a user signs up.
 *  Idempotent guard: only runs when Firebase Auth reports `isNewUser`
 *  on the credential, so re-signing-in to an existing account is a
 *  no-op. The CREATE branch of the rule allows the server-only
 *  role/entitlement keys ONLY at exactly these default values
 *  (consumer / null / [] / false), so don't add or change fields here
 *  without updating firestore.rules — later updates to those fields
 *  are blocked at the rule level. */
async function seedUserDocIfNew(cred: UserCredential): Promise<void> {
  if (!db || !firebaseConfigured) return;
  const info = getAdditionalUserInfo(cred);
  if (!info?.isNewUser) return;
  const ref = doc(db, 'users', cred.user.uid);
  try {
    await setDoc(
      ref,
      {
        accountType: 'consumer',
        orgId: null,
        orgMemberships: [],
        proAccess: false,
        proSource: null,
        activeContext: 'consumer',
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    // Non-fatal — onboarding may write displayName / photoURL before
    // this completes, and the migration script can backfill anyone
    // who slips through. Surface for debugging.
    // eslint-disable-next-line no-console
    console.warn('[auth] seedUserDocIfNew failed', err);
  }
}
