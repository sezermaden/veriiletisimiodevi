// Smoke test: boots the game in headless Chromium, walks through menus into gameplay,
// and reports console errors + screenshots. Usage: node tests/smoke.js [outDir]
const path = require('path');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://localhost:${port}/index.html`);
  setTimeout(() => { if (errors.length) console.log('EARLY ERRORS', errors.join('\n')); }, 15000);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 20000 });
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); };
  const wait = ms => page.waitForTimeout(ms);
  const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(60); };
  await wait(500);
  await shot('01_title');
  await key('Space');
  await wait(300);
  await shot('02_title_menu');
  await key('Enter');
  await wait(800);
  console.log('scene after new game:', await page.evaluate(() => Game.scene));
  await shot('03_select');
  // P2 joins with Space (WASD side)
  await key('Space');
  await wait(300);
  await key('KeyD');
  await shot('04_select_2p');
  await key('Enter'); // P1 ready
  await key('Space'); // P2 ready
  await wait(2200);
  console.log('scene after select:', await page.evaluate(() => Game.scene));
  await shot('05_intro');
  await key('Escape');
  await wait(1500);
  console.log('scene after intro:', await page.evaluate(() => Game.scene));
  await shot('06_world_start');
  // Walk around
  await page.keyboard.down('KeyD'); await wait(1200); await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowLeft'); await wait(800); await page.keyboard.up('ArrowLeft');
  await shot('07_walk');
  const info = await page.evaluate(() => ({ scene: Game.scene, players: Game.players.map(p => [p.breed, p.device, Math.round(p.x), Math.round(p.y)]), quests: Game.state && Game.state.quests, enemies: Game.enemies.length, err: String(Game.lastError || '') }));
  console.log(JSON.stringify(info));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
