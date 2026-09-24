// Balance probe: a simple bot plays with realistic gear/levels and reports
// survival, kill speed and boss fight duration. Usage: node tests/balance.js
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
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    Game.manual = true;
    const orig = Input.state.bind(Input);
    const blank = { mx: 0, my: 0, attack: false, attackHeld: false, roll: false, interact: false, spell: [false, false, false, false], pause: false, map: false };
    window.BOT = { inp: blank, skill: 0.85 };
    Input.state = d => (d === 'bot' ? BOT.inp : orig(d));
    BOT.think = (p) => {
      const inp = { mx: 0, my: 0, attack: false, attackHeld: false, roll: false, interact: false, spell: [false, false, false, false], pause: false, map: false };
      if (p.down) return inp;
      // dodge
      for (const tt of Game.telegraphs) {
        if (tt.friendly || tt.cancel || tt.noDamage) continue;
        if (tt.t < tt.dur * 0.35 || tt.t > tt.dur) continue;
        if (!Game.inTele(tt, p.x, p.y - 6, p.r + 10)) continue;
        if (Math.random() > BOT.skill) continue;
        let a = angleTo(tt.x, tt.y, p.x, p.y);
        if (tt.kind === 'line') a = tt.angle + Math.PI / 2;
        inp.mx = Math.cos(a); inp.my = Math.sin(a);
        if (p.rollCd <= 0 && p.state !== 'roll') inp.roll = true;
        return inp;
      }
      const e = Game.nearestEnemy(p.x, p.y, 1400);
      if (!e) return inp;
      const d = dist(p.x, p.y, e.x, e.y);
      const a = angleTo(p.x, p.y, e.x, e.y);
      if (d > p.stats.wtype.range * 0.8 + e.r) { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
      else { inp.attack = Math.random() < 0.5; if (Math.abs(Math.cos(a)) > 0.2) inp.mx = Math.cos(a) * 0.01; }
      if (p.mp > 40 && Math.random() < 0.03) inp.spell[0] = true;
      if (p.hp < p.stats.maxHp * 0.4 && p.spells[1] && Math.random() < 0.05) inp.spell[1] = true;
      return inp;
    };
    BOT.run = (frames, stop) => {
      const p = Game.players[0];
      const stat = { deaths: 0, kills0: Game.state.kills, minHp: 100 };
      for (let f = 0; f < frames; f++) {
        BOT.inp = BOT.think(p);
        Game.step(1);
        stat.minHp = Math.min(stat.minHp, Math.round(p.hp / p.stats.maxHp * 100));
        if (stop && stop()) { stat.frames = f; return stat; }
        if (Game.scene === 'gameover') {
          stat.deaths++;
          Game.respawn(); Game.step(5);
          return Object.assign(stat, { frames: f });
        }
      }
      stat.frames = frames;
      return stat;
    };
    BOT.setup = (breed, level, gear, spells) => {
      Game.startGame([{ breed, device: 'bot' }], null);
      const st = Game.state;
      st.level = level; st.xp = 0;
      const p = Game.players[0];
      for (const k in gear) { if (gear[k]) st.inv[gear[k]] = 1; p.equip[k] = gear[k]; }
      p.spells = spells;
      for (const s of spells) if (s) st.spells[s] = Math.max(1, Math.ceil(level / 6));
      p.refresh(false);
      Game.step(5);
      return p;
    };
  });

  // 1) early meadows: level 1-3 retriever, starting gear, fights world cats for 3 minutes
  const early = await page.evaluate(() => {
    const out = [];
    for (const breed of BREED_ORDER) {
      const p = BOT.setup(breed, 2, Object.assign({}, BREEDS[breed].start), ['flame', 'heal', null, null]);
      const t = Game.world.gotoSpots.s_puppy;
      p.x = TOWNS.pawston.tx * TS - 16 * TS; p.y = TOWNS.pawston.ty * TS;
      Game.cam.x = p.x; Game.cam.y = p.y;
      const r = BOT.run(60 * 180);
      out.push({ breed, level: Game.state.level, kills: Game.state.kills - r.kills0, deaths: r.deaths, minHp: r.minHp + '%', secs: Math.round(r.frames / 60) });
    }
    return out;
  });
  console.log('EARLY meadows (3 min each):');
  early.forEach(r => console.log('  ', JSON.stringify(r)));

  // 2) bosses with appropriate level/gear
  const bosses = await page.evaluate(() => {
    const plan = [
      ['puppy_cave', 3, { weapon: 'wood_sword', helmet: 'leather_cap', armor: 'leather_vest' }],
      ['whisker_hollow', 6, { weapon: 'iron_sword', helmet: 'leather_cap', armor: 'leather_vest' }],
      ['sphinx_tomb', 13, { weapon: 'bone_axe', helmet: 'iron_helm', armor: 'chainmail' }],
      ['frozen_den', 20, { weapon: 'steel_blade', helmet: 'horned_helm', armor: 'iron_plate' }],
      ['shadow_grove', 27, { weapon: 'steel_blade', helmet: 'knight_helm', armor: 'knight_armor' }],
      ['magma_lair', 34, { weapon: 'claymore', helmet: 'knight_helm', armor: 'ember_plate' }],
      ['lions_keep', 42, { weapon: 'sun_sword', helmet: 'dragon_helm', armor: 'paladin_plate' }],
    ];
    const out = [];
    for (const [id, lvl, gear] of plan) {
      const p = BOT.setup('retriever', lvl, gear, ['flame', 'heal', 'thunder', null]);
      Game.state.barrier = false;
      Game.enterDungeon(DUNGEON_BY_ID[id]);
      let g = 0; while (Game.fade && g++ < 300) Game.step(1);
      for (const e of Game.enemies.slice()) Game.damageEnemy(e, 1e9, {});
      Game.step(30);
      const B = Game.dungeon.bossRoom;
      p.x = B.cx * TS + 16; p.y = (B.y + B.h - 2) * TS;
      g = 0; while (!Game.boss && g++ < 300) Game.step(1);
      const boss = Game.boss;
      const r = BOT.run(60 * 240, () => boss.dead);
      out.push({ id, lvl, bossHp: boss.maxHp, bossLeft: Math.round(Math.max(0, boss.hp) / boss.maxHp * 100) + '%', won: boss.dead, deaths: r.deaths, secs: Math.round(r.frames / 60), minHp: r.minHp + '%' });
      if (Game.dungeon) { Game.exitDungeon(); let q = 0; while (Game.fade && q++ < 300) Game.step(1); }
    }
    return out;
  });
  console.log('BOSSES (bot, 4 min limit):');
  bosses.forEach(r => console.log('  ', JSON.stringify(r)));
  console.log('ERRORS:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
