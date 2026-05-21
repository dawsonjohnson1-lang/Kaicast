#!/usr/bin/env node
// Pulls assets from specific Figma frames via the REST API.
// Writes rendered PNGs and raw S3 originals into assets/figma-export/,
// plus a _manifest.json inventory.
//
// Usage:
//   FIGMA_API_TOKEN=... node scripts/figma-export-assets.mjs [--dry] [--verbose]

import { promises as fs } from 'node:fs';
import path from 'node:path';

const FILE_KEY = 'HP9NdhBiH8r5W8JCHBvwn0';
const FRAME_IDS = [
  '438:3440',
  '459:1527',
  '444:1787',
  '464:4963',
  '467:4288',
  '472:3274',
];
const OUTPUT_DIR = path.resolve('assets/figma-export');
const RENDER_SCALE = 2;
const RENDER_FORMAT = 'png';
const CONCURRENCY = 6;
const RENDER_BATCH = 100;

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const VERBOSE = args.has('--verbose');
const log = (...m) => console.log(...m);
const vlog = (...m) => { if (VERBOSE) console.log(...m); };

const TOKEN = process.env.FIGMA_API_TOKEN;
if (!TOKEN) {
  console.error('FIGMA_API_TOKEN env var not set');
  process.exit(1);
}

async function figma(url) {
  const r = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Figma API ${r.status} ${r.statusText} ${url}\n${body.slice(0, 500)}`);
  }
  return r.json();
}

const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';

// Tokenize on any non-alphanumeric char so names like "Flag_of_Hawaii_1"
// and "profile-header" produce ["flag","of","hawaii","1"] / ["profile","header"].
// JS regex \b treats underscore as a word char, so word-boundary alone misses these.
function tokens(name) {
  return String(name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function categorize(name) {
  const t = new Set(tokens(name));
  const has = (kw) => t.has(kw);
  if (has('flag') || has('country')) return 'flags';
  if (has('logo') || has('brand') || has('wordmark') || has('partner')) return 'logos';
  if (
    has('bg') || has('background') || has('hero') || has('cover') ||
    has('backdrop') || has('photo') || has('splash') || has('banner')
  ) return 'backgrounds';
  if (has('icon') || has('glyph')) return 'icons';
  return 'misc';
}

// Strict matcher for FRAME nodes — html.to.figma names every container "Background"
// or "Header - MAIN NAV", so we only treat a FRAME as an asset-by-name when the
// name unambiguously names a real asset (flag, logo, brand, wordmark).
function frameAssetCategory(name) {
  const t = new Set(tokens(name));
  if (t.has('flag') || t.has('country')) return 'flags';
  if (t.has('logo') || t.has('brand') || t.has('wordmark')) return 'logos';
  return null;
}

function walk(node, parents, frameContext, out) {
  if (!node || node.visible === false) return;
  const layerPath = [...parents, node.name ?? ''];

  const fills = Array.isArray(node.fills) ? node.fills : [];
  const imageRefs = fills
    .filter((f) => f.type === 'IMAGE' && f.imageRef)
    .map((f) => f.imageRef);
  const hasExports = Array.isArray(node.exportSettings) && node.exportSettings.length > 0;
  const nameCategory = categorize(node.name);
  // Vectors/groups/instances treated as a leaf when the node's name matches
  // any asset category. FRAME is gated by frameAssetCategory (stricter, name-only)
  // because html.to.figma wraps layout sections in FRAMEs named "Background" /
  // "Header - MAIN NAV" — those are not assets even though the name keywords match.
  const isShapeAsset =
    nameCategory !== 'misc' &&
    /^(VECTOR|GROUP|COMPONENT|INSTANCE|BOOLEAN_OPERATION)$/.test(node.type);
  const isFrameAsset = node.type === 'FRAME' && frameAssetCategory(node.name) !== null;

  const leaf = imageRefs.length > 0 || hasExports || isShapeAsset || isFrameAsset;

  if (leaf) {
    // Pick category: explicit name match wins; else fall back to layerPath; else,
    // if this node has a raw image fill, default to "backgrounds" (photos imported
    // via html.to.figma often have generic names like "profile-header").
    let category =
      nameCategory !== 'misc' ? nameCategory : categorize(layerPath.join(' / '));
    if (category === 'misc' && imageRefs.length > 0) category = 'backgrounds';
    out.push({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      layerPath,
      category,
      imageRefs,
      hasExports,
      frame: frameContext,
      dims: node.absoluteBoundingBox ?? null,
    });
    return;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, layerPath, frameContext, out);
  }
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function writeOut(p, buf) {
  if (DRY) return;
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
}

async function pool(items, n, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: n }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        out[idx] = await worker(items[idx], idx);
      } catch (e) {
        console.warn(`  ! worker error: ${e.message}`);
        out[idx] = null;
      }
    }
  });
  await Promise.all(runners);
  return out;
}

(async () => {
  log('Fetching node trees…');
  const trees = await figma(
    `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${FRAME_IDS.join(',')}`,
  );

  const frames = [];
  const allItems = [];

  for (const id of FRAME_IDS) {
    const document = trees.nodes[id]?.document;
    if (!document) {
      console.warn(`! Frame ${id} not found in response`);
      continue;
    }
    // Prefix with node ID so frames with non-unique names (e.g. "Frame")
    // don't collide on disk.
    const frameSlug = `${id.replace(':', '_')}-${slug(document.name) || 'unnamed'}`;
    frames.push({ id, name: document.name, slug: frameSlug });
    const items = [];
    walk(document, [], { frameId: id, frameName: document.name, frameSlug }, items);
    allItems.push(...items);
    vlog(`  Frame ${id} (${document.name}): ${items.length} candidate nodes`);
  }

  log(`Collected ${allItems.length} candidate nodes across ${frames.length} frames`);

  log('Resolving imageRef → S3 URL…');
  const imagesMap = await figma(`https://api.figma.com/v1/files/${FILE_KEY}/images`);
  const refToUrl = imagesMap.meta?.images ?? {};

  log(`Requesting render URLs (batched, ${RENDER_BATCH}/batch)…`);
  const allNodeIds = [...new Set(allItems.map((i) => i.nodeId))];
  const renderUrlMap = {};
  for (let i = 0; i < allNodeIds.length; i += RENDER_BATCH) {
    const batch = allNodeIds.slice(i, i + RENDER_BATCH);
    const r = await figma(
      `https://api.figma.com/v1/images/${FILE_KEY}?ids=${batch.join(
        ',',
      )}&format=${RENDER_FORMAT}&scale=${RENDER_SCALE}`,
    );
    Object.assign(renderUrlMap, r.images ?? {});
    vlog(`  Render batch ${Math.floor(i / RENDER_BATCH) + 1}: ${batch.length} nodes`);
  }

  if (DRY) {
    log('--dry: skipping downloads. Sample of what would be written:');
    for (const item of allItems.slice(0, 30)) {
      log(
        `  ${item.frame.frameSlug}/${item.category}/${slug(item.name)}-${item.nodeId.replace(':', '_')}.png  (${item.type}, refs:${item.imageRefs.length})`,
      );
    }
    if (allItems.length > 30) log(`  …and ${allItems.length - 30} more`);
    log(`Total candidates: ${allItems.length}`);
    return;
  }

  log(`Downloading (concurrency=${CONCURRENCY})…`);
  const manifestItems = await pool(allItems, CONCURRENCY, async (item) => {
    const baseDir = path.join(OUTPUT_DIR, item.frame.frameSlug, item.category);
    const baseName = `${slug(item.name)}-${item.nodeId.replace(':', '_')}`;
    const renderedPath = path.join(baseDir, `${baseName}.${RENDER_FORMAT}`);
    const rawPaths = [];
    let renderedOk = false;

    const renderedUrl = renderUrlMap[item.nodeId];
    if (renderedUrl) {
      try {
        const buf = await downloadBuffer(renderedUrl);
        await writeOut(renderedPath, buf);
        renderedOk = true;
        vlog(`  ✓ ${path.relative(process.cwd(), renderedPath)}`);
      } catch (e) {
        console.warn(`  ! render failed for ${item.nodeId} (${item.name}): ${e.message}`);
      }
    }

    for (const ref of item.imageRefs) {
      const url = refToUrl[ref];
      if (!url) continue;
      const ext = (url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ?? 'png').toLowerCase();
      const rawPath = path.join(baseDir, '_raw', `${baseName}-${ref.slice(0, 8)}.${ext}`);
      try {
        const buf = await downloadBuffer(url);
        await writeOut(rawPath, buf);
        rawPaths.push(path.relative(OUTPUT_DIR, rawPath));
        vlog(`  ✓ ${path.relative(process.cwd(), rawPath)}`);
      } catch (e) {
        console.warn(`  ! raw failed for ${ref}: ${e.message}`);
      }
    }

    return {
      nodeId: item.nodeId,
      name: item.name,
      type: item.type,
      category: item.category,
      layerPath: item.layerPath,
      frame: item.frame,
      dims: item.dims,
      rendered: renderedOk ? path.relative(OUTPUT_DIR, renderedPath) : null,
      raw: rawPaths,
    };
  });

  const manifest = {
    fileKey: FILE_KEY,
    generatedAt: new Date().toISOString(),
    renderScale: RENDER_SCALE,
    renderFormat: RENDER_FORMAT,
    frames,
    items: manifestItems.filter(Boolean),
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const manifestPath = path.join(OUTPUT_DIR, '_manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  log(`✓ Wrote ${manifest.items.length} items`);
  log(`✓ Manifest: ${path.relative(process.cwd(), manifestPath)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
