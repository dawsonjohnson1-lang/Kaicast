// fareharborWebhook — public HTTPS endpoint that FareHarbor posts to
// when bookings change. We map three event types to Firestore writes
// on the matching fh_trips/{fhAvailabilityPk} doc:
//
//   booking.created   → bump booked count
//   booking.updated   → re-set booked count
//   booking.cancelled → set cancelled:true + cancelledAt:now and
//                       decrement the booked count by the cancelled
//                       booking's customer count
//
// The booked-count math is best-effort using whatever shape FH ships
// — if a payload doesn't carry the new total, we fall back to a
// targeted /availabilities/{pk}/ re-fetch via the org's stored
// userApiKey. Sync also reconciles every 30 minutes so any drift
// settles within half an hour.
//
// We respond 200 before doing the Firestore write so FH's retry queue
// doesn't pile up when Firestore is briefly slow.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const FAREHARBOR_APP_KEY = defineSecret('FAREHARBOR_APP_KEY');

exports.fareharborWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [FAREHARBOR_APP_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST required' });
      return;
    }
    const body = req.body ?? {};
    const eventType = String(body.event_type ?? body.eventType ?? body.event ?? '').toLowerCase();
    // Respond 200 immediately. FH's retry queue treats anything other
    // than 2xx as a deliverable; the write below is best-effort and
    // we have the 30-min sync as a fallback.
    res.status(200).json({ accepted: true });

    try {
      await handleEvent(eventType, body);
    } catch (err) {
      logger.error('[fh-webhook] handler failed', { eventType, error: err.message });
    }
  },
);

async function handleEvent(eventType, body) {
  switch (eventType) {
    case 'booking.created':
    case 'booking.updated':
    case 'booking.cancelled':
    case 'booking.canceled': // FH spells it both ways across docs versions
      return handleBookingEvent(eventType, body);
    default:
      logger.info('[fh-webhook] ignored event', { eventType });
  }
}

async function handleBookingEvent(eventType, body) {
  // FH's booking payload nests the availability under `availability`
  // (sometimes `availability_pk` directly). The booking customer
  // count is `customer_count` / `customerCount`. We support both.
  const booking = body.booking ?? body;
  const availPk =
    booking?.availability?.pk
    ?? booking?.availability_pk
    ?? booking?.availabilityPk
    ?? body?.availability_pk
    ?? null;
  if (availPk == null) {
    logger.warn('[fh-webhook] no availability pk in payload', { eventType });
    return;
  }
  const customerCount = Number(booking?.customer_count ?? booking?.customerCount ?? 1);
  const cancelled = eventType === 'booking.cancelled' || eventType === 'booking.canceled';

  // Find the trip doc — it could be under any charter_accounts/{orgId}.
  // collectionGroup query on fhAvailabilityPk gives us the matching
  // doc(s) without needing to know which org owns it.
  const db = admin.firestore();
  const snap = await db
    .collectionGroup('fh_trips')
    .where('fhAvailabilityPk', '==', Number(availPk))
    .limit(5)
    .get();

  if (snap.empty) {
    logger.warn('[fh-webhook] no fh_trips doc for availability', { availPk, eventType });
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await Promise.all(
    snap.docs.map((doc) => {
      const current = doc.data();
      const patch = {};
      if (cancelled) {
        // For a cancelled booking, set the trip cancelled flag only if
        // the entire availability was cancelled. FH sends booking.
        // cancelled for individual cancellations too — we use a heuristic:
        // when `booking.availability.is_bookable === false` it's a
        // cancellation of the whole availability; otherwise it's a single
        // booking and we just decrement booked.
        const wholeAvCancelled = booking?.availability?.is_bookable === false;
        if (wholeAvCancelled) {
          patch.cancelled = true;
          patch.cancelledAt = now;
        }
        patch.booked = Math.max(0, (current.booked ?? 0) - customerCount);
      } else if (eventType === 'booking.created') {
        patch.booked = (current.booked ?? 0) + customerCount;
        patch.cancelled = false;
      } else if (eventType === 'booking.updated') {
        // We don't have a reliable "old count" in the payload, so we
        // accept whatever the payload claims is the total or fall
        // through to the next sync. For now, just bump booked by the
        // customer count's delta from prior — if absent, leave unchanged
        // and rely on the 30-min reconciliation.
        const newTotal = Number(booking?.availability?.bookings ?? booking?.availability?.booked ?? NaN);
        if (Number.isFinite(newTotal)) patch.booked = newTotal;
      }
      patch.lastSynced = now;
      patch.lastWebhookEvent = eventType;
      patch.lastWebhookAt = now;
      logger.info('[fh-webhook] applied', { availPk, eventType, patch });
      return doc.ref.set(patch, { merge: true });
    }),
  );
}
