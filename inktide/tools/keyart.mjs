// Derive covers and the menu backdrop from StoreArt/KeyArt/{hero-16x9,poster-2x3,box-1x1}.*
// Uses headless Chromium (canvas) so no native image library is needed.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'StoreArt/KeyArt');
const find = (base) => ['png', 'jpg', 'jpeg', 'webp'].map((e) => path.join(dir, `${base}.${e}`)).find((f) => fs.existsSync(f));
const hero = find('hero-16x9'), poster = find('poster-2x3'), box = find('box-1x1');
if (!hero && !poster && !box) { console.log('No key art in StoreArt/KeyArt — nothing to do (see README.md).'); process.exit(0); }

const OUT = [
  // [source, width, height, output]
  [hero, 1920, 1080, 'StoreArt/Covers/hero-1920x1080.png'],
  [hero, 3840, 2160, 'StoreArt/Covers/hero-3840x2160.png'],
  [hero, 1920, 1080, 'www/art/menu-backdrop.webp'],
  [poster || hero, 1080, 1620, 'StoreArt/Covers/poster-1080x1620.png'],
  [poster || hero, 720, 1080, 'StoreArt/Covers/poster-720x1080.png'],
  [box || hero, 1080, 1080, 'StoreArt/Covers/box-1080x1080.png'],
  [box || hero, 300, 300, 'StoreArt/Covers/box-300x300.png'],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [src, w, h, out] of OUT) {
  if (!src) continue;
  const data = 'data:image/' + path.extname(src).slice(1).replace('jpg', 'jpeg') + ';base64,' + fs.readFileSync(src).toString('base64');
  const type = out.endsWith('.webp') ? 'image/webp' : 'image/png';
  const b64 = await page.evaluate(async ({ data, w, h, type }) => {
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const s = Math.max(w / img.width, h / img.height);          // cover-fit, centred
    const dw = img.width * s, dh = img.height * s;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c.toDataURL(type, 0.9).split(',')[1];
  }, { data, w, h, type });
  fs.mkdirSync(path.join(root, path.dirname(out)), { recursive: true });
  fs.writeFileSync(path.join(root, out), Buffer.from(b64, 'base64'));
  console.log('wrote', out);
}
await browser.close();
