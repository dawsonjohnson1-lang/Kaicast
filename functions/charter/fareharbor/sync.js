// syncFareHarborTrips — Cloud Scheduler, every 30 minutes.
//
// For each charter_accounts/{orgId} that has integrations/fareharbor
// configured with a shortname + userApiKey:
//
//   1. Fetch /companies/{shortname}/items/        — every product/trip.
//   2. Fetch /companies/{shortname}/availabilities/date-range/{from}/{to}/
//      where from = today (HST) and to = +60 days.
//   3. Upsert each item into fh_items/{fhItemPk} with merge:true so
//      charter enrichment fields (tripType, boatIds, harborId,
//      kaicastSpotIds, notes, enriched) SURVIVE the sync.
//   4. Upsert each availability into fh_trips/{fhAvailabilityPk}
//      denormalized with the enrichment payload from fh_items so the
//      /charter/trips page can read one doc per trip.
//   5. Stamp lastSync / syncStatus='ok' / tripCount on the integration
//      doc. On any failure: syncStatus='error' + errorMsg.
//
// We don't delete availabilities that fall out of the window — the
// captain may want to look back. A nightly retention sweep can prune
// older docs once we cross 60 + N days of history.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { listItems, listAvailabilities, FhError } = require('./fareharborApi');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const FAREHARBOR_APP_KEY = defineSecret('FAREHARBOR_APP_KEY');

// Hawaii is fixed UTC-10 (no DST). All FH date strings use the
// company's local clock, so for Hawaii charters we always compute
// in HST.
const HST_OFFSET_MS = -10 * 60 * 60 * 1000;

exports.syncFareHarborTrips = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'us-central1',
    secrets: [FAREHARBOR_APP_KEY],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (_event) => {
    const db = admin.firestore();
    const integrationsSnap = await db
      .collectionGroup('integrations')
      .where('shortname', '>', '')
      .get();
    // collectionGroup matches every doc under any path ending in
    // /integrations/*. Each charter writes ONE doc at
    // charter_accounts/{orgId}/integrations/fareharbor — that's the
    // shape we filter for below.
    const fhDocs = integrationsSnap.docs.filter((d) => d.id === 'fareharbor');
    if (fhDocs.length === 0) {
      logger.info('[fh-sync] no connected charters; skipping');
      return;
    }

    logger.info('[fh-sync] start', { charterCount: fhDocs.length });
    let okCount = 0;
    let errCount = 0;
    for (const doc of fhDocs) {
      // Doc path is charter_accounts/{orgId}/integrations/fareharbor.
      const orgId = doc.ref.parent.parent.id;
      try {
        const result = await syncOneCharter(db, orgId, doc.data());
        await doc.ref.set(
          {
            lastSync: admin.firestore.FieldValue.serverTimestamp(),
            syncStatus: 'ok',
            errorMsg: null,
            tripCount: result.tripCount,
            itemCount: result.itemCount,
          },
          { merge: true },
        );
        okCount += 1;
      } catch (err) {
        errCount += 1;
        const msg = err instanceof FhError ? `${err.kind}: ${err.message}` : err.message || String(err);
        logger.warn('[fh-sync] charter failed', { orgId, error: msg });
        await doc.ref.set(
          {
            lastSync: admin.firestore.FieldValue.serverTimestamp(),
            syncStatus: 'error',
            errorMsg: msg,
          },
          { merge: true },
        );
      }
    }
    logger.info('[fh-sync] done', { okCount, errCount });
  },
);

async function syncOneCharter(db, orgId, integration) {
  const shortname = integration.shortname;
  const userKey = integration.userApiKey;
  if (!shortname || !userKey) {
    throw new FhError('config', 0, 'integration is missing shortname or userApiKey');
  }

  // Window: today HST → +60d HST.
  const todayHst = formatHstDate(new Date());
  const toHst = formatHstDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

  const itemsRaw = await listItems(shortname, userKey);
  const items = Array.isArray(itemsRaw) ? itemsRaw : Array.isArray(itemsRaw?.items) ? itemsRaw.items : [];

  const avsRaw = await listAvailabilities(shortname, userKey, todayHst, toHst);
  const availabilities = Array.isArray(avsRaw)
    ? avsRaw
    : Array.isArray(avsRaw?.availabilities) ? avsRaw.availabilities : [];

  const now = admin.firestore.FieldValue.serverTimestamp();

  // 1) Upsert fh_items. Merge so charter enrichment fields survive.
  const itemsBatch = db.batch();
  let itemBatchSize = 0;
  const itemIndex = new Map(); // pk → minimal data the trip loop needs
  for (const it of items) {
    const pk = pickPk(it);
    if (pk == null) continue;
    const minimal = {
      fhItemPk: pk,
      name: String(it.name ?? ''),
      headline: String(it.headline ?? ''),
      description: String(it.description ?? ''),
      maxCapacity: pickNum(it, 'max_capacity') ?? pickNum(it, 'maxCapacity') ?? 0,
      durationMinutes: pickDurationMin(it),
      lastSynced: now,
    };
    itemsBatch.set(
      db.collection('charter_accounts').doc(orgId).collection('fh_items').doc(String(pk)),
      minimal,
      { merge: true },
    );
    itemIndex.set(pk, minimal);
    itemBatchSize += 1;
    if (itemBatchSize >= 400) {
      await itemsBatch.commit();
      itemBatchSize = 0;
    }
  }
  if (itemBatchSize > 0) await itemsBatch.commit();

  // Read back the enrichment payload for each item so we can
  // denormalize onto every trip. Two reads per charter sync is cheap.
  const enrichmentByPk = await readEnrichment(db, orgId, Array.from(itemIndex.keys()));

  // 2) Upsert fh_trips. We DON'T merge with enrichment fields again
  //    here — the enrichment lives on the item, not the trip. The
  //    trip just denormalizes the current enrichment snapshot.
  const tripsBatch = db.batch();
  let tripBatchSize = 0;
  let writtenTrips = 0;
  for (const av of availabilities) {
    const pk = pickPk(av);
    const itemPk = pickItemPk(av);
    if (pk == null || itemPk == null) continue;
    const enrichment = enrichmentByPk.get(itemPk) ?? null;
    const item = itemIndex.get(itemPk);
    const startsAt = av.start_at || av.startAt || null;
    const endsAt   = av.end_at   || av.endAt   || null;
    const date = startsAt ? startsAt.slice(0, 10) : todayHst;
    const startTime = startsAt ? extractHhmm(startsAt) : '00:00';
    const endTime   = endsAt   ? extractHhmm(endsAt)   : '00:00';
    const booked   = pickNum(av, 'bookings') ?? pickNum(av, 'booked') ?? 0;
    const capacity = pickNum(av, 'capacity') ?? (item?.maxCapacity ?? 0);

    const tripDoc = {
      orgId,
      fhItemPk: itemPk,
      fhAvailabilityPk: pk,
      tripName: item?.name ?? '',
      date,
      startTime,
      endTime,
      booked,
      capacity,
      cancelled: av.is_bookable === false || av.canceled === true,
      cancelledAt: null,
      // Denormalized enrichment snapshot — may be null if not set.
      tripType:        enrichment?.tripType        ?? null,
      boatIds:         Array.isArray(enrichment?.boatIds) ? enrichment.boatIds : [],
      harborId:        enrichment?.harborId        ?? null,
      kaicastSpotIds:  Array.isArray(enrichment?.kaicastSpotIds) ? enrichment.kaicastSpotIds : [],
      source: 'fareharbor',
      lastSynced: now,
    };
    tripsBatch.set(
      db.collection('charter_accounts').doc(orgId).collection('fh_trips').doc(String(pk)),
      tripDoc,
      { merge: true },
    );
    tripBatchSize += 1;
    writtenTrips += 1;
    if (tripBatchSize >= 400) {
      await tripsBatch.commit();
      tripBatchSize = 0;
    }
  }
  if (tripBatchSize > 0) await tripsBatch.commit();

  return { tripCount: writtenTrips, itemCount: itemIndex.size };
}

async function readEnrichment(db, orgId, itemPks) {
  if (itemPks.length === 0) return new Map();
  // Firestore's `in` cap is 30; chunk if necessary.
  const chunks = [];
  for (let i = 0; i < itemPks.length; i += 30) chunks.push(itemPks.slice(i, i + 30));
  const out = new Map();
  for (const chunk of chunks) {
    const snap = await db
      .collection('charter_accounts')
      .doc(orgId)
      .collection('fh_items')
      .where('fhItemPk', 'in', chunk)
      .get();
    snap.forEach((d) => {
      const data = d.data();
      out.set(data.fhItemPk, {
        tripType:       typeof data.tripType === 'string' ? data.tripType : null,
        boatIds:        Array.isArray(data.boatIds) ? data.boatIds : [],
        harborId:       typeof data.harborId === 'string' ? data.harborId : null,
        kaicastSpotIds: Array.isArray(data.kaicastSpotIds) ? data.kaicastSpotIds : [],
      });
    });
  }
  return out;
}

// ─── Tiny helpers — FH API shapes vary between snake_case / camelCase ──

function pickPk(obj) {
  if (typeof obj?.pk === 'number') return obj.pk;
  if (typeof obj?.id === 'number') return obj.id;
  return null;
}

function pickItemPk(obj) {
  if (typeof obj?.item_pk === 'number') return obj.item_pk;
  if (typeof obj?.itemPk === 'number') return obj.itemPk;
  if (typeof obj?.item?.pk === 'number') return obj.item.pk;
  return null;
}

function pickNum(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickDurationMin(item) {
  // FH publishes duration either as a `duration` string ("PT5H") or
  // as `duration_minutes`. We accept both; fall back to 0.
  if (typeof item?.duration_minutes === 'number') return item.duration_minutes;
  if (typeof item?.durationMinutes === 'number') return item.durationMinutes;
  const iso = typeof item?.duration === 'string' ? item.duration : '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0', 10) * 60) + parseInt(m[2] || '0', 10);
}

function formatHstDate(d) {
  const shifted = new Date(d.getTime() + HST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "2026-06-02T07:00:00-10:00" → "07:00". Safe against bare HH:mm. */
function extractHhmm(iso) {
  const t = String(iso).split('T')[1] ?? iso;
  return String(t).slice(0, 5);
}
