/* eslint-env node */

/**
 * Abyss — Solar position + topographic shadow check.
 *
 * Computes the sun's altitude (elevation above horizon) and azimuth
 * (compass bearing) at a given lat/lon/time using the NOAA Solar
 * Position Algorithm. Pure JS, zero dependencies, accurate to better
 * than 0.5° anywhere on Earth between 1950 and 2050 — well inside
 * what topographic uncertainty contributes anyway.
 *
 * Combined with a precomputed horizon profile (see horizon.js), this
 * tells us whether the sun is currently visible from the dive spot
 * or blocked by terrain — the difference between "12 ft visibility
 * because the spot is in mountain shadow at 4 PM" vs "30 ft because
 * sun is direct overhead." Underwater visibility scales roughly with
 * surface light intensity in turbid coastal water.
 *
 * Exports:
 *   solarPosition(lat, lon, dateMs)        → { altitudeDeg, azimuthDeg }
 *   isShadowed({ horizon, sun })           → { shadowed, marginDeg }
 *   horizonAtAzimuth(horizonProfile, az)   → degrees
 *   solarLightFactor({ sun, shadowed, cloud }) → 0..1 multiplier
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ─── Solar position (NOAA algorithm, abridged) ──────────────────────
//
// Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// Errors < 0.5° elevation, < 1° azimuth between 1950–2050.
//
// Returns altitude above the LOCAL horizon (sea level) — does NOT
// account for terrain. Pair with a horizon profile to detect
// terrain-blocked sun.
function solarPosition(lat, lon, dateMs) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dateMs)) {
    return { altitudeDeg: null, azimuthDeg: null };
  }

  // Days since J2000.0 (2000-01-01T12:00:00 UTC, unix ms 946728000000).
  // Fractional, can be negative for pre-2000 dates.
  const n = (dateMs - 946728000000) / 86400000;

  // Mean longitude of the Sun (deg, normalized).
  const meanLong = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;

  // Mean anomaly (deg).
  const meanAnomalyDeg = ((357.528 + 0.9856003 * n) % 360 + 360) % 360;
  const meanAnomalyRad = meanAnomalyDeg * DEG;

  // Ecliptic longitude (deg) — equation of center applied.
  const eclipticLongDeg =
    meanLong +
    1.915 * Math.sin(meanAnomalyRad) +
    0.020 * Math.sin(2 * meanAnomalyRad);
  const eclipticLongRad = eclipticLongDeg * DEG;

  // Obliquity of the ecliptic (deg, slowly time-varying).
  const obliquityDeg = 23.439 - 0.0000004 * n;
  const obliquityRad = obliquityDeg * DEG;

  // Right ascension (rad), declination (rad).
  const raRad = Math.atan2(
    Math.cos(obliquityRad) * Math.sin(eclipticLongRad),
    Math.cos(eclipticLongRad),
  );
  const declRad = Math.asin(Math.sin(obliquityRad) * Math.sin(eclipticLongRad));

  // Greenwich Mean Sidereal Time (deg).
  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24;
  const gmstDeg = ((gmstHours * 15) % 360 + 360) % 360;

  // Local hour angle (deg → rad). Eastern longitude is positive.
  let haDeg = gmstDeg + lon - raRad * RAD;
  haDeg = ((haDeg % 360) + 540) % 360 - 180; // wrap to (-180, 180]
  const haRad = haDeg * DEG;

  const latRad = lat * DEG;

  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  // Azimuth from north, clockwise.
  const cosAlt = Math.cos(altRad);
  const sinAz = -Math.sin(haRad) * Math.cos(declRad) / Math.max(1e-9, cosAlt);
  const cosAz =
    (Math.sin(declRad) - Math.sin(altRad) * Math.sin(latRad)) /
    Math.max(1e-9, cosAlt * Math.cos(latRad));
  const azRad = Math.atan2(sinAz, cosAz);

  let azimuthDeg = ((azRad * RAD) % 360 + 360) % 360;
  let altitudeDeg = altRad * RAD;

  // Atmospheric refraction (Sæmundsson) — adds ~0.5° at horizon, lifts
  // sun apparent position. Only matters near the horizon.
  if (altitudeDeg > -2) {
    const refractionMin =
      altitudeDeg >= 5
        ? 58.1 / Math.tan((altitudeDeg + 7.31 / (altitudeDeg + 4.4)) * DEG)
        : 1735 - altitudeDeg * (518.2 - altitudeDeg * (103.4 - altitudeDeg * (12.79 - altitudeDeg * 0.711)));
    altitudeDeg += refractionMin / 3600; // arcsec → deg
  }

  return {
    altitudeDeg: Math.round(altitudeDeg * 100) / 100,
    azimuthDeg: Math.round(azimuthDeg * 100) / 100,
  };
}

// ─── Horizon profile interpolation ──────────────────────────────────
//
// `horizonProfile` is an array of { bearingDeg, horizonAngleDeg }
// samples at fixed bearing increments (typically 5° = 72 samples).
// horizonAtAzimuth() interpolates linearly between samples for
// arbitrary sun azimuths.
function horizonAtAzimuth(horizonProfile, azimuthDeg) {
  if (!Array.isArray(horizonProfile) || horizonProfile.length === 0) return 0;
  const az = ((azimuthDeg % 360) + 360) % 360;

  // Find the two samples that bracket az.
  let lo = horizonProfile[horizonProfile.length - 1];
  let hi = horizonProfile[0];
  for (let i = 0; i < horizonProfile.length; i++) {
    const b = horizonProfile[i].bearingDeg;
    if (b <= az) lo = horizonProfile[i];
    else { hi = horizonProfile[i]; break; }
  }

  // Span across the 360→0 wrap.
  let loB = lo.bearingDeg;
  let hiB = hi.bearingDeg;
  if (hiB <= loB) hiB += 360;
  const azWrapped = az < loB ? az + 360 : az;

  const span = hiB - loB;
  if (span <= 0) return lo.horizonAngleDeg;
  const t = (azWrapped - loB) / span;
  return lo.horizonAngleDeg + t * (hi.horizonAngleDeg - lo.horizonAngleDeg);
}

// ─── Shadow detection ───────────────────────────────────────────────
//
// Combine solar position with a precomputed horizon profile to
// determine if the spot is currently in terrain shadow.
//   shadowed = sun.altitude < horizon.angleAt(sun.azimuth)
//   marginDeg = how far above (positive) or below (negative) horizon
//
// `marginDeg` is useful for soft-shadow handling — pre-sunset / post-
// sunrise the sun grazes the horizon and light is dim even when not
// fully blocked.
function isShadowed({ horizonProfile, sun }) {
  if (!sun || sun.altitudeDeg == null) {
    return { shadowed: true, reason: 'unknown', marginDeg: null, horizonDeg: null };
  }
  if (sun.altitudeDeg < 0) {
    return { shadowed: true, reason: 'night', marginDeg: sun.altitudeDeg, horizonDeg: 0 };
  }
  const horizonDeg = horizonAtAzimuth(horizonProfile, sun.azimuthDeg);
  const marginDeg = sun.altitudeDeg - horizonDeg;
  if (marginDeg < 0) {
    return { shadowed: true, reason: 'terrain', marginDeg, horizonDeg };
  }
  return { shadowed: false, reason: null, marginDeg, horizonDeg };
}

// ─── Light multiplier for visibility model ──────────────────────────
//
// Underwater horizontal visibility in turbid coastal water scales
// roughly with surface PAR (photosynthetically active radiation).
// We approximate PAR with cos(zenith) clamped, then apply terrain
// shadow + cloud cover. Returns 0..1 multiplier where 1 = high noon
// clear sky on an unobstructed spot.
function solarLightFactor({ sun, shadow, cloudCoverPercent = 0 }) {
  if (!sun || sun.altitudeDeg == null || sun.altitudeDeg <= 0) {
    return { factor: 0.05, reason: 'night' }; // floor for moonlight / scattered ambient
  }

  // Direct-beam component: cos(zenith) shaped, ramps in fast above
  // ~10° altitude, peaks at 1.0 at zenith.
  const altRad = Math.max(0, sun.altitudeDeg) * DEG;
  const cosZenith = Math.sin(altRad); // since alt = 90 - zenith
  let direct = Math.max(0, cosZenith);

  // Soft falloff near terrain horizon — sun "grazing" a ridge gets
  // 50% of full direct light; below the ridge gets 0% direct.
  if (shadow?.shadowed) {
    direct = 0;
  } else if (shadow && Number.isFinite(shadow.marginDeg) && shadow.marginDeg < 5) {
    direct *= shadow.marginDeg / 5;
  }

  // Diffuse (sky) component: doesn't disappear in terrain shadow, but
  // does attenuate with low sun angle and cloud cover.
  const diffuse = 0.15 * Math.max(0.1, cosZenith);

  // Cloud cover dims direct strongly, diffuse mildly.
  const cloudFrac = Math.max(0, Math.min(1, cloudCoverPercent / 100));
  const cloudDirect = 1 - 0.85 * cloudFrac;
  const cloudDiffuse = 1 - 0.35 * cloudFrac;

  const factor = Math.max(0.05, direct * cloudDirect + diffuse * cloudDiffuse);

  return {
    factor: Math.round(factor * 100) / 100,
    direct: Math.round(direct * cloudDirect * 100) / 100,
    diffuse: Math.round(diffuse * cloudDiffuse * 100) / 100,
    reason: shadow?.shadowed ? `terrain-shadow:${shadow.reason}` : null,
  };
}

module.exports = {
  solarPosition,
  horizonAtAzimuth,
  isShadowed,
  solarLightFactor,
};
