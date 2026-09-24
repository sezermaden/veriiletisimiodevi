// Fuzz test: random real inputs for two players across regions and dungeons
// (no god mode), plus a render performance measurement.
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
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });

  const res = await page.evaluate(() => {
    localStorage.clear();
    Game.manual = true;
    Game.startGame([{ breed: 'shiba', device: 'kbA' }, { breed: 'bulldog', device: 'kbB' }], null);
    Game.step(10);
    const st = Game.state;
    for (const id of SPELL_ORDER) st.spells[id] = 3;
    Game.players.forEach(p => { p.spells = ['flame', 'thunder', 'quake', 'meteor']; });
    Game.players[1].spells = ['heal', 'frost', 'spirit', 'shield'];
    const keysA = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyE'];
    const keysB = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyL'];
    const log = { gameovers: 0, respawns: 0, dungeons: 0, frames: 0, maxEnemies: 0, levels: [] };
    let held = new Set();
    const places = [['meadows', 30, 86, 3], ['desert', 96, 128, 10], ['tundra', 80, 26, 16], ['woods', 134, 74, 22], ['ember', 158, 124, 30], ['pride', 160, 30, 38]];
    const tpTo = (tx, ty) => {
      const w = Game.world;
      for (let r = 0; r < 25; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (w.walkableTile(tx + dx, ty + dy) && w.reach[w.idx(tx + dx, ty + dy)] && w.walkableTile(tx + dx + 1, ty + dy)) {
          Game.players.forEach((p, i) => { p.x = (tx + dx) * TS + 16 + i * 20; p.y = (ty + dy) * TS + 20; });
          Game.cam.x = Game.players[0].x; Game.cam.y = Game.players[0].y; return;
        }
      }
    };
    let phase = 0;
    for (let f = 0; f < 14000; f++) {
      // change place every 1500 frames
      if (f % 1500 === 0) {
        if (Game.scene !== 'play') { /* handled below */ }
        else if (Game.dungeon) { Game.exitDungeon(); }
        else {
          const k = phase++ % (places.length + 2);
          if (k < places.length) {
            const [, tx, ty, lv] = places[k];
            st.level = lv; Game.players.forEach(p => { p.refresh(false); p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; p.down = false; });
            tpTo(tx, ty);
          } else {
            const def = DUNGEONS[(phase * 5) % DUNGEONS.length];
            st.level = def.level + 2; st.barrier = false;
            Game.players.forEach(p => { p.refresh(false); p.hp = p.stats.maxHp; p.down = false; });
            Game.enterDungeon(def); log.dungeons++;
          }
        }
      }
      // random inputs
      if (Math.random() < 0.08) {
        for (const k of held) Input.down.delete(k);
        held.clear();
        const a = keysA[Math.floor(Math.random() * 4)], b = keysB[Math.floor(Math.random() * 4)];
        held.add(a); held.add(b);
        if (Math.random() < 0.5) { held.add(keysA[Math.floor(Math.random() * 4)]); }
        for (const k of held) Input.down.add(k);
      }
      if (Math.random() < 0.15) { const k = keysA[4 + Math.floor(Math.random() * 7)]; Input.pressed.add(k); }
      if (Math.random() < 0.15) { const k = keysB[4 + Math.floor(Math.random() * 7)]; Input.pressed.add(k); }
      // occasionally head into the boss room in dungeons
      if (Game.dungeon && f % 1500 === 700) {
        const B = Game.dungeon.bossRoom;
        Game.players.forEach((p, i) => { p.x = B.cx * TS + 16 + i * 20; p.y = (B.y + B.h - 2) * TS; });
      }
      // keep the party alive-ish but allow some downs
      if (f % 400 === 0) Game.players.forEach(p => { if (!p.down) p.hp = Math.max(p.hp, p.stats.maxHp * 0.6); p.mp = p.stats.maxMp; });
      // close dialogs / menus opened by random interactions
      if (Game.overlays.length && Math.random() < 0.3) Input.pressed.add(Math.random() < 0.5 ? 'Enter' : 'Escape');
      Game.step(1, 1 / 60, f % 7 === 0);
      log.frames++;
      log.maxEnemies = Math.max(log.maxEnemies, Game.enemies.length);
      if (Game.scene === 'gameover') {
        log.gameovers++;
        const s = Game.sceneObj; s.t = 2; s.sel = 0; Input.pressed.add('Enter'); Game.step(2);
        let g = 0; while (Game.scene !== 'play' && g++ < 200) Game.step(1);
        log.respawns++;
      }
      if (Game.lastError) { log.err = String(Game.lastError); break; }
    }
    for (const k of held) Input.down.delete(k);
    // performance: world with lots of enemies
    const t0 = performance.now();
    for (let i = 0; i < 240; i++) { Game.step(1, 1 / 60, true); }
    log.msPerFrameWorld = +((performance.now() - t0) / 240).toFixed(2);
    log.scene = Game.scene;
    return log;
  });
  console.log(JSON.stringify(res));
  console.log('ERRORS:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close(); srv.close();
  process.exit(errors.length || res.err ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
