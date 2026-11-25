// Runs builds through the PoB checker engine in Node, without a browser. For development and
// regression checks after updating Path of Building or the engine.
//
//   POB_PATH=/path/to/PathOfBuilding node --experimental-strip-types pob-wasm/check-node.mjs [--facts out.jsonl] build...
//
// Each build argument is a file containing a PoB code or build XML. Prints the analysis summary;
// --facts also writes the raw facts (one JSON line per build) for comparing two runs.
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const pobRoot = process.env.POB_PATH;
if (!pobRoot) {
  console.error('Set POB_PATH to a Path of Building Community checkout.');
  process.exit(1);
}
const args = process.argv.slice(2);
const factsIdx = args.indexOf('--facts');
const factsFile = factsIdx >= 0 ? args.splice(factsIdx, 2)[1] : null;

const { analyzePob } = await import(path.join(here, '../shared/utils/pobAnalysis.ts'));
const createModule = (await import(path.join(here, 'engine/dist/pobwasm.mjs'))).default;

const t0 = performance.now();
const M = await createModule({ print: () => {}, printErr: (s) => process.stderr.write(s + '\n') });
M.FS.mkdir('/pob');
M.FS.mount(M.NODEFS, { root: path.resolve(pobRoot) }, '/pob');
M.FS.mkdir('/pobcheck');
M.FS.mount(M.NODEFS, { root: here }, '/pobcheck');
M.FS.chdir('/pob/src');
if (M.ccall('pob_boot', 'number', ['string'], ['/pobcheck/boot.lua']) !== 0) process.exit(1);
console.log(`PoB booted in ${((performance.now() - t0) / 1000).toFixed(2)}s`);

const toXml = (text) => {
  const t = text.trim();
  if (t.startsWith('<')) return t;
  return zlib.inflateSync(Buffer.from(t.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString('utf8');
};

const factsOut = [];
for (const [i, file] of args.entries()) {
  const xml = toXml(fs.readFileSync(file, 'utf8'));
  const t = performance.now();
  const response = JSON.parse(M.ccall('pob_call', 'string', ['string', 'string'], ['pobcheck_extract', xml]));
  const ms = performance.now() - t;
  const name = path.basename(file);
  if (!response.facts) {
    console.log(`${name}: ERROR ${response.error}\n${response.prompt ?? ''}`);
    continue;
  }
  factsOut.push(JSON.stringify({ id: i + 1, facts: response.facts }));
  try {
    const result = analyzePob(response.facts);
    console.log(`${name}: ${(ms / 1000).toFixed(2)}s  [${result.verdict.state}] ${result.verdict.text}`);
    for (const issue of result.issues) if (issue.severity !== 'info') console.log(`    ${issue.severity}: ${issue.text}`);
  } catch (err) {
    console.log(`${name}: ${(ms / 1000).toFixed(2)}s  ${err.message}`);
  }
}
if (factsFile) fs.writeFileSync(factsFile, factsOut.map((l) => '@@POB@@' + l).join('\n') + '\n');
