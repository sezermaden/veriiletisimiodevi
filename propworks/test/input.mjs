/* The kit's input/camera contract (16 assertions) run against the engine files the game
   ships (www/engine). The kit HTML imports relative to the project root and from
   node_modules; it is patched IN MEMORY on its way out of this server — never with
   symlinks or a node_modules tree inside www/ (that breaks the Windows build). */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(HERE, '../Propworks/www');
const KIT = path.resolve(HERE, 'kit/input-test.html');
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/engine/tests/input-test.html') {
    const body = fs.readFileSync(KIT, 'utf8')
      .replace('<meta charset=utf-8>', '<meta charset=utf-8><base href="/">')
      .replace('./node_modules/three/build/three.module.js', './vendor/three.module.js')
      .replace('./node_modules/three/examples/jsm/', './vendor/addons/');
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(body);
  }
  const f = path.join(WWW, path.normalize(p));
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/engine/tests/input-test.html`);
await page.waitForFunction('window.__done', null, { timeout: 30000 });
const out = await page.evaluate('window.__done');
console.log(out);
await browser.close();
server.close();
process.exit(/HATA|FAIL/.test(out) ? 1 : 0);
