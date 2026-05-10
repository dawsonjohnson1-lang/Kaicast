#!/usr/bin/env node
// Render docs/*.md → functions/public/*.html for Firebase Hosting.
//
// Run from repo root:
//   node scripts/build-legal.js
//
// Uses `marked` for the markdown→HTML conversion. Pulled fresh via
// require() — make sure it's installed at the repo root, in scripts/,
// or globally. When the underlying .md changes, re-run this script
// and `firebase deploy --only hosting`.

/* eslint-env node */
const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const DOCS_DIR   = path.join(ROOT, 'docs');
const OUT_DIR    = path.join(ROOT, 'functions', 'public');
const TARGETS    = [
  { md: 'privacy-policy.md',   html: 'privacy.html', title: 'Privacy Policy' },
  { md: 'terms-of-service.md', html: 'terms.html',   title: 'Terms of Service' },
];

let marked;
try {
  ({ marked } = require('marked'));
} catch {
  console.error(
    'marked not installed. Install once at the repo root:\n' +
    '  npm install --save-dev marked',
  );
  process.exit(1);
}

marked.setOptions({ gfm: true, breaks: false });

const TEMPLATE = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · KaiCast</title>
<style>
  :root {
    --bg: #0e0e0f;
    --card: #161616;
    --border: #1f1f22;
    --text: #f3f3f4;
    --muted: #9ea0a6;
    --accent: #09a1fb;
    --hazard: #f73726;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 96px; }
  header { border-bottom: 1px solid var(--border); padding: 20px 24px; }
  header .wordmark {
    color: var(--text); font-weight: 700; letter-spacing: 0.5px;
    text-decoration: none; font-size: 18px;
  }
  h1 { font-size: 32px; line-height: 1.2; margin: 0 0 24px; }
  h2 { font-size: 22px; margin: 40px 0 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  h3 { font-size: 18px; margin: 24px 0 8px; color: var(--text); }
  p, ul, ol { color: var(--text); margin: 0 0 14px; }
  ul, ol { padding-left: 24px; }
  li { margin: 6px 0; }
  a { color: var(--accent); text-decoration: underline; }
  strong { font-weight: 700; }
  blockquote {
    margin: 16px 0; padding: 14px 18px;
    background: rgba(9, 161, 251, 0.08);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    color: var(--muted);
  }
  blockquote strong { color: var(--accent); }
  blockquote ul { padding-left: 18px; }
  hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
  table {
    width: 100%; border-collapse: collapse;
    margin: 16px 0; font-size: 14px;
    background: var(--card); border-radius: 8px; overflow: hidden;
  }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { background: rgba(9, 161, 251, 0.08); color: var(--accent); font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  code { background: var(--card); padding: 2px 6px; border-radius: 4px; font-size: 14px; color: var(--accent); }
  footer { color: var(--muted); font-size: 13px; text-align: center; padding: 32px 24px; border-top: 1px solid var(--border); margin-top: 64px; }
  footer a { color: var(--muted); }
  @media (max-width: 600px) {
    h1 { font-size: 26px; }
    main { padding: 32px 18px 64px; }
  }
</style>
</head>
<body>
<header>
  <a href="/" class="wordmark">KaiCast</a>
</header>
<main>
${body}
</main>
<footer>
  <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · KaiCast
</footer>
</body>
</html>
`;

for (const { md, html, title } of TARGETS) {
  const src = fs.readFileSync(path.join(DOCS_DIR, md), 'utf8');
  const body = marked.parse(src);
  const out  = TEMPLATE(title, body);
  fs.writeFileSync(path.join(OUT_DIR, html), out, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`built ${html} (${out.length} bytes) from ${md}`);
}
