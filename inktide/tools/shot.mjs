// Drive the game headless and screenshot it.
//   node tools/shot.mjs --url "/?stage=sandbox" --out docs/shots/sandbox.png [--frames 90] [--eval "js"] [--w 1280 --h 720]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const port = 8000 + Math.floor(Math.random() * 900);
const server = createServer(path.resolve('www'));
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const W = Number(opt('w', 1280)), H = Number(opt('h', 720));
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(`http://localhost:${port}${opt('url', '/?stage=sandbox')}`);
const t0 = Date.now();
await page.waitForFunction(() => window.__game && window.__game.frames > 5, null, { timeout: 90000 }).catch((e) => logs.push('timeout waiting for frames: ' + e.message));
const frames = Number(opt('frames', 60));
const f0 = await page.evaluate(() => window.__game?.frames || 0);
await page.waitForFunction((n) => window.__game.frames >= n, f0 + frames, { timeout: 120000 }).catch(() => logs.push('timeout on frame wait'));
const ev = opt('eval', null);
if (ev) {
  const r = await page.evaluate(ev).catch((e) => 'eval error: ' + e.message);
  console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r));
  const f1 = await page.evaluate(() => window.__game.frames);
  await page.waitForFunction((n) => window.__game.frames >= n, f1 + Number(opt('after', 30)), { timeout: 120000 }).catch(() => {});
}
const out = opt('out', 'docs/shots/shot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({ frames: window.__game?.frames, errors: window.__game?.errors, calls: window.__game?.renderer?.gl?.info?.render?.calls, tris: window.__game?.renderer?.gl?.info?.render?.triangles }));
console.log('info', JSON.stringify(info), 'elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
server.close();
