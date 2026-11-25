// Packs Path of Building for the browser PoB checker into public/pob/.
//
//   POB_PATH=/path/to/PathOfBuilding node pob-wasm/pack.mjs
//
// Writes content-hashed files (safe to cache forever) and manifest.json (must not be cached
// long). Run it whenever Path of Building is updated, then build the site.
//
// Pack format: [u32 LE index length][index JSON {path: [offset, length]}][file bytes], gzipped.
// The extension is deliberately not .gz: servers (Nitro included) send .gz files with
// Content-Encoding: gzip, which the browser would undo, breaking download progress.
// The browser worker (app/workers/pobcheck.worker.ts) unpacks them into Emscripten's filesystem.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const pobRoot = process.env.POB_PATH;
if (!pobRoot || !fs.existsSync(path.join(pobRoot, 'src/HeadlessWrapper.lua'))) {
  console.error('Set POB_PATH to a Path of Building Community checkout (src/HeadlessWrapper.lua not found).');
  process.exit(1);
}
const src = path.join(pobRoot, 'src');
const outDir = path.join(here, '../public/pob');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const walk = (dir, filter) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, filter) : filter(p) ? [p] : [];
  });
const isLua = (p) => p.endsWith('.lua');
let totalBytes = 0;

/** Writes data under a content-hashed name and returns that name. */
function emit(base, ext, data) {
  const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 12);
  const name = `${base}.${hash}${ext}`;
  fs.writeFileSync(path.join(outDir, name), data);
  totalBytes += data.length;
  return name;
}

function pack(base, entries) {
  const index = {};
  const chunks = [];
  let offset = 0;
  for (const [vpath, file] of entries) {
    const buf = fs.readFileSync(file);
    index[vpath] = [offset, buf.length];
    chunks.push(buf);
    offset += buf.length;
  }
  const head = Buffer.from(JSON.stringify(index));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  return emit(base, '.pobpack', zlib.gzipSync(Buffer.concat([len, head, ...chunks]), { level: 9 }));
}

const pobVersion = fs.readFileSync(path.join(pobRoot, 'manifest.xml'), 'utf8').match(/<Version number="([^"]+)"/)?.[1] ?? '?';
const gameVersions = fs.readFileSync(path.join(src, 'GameVersions.lua'), 'utf8');
const treeVersions = gameVersions
  .match(/treeVersionList = \{([^}]*)\}/)[1]
  .match(/"([^"]+)"/g)
  .map((v) => v.slice(1, -1));
const latestTree = treeVersions[treeVersions.length - 1];

// ---- core: everything PoB needs to start, plus the checker's own Lua ----
const timelessDir = path.join(src, 'Data/TimelessJewelData');
const core = [
  ...fs.readdirSync(src).filter((f) => f.endsWith('.lua')).map((f) => [`/pob/src/${f}`, path.join(src, f)]),
  ...['Data', 'Modules', 'Classes'].flatMap((d) =>
    walk(path.join(src, d), (p) => (isLua(p) || p.endsWith('.json') || p.endsWith('.jsonc')) && !p.startsWith(timelessDir)).map((p) => [
      `/pob/src/${path.relative(src, p)}`,
      p,
    ]),
  ),
  // Small timeless jewel helpers (node index mappings, names); the large lookup tables are separate packs
  ...fs.readdirSync(timelessDir).filter((f) => /\.(lua|csv)$/.test(f)).map((f) => [`/pob/src/Data/TimelessJewelData/${f}`, path.join(timelessDir, f)]),
  // PoB loads the latest passive tree while starting up, and requires some shared tree files
  ...fs.readdirSync(path.join(src, 'TreeData', latestTree)).filter(isLua).map((f) => [`/pob/src/TreeData/${latestTree}/${f}`, path.join(src, 'TreeData', latestTree, f)]),
  ...walk(path.join(src, 'TreeData'), (p) => isLua(p) && !/[\\/](tree|sprites)\.lua$/.test(p)).map((p) => [`/pob/src/${path.relative(src, p)}`, p]),
  ...walk(path.join(pobRoot, 'runtime/lua'), isLua).map((p) => [`/pob/${path.relative(pobRoot, p)}`, p]),
  ['/pob/manifest.xml', path.join(pobRoot, 'manifest.xml')],
  ['/pobcheck/boot.lua', path.join(here, 'boot.lua')],
  ['/pobcheck/extract.lua', path.join(here, 'extract.lua')],
];

const manifest = {
  pobVersion,
  latestTree,
  engine: {
    js: emit('pobwasm', '.mjs', fs.readFileSync(path.join(here, 'engine/dist/pobwasm.mjs'))),
    wasm: emit('pobwasm', '.wasm', fs.readFileSync(path.join(here, 'engine/dist/pobwasm.wasm'))),
  },
  core: pack('core', core),
  trees: {},
  timeless: {},
};

// ---- passive trees, fetched when a build uses an older tree version ----
for (const ver of treeVersions) {
  const dir = path.join(src, 'TreeData', ver);
  if (ver === latestTree || !fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(isLua);
  if (files.length) manifest.trees[ver] = pack(`tree-${ver}`, files.map((f) => [`/pob/src/TreeData/${ver}/${f}`, path.join(dir, f)]));
}

// ---- timeless jewel lookup tables, fetched when PoB reports "Missing LUT: <type>" ----
const dataLua = fs.readFileSync(path.join(src, 'Modules/Data.lua'), 'utf8');
const jewelTypes = [...dataLua.match(/data\.timelessJewelTypes = \{([^}]*)\}/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
for (const label of jewelTypes) {
  const base = label.replace(/\s+/g, '');
  const files = fs.readdirSync(timelessDir).filter((f) => f.startsWith(`${base}.zip`));
  if (!files.length) {
    console.warn(`No lookup table found for timeless jewel type ${label}`);
    continue;
  }
  manifest.timeless[label] = pack(`timeless-${base}`, files.map((f) => [`/pob/src/Data/TimelessJewelData/${f}`, path.join(timelessDir, f)]));
}

// Which lookup table a timeless jewel needs follows from its conqueror, whose name is always in the
// jewel's mod text ("...in the akhara of Balbala"). The worker uses this map to fetch the right
// tables before PoB loads the build. Taken from PoB itself: ModParser's conquerorList (name ->
// conqueror type) and PassiveSpec's timelessJewelTypeByConqueror (type -> jewel type index).
const modParser = fs.readFileSync(path.join(src, 'Modules/ModParser.lua'), 'utf8');
const passiveSpec = fs.readFileSync(path.join(src, 'Classes/PassiveSpec.lua'), 'utf8');
const conquerorBlock = modParser.match(/local conquerorList = \{([\s\S]*?)\n\}/)[1];
const typeBlock = passiveSpec.match(/timelessJewelTypeByConqueror = \{([\s\S]*?)\}/)[1];
const typeIndex = Object.fromEntries([...typeBlock.matchAll(/(\w+)\s*=\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
manifest.conquerors = {};
for (const [, name, type] of conquerorBlock.matchAll(/\["(\w+)"\]\s*=\s*\{[^}]*type\s*=\s*"(\w+)"/g)) {
  const label = jewelTypes[typeIndex[type] - 1];
  if (label && manifest.timeless[label]) manifest.conquerors[name] = label;
  else console.warn(`No lookup table for conqueror ${name} (${type})`);
}
if (Object.keys(manifest.conquerors).length < 20) throw new Error('Could not read the conqueror list from PoB, check pack.mjs');

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const sizeOf = (name) => fs.statSync(path.join(outDir, name)).size / 1048576;
console.log(`Path of Building ${pobVersion}, latest tree ${latestTree}`);
console.log(`core ${sizeOf(manifest.core).toFixed(2)} MB, engine ${(sizeOf(manifest.engine.js) + sizeOf(manifest.engine.wasm)).toFixed(2)} MB`);
console.log(`${Object.keys(manifest.trees).length} older trees, ${Object.keys(manifest.timeless).length} timeless jewel types`);
console.log(`${(totalBytes / 1048576).toFixed(0)} MB written to public/pob/`);
