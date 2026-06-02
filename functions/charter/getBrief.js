// getCharterBrief — public HTTPS endpoint that serves the read-only
// crew briefing for a charter trip. Anyone with the share link
// (tripId + ?t=<token>) gets a safe subset of the trip + the org +
// the spots' canonical info. The trip doc itself is NOT publicly
// readable per the Phase 1 firestore.rules — this function is the
// only way out.
//
// We use a collectionGroup query on `trips` to find the matching
// trip across all orgs without needing the orgId in the URL. The
// briefingShareToken has ~150 bits of entropy so a brute force
// attack against the search space isn't viable.
//
// Returns ONLY the fields safe to share with someone holding the
// share link:
//
//   ✓ trip date + departure/return time + departure harbor
//   ✓ trip type, headcount, spot ids → resolved to {name, lat, lng}
//   ✓ crew names + roles (NO certs, NO contact info, NO uids)
//   ✓ org name (so the brief can say "Blue Water Charters")
//
//   ✗ manifest (medical, emergency contact)
//   ✗ captain's log
//   ✗ conditionsSnapshot internals
//   ✗ briefingShareToken (don't echo it)
//   ✗ crew cert details
//   ✗ org home harbor (no need)
//   ✗ trip status (if it was cancelled the share should 404)

const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const RATE_LIMIT_HEADERS = {
  // Modest cache so a brief shared widely on text/WhatsApp doesn't
  // hammer Firestore; revalidate every 5 min.
  'Cache-Control': 'public, max-age=300',
};

exports.getCharterBrief = onRequest(
  {
    cors: true,
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const tripId = String(req.query.tripId || '').trim();
      const token  = String(req.query.t      || '').trim();
      if (!tripId || !token) {
        res.status(400).json({ error: 'tripId and t (share token) are both required' });
        return;
      }
      if (tripId.length > 80 || token.length < 32 || token.length > 100) {
        // Reject anything that can't be a real id/token. Stops trivial
        // probes from logging interesting noise.
        res.status(400).json({ error: 'malformed tripId or token' });
        return;
      }

      const db = admin.firestore();
      const snap = await db.collectionGroup('trips')
        .where('briefingShareToken', '==', token)
        .limit(1)
        .get();

      if (snap.empty) {
        res.status(404).json({ error: 'No matching brief' });
        return;
      }

      const doc = snap.docs[0];
      if (doc.id !== tripId) {
        // Token is valid but the URL claims a different trip id. Two
        // possible causes: (1) someone is probing across share links;
        // (2) the captain renamed the trip path somehow. Either way
        // we 404 — we don't leak the matching tripId.
        res.status(404).json({ error: 'No matching brief' });
        return;
      }

      const trip = doc.data();
      // Cancelled trips should not be sharable.
      if (trip.status === 'cancelled') {
        res.status(410).json({ error: 'Trip was cancelled' });
        return;
      }

      // Resolve orgId from the doc path: charter_accounts/{orgId}/trips/{tripId}
      const pathParts = doc.ref.path.split('/');
      const orgId = pathParts[1];

      // Org + spots + crew lookups in parallel.
      const [orgSnap, crewSnap, spotDocs] = await Promise.all([
        db.collection('charter_accounts').doc(orgId).get(),
        db.collection('charter_accounts').doc(orgId).collection('crew').get(),
        // Charter-spots referenced on the trip — empty array is fine.
        Promise.all(
          (Array.isArray(trip.spots) ? trip.spots : []).map((spotId) =>
            db.collection('charter_accounts').doc(orgId).collection('spots').doc(spotId).get(),
          ),
        ),
      ]);

      const org = orgSnap.exists ? orgSnap.data() : null;

      // Resolve spot ids to {id, name, lat, lng} — safe public info.
      // Falls back to the bare id if a referenced spot has since
      // been deleted from the library.
      const resolvedSpots = spotDocs.map((spotDoc, i) => {
        const id = trip.spots[i];
        if (!spotDoc.exists) return { id, name: id, lat: null, lng: null };
        const data = spotDoc.data();
        return { id, name: data.name || id, lat: data.lat ?? null, lng: data.lng ?? null };
      });

      // Resolve crew ids to {name, role}. Drop everything else —
      // certs, uids, contact info — before sending to the public.
      const crewMap = new Map();
      crewSnap.forEach((c) => crewMap.set(c.id, c.data()));
      const resolvedCrew = (Array.isArray(trip.crew) ? trip.crew : [])
        .map((crewId) => {
          const c = crewMap.get(crewId);
          if (!c) return null;
          return { name: c.name || 'Crew', role: c.role || 'crew' };
        })
        .filter(Boolean);

      const out = {
        trip: {
          id: tripId,
          date: trip.date?.toDate?.()?.toISOString() ?? null,
          departureTime: trip.departureTime ?? '',
          returnTime:    trip.returnTime    ?? '',
          tripType:      trip.tripType      ?? '',
          headcount:     trip.headcount     ?? 0,
          departureHarbor: {
            name: trip.departureHarbor?.name ?? '',
            lat:  trip.departureHarbor?.lat  ?? null,
            lng:  trip.departureHarbor?.lng  ?? null,
          },
          spots: resolvedSpots,
          crew:  resolvedCrew,
          floatPlanFiled: trip.floatPlanFiled === true,
        },
        org: org ? { name: String(org.name ?? 'KaiCast Charter') } : null,
      };

      res.set(RATE_LIMIT_HEADERS);
      res.json(out);
    } catch (err) {
      logger.error('getCharterBrief failed', { error: err.message });
      res.status(500).json({ error: 'Internal error' });
    }
  },
);
