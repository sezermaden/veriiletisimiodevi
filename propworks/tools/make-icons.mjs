#!/usr/bin/env node
/* =========================================================
   Generates the full 63-file UWP tile/icon set.

     node tools/make-icons.mjs                       # placeholder set
     node tools/make-icons.mjs --source cover.png    # from your key art

   Windows requires every asset at several scale factors, plus the
   Square44x44 target sizes used by the taskbar and Start search. A
   missing file is a Windows App Certification Kit failure, so the whole
   set is generated every time.
   ========================================================= */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../Propworks/Assets');
const NAME = 'Propworks';

const argv = process.argv.slice(2);
const sourceArg = argv.indexOf('--source');
const sourcePath = sourceArg >= 0 ? resolve(argv[sourceArg + 1]) : null;

/* Base logical sizes. Each is emitted at every scale in SCALES. */
const TILES = [
  ['Square44x44Logo', 44, 44],
  ['Square71x71Logo', 71, 71],
  ['Square150x150Logo', 150, 150],
  ['Square310x310Logo', 310, 310],
  ['Wide310x150Logo', 310, 150],
  ['SmallTile', 71, 71],
  ['LargeTile', 310, 310],
  ['StoreLogo', 50, 50],
  ['SplashScreen', 620, 300],
  ['LockScreenLogo', 24, 24],
];
const SCALES = [100, 125, 150, 200, 400];
/* Taskbar / Start search sizes, plated and unplated. */
const TARGETS = [16, 24, 32, 48, 256];

await mkdir(OUT, { recursive: true });

let sourceUri = null;
if (sourcePath) {
  if (!existsSync(sourcePath)) { console.error('kaynak yok: ' + sourcePath); process.exit(1); }
  sourceUri = 'data:image/png;base64,' + (await readFile(sourcePath)).toString('base64');
  console.log('kaynak: ' + sourcePath);
} else {
  console.log('kaynak yok — yer tutucu set uretiliyor (--source ile kendi gorselini ver)');
}

const browser = await chromium.launch();
const page = await browser.newPage();

/**
 * Draws one asset. With a source image it is cover-fitted and centred; without
 * one a simple branded plate with the app initial is drawn instead.
 */
async function emit(file, w, h, opts = {}) {
  const buf = await page.evaluate(async ({ w, h, src, name, transparent }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    if (!transparent) {
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#1a1226');
      bg.addColorStop(1, '#07050b');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }

    if (src) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
      // cover fit
      const s = Math.max(w / img.width, h / img.height);
      const dw = img.width * s, dh = img.height * s;
      g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      const r = Math.min(w, h);
      const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r * 0.6);
      glow.addColorStop(0, 'rgba(142,227,106,0.35)');
      glow.addColorStop(1, 'rgba(142,227,106,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      g.fillStyle = '#8ee36a';
      g.font = `900 ${Math.round(r * 0.52)}px "Segoe UI", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(name[0].toUpperCase(), w / 2, h / 2 + r * 0.02);
    }

    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const ab = await blob.arrayBuffer();
    return Array.from(new Uint8Array(ab));
  }, { w, h, src: sourceUri, name: NAME, transparent: !!opts.transparent });

  await writeFile(resolve(OUT, file), Buffer.from(buf));
}

let n = 0;
for (const [base, w, h] of TILES) {
  await emit(`${base}.png`, w, h); n++;                       // scale-100 alias
  for (const s of SCALES) {
    await emit(`${base}.scale-${s}.png`, Math.round(w * s / 100), Math.round(h * s / 100));
    n++;
  }
}
for (const t of TARGETS) {
  await emit(`Square44x44Logo.targetsize-${t}.png`, t, t); n++;
  await emit(`Square44x44Logo.altform-unplated_targetsize-${t}.png`, t, t, { transparent: true }); n++;
  await emit(`Square44x44Logo.altform-lightunplated_targetsize-${t}.png`, t, t, { transparent: true }); n++;
}

await browser.close();
console.log(`${n} dosya -> Propworks/Assets/`);
if (!sourcePath) {
  console.log('\nYayindan once gercek gorselle yeniden uret:');
  console.log('  node tools/make-icons.mjs --source Propworks/StoreArt/Covers/Cover-1080x1080.png');
}
