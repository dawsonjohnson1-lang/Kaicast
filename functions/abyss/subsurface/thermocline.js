/* eslint-env node */

/**
 * Thermocline detection from a vertical temperature profile.
 *
 * Pure function. The provider modules fetch raw profiles; this is the
 * single shared routine that turns a {d, t}[] sequence into the depth
 * of the strongest temperature gradient.
 */

// Minimum gradient (°C per meter) to count as a real thermocline.
// Below this, surface mixing is dominant and there isn't a coherent layer.
const MIN_GRADIENT_C_PER_M = 0.1;

/**
 * Find the depth of the strongest vertical temperature gradient.
 *
 * @param {Array<{d: number, t: number}>} profile - depths ascending, temps in °C.
 *   NaN/null temps are skipped (interpreted as data gaps).
 * @returns {number|null} depth (m) of the layer with max |dT/dz|, or null if
 *   no meaningful thermocline is present.
 */
function findThermocline(profile) {
  if (!Array.isArray(profile)) return null;

  // Skip points missing a finite temperature reading.
  const clean = profile.filter(
    (p) => p && Number.isFinite(p.d) && Number.isFinite(p.t)
  );
  if (clean.length < 3) return null;

  let maxGradient = 0;
  let thermoclineDepthM = null;

  for (let i = 1; i < clean.length; i++) {
    const dz = clean[i].d - clean[i - 1].d;
    if (dz <= 0) continue; // unsorted or duplicate depths — skip

    const dt = clean[i].t - clean[i - 1].t;
    const gradient = Math.abs(dt / dz);

    if (gradient > maxGradient) {
      maxGradient = gradient;
      // Midpoint of the two depths better represents the layer interface.
      thermoclineDepthM = (clean[i].d + clean[i - 1].d) / 2;
    }
  }

  if (maxGradient < MIN_GRADIENT_C_PER_M) return null;
  return thermoclineDepthM;
}

module.exports = {
  findThermocline,
  MIN_GRADIENT_C_PER_M,
};
