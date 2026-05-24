// Validate that the four canonical spot lists agree on the set of
// spotIds:
//   - app/src/data/spots.ts          (mobile)
//   - desktop/data/spots.ts          (desktop)
//   - app/scripts/seedSpots.mjs      (Firestore seed)
//   - functions/index.js  SPOTS[]    (backend)
//
// Exits non-zero on any mismatch so this can plug into CI later. For
// now, run manually before bumping a release:
//
//   node scripts/check-spots-in-sync.mjs
//
// The check is intentionally id-only — coords + names diverge across
// files on purpose (mobile has rich copy, backend has buoyStation,
// etc.). What MUST agree is the set of canonical spotIds, since that
// is what cross-surface lookups key on.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const TARGETS = [
  { label: 'mobile  (app/src/data/spots.ts)',     path: 'app/src/data/spots.ts' },
  { label: 'desktop (desktop/data/spots.ts)',     path: 'desktop/data/spots.ts' },
  { label: 'seed    (app/scripts/seedSpots.mjs)', path: 'app/scripts/seedSpots.mjs' },
  { label: 'backend (functions/index.js SPOTS)',  path: 'functions/index.js' },
];

// Extract `id: 'spot-id'` occurrences; this matches the convention
// used in every spot-list file. We use word-anchor on the id form to
// reduce false positives from in-comment uses of the same string.
function extractIds(src) {
  const re = /\bid:\s*['"]([a-z0-9-]+)['"]/g;
  const ids = new Set();
  let m;
  while ((m = re.exec(src)) !== null) ids.add(m[1]);
  return ids;
}

// functions/index.js uses spot ids in many places (e.g. abyss reports,
// neighbor aliasing, the spots-stats trigger), so we have to scope to
// the SPOTS array block. Capture from `const SPOTS = [` to the matching
// `];` at the same indentation.
function extractFunctionsSpots(src) {
  const start = src.indexOf('const SPOTS = [');
  if (start === -1) return new Set();
  // Naive bracket walk — fine since the SPOTS array doesn't embed
  // arrays of its own at the top level.
  let depth = 0;
  let i = start + 'const SPOTS = '.length;
  let openIdx = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '[') { if (depth === 0) openIdx = i; depth++; }
    else if (c === ']') { depth--; if (depth === 0) break; }
  }
  if (openIdx === -1 || i === src.length) return new Set();
  return extractIds(src.slice(openIdx, i + 1));
}

const results = TARGETS.map(({ label, path }) => {
  const full = resolve(repoRoot, path);
  const src = readFileSync(full, 'utf8');
  const ids = path.endsWith('functions/index.js') ? extractFunctionsSpots(src) : extractIds(src);
  return { label, path, ids };
});

// Pick the first list as canonical reference; everyone else must match.
const ref = results[0];
const refSet = ref.ids;

let mismatches = 0;
console.log(`\nReference: ${ref.label} → ${refSet.size} spots\n`);

for (const r of results.slice(1)) {
  const missing = [...refSet].filter((id) => !r.ids.has(id)).sort();
  const extra   = [...r.ids].filter((id) => !refSet.has(id)).sort();
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✔ ${r.label}: ${r.ids.size} spots — in sync`);
    continue;
  }
  mismatches++;
  console.log(`✖ ${r.label}: ${r.ids.size} spots — DIVERGED`);
  if (missing.length) console.log(`    Missing in this file: ${missing.join(', ')}`);
  if (extra.length)   console.log(`    Extra in this file:   ${extra.join(', ')}`);
}

console.log('');
if (mismatches > 0) {
  console.log(`${mismatches} list(s) out of sync. Reconcile and re-run.`);
  process.exit(1);
}
console.log('All four canonical lists agree on spot ids.');
