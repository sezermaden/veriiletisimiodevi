// Gameplay gallery: two bot-controlled dogs fight in every region, dungeons and boss
// arenas; screenshots are taken mid-action. Usage: node tests/gallery.js [outDir]
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.PW_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'out', 'gallery');
fs.mkdirSync(OUT, { recursive: true });

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  await page.waitForTimeout(1500); // web font
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { await ev(() => { Game.resize(); Game.render(); }); await page.locator('#game').screenshot({ path: path.join(OUT, name + '.png') }); console.log('saved', name); };

  await ev(() => {
    localStorage.clear();
    Game.manual = true;
    const blank = () => ({ mx: 0, my: 0, attack: false, attackHeld: false, roll: false, interact: false, spell: [false, false, false, false], pause: false, map: false });
    const orig = Input.state.bind(Input);
    window.G2 = { inp: { bot0: blank(), bot1: blank() } };
    Input.state = d => (d === 'bot0' || d === 'bot1' ? G2.inp[d] : orig(d));
    G2.think = (p, k) => {
      const inp = blank();
      if (p.down) return inp;
      for (const tt of Game.telegraphs) {
        if (tt.friendly || tt.cancel || tt.noDamage || tt.t < tt.dur * 0.5) continue;
        if (!Game.inTele(tt, p.x, p.y - 6, p.r + 6) || Math.random() > 0.7) continue;
        const a = tt.kind === 'line' ? tt.angle + Math.PI / 2 : angleTo(tt.x, tt.y, p.x, p.y);
        inp.mx = Math.cos(a); inp.my = Math.sin(a);
        if (p.rollCd <= 0 && p.state !== 'roll') inp.roll = true;
        return inp;
      }
      const e = Game.nearestEnemy(p.x, p.y, 900);
      if (!e) return inp;
      const d = dist(p.x, p.y, e.x, e.y), a = angleTo(p.x, p.y, e.x, e.y);
      const want = p.breed === 'husky' ? 150 : p.stats.wtype.range * 0.8 + e.r;
      if (d > want) { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
      else if (p.breed === 'husky' && d < 90) { inp.mx = -Math.cos(a); inp.my = -Math.sin(a); }
      else { inp.attack = p.breed !== 'husky' && Math.random() < 0.5; inp.mx = Math.cos(a) * 0.01; }
      if (p.mp > 45 && Math.random() < (p.breed === 'husky' ? 0.08 : 0.025)) inp.spell[Math.floor(Math.random() * 3)] = true;
      return inp;
    };
    G2.run = (frames, until) => {
      for (let f = 0; f < frames; f++) {
        Game.players.forEach((p, i) => { G2.inp['bot' + i] = G2.think(p, i); });
        Game.step(1);
        if (until && f > 30 && until()) return f;
      }
      return frames;
    };
    G2.clean = () => { Game.banner = null; Game.bannerQueue = []; Game.itemGet = null; Game.toasts = []; };
    G2.action = (minAlive = 1) => Game.telegraphs.some(t => !t.friendly && t.t > t.dur * 0.35 && t.t < t.dur * 0.9) && Game.particles.list.length > 20 && Game.texts.length > 0 && Game.texts.length < 6
      && Game.enemies.filter(e => !e.dead).length >= minAlive && Game.enemies.every(e => e.flashT <= 0 || e.dead) && !Game.texts.some(t => t.text === 'ENRAGED!');
    G2.quest = (id, prog) => {
      const st = Game.state;
      for (const q of MAIN_ORDER) { if (q === id) break; st.quests[q] = { status: 'done', progress: 0 }; }
      st.quests[id] = { status: 'active', progress: prog || 0 };
      for (const q of MAIN_ORDER.slice(MAIN_ORDER.indexOf(id) + 1)) delete st.quests[q];
    };
    G2.gear = (lvl) => {
      const t = Math.min(5, Math.max(1, Math.ceil(lvl / 9)));
      const pick = (slot, type) => Object.values(ITEMS).filter(it => it.slot === slot && it.tier === t && !it.chestOnly && (!type || it.type === type))[0];
      Game.players.forEach(p => {
        const st = Game.state;
        const w = p.breed === 'husky' ? pick('weapon', 'staff') : p.breed === 'shiba' ? pick('weapon', 'dagger') : p.breed === 'bulldog' ? (pick('weapon', 'hammer') || pick('weapon', 'axe') || pick('weapon', 'sword')) : pick('weapon', 'sword');
        const h = Object.values(ITEMS).filter(it => it.slot === 'helmet' && it.tier === t && !it.chestOnly)[p.pid % 2];
        const a = Object.values(ITEMS).filter(it => it.slot === 'armor' && it.tier === t && !it.chestOnly)[p.breed === 'husky' ? 2 : 0] || Object.values(ITEMS).filter(it => it.slot === 'armor' && it.tier === t)[0];
        for (const it of [w, h, a]) if (it) { st.inv[it.id] = 1; p.equip[it.slot] = it.id; }
        p.refresh(false); p.hp = p.stats.maxHp; p.mp = p.stats.maxMp;
      });
    };
    G2.setup = (lvl) => {
      Game.state.level = lvl; Game.state.xp = Math.floor(xpForLevel(lvl) * 0.4);
      for (const id of SPELL_ORDER) Game.state.spells[id] = Math.max(1, Math.ceil(lvl / 5));
      Game.players[0].spells = ['flame', 'thunder', 'heal', 'quake'];
      Game.players[1].spells = ['frost', 'flame', 'spirit', 'shield'];
      if (lvl >= 30) Game.players[0].spells[3] = 'meteor';
      G2.gear(lvl);
      Game.state.gold = 120 + lvl * 400;
    };
    Game.startGame([{ breed: 'retriever', device: 'bot0' }, { breed: 'husky', device: 'bot1' }], null);
    Game.overlays = [];
    Game.step(5);
  });

  // ---- town start ----
  await ev(() => { G2.setup(1); G2.quest('m1'); const t = TOWNS.pawston; Game.players[0].x = t.tx * TS + 40; Game.players[0].y = (t.ty + 1) * TS; Game.players[1].x = t.tx * TS + 90; Game.players[1].y = (t.ty + 1) * TS + 10; Game.cam.x = t.tx * TS + 60; Game.cam.y = t.ty * TS; Game.step(200); });
  await shot('01_pawston_town');

  // ---- regions ----
  const regions = [['02_meadows', 30, 86, 4, 'm3'], ['03_desert', 100, 124, 12, 'm6'], ['04_tundra', 90, 24, 18, 'm8'], ['05_whisker_woods', 138, 76, 25, 'm10'], ['06_ember_wastes', 164, 126, 33, 'm12'], ['07_pride_lands', 164, 34, 40, 'm14']];
  for (const [name, tx, ty, lvl, qid] of regions) {
    await ev(([tx, ty, lvl, qid]) => {
      G2.quest(qid, qid === 'm3' ? 6 : 0);
      const w = Game.world;
      let bx = tx, by = ty;
      outer: for (let r = 0; r < 25; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [2, 0], [3, 0], [4, 0]].every(([a, b]) => w.walkableTile(tx + dx + a, ty + dy + b));
        if (ok && w.reach[w.idx(tx + dx, ty + dy)]) { bx = tx + dx; by = ty + dy; break outer; }
      }
      G2.setup(lvl);
      Game.players.forEach((p, i) => { p.x = bx * TS + 16 - i * 40; p.y = by * TS + 20 + i * 18; p.down = false; });
      Game.cam.x = bx * TS; Game.cam.y = by * TS;
      Game.enemies = []; Game.telegraphs = []; Game.projectiles = []; Game.loot = [];
      Game.regionId = -1; Game.townId = null;
      const reg = REGIONS[w.regionAtTile(bx, by)];
      const types = reg.enemies.concat(reg.enemies).slice(0, 8);
      types.forEach((t, i) => {
        const a = i / types.length * Math.PI * 2;
        const e = new Enemy(t, lvl + 4, bx * TS + 16 + Math.cos(a) * 190, by * TS + 20 + Math.sin(a) * 120, { region: reg.id });
        if (Game.map.isSolid(e.x, e.y)) { e.x = bx * TS + 150 + i * 6; e.y = by * TS + 20; }
        e.aggro = true; e.atkCd = 0.4 + i * 0.3; Game.enemies.push(e);
      });
      Game.spawnT = 999;
      Game.godMode = true;
      G2.run(20); G2.clean();
      G2.run(500, () => G2.action(4));
      G2.clean();
    }, [tx, ty, lvl, qid]);
    await shot(name);
  }

  // ---- dungeons: a room brawl, then boss fights ----
  const dungeons = [['08_dungeon_puppy_cave', 'puppy_cave', 3], ['10_dungeon_frozen_den', 'frozen_den', 20], ['12_dungeon_magma_lair', 'magma_lair', 34]];
  const bossShots = { puppy_cave: '09_boss_big_tom', frozen_den: '11_boss_tsarina_frostwhisk', magma_lair: '13_boss_infernus' };
  for (const [name, id, lvl] of dungeons) {
    await ev(([id, lvl]) => {
      G2.setup(lvl);
      G2.quest({ puppy_cave: 'm2', frozen_den: 'm8', magma_lair: 'm12' }[id]);
      Game.godMode = true;
      Game.enterDungeon(DUNGEON_BY_ID[id]);
      let g = 0; while (Game.fade && g++ < 300) Game.step(1);
      const dg = Game.dungeon;
      const r = dg.rooms.filter(r => r.i !== 0 && r !== dg.bossRoom).sort((a, b) => b.w * b.h - a.w * a.h)[0];
      Game.players.forEach((p, i) => { p.x = r.cx * TS + 16 - i * 36; p.y = (r.cy + 2) * TS; });
      Game.cam.x = r.cx * TS; Game.cam.y = r.cy * TS;
      for (const e of Game.enemies) if (!e.dead) { e.maxHp *= 3; e.hp = e.maxHp; }
      G2.run(120); G2.clean(); G2.run(480, () => G2.action(2)); G2.clean();
    }, [id, lvl]);
    await shot(name);
    await ev(() => {
      const dg = Game.dungeon;
      for (const e of Game.enemies.slice()) Game.damageEnemy(e, 1e9, {});
      Game.step(60);
      const B = dg.bossRoom;
      Game.players.forEach((p, i) => { p.x = B.cx * TS + 16 - i * 40; p.y = (B.y + B.h - 3) * TS; });
      let g = 0; while (!Game.boss && g++ < 300) Game.step(1);
      G2.run(60);
      if (Game.boss) { Game.boss.maxHp *= 8; Game.boss.hp = Math.floor(Game.boss.maxHp * 0.47); }
      G2.run(200); G2.clean();
      G2.run(900, () => G2.action() && Game.boss && Game.boss.state === 'windup' && Game.boss.flashT <= 0);
      G2.clean();
    });
    await shot(bossShots[id]);
    if (id === 'magma_lair') {
      await ev(() => { if (Game.boss) Game.damageEnemy(Game.boss, 1e9, { crit: true }); Game.itemGet = null; G2.run(170); });
      await shot('14_victory_reward');
    }
    await ev(() => { Game.exitDungeon(); let g = 0; while (Game.fade && g++ < 300) Game.step(1); Game.step(5); });
  }

  // ---- King Leo ----
  await ev(() => {
    G2.setup(44);
    G2.quest('m14');
    Game.state.barrier = false;
    Game.godMode = true;
    Game.enterDungeon(DUNGEON_BY_ID.lions_keep);
    let g = 0; while (Game.fade && g++ < 300) Game.step(1);
    const dg = Game.dungeon;
    for (const e of Game.enemies.slice()) Game.damageEnemy(e, 1e9, {});
    Game.step(30);
    const B = dg.bossRoom;
    Game.players.forEach((p, i) => { p.x = B.cx * TS + 16 - i * 50; p.y = (B.y + B.h - 3) * TS; });
    g = 0; while (!Game.boss && g++ < 300) Game.step(1);
    G2.run(60);
    Game.boss.maxHp *= 8; Game.boss.hp = Math.floor(Game.boss.maxHp * 0.45); // enraged phase
    G2.run(200); G2.clean();
    G2.run(1500, () => G2.action() && Game.boss.flashT <= 0 && Game.telegraphs.filter(t => !t.friendly).length >= 3 && dist(Game.players[0].x, Game.players[0].y, Game.players[1].x, Game.players[1].y) > 40);
    G2.clean();
  });
  await shot('15_final_boss_king_leo');

  // ---- menus in context ----
  await ev(() => { if (Game.scene !== 'play') Game.setScene(new PlayScene()); Game.exitDungeon(); let g = 0; while (Game.fade && g++ < 300) Game.step(1); const t = TOWNS.cinderpaw; Game.players[0].x = t.tx * TS; Game.players[0].y = (t.ty + 1) * TS; Game.players[1].x = t.tx * TS + 30; Game.players[1].y = (t.ty + 1) * TS; Game.cam.x = t.tx * TS; Game.cam.y = t.ty * TS; Game.step(30); UI.open(new ShopOverlay('smith', 'cinderpaw', Game.players[0])); Game.step(2); });
  await shot('16_blacksmith_shop');
  await ev(() => { Game.overlays = []; UI.open(new PauseOverlay(Game.players[1])); Game.step(2); });
  await shot('17_equipment_menu');
  await ev(() => { Game.overlays = []; for (const k of Object.keys(Game.state.cleared).slice(0)) {} ['puppy_cave', 'whisker_hollow', 'mousetrap_mine', 'sphinx_tomb'].forEach(id => Game.state.cleared[id] = true); UI.open(new PauseOverlay(Game.players[0], 'map')); Game.step(2); });
  await shot('18_world_map');
  await ev(() => { Game.overlays = []; });

  await ev(() => { const s = new StoryScene(ENDING_SLIDES, 'ending'); Game.setScene(s); s.chars = 999; s.st = 5; s.t = 1.3; });
  await shot('19_ending_cutscene');
  await ev(() => { const s = new GameOverScene(); Game.setScene(s); s.t = 2; });
  await shot('20_game_over');
  // ---- title & character select ----
  await ev(() => { Game.setScene(new TitleScene()); Game.sceneObj.stage = 1; Game.step(200); });
  await shot('00_title');
  await ev(() => { const s = new SelectScene('kbB', null); Game.setScene(s); s.slots[1].joined = true; s.slots[1].device = 'kbA'; s.slots[1].cursor = 1; s.slots[0].cursor = 0; s.slots[0].locked = true; Game.step(40); });
  await shot('00b_character_select');

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
