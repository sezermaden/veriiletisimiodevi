// Visual gallery: renders many game situations to PNG for manual review.
// Usage: node tests/visual.js [outDir]
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.PW_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'out');
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
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { await ev(() => Game.render()); await page.screenshot({ path: path.join(OUT, name + '.png') }); };
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = n => !only || only.some(o => n.includes(o));

  await ev(() => {
    localStorage.clear();
    Game.manual = true;
    window.QA = {
      tp(x, y) { Game.players.forEach((p, i) => { p.x = x + i * 30; p.y = y; }); Game.cam.x = x; Game.cam.y = y; },
    };
    Game.startGame([{ breed: 'retriever', device: 'kbA' }, { breed: 'husky', device: 'kbB' }], null);
    Game.step(20);
  });

  // regions with combat
  const spots = [['meadows', 30, 86], ['desert', 96, 128], ['tundra', 80, 26], ['woods', 134, 74], ['ember', 158, 124], ['pride', 160, 30]];
  for (const [name, tx, ty] of spots) {
    if (!want('region_' + name)) continue;
    await ev(([tx, ty]) => {
      const w = Game.world;
      // find walkable spot near
      let bx = tx, by = ty;
      outer: for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (w.walkableTile(tx + dx, ty + dy) && w.walkableTile(tx + dx + 1, ty + dy)) { bx = tx + dx; by = ty + dy; break outer; } }
      QA.tp(bx * TS + 16, by * TS + 20);
      Game.enemies = [];
      const reg = REGIONS[w.regionAtTile(bx, by)];
      Game.state.level = reg.lv[0];
      Game.players.forEach(p => p.refresh(false));
      Game.godMode = true;
      reg.enemies.forEach((t, i) => { const e = new Enemy(t, reg.lv[0], bx * TS + 16 + 110 + i * 50, by * TS + 20 + (i % 2 ? -50 : 50), { region: reg.id }); e.aggro = true; Game.enemies.push(e); });
      Game.regionId = -1; Game.townId = null;
      for (let i = 0; i < 70; i++) { if (i === 30) { Input.pressed.add('Space'); } Game.step(1); }
    }, [tx, ty]);
    await shot('region_' + name);
  }

  // cat bestiary lineup
  if (want('bestiary')) {
    await ev(() => {
      Game.enemies = [];
      const ids = Object.keys(ENEMIES);
      const s = Game.world.gotoSpots.s_puppy;
      QA.tp(s.x, s.y);
      Game.step(2);
    });
    await ev(() => {
      const c = Game.ctx;
      c.setTransform(Game.pixelScale, 0, 0, Game.pixelScale, 0, 0);
      c.fillStyle = '#6cb04a'; c.fillRect(0, 0, 960, 540);
      const ids = Object.keys(ENEMIES);
      ids.forEach((id, i) => {
        const x = 70 + (i % 7) * 135, y = 130 + Math.floor(i / 7) * 170;
        drawCat(c, { x, y, facing: 1, t: 1 + i, def: ENEMIES[id], scale: 1.6, move: 0 });
        uiText(c, ENEMIES[id].name, x, y + 26, 12, '#fff', 'center');
      });
      Game.manualFrame = true;
    });
    await page.screenshot({ path: path.join(OUT, 'bestiary.png') });
  }
  if (want('bosses')) {
    await ev(() => {
      const c = Game.ctx;
      c.setTransform(Game.pixelScale, 0, 0, Game.pixelScale, 0, 0);
      c.fillStyle = '#5a5a66'; c.fillRect(0, 0, 960, 540);
      const ids = Object.keys(BOSSES);
      ids.forEach((id, i) => {
        const b = BOSSES[id];
        const def = Object.assign({}, ENEMIES[b.base], b, { id: b.base });
        const x = 60 + (i % 8) * 118, y = 150 + Math.floor(i / 8) * 175;
        drawCat(c, { x, y, facing: 1, t: 1 + i, def, scale: b.lion ? 1.6 : 1.1, move: 0 });
        uiText(c, b.name, x, y + 22, 10, '#fff', 'center');
      });
    });
    await page.screenshot({ path: path.join(OUT, 'bosses.png') });
  }
  if (want('gear')) {
    await ev(() => {
      const c = Game.ctx;
      c.setTransform(Game.pixelScale, 0, 0, Game.pixelScale, 0, 0);
      c.fillStyle = '#2c3350'; c.fillRect(0, 0, 960, 540);
      const ids = Object.keys(ITEMS);
      ids.forEach((id, i) => {
        const x = 40 + (i % 12) * 78, y = 40 + Math.floor(i / 12) * 90;
        drawItemIcon(c, ITEMS[id], x, y, 40, 0);
        uiText(c, ITEMS[id].name, x, y + 36, 9, TIER_COLORS[ITEMS[id].tier], 'center');
      });
      SPELL_ORDER.forEach((id, i) => { drawSpellIcon(c, id, 60 + i * 110, 470, 44, 0); uiText(c, SPELLS[id].name, 60 + i * 110, 510, 11, '#fff', 'center'); });
      for (let k = 1; k <= 5; k++) drawChest(c, 800 + (k - 1) * 30, 380, k, false, 0, false);
    });
    await page.screenshot({ path: path.join(OUT, 'gear.png') });
  }
  if (want('dogs')) {
    await ev(() => {
      const c = Game.ctx;
      c.setTransform(Game.pixelScale, 0, 0, Game.pixelScale, 0, 0);
      c.fillStyle = '#6cb04a'; c.fillRect(0, 0, 960, 540);
      BREED_ORDER.forEach((b, i) => {
        const B = BREEDS[b];
        const eqs = [
          { weapon: ITEMS[B.start.weapon], helmet: B.start.helmet ? ITEMS[B.start.helmet] : null, armor: B.start.armor ? ITEMS[B.start.armor] : null },
          { weapon: ITEMS.claymore, helmet: ITEMS.knight_helm, armor: ITEMS.knight_armor },
          { weapon: ITEMS.arch_staff, helmet: ITEMS.archmage_hat, armor: ITEMS.celestial_robe },
          { weapon: ITEMS.titan_hammer, helmet: ITEMS.dragon_helm, armor: ITEMS.paladin_plate },
        ];
        eqs.forEach((eq, k) => {
          const x = 90 + k * 230, y = 110 + i * 125;
          drawDog(c, { x, y, facing: 1, t: 1.2 + i, look: B, equip: eq, scale: 1.8, move: 0, attack: k === 3 ? 0.5 : -1 });
        });
      });
    });
    await page.screenshot({ path: path.join(OUT, 'dogs.png') });
  }

  // dungeons of each theme with boss fights
  const dgs = ['puppy_cave', 'whisker_hollow', 'sphinx_tomb', 'frozen_den', 'shadow_grove', 'magma_lair', 'mousetrap_mine', 'catnip_cellar', 'mirage_temple', 'lions_keep'];
  for (const id of dgs) {
    if (!want('dungeon_' + id)) continue;
    await ev((id) => {
      const def = DUNGEON_BY_ID[id];
      Game.state.barrier = false;
      Game.state.level = def.level;
      Game.players.forEach(p => { p.refresh(false); p.hp = p.stats.maxHp; });
      Game.godMode = true;
      Game.overlays = [];
      Game.enterDungeon(def);
      let g = 0; while (Game.fade && g++ < 300) Game.step(1);
      // move into the 2nd room to see enemies
      const dg = Game.dungeon;
      const r = dg.rooms[1];
      QA.tp(r.cx * TS, r.cy * TS + 40);
      Game.step(60);
    }, id);
    await shot('dungeon_' + id + '_room');
    await ev(() => {
      const dg = Game.dungeon;
      for (const e of Game.enemies.slice()) Game.damageEnemy(e, 1e9, {});
      Game.step(40);
      const B = dg.bossRoom;
      QA.tp(B.cx * TS + 16, (B.y + B.h - 3) * TS);
      let g = 0; while (!Game.boss && g++ < 300) Game.step(1);
      // fight until a telegraph is visible
      g = 0; while (g++ < 600) { Game.step(1); if (Game.telegraphs.length && g > 150) break; }
      Game.step(20);
    });
    await shot('dungeon_' + id + '_boss');
    await ev(() => { if (Game.boss) Game.damageEnemy(Game.boss, 1e9, {}); Game.step(150); });
    await shot('dungeon_' + id + '_victory');
    await ev(() => { Game.exitDungeon(); let g = 0; while (Game.fade && g++ < 300) Game.step(1); Game.step(10); });
  }

  // intro & ending slides
  if (want('story')) {
    for (let i = 0; i < 5; i++) {
      await ev((i) => { const s = new StoryScene(INTRO_SLIDES, 'intro', () => {}, [{ breed: 'retriever' }, { breed: 'husky' }]); Game.setScene(s); s.i = i; s.chars = 999; s.st = 5; }, i);
      await shot('story_intro_' + i);
    }
    for (let i = 0; i < 4; i++) {
      await ev((i) => { const s = new StoryScene(ENDING_SLIDES, 'ending'); Game.setScene(s); s.i = i; s.chars = 999; s.st = 5; }, i);
      await shot('story_end_' + i);
    }
    await ev(() => { const s = new GameOverScene(); Game.setScene(s); s.t = 2; });
    await shot('gameover');
    await ev(() => { const s = new CreditsScene(true); Game.setScene(s); s.t = 8; });
    await shot('credits');
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
