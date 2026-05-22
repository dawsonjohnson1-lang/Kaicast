// User Settings — canonical enums + write-path allowlist.
//
// ⚠ KEEP IN SYNC with:
//   desktop/shared/userSettings.ts   (TypeScript mirror)
//   functions/shared/userSettings.js (CommonJS mirror)
//
// A real workspace package would be cleaner but mobile's Metro is
// pinned to app/ (metro.config.js → projectRoot/watchFolders), so
// reaching outside the app/ tree requires bundler reconfig that we
// haven't committed to yet. Mirrored files are the pragmatic interim.

export const CERTIFICATION = {
  PADI_OPEN_WATER: 'padi_open_water',
  PADI_ADVANCED:   'padi_advanced',
  PADI_RESCUE:     'padi_rescue',
  PADI_DIVEMASTER: 'padi_divemaster',
  FREEDIVE_L1:     'freedive_l1',
  FREEDIVE_L2:     'freedive_l2',
  FREEDIVE_L3:     'freedive_l3',
  SPEARFISHING:    'spearfishing',
  NONE:            'none',
} as const;
export type Certification = (typeof CERTIFICATION)[keyof typeof CERTIFICATION];
export const CERTIFICATION_VALUES: Certification[] = Object.values(CERTIFICATION);

// Human labels (displayed in the UI). Keep order in sync with how the
// onboarding form already presents them.
export const CERTIFICATION_LABELS: Record<Certification, string> = {
  padi_open_water: 'PADI Open Water',
  padi_advanced:   'PADI Advanced',
  padi_rescue:     'PADI Rescue',
  padi_divemaster: 'PADI Divemaster',
  freedive_l1:     'Freedive L1',
  freedive_l2:     'Freedive L2',
  freedive_l3:     'Freedive L3',
  spearfishing:    'Spearfishing',
  none:            'None / not yet',
};

export const PREFERRED_DIVE_TYPE = {
  SCUBA:        'scuba',
  FREEDIVE:     'freedive',
  SPEARFISHING: 'spearfishing',
  SNORKEL:      'snorkel',
} as const;
export type PreferredDiveType = (typeof PREFERRED_DIVE_TYPE)[keyof typeof PREFERRED_DIVE_TYPE];
export const PREFERRED_DIVE_TYPE_VALUES: PreferredDiveType[] = Object.values(PREFERRED_DIVE_TYPE);
export const PREFERRED_DIVE_TYPE_LABELS: Record<PreferredDiveType, string> = {
  scuba:        'Scuba',
  freedive:     'Freediving',
  spearfishing: 'Spearfishing',
  snorkel:      'Snorkeling',
};

export const UNITS = {
  IMPERIAL: 'imperial',
  METRIC:   'metric',
} as const;
export type Units = (typeof UNITS)[keyof typeof UNITS];
export const UNITS_VALUES: Units[] = Object.values(UNITS);
export const UNITS_LABELS: Record<Units, string> = {
  imperial: 'Imperial (ft, °F)',
  metric:   'Metric (m, °C)',
};

export type Platform = 'ios' | 'android' | 'web';

// Dotted Firestore field paths. The `updateUserSetting` callable rejects
// any path not in this list — a tripwire against UI typos and the
// canonical allowlist for clients building dynamic edit rows.
export const SETTINGS_PATHS = {
  email: 'email',
  phone: 'phone',

  certification:     'profile.certification',
  preferredDiveType: 'profile.preferredDiveType',
  homeSpotId:        'profile.homeSpotId',

  pushEnabled:                  'prefs.pushNotifications.enabled',
  pushCategoryConditionAlerts:  'prefs.pushNotifications.categories.conditionAlerts',
  pushCategoryFriendReports:    'prefs.pushNotifications.categories.friendReports',
  pushCategorySystem:           'prefs.pushNotifications.categories.system',

  units: 'prefs.units',
} as const;

export type SettingsPath = (typeof SETTINGS_PATHS)[keyof typeof SETTINGS_PATHS];
export const SETTINGS_PATH_VALUES: SettingsPath[] = Object.values(SETTINGS_PATHS);

// Paths that need a recent re-auth before the callable will accept the
// write. The client must call `reauthenticateWithCredential` (or the
// equivalent) within ~5 minutes of invoking the callable, then attempt
// the write. Firebase doesn't expose a server-side "was recently
// re-authed" check (auth_time is on the ID token but only refreshes on
// re-auth + token refresh), so this is enforced client-side AND noted
// in audit logs.
export const REAUTH_REQUIRED_PATHS: ReadonlyArray<SettingsPath> = [
  SETTINGS_PATHS.email,
  SETTINGS_PATHS.phone,
];

// Legal & support — surfaced in the Settings UI on both clients.
export const LEGAL_LINKS = {
  privacyPolicy:  'https://kaicast.app/legal/privacy',
  termsOfService: 'https://kaicast.app/legal/terms',
  supportMailto:  'mailto:support@kaicast.app',
} as const;

// Defaults used by the migration script and as initializers in the UI
// when /users/{uid} hasn't been populated yet.
export const DEFAULT_USER_SETTINGS = {
  phone: '',
  profile: {
    certification:     CERTIFICATION.NONE,
    preferredDiveType: PREFERRED_DIVE_TYPE.SCUBA,
    homeSpotId:        '',
  },
  prefs: {
    pushNotifications: {
      enabled: true,
      categories: {
        conditionAlerts: true,
        friendReports:   true,
        system:          true,
      },
    },
    units: UNITS.IMPERIAL,
  },
} as const;

// E.164 phone regex — +, country code (1–9), 1–14 trailing digits.
// Used by the Cloud Function for server-side validation; clients can
// use it for inline form feedback.
export const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isValidPhone(s: string): boolean {
  return typeof s === 'string' && E164_REGEX.test(s);
}

export function isValidEmail(s: string): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
