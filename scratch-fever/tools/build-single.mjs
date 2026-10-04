/* Bundles the whole game into one self-contained HTML file. */
import { createRequire } from 'module';
import { join } from 'path';
/* esbuild from node_modules, or from NODE_PATH when the project has no node_modules */
const esbuild = await (async () => {
  try { return await import('esbuild'); } catch { /* fall through */ }
  const req = createRequire(import.meta.url);
  for (const p of (process.env.NODE_PATH || '').split(':').filter(Boolean)) { try { return req(join(p, 'esbuild')); } catch { /* next */ } }
  throw new Error('esbuild not found: run `npm install` or set NODE_PATH');
})();
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WWW = resolve(HERE, '../ScratchFever/www');
const OUT = resolve(HERE, '../ScratchFever/dist');

const threeAlias = {
  name: 'three-alias',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: resolve(WWW, 'vendor/three.module.js') }));
    build.onResolve({ filter: /^three\/addons\// }, (args) => ({
      path: resolve(WWW, 'vendor/addons', args.path.slice('three/addons/'.length)),
    }));
  },
};

const result = await esbuild.build({
  entryPoints: [resolve(WWW, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome90'],
  minify: true,
  legalComments: 'none',
  write: false,
  plugins: [threeAlias],
});

const js = result.outputFiles[0].text;
const css = (await readFile(resolve(WWW, 'src/theme.css'), 'utf8')) + '\n' + (await readFile(resolve(WWW, 'styles/main.css'), 'utf8'));
const html = await readFile(resolve(WWW, 'index.html'), 'utf8');

// Replacement *functions* only: the bundled code contains `$&` sequences that
// String.replace would otherwise interpret as the matched substring.
let out = html
  .replace(/<link rel="stylesheet" href="\.\/src\/theme\.css" \/>\s*/, () => '')
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, () => '')
  .replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/,
    () => `<script>\n${js}\n</script>`);

if (out.includes('src="./src/main.js"') || out.includes('importmap')) {
  throw new Error('single-file inlining failed');
}

await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'ScratchFever.html'), out, 'utf8');

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`bundle js   ${kb(js.length)}`);
console.log(`single file ${kb(out.length)}  ->  ScratchFever/dist/ScratchFever.html`);
