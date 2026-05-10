# Abyss Visibility Engine — Status

Status of KaiCast's dive-visibility model, written 2026-05-10.

---

## What's Wired

The pipeline (`functions/index.js` → `buildSpotReport`) routes every spot's
**now snapshot** and every **forecast window** through
`estimateVisibilityAbyss`. Each call composes a sequence of multiplicative
layers, each one a physics-informed correction on top of the previous result.

```
baseline → wave → tidal → runoff → bloom → spm → light → wind
```

Per layer, the multipliers in play right now:

| Layer | When it fires | Effect range |
|---|---|---|
| **Baseline** (KD490 → Secchi) | CMEMS / NASA Earthdata creds present | sets initial vis (1-30m) |
| **Wave** (orbital velocity at depth × sediment threshold) | wave height + period present | 0.4× to 1.0× |
| **Tidal flushing** | tide phase known | 0.9× to 1.1× |
| **Runoff plume** | rainfall last 24h > thresholds | 0.3× to 1.0× |
| **Algal bloom** | CHL > 1.0 mg/m³ | 0.6× to 1.0× |
| **SPM** (suspended particulate) | SPM > 0 | 0.4× to 1.0× |
| **Solar light** | always | 0.10× (full shadow + overcast) to 1.0× |
| **Wind chop** | always (gates wind > 8 kts) | 0.45× (storm onshore) to 1.05× (offshore) |

Without CMEMS / NASA creds, layers 1–6 fall through to the legacy heuristic
baseline, and 7–8 always apply.

### Solar + Topographic Shadow

- Pure-JS NOAA Solar Position Algorithm (accurate to <0.5° anywhere on Earth
  1950-2050). No external deps, no calls.
- Topographic horizon profiles **precomputed once** via OpenTopoData (SRTM 30 m)
  for all 26 spots — 72 bearings × 4 distance shells per spot. Ships as
  static JSON; no runtime DEM calls. See `scripts/precompute-horizons.js`.
- Most aggressive horizons: Tunnels Reef 26° south (Wai'ale'ale ridgeline),
  Mokuleia 14° SE (Waianae Range), Three Tables 14° east (Pupukea ridge).
- Per-day solar events on every day in `days[]`: the *effective* first/last
  light accounting for terrain (Hanauma loses sun before calendar sunset
  because of the crater rim, etc.).

### Swell Direction Shielding

The same horizon profile drives directional swell shielding. If the swell is
coming FROM a direction with significant terrain between the spot and open
water, the model scales the effective wave height down. Verified:

- Honolua Bay, 2 m NW swell → effective 2.0 m (open ocean — full hit)
- Honolua Bay, 2 m SE swell → effective 0.3 m (West Maui Mountains block)

Rating + visibility both reflect this — Honolua reads "Fair" with NW swell
but "Good" with SE.

### Wind Chop (Onshore / Offshore)

Wind direction relative to the spot's open-ocean bearing (derived from the
horizon profile's minimum bearing). Verified Mokuleia (north-shore Oahu sand):

- Calm → 17 m vis
- NE trades 18 kts (onshore) → 8 m
- NE trades 25 kts (onshore) → 4 m
- Kona 18 kts (offshore) → 11 m + small bonus

### Rationale

Each visibility computation returns a `rationale` array describing which
layers helped or hurt, expressed as percent deltas. Surfaces on the Overview
tab as a "Why X ft?" card.

---

## Data Sources

| Source | Status | Notes |
|---|---|---|
| **OpenWeather Hourly** | ✅ wired | Air temp, wind, cloud cover, rain |
| **NDBC realtime2** | ✅ wired | Wave height + period + direction + SST. Parser fixed: MWD column now correctly classified as direction (was being conflated with period). |
| **Open-Meteo Marine** | ✅ wired | 7-day wave forecast. Used to fill future hours of `hourlyWithBuoy` for the forecast windows. |
| **NOAA CO-OPS Tides** | ✅ wired | 6-station registry (Honolulu, Mokuoloe, Kahului, Nawiliwili, Hilo, Kawaihae). 7-day tide series. |
| **SRTM 30m** (via OpenTopoData) | ✅ precomputed | Horizon profiles, static JSON. |
| **CMEMS Marine L4** | ❌ disabled | Requires `CMEMS_USERNAME` / `CMEMS_PASSWORD` Firebase secrets. When set, satellite ocean color flows through. |
| **NASA OceanColor MODIS-Aqua** | ❌ disabled | Requires `NASA_EARTHDATA_USERNAME` / `NASA_EARTHDATA_PASSWORD`. Fallback when CMEMS is unavailable. |
| **HYCOM thermocline** | ⚠️ endpoint dead | `coastwatch.pfeg.noaa.gov/erddap/griddap/HYCOM_reg7_latest3d` returns 404. Code exists in `functions/abyss/thermocline.js` but never wired. Needs a working ERDDAP endpoint. |
| **WaveWatch III** | ⚠️ stub | `fetchWW3Forecast` returns empty — GRIB2 binary parse not implemented. We use Open-Meteo Marine instead, which is fine. |

---

## What's Returned in the Report

`now.visibility` shape:
```ts
{
  estimatedVisibilityMeters: number,
  estimatedVisibilityFeet: number,
  rating: 'Poor' | 'Fair' | 'Good' | 'Excellent',
  source: 'satellite' | 'heuristic' | 'cache',
  confidence: number,
  kd490, chlorophyll, spm, dataAgeHours,  // null on heuristic path
  layers: { baseline, wave, tidal, runoff, bloom, spm, light, wind },
  sun: { altitudeDeg, azimuthDeg },
  shadow: { shadowed, reason, horizonDeg, marginDeg },
  light: { factor, direct, diffuse, reason },
  exposure: { factor, swellFromDeg, rawWaveHeightM, effectiveWaveHeightM },
  wind: { relation, openOceanBearingDeg, angleFromOpenDeg, chopMultiplier },
  rationale: string[],
  waveImpact: { orbitalVelocityMps, sedimentRisk, surgeRating, visibilityImpactM },
}
```

`days[i].solar` shape (7-day forecast):
```ts
{
  firstLightMs: number | null,    // first sun above local terrain horizon
  lastLightMs:  number | null,    // last sun above local terrain horizon
  solarNoonMs:  number | null,    // time of peak altitude
  peakAltDeg:   number | null,
}
```

---

## Calibration (Pending Wiring)

`abyss/calibration.js` ships an `ingestDiverReport()` function ready to
record diver-reported visibility for ground-truth comparison against the
model's prediction. The dive-log already captures both inputs:

- `conditions.visibilityFt` and `scuba.visibilityFt` from the user
- `conditionsSnapshot.now.visibility.estimatedVisibilityMeters` from KaiCast

To activate calibration, add a Firestore `onCreate` trigger on
`diveLogs/{logId}` that calls `ingestDiverReport` with the two values.
Per-site bias correction tables live at `abyss_calibration/{spotId}`.
The current Phase 1 approach is a per-spot baseline offset; once a site has
~50 reports the function signature is designed for drop-in replacement with
a ML model trained on the feature vector documented in calibration.js.

---

## Remaining Accuracy Wins (Ranked by Effort × Impact)

| Item | Effort | Impact | Notes |
|---|---|---|---|
| Wire CMEMS / NASA creds | low (user) | high | Unlocks layers 1, 5, 6. Free Copernicus account at marine.copernicus.eu. |
| Diver report trigger | low (1 hr) | medium | Phase-1 calibration foundation. Pure code. |
| Replace HYCOM endpoint | medium | medium | Thermocline visibility shifts at depth. CoastWatch ERDDAP HYCOM_reg7 is 404'd; needs alternate URL discovery. |
| Apple/Google Sign In | medium (user) | low (auth UX) | Already scaffolded in `app/src/api/socialAuth.ts`. Needs Apple Developer + Google Cloud OAuth setup. |
| Local wind-vs-swell interference | medium | medium | Wind opposing swell creates square waves / bigger chop; same direction smooths. Not modeled. |
| Spot-specific stream-mouth direction | medium | medium | Some spots are near a single specific stream. After heavy rain, sediment plume reaches the spot only when wind/current carry it there. |
| Time-since-high-tide for slack timing | low | low | Currently uses categorical tidePhase. Continuous would be slightly more accurate. |
| Multi-day swell forecast (already in Open-Meteo Marine) | done | — | Already wired through `marineForecast.waveDirMap`. |

---

## Test Scenarios

The current model produces these realistic results on the production pipeline
(verified 2026-05-10):

| Spot | Conditions | Vis | Rating | Driver |
|---|---|---|---|---|
| Hanauma Bay (morning) | 1.85 m NE swell shielded, sun 44°, mild cloud | 4 m | Poor | Sheltered from swell -85%, light -63% |
| Hanauma Bay (night) | Sun -45° | 1 m | Poor | Light floor 14% (no flashlight in model) |
| Honolua Bay (8 AM) | 1.7 m NE swell (blocked by W. Maui), offshore breeze | 7 m | Fair | Sheltered -85%, offshore +5% |
| Molokini Crater | 1.6 m NW open swell | 6 m | Fair | Late-afternoon light -45% |
| Mokuleia (calm) | <5 kts wind, 0.6 m N swell | 17 m | Good | — |
| Mokuleia (NE trades 25 kts) | Onshore wind on sand | 4 m | Poor | Onshore wind chop multiplier 0.58 |
| Tunnels Reef (1 AM) | Night | 1 m | Poor | Below horizon |

These match lived experience for Hawaii dive sites.
