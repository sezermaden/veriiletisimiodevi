#!/usr/bin/env node
/**
 * run-input-tests.mjs — girdi/kamera sözleşmesini headless tarayıcıda doğrular.
 *
 * Bu testler "dikkatli yazdım" yerine geçer: kamera sürüklenmesi, ters tuşlar ve
 * kare hızına bağlı hassasiyet bir daha oyuna giremez, çünkü build bu testten geçmeden
 * paketlenmiyor. Çıkış kodu 0 = hepsi geçti.
 *
 *   node engine/tests/run-input-tests.mjs [--port 8099] [--chrome <yol>]
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');            // proje kökü: engine/ ve node_modules/ burada
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const port = Number(opt('port', 8099));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

const chromePaths = [opt('chrome', null), process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);

server.listen(port, async () => {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); }
  catch { console.error('playwright-core gerekli: npm i -D playwright-core'); process.exit(2); }
  const executablePath = chromePaths.find((p) => fs.existsSync(p));
  if (!executablePath) { console.error('Chrome bulunamadi; --chrome <yol> ver'); process.exit(2); }

  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('sayfa hatasi:', e.message));
  await page.goto(`http://localhost:${port}/engine/tests/input-test.html`);
  await page.waitForFunction('window.__done', null, { timeout: 30000 });
  const out = await page.evaluate('window.__done');
  console.log(out);
  await browser.close();
  server.close();
  process.exit(/HATA/.test(out) ? 1 : 0);
});
