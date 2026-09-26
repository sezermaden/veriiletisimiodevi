#!/usr/bin/env node
/**
 * mockup.mjs — menu concept mockups that need no human in the loop.
 *
 * Why not AI concept art: the generated image lives on a CDN this environment cannot read, so any
 * AI-art flow needs someone at a PC to download and drop the file. These mockups are authored as
 * real HTML/CSS, rendered here in headless Chrome and screenshotted, which means the agent can SEE
 * them, compare them and pick — and, more usefully, the winning mockup already IS the theme:
 * its tokens go straight into src/theme.css, so implementation fidelity is exact rather than
 * approximate.
 *
 *   node art/mockup.mjs --config game.json --out docs/concept --variants 3
 *   node art/mockup.mjs --title "SUPER MARTOM" --items "PLAY,CONTINUE,OPTIONS,QUIT" \
 *        --mood space --fonts-dir game/fonts --out docs/concept
 *
 * Moods: space dungeon candy neon nature arctic. Archetypes cycle automatically per variant.
 *
 * Produces per variant:  concept-<n>.png (1920x1080), theme-<n>.css, concept-<n>.html
 * Plus:                  sheet.png — all variants side by side, for the pick.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };

/** Moods are palette + lighting recipes, not themes: an archetype layout is applied on top. */
export const MOODS = {
  inktide:    { bg: '#0b0a26', deep: '#171446', accent: '#ff8a1f', accent2: '#2fe0ff', warm: '#ffe14d', fog: '#2a2170', name: 'neon ink tide' },
  space:      { bg: '#080b18', deep: '#0d1430', accent: '#5ad2ff', accent2: '#b06cff', warm: '#ffd166', fog: '#1b2a5e', name: 'derin uzay' },
  dungeon:    { bg: '#0f0c0a', deep: '#1c1512', accent: '#ffab3d', accent2: '#7a3b1e', warm: '#ffd9a0', fog: '#2a1c14', name: 'meşaleli zindan' },
  candy:      { bg: '#1b1030', deep: '#2d1a52', accent: '#ff6bb5', accent2: '#57e0d0', warm: '#ffe27a', fog: '#3d2470', name: 'şekerli hyper-casual' },
  neon:       { bg: '#05070f', deep: '#0b1030', accent: '#00ffc8', accent2: '#ff2e97', warm: '#f5f7ff', fog: '#122055', name: 'siberpunk neon' },
  nature:     { bg: '#0a1410', deep: '#12251c', accent: '#7ddb6a', accent2: '#e8b34a', warm: '#f2f7ef', fog: '#1c3a2b', name: 'orman' },
  arctic:     { bg: '#0b1622', deep: '#132534', accent: '#7fd8ff', accent2: '#e8f4ff', warm: '#ffffff', fog: '#1d3purple', name: 'buzul' },
};

/** Layout archetypes. Varying THIS is what stops every game looking the same. */
export const ARCHETYPES = ['left-rail', 'center-stack', 'bottom-bar'];

const FONT_PAIRS = [
  { display: 'Bungee', ui: 'Baloo 2', weight: 400, spacing: '0.02em' },
  { display: 'Lilita One', ui: 'Baloo 2', weight: 400, spacing: '0.02em' },
  { display: 'Rubik Wet Paint', ui: 'Baloo 2', weight: 400, spacing: '0.02em' },
  { display: 'Anton', ui: 'Open Sans', weight: 400, spacing: '0.02em' },
  { display: 'Bangers', ui: 'Open Sans', weight: 400, spacing: '0.04em' },
  { display: 'Oswald', ui: 'Open Sans', weight: 700, spacing: '0.06em' },
  { display: 'Lilita One', ui: 'Open Sans', weight: 400, spacing: '0.01em' },
];

/**
 * Fonts must come from the SAME .woff2 files the game ships, otherwise the mockup promises a
 * typeface the game cannot honour. Point --fonts-dir at the folder holding them (copy them out of
 * $LIB/fonts/ first). Without it the mockup falls back to system faces and says so.
 */
function fontFaces(dir, pairs) {
  if (!dir || !fs.existsSync(dir)) return { css: '', available: false };
  const files = fs.readdirSync(dir).filter((f) => /\.(woff2|ttf|otf)$/i.test(f));
  const find = (family) => {
    const key = family.toLowerCase().replace(/[^a-z]/g, '');
    return files.find((f) => f.toLowerCase().replace(/[^a-z]/g, '').includes(key));
  };
  const faces = [];
  for (const fam of [...new Set(pairs.flatMap((p) => [p.display, p.ui]))]) {
    const file = find(fam);
    if (file) {
      faces.push(`@font-face{font-family:'${fam}';src:url('file://${path.join(dir, file)}');font-display:block}`);
    }
  }
  return { css: faces.join('\n'), available: faces.length > 0, count: faces.length };
}

function html({ title, subtitle, items, mood, archetype, font, prompts, faceCss }) {
  const m = MOODS[mood] || MOODS.space;
  const f = font;
  const layout = {
    'left-rail': { menuArea: 'grid-column:1/2; align-self:center;', heroArea: 'grid-column:2/4;', cols: '38fr 32fr 30fr', align: 'left' },
    'center-stack': { menuArea: 'grid-column:1/4; justify-self:center; text-align:center;', heroArea: 'grid-column:1/4; grid-row:1/3;', cols: '1fr 1fr 1fr', align: 'center' },
    'bottom-bar': { menuArea: 'grid-column:1/4; align-self:end; display:flex; gap:2.5rem;', heroArea: 'grid-column:1/4; grid-row:1/2;', cols: '1fr 1fr 1fr', align: 'center' },
  }[archetype];

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
${faceCss || ''}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1920px;height:1080px;overflow:hidden;background:${m.bg};
    font-family:'${f.ui}',system-ui,sans-serif;color:#eef2f8}
  .stage{position:absolute;inset:0;overflow:hidden}
  /* atmosfer: katmanlı degradeler + siluetler, gerçek sahnenin yerini tutan konsept dokusu */
  .sky{position:absolute;inset:0;background:
      radial-gradient(120% 90% at 72% 22%, ${m.fog}cc 0%, transparent 62%),
      radial-gradient(80% 60% at 20% 90%, ${m.deep} 0%, transparent 70%),
      linear-gradient(180deg, ${m.deep} 0%, ${m.bg} 68%)}
  .glow{position:absolute;left:62%;top:26%;width:520px;height:520px;transform:translate(-50%,-50%);
    background:radial-gradient(circle, ${m.accent}66 0%, ${m.accent}18 42%, transparent 70%);filter:blur(2px)}
  .orb{position:absolute;left:62%;top:26%;width:230px;height:230px;transform:translate(-50%,-50%);
    border-radius:50%;background:radial-gradient(circle at 34% 30%, ${m.warm}, ${m.accent} 55%, ${m.accent2} 100%);
    box-shadow:0 0 120px ${m.accent}88, inset -30px -24px 60px #0006}
  .ring{position:absolute;left:62%;top:26%;width:430px;height:430px;transform:translate(-50%,-50%) rotate(-18deg);
    border:2px solid ${m.accent}55;border-radius:50%;box-shadow:0 0 40px ${m.accent}33 inset}
  .stars i{position:absolute;background:#fff;border-radius:50%;opacity:.75}
  .ridge{position:absolute;left:0;right:0;bottom:0;height:38%;
    background:linear-gradient(180deg, transparent, ${m.bg} 72%)}
  .peak{position:absolute;bottom:0;background:${m.deep};filter:brightness(.75)}
  .peak.a{left:-4%;width:46%;height:15%;clip-path:polygon(0 100%,18% 34%,34% 62%,52% 12%,74% 58%,100% 26%,100% 100%);
    filter:brightness(.5);opacity:.9}
  .peak.b{right:-6%;width:54%;height:12%;clip-path:polygon(0 100%,14% 46%,32% 18%,58% 54%,80% 22%,100% 48%,100% 100%);
    filter:brightness(.35);opacity:.9}
  .vig{position:absolute;inset:0;box-shadow:inset 0 0 260px #000a, inset 0 0 90px #0006}

  .frame{position:absolute;inset:0;display:grid;grid-template-columns:${layout.cols};
    grid-template-rows:1fr auto;padding:5vh 5vw;gap:2rem}
  .hero{${layout.heroArea}}
  .menu{${layout.menuArea};position:relative;z-index:3}
  .title{font-family:'${f.display}',system-ui;font-size:${archetype === 'center-stack' ? '110px' : '92px'};
    line-height:.92;letter-spacing:${f.spacing};text-transform:uppercase;
    background:linear-gradient(180deg,#fff 30%, ${m.accent} 130%);-webkit-background-clip:text;color:transparent;
    filter:drop-shadow(0 6px 0 #0008) drop-shadow(0 0 40px ${m.accent}55);margin-bottom:.35em}
  .sub{font-size:26px;letter-spacing:.22em;text-transform:uppercase;color:#ffffffaa;margin-bottom:2.2rem}
  .items{display:${archetype === 'bottom-bar' ? 'flex' : 'grid'};gap:${archetype === 'bottom-bar' ? '1.6rem' : '.85rem'}}
  .item{font-size:34px;font-weight:600;padding:18px 34px;min-height:64px;display:flex;align-items:center;
    ${archetype === 'center-stack' ? 'justify-content:center;min-width:420px;' : ''}
    border-radius:14px;color:#e9eef7;background:#0c1020cc;border:1px solid #ffffff1f;
    backdrop-filter:blur(6px)}
  .item.on{background:linear-gradient(90deg, ${m.accent}33, #0c1020cc);
    border:1px solid ${m.accent};box-shadow:0 0 0 4px ${m.accent}55, 0 0 34px ${m.accent}44;color:#fff}
  .item.on::before{content:'';width:10px;height:34px;border-radius:6px;background:${m.accent};
    margin-right:18px;box-shadow:0 0 18px ${m.accent}}
  .prompts{grid-column:1/4;display:flex;gap:2.4rem;align-items:center;justify-content:${archetype === 'left-rail' ? 'flex-start' : 'center'};
    color:#ffffffb0;font-size:22px;letter-spacing:.04em}
  .btn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;
    font-weight:700;font-size:19px;margin-right:12px;color:#0b0d12}
  /* buton renkleri ayri ad alaninda: .peak.a ile cakisirsa daglar yesil/kirmizi olur */
  .btn-a{background:#8ede6a}.btn-b{background:#f2726b}.btn-x{background:#6fb7ff}.btn-y{background:#ffd166}
  .badge{position:absolute;right:5vw;top:5vh;font-size:20px;color:#ffffff66;letter-spacing:.1em}
</style></head><body>
<div class="stage">
  <div class="sky"></div>
  <div class="stars">${Array.from({ length: 90 }, (_, i) => {
    const x = (i * 97) % 100, y = (i * 53) % 62, s = 1 + ((i * 7) % 3);
    return `<i style="left:${x}%;top:${y}%;width:${s}px;height:${s}px"></i>`;
  }).join('')}</div>
  <div class="glow"></div><div class="ring"></div><div class="orb"></div>
  <div class="ridge"></div><div class="peak a"></div><div class="peak b"></div>
  <div class="vig"></div>
</div>
<div class="frame">
  <div class="hero"></div>
  <div class="menu">
    <div class="title">${title}</div>
    ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
    <div class="items">
      ${items.map((t, i) => `<div class="item${i === 0 ? ' on' : ''}">${t}</div>`).join('')}
    </div>
  </div>
  <div class="prompts">
    ${prompts.map((p) => `<span><span class="btn btn-${p.k.toLowerCase()}">${p.k}</span>${p.label}</span>`).join('')}
  </div>
  <div class="badge">v0.1</div>
</div>
</body></html>`;
}

function themeCss({ mood, font }) {
  const m = MOODS[mood] || MOODS.space;
  return `/* GENERATED by art/mockup.mjs — the chosen concept IS these tokens.
   Every screen reads them; nothing hard-codes a colour. Sizes are 10-foot values. */
:root {
  --bg: ${m.bg};
  --surface: ${m.deep};
  --surface-2: ${m.fog};
  --text: #eef2f8;
  --text-muted: #ffffffb0;
  --accent: ${m.accent};
  --accent-2: ${m.accent2};
  --accent-warm: ${m.warm};
  --focus: ${m.accent};
  --danger: #f2726b;
  --success: #8ede6a;

  --font-display: '${font.display}', system-ui, sans-serif;
  --font-ui: '${font.ui}', system-ui, sans-serif;
  --step--1: clamp(18px, 1.15vw, 26px);
  --step-0:  clamp(24px, 1.55vw, 34px);
  --step-1:  clamp(32px, 2.1vw, 46px);
  --step-2:  clamp(44px, 3.0vw, 66px);
  --step-3:  clamp(64px, 4.8vw, 110px);

  --safe-x: 5vw;  --safe-y: 5vh;
  --gap-s: .6rem; --gap-m: 1.2rem; --gap-l: 2.4rem;
  --focus-ring: 4px; --radius: 14px; --hit-min: 64px;
  --anim-fast: 120ms; --anim-slow: 260ms;
}
:where(button,[role="menuitem"],[tabindex]):focus-visible{
  outline: var(--focus-ring) solid var(--focus); outline-offset: 3px;
}
`;
}

async function main() {
  const cfgPath = opt('config');
  const cfg = cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
  const title = opt('title', cfg.title || 'GAME TITLE');
  const subtitle = opt('subtitle', cfg.subtitle || '');
  const items = (opt('items', cfg.items?.join(',') || 'PLAY,CONTINUE,OPTIONS,CREDITS,QUIT')).split(',');
  const mood = opt('mood', cfg.mood || 'space');
  const out = path.resolve(opt('out', 'docs/concept'));
  const n = Number(opt('variants', 3));
  const prompts = cfg.prompts || [{ k: 'A', label: 'Select' }, { k: 'B', label: 'Back' }];
  fs.mkdirSync(out, { recursive: true });

  const fontsDir = opt('fonts-dir', cfg.fontsDir || null);
  const faces = fontFaces(fontsDir ? path.resolve(fontsDir) : null, FONT_PAIRS);
  if (!faces.available) {
    console.warn('UYARI: --fonts-dir verilmedi ya da font bulunamadi — mockup sistem fontuyla');
    console.warn('       cizilecek ve oyunun gercek tipografisini GOSTERMEYECEK.');
    console.warn('       $LIB/fonts/ icinden woff2 dosyalarini bir klasore kopyalayip yolu ver.');
  } else {
    console.log(`${faces.count} font yuklendi: ${path.resolve(fontsDir)}`);
  }

  const { chromium } = await import('playwright-core');
  const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

  const made = [];
  for (let i = 0; i < n; i++) {
    const archetype = ARCHETYPES[i % ARCHETYPES.length];
    const font = FONT_PAIRS[i % FONT_PAIRS.length];
    const doc = html({ title, subtitle, items, mood, archetype, font, prompts, faceCss: faces.css });
    const base = path.join(out, `concept-${i + 1}`);
    fs.writeFileSync(base + '.html', doc);
    fs.writeFileSync(path.join(out, `theme-${i + 1}.css`), themeCss({ mood, font }));
    await page.goto('file://' + base + '.html');
    await page.waitForTimeout(700);                     // web fonts
    await page.screenshot({ path: base + '.png' });
    made.push({ file: base + '.png', archetype, font: font.display, mood });
    console.log(`concept-${i + 1}: ${archetype} + ${font.display}  (${MOODS[mood]?.name || mood})`);
  }

  // contact sheet so a single image carries the whole choice
  const sheet = `<!doctype html><body style="margin:0;background:#0b0d12;display:grid;
    grid-template-columns:repeat(${Math.min(n, 3)},1fr);gap:16px;padding:16px;font-family:system-ui;color:#e6e8ee">
    ${made.map((m, i) => `<figure style="margin:0"><img src="file://${m.file}" style="width:100%;display:block;border-radius:8px">
      <figcaption style="padding:8px 2px;font-size:26px">${i + 1} — ${m.archetype} · ${m.font}</figcaption></figure>`).join('')}
  </body>`;
  const sheetPath = path.join(out, 'sheet.html');
  fs.writeFileSync(sheetPath, sheet);
  await page.setViewportSize({ width: 1920, height: Math.ceil(1080 / Math.min(n, 3)) + 120 });
  await page.goto('file://' + sheetPath);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  await browser.close();
  console.log(`\n${n} konsept + sheet.png -> ${out}`);
  console.log('secilen varyantin theme-<n>.css dosyasi dogrudan src/theme.css olur.');
}

main().catch((e) => { console.error(e); process.exit(1); });
