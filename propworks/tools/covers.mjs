/* Store covers from the key art drop folder (+ the rendered wordmark). Missing art falls
   back to a gameplay screenshot and is reported as a PLACEHOLDER. */
import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../Propworks/StoreArt');
const KEY = resolve(ROOT, 'KeyArt'), LOGO = resolve(ROOT, 'Logo'), OUT = resolve(ROOT, 'Covers'), SHOTS = resolve(ROOT, 'Screenshots');
await mkdir(OUT, { recursive: true });
const files = existsSync(KEY) ? await readdir(KEY) : [];
const find = (stem) => { const f = files.find((x) => x.startsWith(stem + '.')); return f ? resolve(KEY, f) : null; };
const shotFallback = resolve(SHOTS, '02-sandbox-physgun.png');
const src = { hero: find('hero-16x9'), poster: find('poster-2x3'), box: find('box-1x1') };
for (const [k, v] of Object.entries(src)) console.log(`${k.padEnd(7)} ${v ? v : 'PLACEHOLDER (in-game screenshot)'}`);

async function cover(name, w, h, art, logoFile, { logo = true, logoW = 0.7, logoY = 0.08 } = {}) {
  const base = sharp(art || shotFallback).resize(w, h, { fit: 'cover', position: 'attention' });
  const layers = [];
  // darken the top for the wordmark
  const grad = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".65"/><stop offset=".45" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  layers.push({ input: grad });
  if (logo && existsSync(resolve(LOGO, logoFile))) {
    const lw = Math.round(w * logoW);
    const lb = await sharp(resolve(LOGO, logoFile)).resize({ width: lw }).toBuffer();
    const meta = await sharp(lb).metadata();
    layers.push({ input: lb, left: Math.round((w - lw) / 2), top: Math.round(h * logoY) });
    void meta;
  }
  await base.composite(layers).png().toFile(resolve(OUT, name));
  console.log('  ' + name);
}

await cover('hero-1920x1080.png', 1920, 1080, src.hero, 'logo-wide.png', { logoW: 0.5 });
await cover('hero-textless-1920x1080.png', 1920, 1080, src.hero, null, { logo: false });
await cover('poster-720x1080.png', 720, 1080, src.poster || src.hero, 'logo-stacked.png', { logoW: 0.8 });
await cover('box-1080.png', 1080, 1080, src.box || src.hero, 'logo-stacked.png', { logoW: 0.75 });
await cover('keyart-584x800.png', 584, 800, src.poster || src.hero, 'logo-stacked.png', { logoW: 0.8 });
await cover('tile-300.png', 300, 300, src.box || src.hero, 'logo-mark.png', { logoW: 0.85, logoY: 0.3 });
await cover('tile-150.png', 150, 150, src.box || src.hero, 'logo-mark.png', { logoW: 0.85, logoY: 0.3 });
await cover('tile-71.png', 71, 71, src.box || src.hero, 'logo-mark.png', { logoW: 0.9, logoY: 0.28 });
