// seedHarbors — one-shot admin callable that writes the 12 Hawaii
// small-boat harbors to the global /harbors collection. Idempotent
// (setDoc + merge:true) so re-running is safe — useful when adding
// a new harbor entry to the source list below.
//
// Auth: email allowlist (same pattern as provisionCharterOperator).
// Delete this file + the export when the harbor list moves to a real
// seed pipeline.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ALLOWED_EMAILS = new Set([
  'dawson@immersion.design',
]);

// Stable harbor list — coordinates from the spec. `aka` array holds
// alternate names that FareHarbor or charters might use (e.g.
// "Honokōhau" vs "Honokohau") so future fuzzy-match flows can land
// the right doc.
const HARBORS = [
  // ── Oahu ────────────────────────────────────────────────────────
  { harborId: 'kewalo_basin',         name: 'Kewalo Basin Harbor',           island: 'oahu',        lat: 21.2897, lng: -157.8631, aka: ['Kewalo Basin'] },
  { harborId: 'hawaii_kai',           name: 'Hawaii Kai Small Boat Harbor',  island: 'oahu',        lat: 21.2763, lng: -157.7011, aka: ['Hawaii Kai'] },
  { harborId: 'haleiwa',              name: 'Haleiwa Small Boat Harbor',     island: 'oahu',        lat: 21.5907, lng: -158.1050, aka: ['Haleiwa', 'Hale\'iwa'] },
  { harborId: 'waianae',              name: 'Waianae Small Boat Harbor',     island: 'oahu',        lat: 21.4447, lng: -158.1877, aka: ['Waianae', 'Wai\'anae'] },
  { harborId: 'kaneohe_bay',          name: 'Kaneohe Bay',                   island: 'oahu',        lat: 21.4389, lng: -157.8003, aka: ['Kaneohe', 'Kane\'ohe Bay'] },
  // ── Maui ────────────────────────────────────────────────────────
  { harborId: 'lahaina',              name: 'Lahaina Harbor',                island: 'maui',        lat: 20.8709, lng: -156.6825, aka: ['Lahaina'] },
  { harborId: 'maalaea',              name: 'Maalaea Harbor',                island: 'maui',        lat: 20.7933, lng: -156.5139, aka: ['Maalaea', 'Mā\'alaea'] },
  { harborId: 'hana',                 name: 'Hana Boat Ramp',                island: 'maui',        lat: 20.7579, lng: -155.9899, aka: ['Hana', 'Hāna'] },
  // ── Big Island ──────────────────────────────────────────────────
  { harborId: 'honokohau',            name: 'Honokohau Harbor',              island: 'big_island',  lat: 19.6900, lng: -156.0286, aka: ['Honokohau', 'Honokōhau'] },
  { harborId: 'kawaihae',             name: 'Kawaihae Harbor',               island: 'big_island',  lat: 20.0366, lng: -155.8286, aka: ['Kawaihae'] },
  // ── Kauai ───────────────────────────────────────────────────────
  { harborId: 'nawiliwili',           name: 'Nawiliwili Harbor',             island: 'kauai',       lat: 21.9583, lng: -159.3514, aka: ['Nawiliwili', 'Nāwiliwili'] },
  { harborId: 'port_allen',           name: 'Port Allen Harbor',             island: 'kauai',       lat: 21.8981, lng: -159.5950, aka: ['Port Allen'] },
];

exports.seedHarbors = onCall(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in first.');
    }
    const email = String(req.auth.token?.email ?? '').toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      logger.warn('[seedHarbors] denied', { email, uid: req.auth.uid });
      throw new HttpsError('permission-denied', `${email} not on seed allowlist.`);
    }

    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all(
      HARBORS.map((h) =>
        db.collection('harbors').doc(h.harborId).set({ ...h, updatedAt: now }, { merge: true }),
      ),
    );

    logger.info('[seedHarbors] seeded', { count: HARBORS.length });
    return { ok: true, count: HARBORS.length };
  },
);
