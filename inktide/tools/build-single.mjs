// Bundle the whole game into ONE self-contained HTML file that plays by double-click (file://):
// JS (three.js, three-mesh-bvh and every lazy-loaded module) via esbuild, every stylesheet inlined,
// fonts and the favicon as data: URIs. Textures, models, music and sound are generated in code, so
// nothing else is needed. Adapted from the uwp-three-game kit's build-single.mjs.
//   node tools/build-single.mjs            -> dist/INKTIDE.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(root, 'www');
const OUT = path.join(root, 'dist');

const vendor = {
  name: 'vendor-alias',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: path.join(WWW, 'vendor/three.module.js') }));
    build.onResolve({ filter: /^three-mesh-bvh$/ }, () => ({ path: path.join(WWW, 'vendor/three-mesh-bvh.module.js') }));
    build.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(WWW, 'vendor/addons', a.path.slice('three/addons/'.length)) }));
  },
};

const result = await esbuild.build({
  entryPoints: [path.join(WWW, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'edge100', 'firefox100', 'safari16'],
  minify: true,
  keepNames: true,                 // class names stay readable (debugging, tests)
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
  plugins: [vendor],
});
// a literal "</script" inside the bundle would end the inline script early
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
// stylesheets, in document order, with their url(...) fonts inlined
let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8').replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const file = path.join(WWW, href);
  const css = fs.readFileSync(file, 'utf8').replace(/url\(['"]?([^'")]+\.woff2)['"]?\)/g, (m, u) => `url('${dataUri(path.resolve(path.dirname(file), u), 'font/woff2')}')`);
  return `<style>\n${css}\n</style>`;
});
// Replacement *functions* from here on: the bundle contains `$&`-like sequences
html = html
  .replace(/<link rel="icon" href="favicon\.svg"[^>]*>/, () => `<link rel="icon" href="${dataUri(path.join(WWW, 'favicon.svg'), 'image/svg+xml')}">`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, () => '')
  .replace(/<script type="module" src="src\/main\.js"><\/script>/, () => `<script>\n${js}\n</script>`);

if (/src="src\/main\.js"|importmap|<link rel="stylesheet"|url\('\.\.\/fonts/.test(html)) throw new Error('single-file inlining failed');

fs.mkdirSync(OUT, { recursive: true });
const outFile = path.join(OUT, 'INKTIDE.html');
fs.writeFileSync(outFile, html, 'utf8');
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`bundle js ${mb(js.length)} · single file ${mb(html.length)} -> dist/INKTIDE.html`);
