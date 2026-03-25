
/* eslint-env node */
/* global fetch */

const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

let WEBFLOW_API_TOKEN;
let WEBFLOW_SPOTS_CID;
let WEBFLOW_WINDOWS_CID;

try {
  WEBFLOW_API_TOKEN = defineSecret("WEBFLOW_API_TOKEN");
  WEBFLOW_SPOTS_CID = defineSecret("WEBFLOW_SPOTS_CID");
  WEBFLOW_WINDOWS_CID = defineSecret("WEBFLOW_WINDOWS_CID");
} catch (e) {
  logger.info("defineSecret not available, falling back to process.env for Webflow secrets");
  WEBFLOW_API_TOKEN = null;
  WEBFLOW_SPOTS_CID = null;
  WEBFLOW_WINDOWS_CID = null;
}

const WEBFLOW_BASE = "https://api.webflow.com/v2";

function jsonHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Accept-Version": "1.0.0",
    "Content-Type": "application/json",
    "User-Agent": "KaiCast/1.0",
  };
}

async function listAllItems({ collectionId, token }) {
  let items = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${WEBFLOW_BASE}/collections/${collectionId}/items?limit=${limit}&offset=${offset}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let r;
    try {
      r = await fetch(url, { headers: jsonHeaders(token), signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      throw new Error(`Webflow list items failed: ${err.message}`);
    }
    clearTimeout(timeout);

    if (!r.ok) {
      const txt = await r.text().catch(() => "<no body>");
      throw new Error(`Webflow list items failed (${r.status}): ${txt}`);
    }
    const j = await r.json();
    const batch = j.items || [];
    items = items.concat(batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return items;
}

async function createItem({ collectionId, token, fieldData }) {
  const url = `${WEBFLOW_BASE}/collections/${collectionId}/items`;
  const r = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ isArchived: false, isDraft: false, fieldData }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Webflow create item failed (${r.status}): ${txt}`);
  }
  return r.json();
}

async function updateItem({ collectionId, token, itemId, fieldData }) {
  const url = `${WEBFLOW_BASE}/collections/${collectionId}/items/${itemId}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ fieldData }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Webflow update item failed (${r.status}): ${txt}`);
  }
  return r.json();
}

async function getCollectionFields({ collectionId, token }) {
  const url = `${WEBFLOW_BASE}/collections/${collectionId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let r;
  try {
    r = await fetch(url, { headers: jsonHeaders(token), signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`Webflow get collection schema failed: ${err.message}`);
  }
  clearTimeout(timeout);

  if (!r.ok) {
    const txt = await r.text().catch(() => "<no body>");
    throw new Error(`Webflow get collection schema failed (${r.status}): ${txt}`);
  }
  const j = await r.json();
  const fields = Array.isArray(j.fields) ? j.fields.map((f) => (f.slug || f.name || "").toString()) : [];
  return fields;
}

function safeSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function putNum(out, key, v) {
  if (Number.isFinite(v)) out[key] = v;
}
function putStr(out, key, v) {
  if (v != null && String(v).trim() !== "") out[key] = String(v);
}
function putBool(out, key, v) {
  if (typeof v === "boolean") out[key] = v;
}
function putJson(out, key, v) {
  if (v != null) out[key] = typeof v === "string" ? v : JSON.stringify(v);
}

function toSpotFieldData(report) {
  const slug = safeSlug(report.spot);
  const lat = report.spotLat ?? null;
  const lon = report.spotLon ?? null;
  const coast = report.spotCoast ?? null;

  const out = {
    name: report.spotName || report.spot,
    slug,
    spot_id: String(report.spot ?? ""),
    last_generated_at: String(report.generatedAt ?? ""),
    now_json: JSON.stringify(report.now ?? {}),
    report_json: JSON.stringify(report ?? {}),
    latitude: lat,
    longitude: lon,
    coast: coast,
  };

  out["spot-id"] = out.spot_id;
  out["last-generated-at"] = out.last_generated_at;
  out["now-json"] = out.now_json;
  out["report-json"] = out.report_json;

  return out;
}

function toWindowFieldData({ report, window, spotItemId = null }) {
  const spotSlug = safeSlug(report.spot);
  const start = window.startIso || "";
  const end = window.endIso || "";
  const windowSlug = safeSlug(`${spotSlug}-${start}-${end}`);

  const rating = window.rating ?? {};
  const avg = window.avg ?? {};
  const vis = window.visibility ?? {};

  const nowAnalysis = report.now?.analysis ?? {};
  const moon = nowAnalysis.moon ?? {};
  const jelly = nowAnalysis.jellyfish ?? {};
  const nowMetrics = report.now?.metrics ?? {};

  const savedAtHourKey = report.hourKey || (() => {
    const d = new Date(start);
    return (
      String(d.getUTCFullYear()) +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0") +
      String(d.getUTCHours()).padStart(2, "0")
    );
  })();

  const label = `${report.spotName || report.spot} ${start}`;

  const out = {
    name: label,
    label,
    slug: windowSlug,
    spot_id: report.spot,

    start: window.startIso ?? undefined,
    end: window.endIso ?? undefined,

    ...(spotItemId ? { spotref: [spotItemId] } : {}),

    rating: rating.rating ?? undefined,
    reason: rating.reason ?? undefined,
    "caution-note": rating.cautionNote ?? undefined,
  };

  putNum(out, "score", rating.score);

  putNum(out, "vis-m", vis.estimatedVisibilityMeters);
  putNum(out, "vis-ft", vis.estimatedVisibilityFeet);

  putNum(out, "wind-kt", avg.windSpeedKts ?? nowMetrics.windSpeedKts);
  putNum(out, "gust-kt", avg.windGustKts ?? nowMetrics.windGustKts);
  putNum(out, "wind-direction", avg.windDeg ?? nowMetrics.windDeg);

  putNum(out, "air-temp-c", avg.airTempC ?? nowMetrics.airTempC);
  const airC = avg.airTempC ?? nowMetrics.airTempC;
  if (Number.isFinite(airC)) putNum(out, "air-temp-f", Math.round((airC * 9 / 5 + 32) * 10) / 10);

  putNum(out, "water-temp-c", avg.waterTempC ?? nowMetrics.waterTempC);
  const waterC = avg.waterTempC ?? nowMetrics.waterTempC;
  if (Number.isFinite(waterC)) putNum(out, "water-temp-f", Math.round((waterC * 9 / 5 + 32) * 10) / 10);

  putNum(out, "wave-height-m", avg.waveHeightM);
  const waveHeightM = avg.waveHeightM ?? nowMetrics.waveHeightM;
  if (Number.isFinite(waveHeightM)) {
    const waveFeet = Math.round(waveHeightM * 3.28084 * 10) / 10;
    putNum(out, "wave-height-f", waveFeet);
    putNum(out, "wave-ft", waveFeet);
  }
  putNum(out, "dominant-period-s", avg.wavePeriodS);

  putStr(out, "moon-phase", moon.moonPhase);
  putNum(out, "moon-illumination", moon.moonIllumination);
  putNum(out, "days-since-full-moon", moon.daysSinceFullMoon);

  putBool(out, "jellyfish-warning", jelly.jellyfishWarning);
  putBool(out, "night-diving-ok", jelly.nightDivingOk);
  putStr(out, "night-dive-note", jelly.nightDiveNote);

  const runoff = window.runoff ?? nowAnalysis.runoff ?? null;
  if (runoff) {
    putStr(out, "runoff-severity", runoff.severity);
    putBool(out, "runoff-safe-to-enter", runoff.safeToEnter);
    putStr(out, "runoff-health-risk", runoff.healthRisk);
    putStr(out, "runoff-water-quality", runoff.waterQualityFeel);

    // NEW OPTIONAL FIELDS:
    // These will only be sent if your CMS schema includes them (due to schema filtering).
    putStr(out, "runoff-rating-cap", runoff.ratingCap);
    putNum(out, "runoff-vis-cap-m", runoff.visibilityCapMeters);
    putNum(out, "runoff-confidence", runoff.confidence);
  }

  putJson(out, "sources-json", Array.isArray(report.sources) ? report.sources : null);

  if (Array.isArray(report.qcFlags) && report.qcFlags.length > 0) {
    out["qc-flags"] = report.qcFlags.join(",");
  }

  putStr(out, "saved-at-hour-key", savedAtHourKey);

  out.window_json = JSON.stringify(window ?? {});
  out.generated_at = String(report.generatedAt ?? "");

  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

function filterFieldDataForCollection(fieldData, allowedFieldSlugs = new Set()) {
  if (!fieldData || typeof fieldData !== "object") return {};
  if (allowedFieldSlugs.size === 0) return fieldData;

  const out = {};
  const always = ["name", "slug"];
  for (const k of always) if (fieldData[k] !== undefined) out[k] = fieldData[k];

  for (const [k, v] of Object.entries(fieldData)) {
    if (always.includes(k)) continue;
    if (allowedFieldSlugs.has(k)) out[k] = v;
  }
  return out;
}

async function pushAllReportsToWebflow({ reports }) {
  let token;
  let spotsCid;
  let windowsCid;

  try { token = WEBFLOW_API_TOKEN ? WEBFLOW_API_TOKEN.value() : (process.env.WEBFLOW_API_TOKEN || ""); }
  catch { token = process.env.WEBFLOW_API_TOKEN || ""; }

  try { spotsCid = WEBFLOW_SPOTS_CID ? WEBFLOW_SPOTS_CID.value() : (process.env.WEBFLOW_SPOTS_CID || ""); }
  catch { spotsCid = process.env.WEBFLOW_SPOTS_CID || ""; }

  try { windowsCid = WEBFLOW_WINDOWS_CID ? WEBFLOW_WINDOWS_CID.value() : (process.env.WEBFLOW_WINDOWS_CID || ""); }
  catch { windowsCid = process.env.WEBFLOW_WINDOWS_CID || ""; }

  if (!token) throw new Error("WEBFLOW_API_TOKEN is missing");
  if (!spotsCid) throw new Error("WEBFLOW_SPOTS_CID is missing");
  if (!windowsCid) throw new Error("WEBFLOW_WINDOWS_CID is missing");

  logger.info("Webflow push starting", { reports: reports.length });

  const spotsFieldsArr = await getCollectionFields({ collectionId: spotsCid, token }).catch((e) => {
    logger.warn("Unable to fetch spots collection schema; continuing without schema filtering", { message: e.message });
    return [];
  });
  const windowsFieldsArr = await getCollectionFields({ collectionId: windowsCid, token }).catch((e) => {
    logger.warn("Unable to fetch windows collection schema; continuing without schema filtering", { message: e.message });
    return [];
  });

  const spotsAllowed = new Set((spotsFieldsArr || []).map(String));
  const windowsAllowed = new Set((windowsFieldsArr || []).map(String));

  const existingSpots = await listAllItems({ collectionId: spotsCid, token });
  const spotBySlug = new Map();
  for (const it of existingSpots) {
    const slug = it?.fields?.slug || it?.fieldData?.slug || it?.slug;
    if (slug) spotBySlug.set(String(slug), it);
  }

  for (const report of reports) {
    const rawFieldData = toSpotFieldData(report);
    const fieldData = filterFieldDataForCollection(rawFieldData, spotsAllowed);
    const slug = rawFieldData.slug;
    const existing = spotBySlug.get(slug);

    if (!existing) {
      const created = await createItem({ collectionId: spotsCid, token, fieldData });
      logger.info("Webflow spot created", { slug, id: created?.id });
      spotBySlug.set(slug, created);
    } else {
      await updateItem({ collectionId: spotsCid, token, itemId: existing.id, fieldData });
      logger.info("Webflow spot updated", { slug });
    }
  }

  const latestSpots = await listAllItems({ collectionId: spotsCid, token });
  const latestSpotBySlug = new Map();
  for (const it of latestSpots) {
    const slug = it?.fields?.slug || it?.fieldData?.slug || it?.slug;
    if (slug) latestSpotBySlug.set(String(slug), it);
  }

  const existingWindows = await listAllItems({ collectionId: windowsCid, token });
  const windowBySlug = new Map();
  for (const it of existingWindows) {
    const slug = it?.fields?.slug || it?.fieldData?.slug || it?.slug;
    if (slug) windowBySlug.set(String(slug), it);
  }

  for (const report of reports) {
    const windows = Array.isArray(report.windows) ? report.windows : [];
    for (const w of windows) {
      const spotItem = latestSpotBySlug.get(String(safeSlug(report.spot)));
      const spotItemId = spotItem?.id || null;

      const rawFieldData = toWindowFieldData({ report, window: w, spotItemId });
      const fieldData = filterFieldDataForCollection(rawFieldData, windowsAllowed);

      const slug = fieldData.slug || rawFieldData.slug;
      const existing = windowBySlug.get(slug);

      if (!existing) {
        const created = await createItem({ collectionId: windowsCid, token, fieldData });
        logger.info("Webflow window created", { slug, id: created?.id });
        windowBySlug.set(slug, created);
      } else {
        await updateItem({ collectionId: windowsCid, token, itemId: existing.id, fieldData });
        logger.info("Webflow window updated", { slug });
      }
    }
  }

  logger.info("Webflow push finished", { reports: reports.length });
}

module.exports = { pushAllReportsToWebflow };