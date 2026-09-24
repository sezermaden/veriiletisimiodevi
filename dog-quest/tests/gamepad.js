// Gamepad test: two virtual gamepads drive the whole flow from the title screen
// into co-op gameplay (menus, joining, moving, attacking, spells, talking, pausing).
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.PW_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..');

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.addInitScript(() => {
    const mk = i => ({ id: 'Virtual Pad', index: i, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] });
    window.fakePads = [mk(0), mk(1), null, null];
    navigator.getGamepads = () => window.fakePads;
  });
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    localStorage.clear();
    Game.manual = true;
    const log = [];
    const btn = (pad, b, frames = 3) => { fakePads[pad].buttons[b].pressed = true; Game.step(frames); fakePads[pad].buttons[b].pressed = false; Game.step(3); };
    const axis = (pad, x, y, frames) => { fakePads[pad].axes[0] = x; fakePads[pad].axes[1] = y; Game.step(frames); fakePads[pad].axes[0] = 0; fakePads[pad].axes[1] = 0; Game.step(2); };
    Game.step(5);
    btn(0, PB.A); log.push('title stage ' + Game.sceneObj.stage);
    // menu: New Game is first when no save
    btn(0, PB.A); let g = 0; while (Game.scene !== 'select' && g++ < 100) Game.step(1);
    log.push('scene ' + Game.scene + ' p1=' + Game.sceneObj.slots[0].device);
    btn(1, PB.A); log.push('p2 joined=' + Game.sceneObj.slots[1].joined + ' dev=' + Game.sceneObj.slots[1].device);
    btn(1, PB.RIGHT); btn(0, PB.A); btn(1, PB.A);
    log.push('locked ' + Game.sceneObj.slots.map(s => s.locked + ':' + BREED_ORDER[s.cursor]).join(','));
    g = 0; while (Game.scene !== 'story' && g++ < 200) Game.step(1);
    log.push('scene ' + Game.scene);
    btn(0, PB.B); g = 0; while (Game.scene !== 'play' && g++ < 200) Game.step(1);
    log.push('scene ' + Game.scene + ' devices=' + Game.players.map(p => p.device).join(','));
    log.push('tutorial=' + (Game.overlays[0] && Game.overlays[0].constructor.name));
    btn(0, PB.A, 50); btn(0, PB.A); log.push('overlays after A=' + Game.overlays.length);
    const p0 = Game.players[0], p1 = Game.players[1];
    const x0 = p0.x;
    axis(0, 1, 0, 40); log.push('p0 moved ' + Math.round(p0.x - x0));
    const y1 = p1.y;
    axis(1, 0, 1, 30); log.push('p1 moved ' + Math.round(p1.y - y1));
    btn(0, PB.A); log.push('p0 state ' + p0.state);
    Game.step(30);
    btn(1, PB.B); log.push('p1 state ' + p1.state);
    Game.step(30);
    const mp = p0.mp; btn(0, PB.LB); log.push('p0 cast flame, mana ' + Math.round(mp) + '->' + Math.round(p0.mp) + ' proj=' + Game.projectiles.length);
    // walk to elder and talk with X
    const elder = Game.npcs.find(n => n.id === 'elder');
    p0.x = elder.x; p0.y = elder.y + 30; Game.step(3);
    btn(0, PB.X); log.push('dialog open=' + (Game.overlays.length > 0));
    g = 0; while (Game.overlays.length && g++ < 60) btn(0, PB.A, 10);
    log.push('m1 done=' + Game.questDone('m1'));
    btn(1, PB.START); log.push('pause=' + (Game.overlays[0] && Game.overlays[0].constructor.name) + ' by P' + (Game.overlays[0] && Game.overlays[0].pi + 1));
    btn(1, PB.RB); btn(1, PB.RB); log.push('tab=' + Game.overlays[0].tabs[Game.overlays[0].tab]);
    btn(1, PB.B); log.push('overlays=' + Game.overlays.length);
    btn(0, PB.Y); log.push('map=' + (Game.overlays[0] && Game.overlays[0].tabs[Game.overlays[0].tab]));
    btn(0, PB.START); log.push('closed=' + (Game.overlays.length === 0));
    return log;
  });
  r.forEach(l => console.log(' ', l));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
