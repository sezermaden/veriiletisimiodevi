#!/usr/bin/env node
/* Renders the Store covers from a gameplay screenshot plus the CSS wordmark.
   The wordmark is rendered in Chromium with the real font stack (never as SVG text:
   sharp's SVG renderer ignores @font-face silently). Output:
     ScratchFever/StoreArt/Covers/Cover-1080x1080.png   (box / icon source)
     ScratchFever/StoreArt/Covers/Hero-1920x1080.png    (store hero)
     ScratchFever/StoreArt/Covers/Poster-720x1080.png   (2:3)
     ScratchFever/StoreArt/Covers/Wide-2400x1200.png    (Partner Center wide)
   Run tools/shots.mjs first; 03-play.png is the backdrop. */
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPlaywright } from '../test/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../ScratchFever');
const OUT = resolve(APP, 'StoreArt/Covers');
const SHOT = resolve(APP, 'StoreArt/Screenshots/03-play.png');
const THEME = await readFile(resolve(APP, 'www/src/theme.css'), 'utf8');

await mkdir(OUT, { recursive: true });
const backdrop = existsSync(SHOT) ? 'data:image/png;base64,' + (await readFile(SHOT)).toString('base64') : null;
if (!backdrop) console.warn('no screenshot at ' + SHOT + ' — rendering on a plain gradient');

const page_html = (w, h, variant) => `<!doctype html><html><head><meta charset="utf-8"><style>
${THEME}
* { margin:0; padding:0; box-sizing:border-box; }
body { width:${w}px; height:${h}px; overflow:hidden; background: var(--bg); font-family: var(--font-display); }
.bg { position:absolute; inset:0; transform: scale(1.32); transform-origin: 50% 55%; background: ${backdrop ? `url(${backdrop}) center / cover no-repeat` : 'radial-gradient(ellipse at 50% 40%, var(--surface-2), var(--bg))'}; filter: saturate(1.15); }
.bg::after { content:''; position:absolute; inset:0; background: linear-gradient(180deg, rgba(7,19,14,0.15) 0%, rgba(7,19,14,0) 35%, rgba(7,19,14,0.85) 100%); }
.wrap { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:${variant === 'poster' ? 'flex-end' : 'center'}; padding: ${Math.round(h * 0.06)}px; }
.logo { display:flex; flex-direction:column; align-items:center; line-height:0.84; letter-spacing:0.04em; text-transform:uppercase; font-weight:900; }
.w1 { font-size:${Math.round(Math.min(w, h) * (variant === 'square' ? 0.155 : variant === 'poster' ? 0.175 : 0.15))}px; color: var(--text); text-shadow: 0 ${Math.round(h * 0.008)}px 0 var(--surface), 0 ${Math.round(h * 0.02)}px ${Math.round(h * 0.05)}px rgba(0,0,0,0.7); }
.w2 { font-size:${Math.round(Math.min(w, h) * (variant === 'square' ? 0.155 : variant === 'poster' ? 0.175 : 0.15))}px; color: var(--accent); text-shadow: 0 ${Math.round(h * 0.008)}px 0 var(--surface), 0 0 ${Math.round(h * 0.05)}px var(--focus-glow), 0 ${Math.round(h * 0.02)}px ${Math.round(h * 0.05)}px rgba(0,0,0,0.7); }
.tag { margin-top: ${Math.round(h * 0.03)}px; color: var(--accent-warm); letter-spacing: 0.4em; font-size: ${Math.round(Math.min(w, h) * 0.03)}px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
.mark { position:absolute; left:50%; top:${variant === 'poster' ? '28%' : '50%'}; width:${Math.round(Math.min(w, h) * 0.9)}px; height:${Math.round(Math.min(w, h) * 0.9)}px; transform:translate(-50%,-50%); border-radius:50%; background: radial-gradient(circle, rgba(244,197,66,0.22) 0%, rgba(244,197,66,0) 65%); }
</style></head><body><div class="bg"></div><div class="mark"></div><div class="wrap"><div class="logo"><span class="w1">Scratch</span><span class="w2">Fever</span></div><div class="tag">LUCK IS YOUR WEAPON</div></div></body></html>`;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch();
const jobs = [
  ['Cover-1080x1080.png', 1080, 1080, 'square'],
  ['Hero-1920x1080.png', 1920, 1080, 'hero'],
  ['Poster-720x1080.png', 720, 1080, 'poster'],
  ['Wide-2400x1200.png', 2400, 1200, 'hero'],
];
for (const [file, w, h, variant] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(page_html(w, h, variant), { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await writeFile(resolve(OUT, file), await page.screenshot({ type: 'png' }));
  console.log('  ' + file);
  await page.close();
}
await browser.close();
console.log('covers →', OUT);
