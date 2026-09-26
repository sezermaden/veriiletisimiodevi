// UWP tile / icon set (every size and scale Windows App Certification checks) drawn from the game's
// own brand mark: the logo squid on a cyan ink splat, on the navy UI plate. Same file list as the
// uwp-three-game kit's make-icons.mjs; output goes to uwp/assets/ (committed) and
// tools/make-uwp.mjs copies it into the generated project's Assets/.
//   node tools/make-icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'uwp/assets');
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME_PATH].filter(Boolean).find((p) => fs.existsSync(p));

const TILES = [
  ['Square44x44Logo', 44, 44], ['Square71x71Logo', 71, 71], ['Square150x150Logo', 150, 150],
  ['Square310x310Logo', 310, 310], ['Wide310x150Logo', 310, 150], ['SmallTile', 71, 71],
  ['LargeTile', 310, 310], ['StoreLogo', 50, 50], ['SplashScreen', 620, 300], ['LockScreenLogo', 24, 24],
];
const SCALES = [100, 125, 150, 200, 400];
const TARGETS = [16, 24, 32, 48, 256];

const jobs = [];
for (const [base, w, h] of TILES) {
  jobs.push([`${base}.png`, w, h, false]);
  for (const s of SCALES) jobs.push([`${base}.scale-${s}.png`, Math.round(w * s / 100), Math.round(h * s / 100), false]);
}
for (const t of TARGETS) {
  jobs.push([`Square44x44Logo.targetsize-${t}.png`, t, t, false]);
  jobs.push([`Square44x44Logo.altform-unplated_targetsize-${t}.png`, t, t, true]);
  jobs.push([`Square44x44Logo.altform-lightunplated_targetsize-${t}.png`, t, t, true]);
}

const server = createServer(path.join(root, 'www'));
const port = 9900 + Math.floor(Math.random() * 90);
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
fs.mkdirSync(OUT, { recursive: true });

const files = await page.evaluate(async (jobs) => {
  const { splatPath } = await import('/src/ui/icons.js');
  const { SQUID } = await import('/src/ui/logo.js');
  const C = { bg: '#0b0a26', surface: '#171446', text: '#eef2f8', accent: '#ff8a1f', accent2: '#2fe0ff' };
  const splat = splatPath(7, 110, { arms: 8, drops: 7, lump: 0.1 });
  const style = `.sq-body,.sq-skirt{fill:${C.accent};stroke:${C.surface};stroke-width:7;stroke-linejoin:round}
    .sq-hl{fill:none;stroke:rgba(238,242,248,.7);stroke-width:9;stroke-linecap:round}
    .sq-eye{fill:${C.text};stroke:${C.surface};stroke-width:5}.sq-pupil{fill:${C.bg}}.sq-glint{fill:${C.text}}`;
  const out = [];
  for (const [name, w, h, bare] of jobs) {
    const m = Math.min(w, h);
    // tiny sizes: fill more of the plate so the squid stays readable
    const k = (m <= 32 ? 0.95 : m <= 71 ? 0.86 : 0.74) * m / 340;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <style>${style}</style>
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.surface}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>
      ${bare ? '' : `<rect width="${w}" height="${h}" fill="url(#bg)"/>`}
      <g transform="translate(${w / 2} ${h / 2}) scale(${k})">
        <path d="${splat}" fill="${C.accent2}" transform="rotate(-8)"/>
        <g transform="translate(-100 -128)">${SQUID}</g>
      </g></svg>`;
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    out.push([name, c.toDataURL('image/png').split(',')[1]]);
  }
  return out;
}, jobs);

for (const [name, b64] of files) fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64'));
await browser.close();
server.close();
console.log(`${files.length} files -> uwp/assets/`);
