/* Renders the PROPWORKS wordmark in Chromium with real fonts and saves transparent PNGs.
   Never compose typography as SVG for sharp: its renderer ignores @font-face silently. */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../Propworks/StoreArt/Logo');
await mkdir(OUT, { recursive: true });
const theme = await readFile(resolve(HERE, '../Propworks/www/styles/theme.css'), 'utf8');

const html = (variant) => `<!doctype html><meta charset=utf-8><style>${theme}
html,body{margin:0;background:transparent}
.wrap{display:inline-flex;flex-direction:column;align-items:center;padding:90px 60px 40px}
.stack{position:relative;font-family:var(--font-display);font-size:${variant === 'stacked' ? 150 : 180}px;line-height:1;letter-spacing:.01em;white-space:nowrap}
.stack span{position:absolute;left:0;top:0}
.l1{color:transparent;-webkit-text-stroke:22px var(--bg);transform:translate(0,10px)}
.l2{color:transparent;-webkit-text-stroke:14px var(--surface-3)}
.l3{color:transparent;-webkit-text-stroke:3px var(--accent);filter:drop-shadow(0 0 18px var(--accent))}
.l4{background:linear-gradient(180deg,#fff 0%,var(--text) 45%,var(--accent-2) 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.stack .ghost{visibility:hidden;position:relative;display:block}
.mark{position:absolute;left:50%;top:50%;width:1.15em;height:1.15em;transform:translate(-50%,-52%) rotate(45deg);border:10px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:14px;z-index:-1}
.tag{margin-top:26px;color:var(--accent-warm);font-family:var(--font-ui);font-size:40px;letter-spacing:.42em;text-transform:uppercase;display:flex;align-items:center;gap:24px}
.tag::before,.tag::after{content:'';width:90px;height:3px;background:var(--accent-warm);opacity:.8}
</style><div class=wrap id=w>${variant === 'stacked'
  ? `<div class=stack><span class=l1>PROP<br>WORKS</span><span class=l2>PROP<br>WORKS</span><span class=l3>PROP<br>WORKS</span><span class=l4>PROP<br>WORKS</span><span class=ghost>PROP<br>WORKS</span><i class=mark></i></div>`
  : `<div class=stack><span class=l1>PROPWORKS</span><span class=l2>PROPWORKS</span><span class=l3>PROPWORKS</span><span class=l4>PROPWORKS</span><span class=ghost>PROPWORKS</span><i class=mark></i></div>`}
${variant === 'mark' ? '' : '<div class=tag>a physics sandbox story</div>'}</div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
for (const v of ['wide', 'stacked', 'mark']) {
  await page.setContent(html(v));
  const el = await page.$('#w');
  await el.screenshot({ path: resolve(OUT, `logo-${v}.png`), omitBackground: true });
  console.log('logo-' + v + '.png');
}
await browser.close();
