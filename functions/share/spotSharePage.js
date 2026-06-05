/**
 * spotSharePage — minimal HTML served at https://kaicast.com/s/:slug[/:date]
 *
 * Purpose is single: give iMessage / WhatsApp / Slack / Twitter
 * crawlers Open-Graph + Twitter Card metadata so the link unfurls
 * with a rich preview. Humans hitting the URL bounce immediately
 * into the app (via the kaicast:// deep link) or — if the app
 * isn't installed — into the desktop web app's spot detail page.
 *
 * Routed via firebase.json hosting rewrite:
 *   "/s/**" → /spotSharePage
 *
 * The function receives the full original path in `req.url`, e.g.
 *   /s/electric-beach/2026-06-05
 * The slug and optional date are parsed back out below.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { buildShareData } = require('./buildShareData');

// Image lives behind its own Cloud Function URL — the crawler will
// fetch it asynchronously after parsing this HTML, so the OG image
// URL must be stable + cacheable.
const IMAGE_BASE = 'https://us-central1-kaicast-207dc.cloudfunctions.net/generateSpotShareImage';

// Where to send humans (not crawlers) after the deep-link attempt
// fails — i.e., they don't have the app installed. Points at the
// desktop web preview's spot detail route.
const WEB_BASE = 'https://kaicast.com';

// HTML-escape a string for safe interpolation into the response body.
// Keeps a possible quote/angle-bracket out of a spot slug or summary
// from breaking the surrounding tags.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parsePath(reqUrl) {
  // req.url is the *rewritten* path; the hosting layer keeps the
  // original /s/{slug}/{date?} structure. Drop the query string and
  // any leading slashes to get back to the segments.
  const noQs = String(reqUrl || '').split('?')[0];
  const parts = noQs.split('/').filter(Boolean);
  // parts[0] should be "s"; tolerate it being absent in case the
  // function is hit directly without going through the rewrite.
  const start = parts[0] === 's' ? 1 : 0;
  const slug = parts[start] || '';
  const date = parts[start + 1] || null;
  return { slug, date };
}

exports.spotSharePage = onRequest(
  { timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (req, res) => {
    const { slug, date } = parsePath(req.url);
    if (!slug) {
      res.status(400).send('Missing spot slug');
      return;
    }

    // Pull the data so the OG title + description are rich. The image
    // fetches its own copy of the same data — both use the same cache
    // path so they stay in sync.
    let data = null;
    try {
      data = await buildShareData({ spotId: slug, date });
    } catch (err) {
      console.error('[spotSharePage] buildShareData failed', err && err.message ? err.message : err);
    }

    // OG title / description fall back to neutral copy if no report.
    const title = data
      ? `${data.spotName} – ${data.tierLabel} conditions · KaiCast`
      : 'KaiCast — Hawaii dive conditions';
    const description = data
      ? data.summary
      : 'Real-time Hawaii dive and snorkel conditions, forecasts, and dive logs.';

    // OG image URL must include the date param so future-day shares
    // get the right card. URL-encode the slug so unusual characters
    // (apostrophes, etc.) don't break the unfurl.
    const imgUrl = `${IMAGE_BASE}?spot=${encodeURIComponent(slug)}${date ? `&date=${encodeURIComponent(date)}` : ''}`;

    // Deep-link target for the mobile app. Date is optional in the
    // path; the app's linking config treats it as "today" when absent.
    const deepLink = `kaicast://spot/${encodeURIComponent(slug)}${date ? `/${encodeURIComponent(date)}` : ''}`;
    // Web fallback — desktop preview's spot detail page. Doesn't take
    // a date param yet; the desktop UI defaults to "today" which is
    // the correct behavior for someone landing from a share link.
    const webFallback = `${WEB_BASE}/spot/${encodeURIComponent(slug)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imgUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(webFallback)}">
<meta property="og:site_name" content="KaiCast">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imgUrl)}">

<!-- Crawlers stop here; humans get the deep-link attempt + web
     fallback below. We do NOT use http-equiv refresh to the
     kaicast:// scheme because Safari treats that as a navigation
     and shows a "cannot open" alert when the app isn't installed.
     The JS path below tries the deep link silently, then sends
     the user to the web fallback after a short delay. -->

<style>
  html, body { margin: 0; padding: 0; background: #0B1015; color: #F8F8F8;
               font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 64px 24px; text-align: center; }
  .dot  { display: inline-block; width: 10px; height: 10px; border-radius: 999px;
          background: #09A1FB; margin-right: 8px; vertical-align: middle; }
  .brand { font-size: 14px; letter-spacing: 2px; text-transform: uppercase;
           color: rgba(248,248,248,0.70); }
  h1 { font-size: 22px; font-weight: 700; margin: 24px 0 8px; }
  p  { font-size: 15px; color: rgba(248,248,248,0.70); line-height: 1.5; }
  a.btn { display: inline-block; margin-top: 24px; padding: 12px 22px; border-radius: 999px;
          background: #09A1FB; color: #0B1015; font-weight: 700; text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <div><span class="dot"></span><span class="brand">KaiCast</span></div>
  <h1>${esc(data ? data.spotName : 'KaiCast')}</h1>
  <p>${esc(description)}</p>
  <a class="btn" href="${esc(webFallback)}">Open on the web</a>
</div>
<script>
  (function () {
    var deep = ${JSON.stringify(deepLink)};
    var web  = ${JSON.stringify(webFallback)};

    // Crawlers like the iMessage / Slack bots run JS-disabled HEAD
    // fetches — they only read the <meta> tags above. This block
    // only runs in a real browser. Try the kaicast:// scheme first
    // (silent on iOS Safari when the app isn't installed) then fall
    // back to the desktop web app after a short delay.
    var t = setTimeout(function () { window.location.replace(web); }, 1200);
    try {
      window.location.replace(deep);
    } catch (e) {
      clearTimeout(t);
      window.location.replace(web);
    }
    // If the deep-link succeeded, the page is backgrounded and the
    // timeout never fires. If it failed, the timeout sends the
    // user to the web. Either way, no "cannot open" alert.
  })();
</script>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    // Short cache so a spot's rating chip refresh propagates to the
    // unfurl in the same window the upstream forecast refreshes.
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
    res.status(200).send(html);
  }
);
