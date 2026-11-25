// Web Worker for the PoB checker: runs Path of Building (Lua 5.2 compiled to WebAssembly, see
// pob-wasm/) in the visitor's browser and analyses the build.
//
// Messages in:  { type: 'warmup' } | { type: 'check', id, code }
// Messages out: { type: 'progress', id?, stage, loaded?, total? } | { type: 'result', id, result } | { type: 'error', id, message }
import type { PobCheckResult, PobFacts } from '#shared/types/pobCheck';
import { PobCheckError, analyzePob } from '#shared/utils/pobAnalysis';
import { isLink, parsePobLink, supportedLinkSites } from '#shared/utils/pobLinks';

const BASE = '/pob/';

interface Manifest {
  pobVersion: string;
  latestTree: string;
  engine: { js: string; wasm: string };
  core: string;
  trees: Record<string, string>;
  timeless: Record<string, string>;
  /** Timeless jewel conqueror name (lower case) -> jewel type label, a key of `timeless`. */
  conquerors: Record<string, string>;
}

interface PobModule {
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    chdir(path: string): void;
  };
  ccall(name: string, returnType: 'number' | 'string', argTypes: string[], args: unknown[]): number | string;
}

export type WorkerProgressStage = 'link' | 'download' | 'starting' | 'calculating';
export type WorkerMessage =
  | { type: 'progress'; id?: number; stage: WorkerProgressStage; loaded?: number; total?: number }
  | { type: 'result'; id: number; result: PobCheckResult }
  | { type: 'error'; id: number; message: string };

class UserError extends Error {}

const post = (msg: WorkerMessage) => self.postMessage(msg);
let currentId: number | undefined;

let manifest: Manifest | null = null;
let engine: PobModule | null = null;
let starting: Promise<PobModule> | null = null;
const loadedPacks = new Set<string>();

async function fetchBytes(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not download ${url} (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  // A server may already have removed the gzip layer (Content-Encoding); only decompress real gzip.
  if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Downloads a pack and unpacks it into the engine's filesystem (format: see pob-wasm/pack.mjs). */
async function loadPack(M: PobModule, file: string, onProgress?: (loaded: number, total: number) => void) {
  if (loadedPacks.has(file)) return;
  const buf = await gunzip(await fetchBytes(BASE + file, onProgress));
  const indexLength = new DataView(buf.buffer, buf.byteOffset).getUint32(0, true);
  const index = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + indexLength))) as Record<string, [number, number]>;
  const base = 4 + indexLength;
  for (const [path, [offset, length]] of Object.entries(index)) {
    M.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
    M.FS.writeFile(path, buf.subarray(base + offset, base + offset + length));
  }
  loadedPacks.add(file);
}

async function startEngine(): Promise<PobModule> {
  const res = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new UserError('The PoB checker is not installed on this site yet.');
  const m = (await res.json()) as Manifest;
  manifest = m;
  const createModule = (await import(/* @vite-ignore */ BASE + m.engine.js)).default as (opts: object) => Promise<PobModule>;
  const M = await createModule({
    locateFile: (p: string) => (p.endsWith('.wasm') ? BASE + m.engine.wasm : p),
    print: () => {},
    printErr: () => {},
  });
  await loadPack(M, m.core, (loaded, total) => post({ type: 'progress', id: currentId, stage: 'download', loaded, total }));
  post({ type: 'progress', id: currentId, stage: 'starting' });
  M.FS.chdir('/pob/src');
  if (M.ccall('pob_boot', 'number', ['string'], ['/pobcheck/boot.lua']) !== 0) {
    throw new Error('Path of Building failed to start.');
  }
  engine = M;
  return M;
}

function getEngine(): Promise<PobModule> {
  if (engine) return Promise.resolve(engine);
  if (!starting) {
    starting = startEngine().catch((err) => {
      starting = null;
      throw err;
    });
  }
  return starting;
}

/** Downloads the build code behind a build link through this site's server (most build sites block cross-origin requests). */
async function fetchLinkedCode(link: string): Promise<string> {
  if (!parsePobLink(link)) {
    throw new UserError(`That link is not supported. Use a link from ${supportedLinkSites}, or paste the PoB code itself.`);
  }
  post({ type: 'progress', id: currentId, stage: 'link' });
  let res: Response;
  try {
    res = await fetch(`/api/pob-link?url=${encodeURIComponent(link.trim())}`);
  } catch {
    throw new UserError('Could not download the build. Check your connection, or paste the PoB code instead.');
  }
  const body = (await res.json().catch(() => null)) as { code?: string; statusMessage?: string; message?: string } | null;
  if (!res.ok || !body?.code) {
    throw new UserError(body?.statusMessage || body?.message || 'Could not download the build. Paste the PoB code instead.');
  }
  return body.code;
}

async function decodeCode(input: string): Promise<string> {
  const code = isLink(input) ? await fetchLinkedCode(input) : input;
  const trimmed = code.trim();
  if (!trimmed) throw new UserError('Paste a PoB code first.');
  if (trimmed.startsWith('<')) return trimmed;
  const cleaned = trimmed.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  let bytes: Uint8Array;
  try {
    const bin = atob(cleaned);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    throw new UserError('That does not look like a PoB code. Export it from Path of Building (Import/Export Build > Generate) and paste the whole code.');
  }
  let xml: string;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    xml = await new Response(stream).text();
  } catch {
    throw new UserError('Could not decompress the PoB code. Make sure you copied all of it.');
  }
  if (!/^\s*(<\?xml[^>]*>\s*)?<PathOfBuilding[\s>]/.test(xml)) throw new UserError('That is not a Path of Building export.');
  return xml;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Fetches the data this build needs beyond the core: older passive trees and timeless jewel tables. */
async function loadBuildData(M: PobModule, m: Manifest, xml: string, extraTimeless: Set<string>) {
  const files = new Set<string>();
  for (const version of new Set([...xml.matchAll(/treeVersion="([^"]+)"/g)].map((v) => v[1]!))) {
    const file = m.trees[version];
    if (file) files.add(file);
  }
  // A timeless jewel's mod text names its conqueror ("...in the akhara of Balbala"), which decides
  // the lookup table PoB reads. The tables must be present before PoB loads the build: a missing one
  // makes the load fail and leaves PoB in a broken state. Only items with a "conquered" line are
  // timeless jewels ("Passives in radius are Conquered by...", Abyss: "...conquered by the abyssal");
  // searching the whole build would match names like the cluster notable "Doryani's Lesson".
  const timelessText = [...xml.matchAll(/<Item\b[^>]*>([\s\S]*?)<\/Item>/g)]
    .map((item) => item[1]!)
    .filter((text) => /conquered/i.test(text))
    .join('\n');
  for (const [conqueror, label] of Object.entries(m.conquerors)) {
    if (new RegExp(`\\b${escapeRegExp(conqueror)}\\b`, 'i').test(timelessText)) files.add(m.timeless[label]!);
  }
  for (const label of extraTimeless) if (m.timeless[label]) files.add(m.timeless[label]);
  const missing = [...files].filter((f) => !loadedPacks.has(f));
  for (const file of missing) {
    await loadPack(M, file, (loaded, total) => post({ type: 'progress', id: currentId, stage: 'download', loaded, total }));
  }
}

function resetEngine() {
  engine = null;
  starting = null;
  loadedPacks.clear();
}

async function check(code: string): Promise<PobCheckResult> {
  const xml = await decodeCode(code);
  const extraTimeless = new Set<string>();
  for (let attempt = 0; attempt < 2; attempt++) {
    const M = await getEngine();
    const m = manifest!;
    await loadBuildData(M, m, xml, extraTimeless);
    post({ type: 'progress', id: currentId, stage: 'calculating' });
    const out = M.ccall('pob_call', 'string', ['string', 'string'], ['pobcheck_extract', xml]) as string;
    const response = JSON.parse(out) as { facts?: PobFacts; needs?: string[]; error?: string; prompt?: string };
    if (response.facts) return analyzePob(response.facts);
    if (response.needs) {
      // A timeless jewel the conqueror detection missed. PoB is not reliable after a build failed to
      // load, so start a fresh engine (its downloads are cached) with the missing tables included.
      const byName = new Map(Object.keys(m.timeless).map((label) => [label.replace(/\s+/g, ''), label]));
      const labels = response.needs.map((name) => byName.get(name)).filter((l): l is string => !!l && !extraTimeless.has(l));
      if (!labels.length) break;
      for (const label of labels) extraTimeless.add(label);
      console.warn('[pobcheck] restarting Path of Building to load timeless jewel data:', labels.join(', '));
      resetEngine();
      continue;
    }
    console.error('[pobcheck]', response.error, response.prompt);
    throw new UserError('Path of Building could not process this build.');
  }
  throw new UserError('Path of Building could not load the timeless jewel data for this build.');
}

self.onmessage = async (e: MessageEvent<{ type: 'warmup' } | { type: 'check'; id: number; code: string }>) => {
  const msg = e.data;
  if (msg.type === 'warmup') {
    getEngine().catch(() => {});
    return;
  }
  currentId = msg.id;
  try {
    post({ type: 'result', id: msg.id, result: await check(msg.code) });
  } catch (err) {
    const message = err instanceof UserError || err instanceof PobCheckError ? err.message : 'The check failed. Reload the page and try again.';
    if (!(err instanceof UserError || err instanceof PobCheckError)) console.error('[pobcheck]', err);
    post({ type: 'error', id: msg.id, message });
  }
};
