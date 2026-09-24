// Full automated playthrough: validates world, every dungeon, every boss, quests,
// shops/menus, save/load and the ending. Usage: node tests/playthrough.js [outDir]
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.PW_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript' };
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
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  const shot = async (name) => { await page.evaluate(() => Game.render()); await page.screenshot({ path: path.join(OUT, name + '.png') }); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  let fails = 0;
  const check = (cond, msg) => { if (!cond) { fails++; console.log('FAIL:', msg); } };

  // ---------- setup helpers inside the page ----------
  await ev(() => {
    localStorage.clear();
    Game.manual = true;
    window.QA = {
      press(code) { Input.pressed.add(code); Input.down.add(code); },
      release(code) { Input.down.delete(code); },
      step(n, render) { Game.step(n, 1 / 60, !!render); },
      closeOverlays(max = 400) {
        let guard = 0;
        while (Game.overlays.length && guard++ < max) { Input.pressed.add('Enter'); Game.step(8); }
        return Game.overlays.length === 0;
      },
      tp(x, y) { const p = Game.players[0]; p.x = x; p.y = y; Game.cam.x = x; Game.cam.y = y; if (Game.players[1]) { Game.players[1].x = x + 20; Game.players[1].y = y; } },
      waitFade() { let g = 0; while (Game.fade && g++ < 400) Game.step(1); },
    };
  });

  // ---------- world validation ----------
  const worldRes = await ev(() => {
    const w = Game.world, out = [];
    const reach = (tx, ty) => w.inb(tx, ty) && w.reach[w.idx(tx, ty)];
    for (const d of DUNGEONS) if (!reach(d.tx, d.ty + 1)) out.push('entrance unreachable ' + d.id);
    for (const c of w.chests) { let ok = false; for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (reach(c.tx + dx, c.ty + dy)) ok = true; if (!ok) out.push('chest unreachable ' + c.id); }
    for (const s of w.npcSpots) if (!reach(Math.floor(s.x / TS), Math.floor(s.y / TS))) out.push('npc unreachable ' + s.npc.id);
    for (const b of w.buildings) if (b.door && !reach(Math.floor(b.door.x / TS), Math.floor(b.door.y / TS))) out.push('door unreachable ' + b.town + ' ' + b.kind);
    for (const k in w.gotoSpots) { const g = w.gotoSpots[k]; if (!reach(Math.floor(g.x / TS), Math.floor(g.y / TS))) out.push('goto unreachable ' + k); }
    const regionCount = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < w.region.length; i++) if (w.reach[i]) regionCount[w.region[i]]++;
    return { out, chests: w.chests.length, tiers: w.chests.map(c => c.tier).join(''), regionCount, props: w.props.length };
  });
  console.log('world:', JSON.stringify(worldRes));
  check(worldRes.out.length === 0, 'world reachability: ' + worldRes.out.join(', '));

  // ---------- dungeon validation ----------
  const dgRes = await ev(() => {
    const out = [];
    for (const def of DUNGEONS) {
      const d = new Dungeon(def);
      const seen = new Uint8Array(d.w * d.h);
      const sx = Math.floor(d.start.x / TS), sy = Math.floor(d.start.y / TS);
      const st = [[sx, sy]]; seen[sy * d.w + sx] = 1;
      while (st.length) {
        const [x, y] = st.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (!d.inb(nx, ny)) continue;
          const t = d.tile(nx, ny); if (!(t === DT.FLOOR || t === DT.GATE)) continue;
          const i = ny * d.w + nx; if (seen[i]) continue; seen[i] = 1; st.push([nx, ny]);
        }
      }
      const ok = (px, py) => seen[Math.floor(py / TS) * d.w + Math.floor(px / TS)];
      if (!ok(d.bossSpawn.x, d.bossSpawn.y)) out.push(def.id + ': boss unreachable');
      if (d.tile(Math.floor(d.start.x / TS), Math.floor(d.start.y / TS)) !== DT.FLOOR) out.push(def.id + ': start not floor');
      for (const c of d.chests) if (!ok(c.x, c.y - 10)) out.push(def.id + ': chest unreachable ' + c.id);
      for (const s of d.spawns) if (!ok(s.x, s.y)) out.push(def.id + ': spawn bad');
      if (d.gateTiles.length === 0) out.push(def.id + ': no gate');
      if (d.rooms.length !== def.rooms) out.push(def.id + `: rooms ${d.rooms.length}/${def.rooms}`);
      if (d.chests.length !== def.chests.length) out.push(def.id + ': chest count');
    }
    return out;
  });
  console.log('dungeon validation issues:', dgRes.length ? dgRes : 'none');
  check(dgRes.length === 0, 'dungeon validation');

  // ---------- start a 1P game ----------
  await ev(() => { Game.startGame([{ breed: 'retriever', device: 'any' }], null); QA.step(30); });
  await shot('pt_01_start');

  // talk-to helper, kill-quest helper, clear dungeon helper
  await ev(() => {
    QA.talk = (npcId) => {
      const n = Game.npcs.find(n => n.id === npcId);
      QA.tp(n.x, n.y + 30); QA.step(5);
      const p = Game.players[0];
      const it = Game.findInteractable(p);
      if (!it || it.kind !== 'npc' || it.npc.id !== npcId) { Game.interact(p, { kind: 'npc', npc: n }); } else Game.interact(p, it);
      QA.closeOverlays();
      QA.step(10);
    };
    QA.killQuest = (qid) => {
      const q = QUESTS[qid];
      const type = q.obj.enemy || (q.obj.region != null ? REGIONS[q.obj.region].enemies[0] : 'kitten');
      const region = q.obj.region != null ? q.obj.region : 0;
      let guard = 0;
      while (Game.questActive(qid) && guard++ < 400) {
        const p = Game.players[0];
        const e = new Enemy(type, 3, p.x + 60, p.y, { region });
        Game.enemies.push(e);
        Game.damageEnemy(e, 1e9, {});
        QA.step(2);
      }
      QA.step(60);
      return !Game.questActive(qid);
    };
    QA.clearDungeon = (id, opts = {}) => {
      const def = DUNGEON_BY_ID[id];
      const st = Game.state;
      if (st.level < def.level) { st.level = def.level; st.xp = 0; Game.players.forEach(p => p.refresh(false)); }
      Game.godMode = !opts.noGod;
      Game.enterDungeon(def);
      QA.waitFade(); QA.step(20);
      const log = { id, entered: Game.dungeon && Game.dungeon.def.id === id };
      const dg = Game.dungeon;
      if (!dg) return log;
      log.enemies = Game.enemies.length;
      // walk-in test: move player a bit to wake monsters
      QA.press('KeyD'); QA.step(30); QA.release('KeyD');
      for (const e of Game.enemies.slice()) Game.damageEnemy(e, 1e9, {});
      QA.step(60);
      // go to boss room
      const B = dg.bossRoom;
      QA.tp((B.cx) * TS + 16, (B.y + B.h - 2) * TS + 16);
      let g = 0; while (!Game.boss && g++ < 400) QA.step(1);
      log.bossSpawned = !!Game.boss;
      log.gateClosed = dg.gateClosed;
      if (opts.shot) { QA.step(90, false); }
      // let the boss fight for a while (god mode) + player attacks
      let moves = new Set();
      for (let i = 0; i < (opts.fight || 900); i++) {
        if (i % 20 === 0) QA.press('KeyJ');
        if (i % 20 === 5) QA.release('KeyJ');
        if (i % 90 === 40) QA.press('Digit1');
        if (i % 90 === 45) QA.release('Digit1');
        const p = Game.players[0];
        if (Game.boss) {
          const b = Game.boss;
          // keep the player near the boss
          if (dist(p.x, p.y, b.x, b.y) > 160) { p.x = b.x + 90; p.y = b.y + 30; if (Game.collides(p.x, p.y, 8)) { p.x = b.x; p.y = b.y + 60; } }
          if (b.state === 'windup' && b.moveIdx) moves.add(b.def.moves[(b.moveIdx - 1) % b.def.moves.length]);
          if (i === (opts.fight || 900) - 300 && b.hp > b.maxHp * 0.45) b.hp = Math.floor(b.maxHp * 0.45); // force phase 2
        }
        Game.step(1);
      }
      log.moves = [...moves].join(',');
      log.phase2 = Game.boss ? Game.boss.phase2 : 'dead';
      if (Game.boss) Game.damageEnemy(Game.boss, 1e9, {});
      QA.step(120);
      log.cleared = !!st.cleared[id];
      log.gateOpen = !dg.gateClosed;
      log.reward = !!dg.rewardChest;
      if (dg.rewardChest) { Game.openChest(dg.rewardChest, true); QA.step(10); }
      let opened = 0, locked = 0;
      for (const c of dg.chests) { const before = st.chests[c.id]; Game.openChest(c, true); if (st.chests[c.id] && !before) opened++; else if (!st.chests[c.id]) locked++; }
      log.chestsOpened = opened; log.chestsLocked = locked;
      log.keys = st.keys.map(k => k ? 1 : 0).join('');
      log.seals = Object.keys(st.seals).join(',');
      if (!opts.stay) { Game.exitDungeon(); QA.waitFade(); QA.step(20); log.back = !Game.dungeon; }
      Game.godMode = false;
      return log;
    };
  });

  // ---------- main quest chain ----------
  const mainLog = [];
  for (let guard = 0; guard < 40; guard++) {
    const r = await ev(() => {
      const m = Game.currentMainQuest();
      if (!m) return { done: true };
      const q = QUESTS[m];
      const res = { m, type: q.obj.type };
      if (q.obj.type === 'talk') { QA.talk(q.obj.npc); res.ok = Game.questDone(m); }
      else if (q.obj.type === 'kill') res.ok = QA.killQuest(m);
      else if (q.obj.type === 'clear') {
        if (q.obj.dungeon === 'lions_keep') return { final: true, m };
        res.log = QA.clearDungeon(q.obj.dungeon, { fight: 700 });
        res.ok = Game.questDone(m);
      }
      return res;
    });
    if (r.done || r.final) { mainLog.push(r); break; }
    mainLog.push(r);
    if (!r.ok) { check(false, 'main quest failed ' + JSON.stringify(r)); break; }
    if (r.log) console.log('  dungeon', JSON.stringify(r.log));
    else console.log('  quest', r.m, r.type, r.ok ? 'ok' : 'FAIL');
  }
  const afterMain = await ev(() => ({ level: Game.state.level, gold: Game.state.gold, seals: Object.keys(Game.state.seals), barrier: Game.state.barrier, keys: Game.state.keys, main: Game.currentMainQuest() }));
  console.log('after main chain:', JSON.stringify(afterMain));
  check(afterMain.main === 'm14' && !afterMain.barrier && afterMain.seals.length === 4, 'main chain did not reach m14 with 4 seals');

  // ---------- side quests via boards ----------
  const side = await ev(() => {
    const out = [];
    for (const tid of TOWN_ORDER) {
      const ov = new BoardOverlay(tid);
      UI.open(ov); Game.step(2, 1 / 60, true);
      for (const q of Game.availableBoardQuests(tid)) Game.startQuest(q.id);
      UI.close(ov);
    }
    for (const id in QUESTS) { const q = QUESTS[id]; if (!q.main && !Game.state.quests[id]) out.push('not accepted ' + id); }
    return out;
  });
  console.log('side quests not accepted:', side.length ? side : 'none');
  // clear all side dungeons and complete side quests
  const sideDungeons = await ev(() => DUNGEONS.filter(d => !d.final && !Game.state.cleared[d.id]).map(d => d.id));
  for (const id of sideDungeons) {
    const log = await ev((id) => QA.clearDungeon(id, { fight: 600 }), id);
    console.log('  dungeon', JSON.stringify(log));
    check(log.cleared && log.bossSpawned && log.back, 'side dungeon ' + id);
  }
  const sideRes = await ev(() => {
    const res = [];
    for (const id in QUESTS) {
      const q = QUESTS[id];
      if (q.main || !Game.questActive(id)) continue;
      if (q.obj.type === 'kill') QA.killQuest(id);
      else if (q.obj.type === 'goto') { const s = Game.world.gotoSpots[id]; QA.tp(s.x, s.y + 20); QA.step(5); QA.closeOverlays(); QA.step(5); }
      else if (q.obj.type === 'chests') { let g = 0; for (const c of Game.world.chests) { if (!Game.questActive(id) || g++ > 60) break; QA.tp(c.x, c.y + 40); Game.openChest(c, false); QA.step(2); } }
    }
    for (const id in QUESTS) if (!QUESTS[id].main && !Game.questDone(id)) res.push(id + ':' + (Game.state.quests[id] ? Game.state.quests[id].status : 'none'));
    return res;
  });
  console.log('side quests not completed:', sideRes.length ? sideRes : 'none');
  check(sideRes.length === 0, 'side quests incomplete: ' + sideRes.join(','));

  // ---------- world chests (all keys owned now) ----------
  const chestRes = await ev(() => {
    let opened = 0, fail = 0;
    for (const c of Game.world.chests) { if (Game.state.chests[c.id]) continue; Game.openChest(c, false); if (Game.state.chests[c.id]) opened++; else fail++; }
    return { opened, fail, total: Game.state.chestsOpened, inv: Object.keys(Game.state.inv).length };
  });
  console.log('world chests:', JSON.stringify(chestRes));
  check(chestRes.fail === 0, 'world chests failed to open');

  // ---------- shops & menus rendering ----------
  const menuRes = await ev(() => {
    const out = [];
    const p = Game.players[0];
    Game.state.gold = 999999;
    QA.tp(TOWNS.pawston.tx * TS, (TOWNS.pawston.ty + 2) * TS);
    QA.step(5);
    for (const tid of TOWN_ORDER) {
      for (const kind of ['smith', 'mage']) {
        const ov = new ShopOverlay(kind, tid, p);
        UI.open(ov);
        for (let i = 0; i < 14; i++) { Input.pressed.add('Enter'); Game.step(1, 1 / 60, true); Input.pressed.add('ArrowDown'); Input.down.add('ArrowDown'); Game.step(1, 1 / 60, true); Input.down.delete('ArrowDown'); Game.step(1, 1 / 60, true); }
        if (kind === 'smith') { Input.pressed.add('KeyE'); Game.step(1, 1 / 60, true); for (let i = 0; i < 5; i++) { Input.pressed.add('Enter'); Game.step(2, 1 / 60, true); } }
        UI.close(ov);
      }
    }
    // pause menu tabs
    const po = new PauseOverlay(p);
    UI.open(po);
    for (let tab = 0; tab < 5; tab++) {
      for (let i = 0; i < 3; i++) { Input.pressed.add('ArrowDown'); Input.down.add('ArrowDown'); Game.step(1, 1 / 60, true); Input.down.delete('ArrowDown'); Game.step(1, 1 / 60, true); }
      if (tab < 2) { Input.pressed.add('Enter'); Game.step(1, 1 / 60, true); Input.pressed.add('ArrowDown'); Input.down.add('ArrowDown'); Game.step(1, 1 / 60, true); Input.down.delete('ArrowDown'); Input.pressed.add('Enter'); Game.step(1, 1 / 60, true); }
      Input.pressed.add('KeyE'); Game.step(1, 1 / 60, true);
    }
    UI.close(po);
    out.push('spells:' + JSON.stringify(Game.state.spells));
    out.push('equip:' + JSON.stringify(p.equip));
    return out;
  });
  console.log('menus:', menuRes.join(' | '));
  await ev(() => { UI.open(new PauseOverlay(Game.players[0])); });
  await shot('pt_02_pause_equip');
  await ev(() => { Game.overlays = []; UI.open(new PauseOverlay(Game.players[0], 'map')); });
  await shot('pt_03_pause_map');
  await ev(() => { Game.overlays = []; UI.open(new ShopOverlay('smith', 'cinderpaw', Game.players[0])); });
  await shot('pt_04_shop');
  await ev(() => { Game.overlays = []; UI.open(new BoardOverlay('pawston')); });
  await shot('pt_05_board');
  await ev(() => { Game.overlays = []; });

  // ---------- save / load ----------
  const saveRes = await ev(() => {
    Game.save(true);
    const s = Game.loadSave();
    const lvl = s.level, gold = s.gold;
    Game.startGame([{ breed: 'husky', device: 'kbA' }, { breed: 'shiba', device: 'kbB' }], s);
    QA.step(30);
    return { ok: Game.state.level === lvl && Game.state.gold === gold && Game.players.length === 2, main: Game.currentMainQuest() };
  });
  console.log('save/load:', JSON.stringify(saveRes));
  check(saveRes.ok && saveRes.main === 'm14', 'save/load');

  // ---------- final boss & ending (2 players) ----------
  const fin = await ev(() => QA.clearDungeon('lions_keep', { fight: 1400, stay: true }));
  console.log('final:', JSON.stringify(fin));
  check(fin.cleared && fin.bossSpawned, 'final boss');
  const endRes = await ev(() => {
    let g = 0;
    while (Game.scene === 'play' && g++ < 900) Game.step(1);
    const s1 = Game.scene;
    g = 0;
    while (Game.scene === 'story' && g++ < 3000) { if (g % 20 === 0) Input.pressed.add('Enter'); Game.step(1, 1 / 60, g % 100 === 0); }
    const s2 = Game.scene;
    g = 0;
    while (Game.scene === 'credits' && g++ < 5000) { Input.down.add('Enter'); Game.step(1, 1 / 60, g % 200 === 0); }
    Input.down.delete('Enter');
    return { s1, s2, s3: Game.scene, finished: Game.state && Game.state.finished, main: Game.state && Game.state.quests.m14 };
  });
  console.log('ending:', JSON.stringify(endRes));
  check(endRes.s1 === 'story' && endRes.s2 === 'credits' && endRes.s3 === 'title', 'ending flow');

  const lastErr = await ev(() => String(Game.lastError || ''));
  if (lastErr) errors.push('Game.lastError: ' + lastErr);
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
  await browser.close();
  srv.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
