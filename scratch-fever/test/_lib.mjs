/* Shared test plumbing: a static server for www/, Playwright under SwiftShader,
   and frame-based waiting (never time-based — PITFALLS 14). */
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WWW = resolve(HERE, '../ScratchFever/www');
export const OUT = resolve(HERE, '../docs/shots');

/** Playwright from node_modules, or from NODE_PATH when the project has no node_modules. */
export async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  const req = createRequire(import.meta.url);
  for (const p of (process.env.NODE_PATH || '').split(':').filter(Boolean)) {
    try { return req(join(p, 'playwright')); } catch { /* next */ }
  }
  throw new Error('playwright not found: run `npm install` or set NODE_PATH');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

export function serve(port, root = WWW, patch = null) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if ((await stat(file)).isDirectory()) throw new Error('dir');
      let body = await readFile(file);
      if (patch) body = patch(p, body);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}

export async function launch(pw) {
  return pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/** Opens the game, waits for the title screen. Returns { page, errors, requests404 }. */
export async function openGame(browser, port, { width = 1280, height = 720, xbox = false, storage = null, fast = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  if (xbox) await page.addInitScript(() => { window.GAME_HOST = { shell: 'uwp', deviceFamily: 'Windows.Xbox' }; });
  if (storage) await page.addInitScript((s) => { for (const k in s) localStorage.setItem(k, s[k]); }, storage);
  // software rendering: drop the pixel load so the loop actually ticks (PITFALLS 14)
  if (fast) await page.addInitScript(() => { localStorage.setItem('scratchfever.settings.v1', JSON.stringify({ renderScale: 0.5, bloom: false, master: 0.8, music: 0.4, sfx: 0.85 })); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__game && window.__game.frames > 2, null, { timeout: 90000 });
  return { page, ctx, errors, bad };
}

export const frames = (page) => page.evaluate(() => window.__game.frames);
export async function step(page, n = 2) {
  const s = await frames(page);
  await page.waitForFunction((t) => window.__game.frames > t, s + n - 1, { timeout: 60000 });
}
/** Press a key and wait for the loop to process it. */
export async function press(page, key, n = 3) {
  await page.keyboard.press(key);
  await step(page, n);
}

export const state = (page) => page.evaluate(() => {
  const g = window.__game;
  const f = g.ui.focus.current;
  return {
    state: g.state, ui: g.ui.name, phase: g.phase,
    focus: f ? (f.dataset.key || f.textContent.trim().slice(0, 18)) : null,
    cash: g.eco.s.cash, tickets: g.eco.s.stats.tickets,
  };
});

export function reporter(label) {
  let fails = 0, passes = 0;
  const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (cond) passes++; else fails++; };
  const done = () => { console.log(`\n${label}: ${passes} passed, ${fails} failed`); return fails; };
  return { ok, done };
}

/** A fake gamepad the input layer reads through navigator.getGamepads. Drive it from the test. */
export async function installFakePad(page) {
  await page.evaluate(() => {
    const pad = {
      id: 'Xbox Wireless Controller (fake)', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null,
    };
    window.__pad = pad;
    navigator.getGamepads = () => [pad];
    window.__padPress = (i, v = 1) => { pad.buttons[i].pressed = v > 0.5; pad.buttons[i].value = v; };
    window.__padRelease = (i) => { pad.buttons[i].pressed = false; pad.buttons[i].value = 0; };
    window.__padAxes = (a) => { for (let i = 0; i < 4; i++) pad.axes[i] = a[i] ?? 0; };
  });
}
/** Tap a gamepad button for a frame and let the loop settle. */
export async function padTap(page, button, n = 3) {
  await page.evaluate((b) => window.__padPress(b), button);
  await step(page, 2);
  await page.evaluate((b) => window.__padRelease(b), button);
  await step(page, n);
}
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
