/* Copies runtime dependencies from node_modules into www/vendor.
   Files are COPIED, never symlinked — a POSIX symlink under the app folder
   breaks the Windows MSBuild content glob ("Illegal characters in path"). */
import { cp, mkdir, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NM = resolve(ROOT, 'node_modules');
const OUT = resolve(ROOT, 'Propworks/www/vendor');

await rm(OUT, { recursive: true, force: true });
await mkdir(resolve(OUT, 'addons'), { recursive: true });
await cp(resolve(NM, 'three/build/three.module.js'), resolve(OUT, 'three.module.js'));
await cp(resolve(NM, 'three/build/three.core.js'), resolve(OUT, 'three.core.js'));
for (const dir of ['postprocessing', 'shaders', 'utils', 'math', 'objects', 'environments', 'geometries']) {
  await cp(resolve(NM, 'three/examples/jsm', dir), resolve(OUT, 'addons', dir), { recursive: true, dereference: true });
}
await cp(resolve(NM, '@dimforge/rapier3d-compat/dist/rapier.mjs'), resolve(OUT, 'rapier.mjs'));
await cp(resolve(NM, 'three/LICENSE'), resolve(OUT, 'LICENSE.three.txt'));
await cp(resolve(NM, '@dimforge/rapier3d-compat/LICENSE'), resolve(OUT, 'LICENSE.rapier.txt'));
console.log('vendor ->', OUT);
