// Shared headless harness: static server over www/ + SwiftShader Chromium.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from '../tools/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME_PATH].filter(Boolean).find((p) => fs.existsSync(p));

export async function launch({ width = 640, height = 360 } = {}) {
  const port = 9000 + Math.floor(Math.random() * 900);
  const server = createServer(path.join(root, 'www'));
  // serve the kit's input test page, patched in memory (never symlink node_modules into www/)
  const orig = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (req.url.startsWith('/__input-test.html')) {
      const body = fs.readFileSync(path.join(here, 'fixtures/input-test.html'), 'utf8')
        .replace('<meta charset=utf-8>', '<meta charset=utf-8><base href="/">')
        .replace('./node_modules/three/build/three.module.js', './vendor/three.module.js')
        .replace('./node_modules/three/examples/jsm/', './vendor/addons/')
        .replaceAll("'./engine/input.js'", "'./src/engine/input.js'")
        .replaceAll("'./engine/camera-rig.js'", "'./src/engine/camera-rig.js'");
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(body);
    }
    return orig(req, res);
  });
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`[console] ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[http ${r.status()}] ${r.url()}`); });
  const base = `http://localhost:${port}`;
  return {
    page, errors, base,
    async open(url, frames = 5) {
      await page.goto(base + url);
      await page.waitForFunction((n) => window.__game && window.__game.frames > n && (!new URLSearchParams(location.search).get('stage') || window.__game.session?.started), frames, { timeout: 180000 });
    },
    async close() { await browser.close(); server.close(); },
  };
}

export function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}
