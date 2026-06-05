/**
 * generateSpotShareImage — 1200×630 PNG card for iMessage / WhatsApp /
 * Slack / Twitter unfurls.
 *
 * Reads the latest cached `kaicast_reports/{spotId}_{hourKey}` and
 * renders a dark-themed card with rating chip + 3-stat strip + a
 * deterministic one-liner summary. Falls back to a "Check KaiCast"
 * placeholder when no report is available.
 *
 * URL:    /generateSpotShareImage?spot={slug}&date={YYYY-MM-DD}
 * Output: image/png, 1h public cache
 *
 * Satori takes React-element-shaped objects (NOT JSX) so this file is
 * plain JS with manual `{ type, props }` trees. Keeps the function
 * package free of TypeScript / JSX transforms.
 */

const fs = require('fs');
const path = require('path');
const { onRequest } = require('firebase-functions/v2/https');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

const { buildShareData, TIER_COLORS } = require('./buildShareData');

// ── Brand tokens (mirrors desktop/tokens.ts + CLAUDE.md spec) ───────
const COLORS = {
  bg:        '#0B1015',
  surface1:  '#161616',
  surface2:  '#1E252C',
  hairline:  'rgba(255,255,255,0.10)',
  text1:     '#F8F8F8',
  text2:     'rgba(248,248,248,0.70)',
  text3:     'rgba(248,248,248,0.44)',
  accent:    '#09A1FB',
};

const FONTS_DIR = path.join(__dirname, '..', 'node_modules', '@fontsource');

// Fonts load once per warm instance. Satori accepts WOFF (not WOFF2),
// which is what fontsource ships in v5+. Reading at module scope means
// the first invocation after a cold start pays the disk cost; warm
// invocations are zero-overhead.
let fontCache = null;
function loadFonts() {
  if (fontCache) return fontCache;
  fontCache = [
    {
      name: 'Inter',
      data: fs.readFileSync(path.join(FONTS_DIR, 'inter/files/inter-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Inter',
      data: fs.readFileSync(path.join(FONTS_DIR, 'inter/files/inter-latin-700-normal.woff')),
      weight: 700,
      style: 'normal',
    },
    {
      name: 'DM Sans',
      data: fs.readFileSync(path.join(FONTS_DIR, 'dm-sans/files/dm-sans-latin-700-normal.woff')),
      weight: 700,
      style: 'normal',
    },
    {
      name: 'JetBrains Mono',
      data: fs.readFileSync(path.join(FONTS_DIR, 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'JetBrains Mono',
      data: fs.readFileSync(path.join(FONTS_DIR, 'jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff')),
      weight: 600,
      style: 'normal',
    },
  ];
  return fontCache;
}

// Shorthand for satori element trees. `props.children` accepts a
// string, a single element, or an array — same as React.
function el(type, props, ...children) {
  const flat = children.flat().filter((c) => c != null && c !== false);
  const merged = { ...(props || {}) };
  if (flat.length > 0) merged.children = flat.length === 1 ? flat[0] : flat;
  return { type, props: merged };
}

// ── Card tree builders ─────────────────────────────────────────────

function statBlock({ label, value, unit, accent }) {
  return el('div', { style: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '24px 28px',
    gap: 8,
  } },
    el('div', { style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 16,
      fontWeight: 400,
      letterSpacing: 2,
      color: COLORS.text3,
      textTransform: 'uppercase',
    } }, label),
    el('div', { style: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    } },
      el('div', { style: {
        fontFamily: 'JetBrains Mono',
        fontSize: 56,
        fontWeight: 600,
        color: accent || COLORS.text1,
        lineHeight: 1,
      } }, value),
      unit ? el('div', { style: {
        fontFamily: 'JetBrains Mono',
        fontSize: 18,
        color: COLORS.text3,
        letterSpacing: 1,
      } }, unit) : null,
    ),
  );
}

function ratingPill(tier, label) {
  const color = TIER_COLORS[tier] || COLORS.accent;
  return el('div', { style: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
    borderRadius: 999,
    backgroundColor: COLORS.surface1,
    border: `1px solid ${color}`,
  } },
    el('div', { style: {
      width: 12,
      height: 12,
      borderRadius: 999,
      backgroundColor: color,
    } }),
    el('div', { style: {
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: 700,
      color: color,
      letterSpacing: 0.5,
    } }, label.toUpperCase()),
  );
}

function buildCard(data) {
  // Header row — spot name + island + date on the left, rating pill on
  // the right.
  const header = el('div', { style: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '56px 64px 40px 64px',
    width: '100%',
  } },
    el('div', { style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1,
    } },
      el('div', { style: {
        fontFamily: 'DM Sans',
        fontSize: 72,
        fontWeight: 700,
        color: COLORS.text1,
        letterSpacing: -1,
        lineHeight: 1,
      } }, data.spotName),
      el('div', { style: {
        display: 'flex',
        flexDirection: 'row',
        gap: 14,
        alignItems: 'center',
      } },
        data.island ? el('div', { style: {
          fontFamily: 'JetBrains Mono',
          fontSize: 18,
          color: COLORS.text2,
          letterSpacing: 2,
          textTransform: 'uppercase',
        } }, data.island) : null,
        data.island ? el('div', { style: {
          width: 4, height: 4, borderRadius: 999, backgroundColor: COLORS.text3,
        } }) : null,
        el('div', { style: {
          fontFamily: 'JetBrains Mono',
          fontSize: 18,
          color: COLORS.text2,
          letterSpacing: 2,
          textTransform: 'uppercase',
        } }, data.dateLabel),
      ),
    ),
    ratingPill(data.tier, data.tierLabel),
  );

  // 3-stat strip — viz / swell / wind. Dashes for missing fields keep
  // the layout stable across spots that don't have full coverage.
  const stats = el('div', { style: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    margin: '0 64px',
    marginRight: 64,
    backgroundColor: COLORS.surface1,
    borderRadius: 16,
    border: `1px solid ${COLORS.hairline}`,
  } },
    statBlock({
      label: 'Viz',
      value: data.visFt != null ? String(data.visFt) : '—',
      unit: data.visFt != null ? 'FT' : '',
      accent: data.tierColor,
    }),
    el('div', { style: { width: 1, backgroundColor: COLORS.hairline } }),
    statBlock({
      label: 'Swell',
      value: data.swellFt != null ? data.swellFt.toFixed(1) : '—',
      unit: data.swellFt != null
        ? (data.swellPeriodS != null ? `FT · ${Math.round(data.swellPeriodS)}S` : 'FT')
        : '',
    }),
    el('div', { style: { width: 1, backgroundColor: COLORS.hairline } }),
    statBlock({
      label: 'Wind',
      value: data.windKt != null ? String(data.windKt) : '—',
      unit: data.windKt != null
        ? (data.windDir ? `KT ${data.windDir}` : 'KT')
        : '',
    }),
  );

  // Summary + footer wordmark.
  const summary = el('div', { style: {
    fontFamily: 'Inter',
    fontSize: 28,
    color: COLORS.text2,
    padding: '36px 64px 0 64px',
    lineHeight: 1.35,
  } }, data.summary);

  const footer = el('div', { style: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: '40px 64px 0 64px',
  } },
    el('div', { style: {
      width: 14, height: 14, borderRadius: 999, backgroundColor: COLORS.accent,
    } }),
    el('div', { style: {
      fontFamily: 'DM Sans',
      fontSize: 22,
      fontWeight: 700,
      color: COLORS.text1,
      letterSpacing: 1,
    } }, 'KAICAST'),
    el('div', { style: { flex: 1 } }),
    el('div', { style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
      color: COLORS.text3,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    } }, 'Hawaii dive conditions'),
  );

  return el('div', { style: {
    display: 'flex',
    flexDirection: 'column',
    width: 1200,
    height: 630,
    backgroundColor: COLORS.bg,
    color: COLORS.text1,
  } },
    header,
    stats,
    summary,
    el('div', { style: { flex: 1 } }),
    footer,
  );
}

function buildPlaceholderCard(spotSlug) {
  const data = {
    spotName: spotSlug ? prettifySlug(spotSlug) : 'Hawaii dive conditions',
    island: '',
    dateLabel: 'Forecast unavailable',
    tier: 'good',
    tierLabel: 'Check KaiCast',
    tierColor: COLORS.accent,
    visFt: null, swellFt: null, swellPeriodS: null,
    windKt: null, windDir: '',
    summary: "We couldn't load this spot's conditions. Open kaicast.com or the app for the latest.",
  };
  return buildCard(data);
}

function prettifySlug(slug) {
  return String(slug || '')
    .split('-')
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(' ');
}

// ── HTTP entrypoint ────────────────────────────────────────────────

exports.generateSpotShareImage = onRequest(
  { timeoutSeconds: 30, memory: '512MiB', cors: true },
  async (req, res) => {
    try {
      const spotId = String(req.query.spot || '').trim();
      const date = req.query.date ? String(req.query.date).trim() : null;
      if (!spotId) {
        res.status(400).send('spot query param is required');
        return;
      }

      const data = await buildShareData({ spotId, date });
      const tree = data ? buildCard(data) : buildPlaceholderCard(spotId);
      const fonts = loadFonts();
      const svg = await satori(tree, { width: 1200, height: 630, fonts });
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

      res.set('Content-Type', 'image/png');
      // 1h CDN + browser cache. Forecasts refresh hourly so this matches
      // the upstream pipeline cadence — readers re-fetching within the
      // window get the same card the original sharer saw.
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.status(200).send(png);
    } catch (err) {
      // Don't surface a 500 to crawlers — they may stop unfurling
      // future links from the same domain. Emit a placeholder PNG so
      // the share still shows something on-brand.
      console.error('[generateSpotShareImage] failed', err && err.message ? err.message : err);
      try {
        const fonts = loadFonts();
        const svg = await satori(buildPlaceholderCard(String(req.query.spot || '')), {
          width: 1200, height: 630, fonts,
        });
        const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=300');
        res.status(200).send(png);
      } catch (innerErr) {
        console.error('[generateSpotShareImage] placeholder also failed', innerErr);
        res.status(500).send('share image failed');
      }
    }
  }
);
