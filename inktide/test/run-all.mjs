// npm test — runs every suite sequentially (headless SwiftShader, slow but GPU-free).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  ['input contract (16 assertions)', 'input.mjs'],
  ['feel contract + negative controls', 'feel.mjs'],
  ['core ink mechanics', 'mechanics.mjs'],
  ['memory (5 sessions)', 'memory.mjs'],
  ['layout sweep (5 shapes)', 'layout.mjs'],
  ['gamepad reachability graph', 'gamepad.mjs'],
  ['scripted playtest (smoke)', 'smoke.mjs'],
  ['story stages load', 'stages.mjs'],
  ['audio: tracks, sfx, ambience, ids', 'audio.mjs'],
].filter(([, f]) => fs.existsSync(path.join(here, f)));

let failed = 0;
for (const [name, file] of suites) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit', timeout: 40 * 60 * 1000 });
  if (r.status !== 0) { failed++; console.log(`>>> ${name}: FAILED (exit ${r.status})`); }
}
console.log(`\n${suites.length - failed}/${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
