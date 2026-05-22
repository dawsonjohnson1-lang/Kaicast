// User Settings — canonical enums + write-path allowlist (CommonJS).
//
// ⚠ KEEP IN SYNC with:
//   app/src/shared/userSettings.ts     (TypeScript canonical)
//   desktop/shared/userSettings.ts     (TypeScript mirror)
//
// Cloud Functions still run on CommonJS, so this file is a hand-written
// mirror of the TS version. If you edit one, edit all three.

const CERTIFICATION = Object.freeze({
  PADI_OPEN_WATER: 'padi_open_water',
  PADI_ADVANCED:   'padi_advanced',
  PADI_RESCUE:     'padi_rescue',
  PADI_DIVEMASTER: 'padi_divemaster',
  FREEDIVE_L1:     'freedive_l1',
  FREEDIVE_L2:     'freedive_l2',
  FREEDIVE_L3:     'freedive_l3',
  SPEARFISHING:    'spearfishing',
  NONE:            'none',
});
const CERTIFICATION_VALUES = Object.values(CERTIFICATION);

const PREFERRED_DIVE_TYPE = Object.freeze({
  SCUBA:        'scuba',
  FREEDIVE:     'freedive',
  SPEARFISHING: 'spearfishing',
  SNORKEL:      'snorkel',
});
const PREFERRED_DIVE_TYPE_VALUES = Object.values(PREFERRED_DIVE_TYPE);

const UNITS = Object.freeze({
  IMPERIAL: 'imperial',
  METRIC:   'metric',
});
const UNITS_VALUES = Object.values(UNITS);

const SETTINGS_PATHS = Object.freeze({
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
});
const SETTINGS_PATH_VALUES = Object.values(SETTINGS_PATHS);

const REAUTH_REQUIRED_PATHS = Object.freeze([
  SETTINGS_PATHS.email,
  SETTINGS_PATHS.phone,
]);

const DEFAULT_USER_SETTINGS = Object.freeze({
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
});

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

function isValidPhone(s) {
  return typeof s === 'string' && E164_REGEX.test(s);
}

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Validate the (path, value) tuple from a client. Returns
// { ok: true } | { ok: false, message: string }.
function validateSettingsWrite(path, value) {
  if (!SETTINGS_PATH_VALUES.includes(path)) {
    return { ok: false, message: `Unknown settings path: ${String(path)}` };
  }

  switch (path) {
    case SETTINGS_PATHS.email:
      if (!isValidEmail(value)) return { ok: false, message: 'Email must look like name@domain.tld' };
      return { ok: true };

    case SETTINGS_PATHS.phone:
      if (!isValidPhone(value)) return { ok: false, message: 'Phone must be E.164 (e.g. +18085550129)' };
      return { ok: true };

    case SETTINGS_PATHS.certification:
      if (!CERTIFICATION_VALUES.includes(value)) {
        return { ok: false, message: `certification must be one of: ${CERTIFICATION_VALUES.join(', ')}` };
      }
      return { ok: true };

    case SETTINGS_PATHS.preferredDiveType:
      if (!PREFERRED_DIVE_TYPE_VALUES.includes(value)) {
        return { ok: false, message: `preferredDiveType must be one of: ${PREFERRED_DIVE_TYPE_VALUES.join(', ')}` };
      }
      return { ok: true };

    case SETTINGS_PATHS.homeSpotId:
      // Existence check happens in the callable (needs Firestore) — here
      // just shape-check it's a non-empty string.
      if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, message: 'homeSpotId must be a non-empty spotId string' };
      }
      return { ok: true };

    case SETTINGS_PATHS.units:
      if (!UNITS_VALUES.includes(value)) {
        return { ok: false, message: `units must be one of: ${UNITS_VALUES.join(', ')}` };
      }
      return { ok: true };

    case SETTINGS_PATHS.pushEnabled:
    case SETTINGS_PATHS.pushCategoryConditionAlerts:
    case SETTINGS_PATHS.pushCategoryFriendReports:
    case SETTINGS_PATHS.pushCategorySystem:
      if (typeof value !== 'boolean') {
        return { ok: false, message: `${path} must be boolean` };
      }
      return { ok: true };

    default:
      return { ok: false, message: `Unhandled path: ${path}` };
  }
}

module.exports = {
  CERTIFICATION,
  CERTIFICATION_VALUES,
  PREFERRED_DIVE_TYPE,
  PREFERRED_DIVE_TYPE_VALUES,
  UNITS,
  UNITS_VALUES,
  SETTINGS_PATHS,
  SETTINGS_PATH_VALUES,
  REAUTH_REQUIRED_PATHS,
  DEFAULT_USER_SETTINGS,
  E164_REGEX,
  isValidPhone,
  isValidEmail,
  validateSettingsWrite,
};
