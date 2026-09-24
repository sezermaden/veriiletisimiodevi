// ============================================================
// Dog Quest - core game: loop, state, combat, systems, rendering
// ============================================================
'use strict';

const SAVE_KEY = 'dogquest_save_v1';
const VIEW_W = 960, VIEW_H = 540;

const Game = {
  canvas: null, ctx: null, pixelScale: 1,
  scene: 'boot', sceneObj: null,
  time: 0, last: 0, hitstop: 0, slowmo: 1,
  state: null,
  players: [], enemies: [], projectiles: [], particles: new Particles(), texts: [], loot: [], telegraphs: [], npcs: [],
  world: null, dungeon: null, map: null,
  cam: { x: 0, y: 0, zoom: 1, shake: 0 },
  overlays: [], toasts: [], banner: null, itemGet: null,
  fade: null, spawnT: 0, regionId: -1, townId: null, boss: null, bossIntro: 0,
  godMode: false, settings: { shake: true },
  dungeonCache: {}, autosaveT: 0, timers: [], manual: false,

  // ---------------------------------------------------------
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.init();
    Input.onGesture = () => Sound.unlock();
    Sound.init();
    try { const s = JSON.parse(localStorage.getItem('dogquest_settings') || '{}'); if (s.shake === false) this.settings.shake = false; } catch (e) { /* */ }
    // pre-build world (deterministic) so it is ready for the game
    this.world = new World(1337);
    this.setScene(new TitleScene());
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const s = Math.min(ww / VIEW_W, wh / VIEW_H);
    const cssW = Math.floor(VIEW_W * s), cssH = Math.floor(VIEW_H * s);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.pixelScale = s * dpr;
    this.canvas.width = Math.floor(VIEW_W * this.pixelScale);
    this.canvas.height = Math.floor(VIEW_H * this.pixelScale);
  },

  setScene(s) {
    this.sceneObj = s;
    this.scene = s.name;
    Input.consume();
    if (s.enter) s.enter();
  },

  later(sec, fn) { this.timers.push({ t: sec, fn }); },
  runTimers(dt) {
    if (!this.timers.length) return;
    const due = [];
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
    if (due.length) { this.timers = this.timers.filter(tm => tm.t > 0); for (const tm of due) tm.fn(); }
  },
  // deterministic stepping for automated tests
  step(n = 1, dt = 1 / 60, render = false) {
    for (let i = 0; i < n; i++) { Input.update(dt); this.update(dt); if (render) this.render(); Input.endFrame(); }
  },

  frame(ts) {
    if (this.manual) { this.last = ts; requestAnimationFrame(t => this.frame(t)); return; }
    const raw = Math.min(0.05, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    Input.update(raw);
    try {
      this.update(raw);
      this.render();
    } catch (err) {
      console.error(err);
      this.lastError = err;
    }
    Input.endFrame();
    requestAnimationFrame(t => this.frame(t));
  },

  update(dt) {
    this.time += dt;
    if (this.fade) {
      this.fade.t += dt;
      if (!this.fade.fired && this.fade.t >= this.fade.dur) { this.fade.fired = true; if (this.fade.cb) this.fade.cb(); }
      if (this.fade.t >= this.fade.dur * 2) this.fade = null;
    }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < t.life);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.itemGet) { this.itemGet.t += dt; if (this.itemGet.t > 2.6) this.itemGet = null; }
    if (this.sceneObj && this.sceneObj.update) this.sceneObj.update(dt);
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.sceneObj && this.sceneObj.draw) this.sceneObj.draw(ctx);
    UI.drawToasts(ctx);
    if (this.fade) {
      const k = this.fade.t < this.fade.dur ? this.fade.t / this.fade.dur : 1 - (this.fade.t - this.fade.dur) / this.fade.dur;
      ctx.fillStyle = `rgba(0,0,0,${clamp(k, 0, 1)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  },

  fadeTo(cb, dur = 0.35) { if (this.fade && !this.fade.fired) return; this.fade = { t: 0, dur, cb, fired: false }; },

  toast(text, color = '#ffffff', life = 3) {
    this.toasts.push({ text, color, t: 0, life });
    if (this.toasts.length > 5) this.toasts.shift();
  },
  showBanner(text, sub = '', color = '#ffffff', life = 3) { this.banner = { text, sub, color, t: 0, life }; },

  // ---------------------------------------------------------
  // NEW GAME / SAVE / LOAD
  // ---------------------------------------------------------
  newState() {
    return {
      version: 1, level: 1, xp: 0, gold: 30,
      inv: {}, spells: { flame: 1 }, keys: [false, false, false, false, false, false], seals: {},
      quests: {}, cleared: {}, chests: {}, rewards: {},
      kills: 0, killsByType: {}, chestsOpened: 0,
      party: [], pos: null, lastTown: 'pawston', playTime: 0, finished: false, barrier: true,
    };
  },

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.version === 1 ? s : null; } catch (e) { return null; } },

  save(silent = false) {
    if (!this.state) return;
    const st = this.state;
    st.party = this.players.map(p => ({ breed: p.breed, equip: Object.assign({}, p.equip), spells: p.spells.slice() })).concat(st.party.slice(this.players.length));
    if (!this.dungeon && this.players[0]) st.pos = { x: this.players[0].x, y: this.players[0].y };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); if (!silent) this.toast('Game saved', '#8fe38f', 2); } catch (e) { this.toast('Could not save!', '#ff6a6a'); }
  },

  // party: [{breed, device}] ; loaded: existing state or null
  startGame(partyDefs, loaded) {
    this.state = loaded || this.newState();
    const st = this.state;
    this.players = [];
    partyDefs.forEach((pd, i) => {
      const p = new Player(i, pd.breed, pd.device);
      let slot = st.party[i];
      if (!slot) {
        const b = BREEDS[pd.breed];
        slot = { breed: pd.breed, equip: Object.assign({}, b.start), spells: ['flame', null, null, null] };
        st.party[i] = slot;
      }
      slot.breed = pd.breed;
      p.equip = Object.assign({}, slot.equip);
      p.spells = slot.spells.slice();
      for (const k of ['weapon', 'helmet', 'armor']) if (p.equip[k] && !st.inv[p.equip[k]]) st.inv[p.equip[k]] = 1;
      if (!p.equip.weapon) { p.equip.weapon = BREEDS[pd.breed].start.weapon; st.inv[p.equip.weapon] = st.inv[p.equip.weapon] || 1; }
      p.refresh(false);
      this.players.push(p);
    });
    // starter gear for every breed goes into the shared bag
    this.enemies = []; this.projectiles = []; this.texts = []; this.loot = []; this.telegraphs = []; this.particles.list = [];
    this.dungeon = null; this.map = this.world; this.boss = null; this.overlays = []; this.timers = [];
    this.npcs = this.world.npcSpots.map(s => new NPC(s));
    this.regionId = -1; this.townId = null;
    const town = TOWNS[st.lastTown] || TOWNS.pawston;
    let sx = town.tx * TS + 16, sy = (town.ty + 2) * TS + 16;
    if (st.pos && loaded) { sx = st.pos.x; sy = st.pos.y; }
    this.placePlayers(sx, sy);
    this.cam.x = sx; this.cam.y = sy;
    this.setScene(new PlayScene());
    if (!loaded) {
      this.startQuest('m1', true);
      this.save(true);
    } else {
      this.ensureMainQuest();
      this.toast('Welcome back, heroes!', '#ffd23f');
    }
  },

  addPlayer2(breed, d1, d2) {
    const st = this.state;
    let devs = [d1, d2];
    const kbCount = devs.filter(d => d.startsWith('kb')).length;
    if (kbCount === 1) devs = devs.map(d => d.startsWith('kb') ? 'kb' : d);
    const p1 = this.players[0];
    p1.device = devs[0];
    const p = new Player(1, breed, devs[1]);
    let slot = st.party[1];
    if (!slot) slot = st.party[1] = { breed, equip: Object.assign({}, BREEDS[breed].start), spells: ['flame', null, null, null] };
    slot.breed = breed;
    p.equip = Object.assign({}, slot.equip);
    for (const k of ['weapon', 'helmet', 'armor']) if (p.equip[k] && !st.inv[p.equip[k]]) st.inv[p.equip[k]] = 1;
    p.spells = slot.spells.map(id => id && st.spells[id] ? id : null);
    if (!p.spells.some(Boolean)) p.spells[0] = 'flame';
    p.refresh(false);
    p.x = p1.x + 24; p.y = p1.y;
    if (this.collides(p.x, p.y, 8)) p.x = p1.x;
    p.invuln = 1.5;
    this.players.push(p);
    this.poof(p.x, p.y - 14, '#ffffff');
    Sound.sfx('bark', { pitch: BREEDS[breed].bark });
    this.toast(`${BREEDS[breed].name} joined the party!`, PCOLORS[1]);
    this.save(true);
  },
  removePlayer2() {
    if (this.players.length < 2) return;
    const p = this.players[1];
    this.state.party[1] = { breed: p.breed, equip: Object.assign({}, p.equip), spells: p.spells.slice() };
    this.poof(p.x, p.y - 14, '#ffffff');
    this.players.length = 1;
    this.players[0].device = 'any';
    this.toast(`${BREEDS[p.breed].name} left the party.`, '#c8c8d8');
    this.save(true);
  },

  placePlayers(x, y) {
    this.players.forEach((p, i) => {
      p.x = x + (i ? 26 : 0); p.y = y;
      if (this.map.isSolid(p.x, p.y)) p.x = x;
      p.vx = p.vy = 0; p.state = 'idle';
    });
  },

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  collides(x, y, r) {
    const m = this.map;
    return m.isSolid(x - r, y) || m.isSolid(x + r, y) || m.isSolid(x - r, y - r * 0.8) || m.isSolid(x + r, y - r * 0.8) || m.isSolid(x, y - r) || m.isSolid(x, y + 1);
  },
  moveEntity(e, dx, dy) {
    const r = Math.min(e.r * 0.8, 13);
    if (this.collides(e.x, e.y, r)) { e.x += dx; e.y += dy; return; } // stuck: let it escape
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      let nx = e.x + sx;
      if (e instanceof Player && !this.tetherOk(e, nx, e.y)) nx = e.x;
      if (!this.collides(nx, e.y, r)) e.x = nx;
      let ny = e.y + sy;
      if (e instanceof Player && !this.tetherOk(e, e.x, ny)) ny = e.y;
      if (!this.collides(e.x, ny, r)) e.y = ny;
    }
  },
  tetherOk(p, nx, ny) {
    if (this.players.length < 2) return true;
    const o = this.players[1 - p.pid];
    if (!o || o.down) return true;
    const mx = VIEW_W / 0.62 - 140, my = VIEW_H / 0.62 - 150;
    const okx = Math.abs(nx - o.x) < mx || Math.abs(nx - o.x) < Math.abs(p.x - o.x);
    const oky = Math.abs(ny - o.y) < my || Math.abs(ny - o.y) < Math.abs(p.y - o.y);
    return okx && oky;
  },
  nearestEnemy(x, y, maxD = 1e9, exclude = null) {
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      const d = dist2(x, y, e.x, e.y - e.hgt * 0.5);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  nearestPlayerTo(x, y, alive = true) {
    let best = null, bd = 1e18;
    for (const p of this.players) { if (alive && p.down) continue; const d = dist2(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
    return best;
  },
  partyLevel() { return this.state.level; },
  floatText(x, y, text, color, size = 16) { this.texts.push(new FloatText(x, y, text, color, size)); },
  shake(a) { if (this.settings.shake) this.cam.shake = Math.max(this.cam.shake, a); },

  // ---------------------------------------------------------
  // FX
  // ---------------------------------------------------------
  burst(x, y, color, n = 10, sp = 120, type = 'dot') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(sp * 0.3, sp);
      this.particles.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), size: rand(2, 4.5), color, type, drag: 0.05 });
    }
  },
  poof(x, y, color = '#ffffff') {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), s = rand(30, 110);
      this.particles.add({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(0.35, 0.7), size: rand(5, 9), color: i % 2 ? 'rgba(240,240,240,0.9)' : rgba(color.startsWith('#') ? color : '#ffffff', 0.8), type: 'smoke', drag: 0.02 });
    }
  },
  dustRing(x, y, r) {
    this.particles.add({ x, y, r, type: 'ring', color: 'rgba(230,210,170,0.9)', life: 0.45, width: 6, flat: 0.45 });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      this.particles.add({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.25, vx: Math.cos(a) * r * 1.5, vy: Math.sin(a) * r * 0.7, life: 0.5, size: rand(4, 8), color: 'rgba(200,180,140,0.7)', type: 'smoke', drag: 0.03 });
    }
  },
  shockwave(x, y, r) {
    this.particles.add({ x, y, r, type: 'ring', color: 'rgba(255,230,180,0.95)', life: 0.6, width: 10, flat: 0.5 });
    this.particles.add({ x, y: y - 20, r: r * 0.8, type: 'ring', color: 'rgba(255,120,60,0.8)', life: 0.5, width: 6, flat: 0.6 });
  },
  explosion(x, y, r, color) {
    Sound.sfx('explode');
    this.shake(6);
    this.particles.add({ x, y, r, type: 'ring', color, life: 0.4, width: 8, flat: 0.7 });
    for (let i = 0; i < 22; i++) {
      const a = rand(0, TAU), s = rand(40, r * 3);
      this.particles.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8 - 30, life: rand(0.3, 0.6), size: rand(5, 10), type: 'flame', drag: 0.03 });
    }
    for (let i = 0; i < 8; i++) this.particles.add({ x: x + rand(-r / 2, r / 2), y: y + rand(-r / 3, r / 3), vx: rand(-20, 20), vy: rand(-60, -20), life: 0.9, size: rand(6, 10), color: 'rgba(80,70,70,0.6)', type: 'smoke' });
  },
  magicBlast(x, y, r, el) {
    const c = el === 'ice' ? '#7fe0ff' : el === 'fire' ? '#ff7b2e' : '#b46cff';
    this.particles.add({ x, y, r, type: 'ring', color: c, life: 0.4, width: 7, flat: 0.55 });
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), s = rand(40, 180);
      this.particles.add({ x, y: y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 50, life: rand(0.3, 0.6), size: rand(3, 6), color: c, type: el === 'fire' ? 'flame' : 'dot', drag: 0.04 });
    }
    Sound.sfx(el === 'ice' ? 'ice' : el === 'fire' ? 'fire' : 'magic');
  },
  meteorFx(x, y, r, friendly) {
    // falling rock then explosion
    this.particles.add({ x: x + 60, y: y - 320, vx: -300, vy: 1600, life: 0.2, size: 10, color: '#ffb040', type: 'spark' });
    this.explosion(x, y, r, friendly ? '#ffd23f' : '#ff4a2a');
    this.shake(12);
    for (let i = 0; i < 10; i++) { const a = rand(0, TAU); this.particles.add({ x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 120 - 200, grav: 600, life: 0.8, size: rand(3, 6), color: '#5a3a2a', type: 'dot' }); }
  },
  breathFx(e, a, R, el) {
    for (let i = 0; i < 40; i++) {
      const aa = a + rand(-0.45, 0.45), s = rand(R * 1.2, R * 2.4);
      this.particles.add({ x: e.x + Math.cos(a) * 14, y: e.y - e.hgt * 0.6, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: rand(0.35, 0.55), size: rand(4, 9), color: el === 'ice' ? '#bff0ff' : '#ff7b2e', type: el === 'ice' ? 'dot' : 'flame', drag: 0.2 });
    }
  },
  slashFx(p, aim, reach) {
    const dir = p.combo === 2 ? -1 : 1;
    const col = p.stats.weapon.look.gem || '#ffffff';
    this.particles.add({ x: p.x, y: p.y - 12, r: reach * 0.85, a0: aim - 1.1 * dir, sweep: 2.2, dir, type: 'slash', color: rgba(col, 0.9), size: p.combo === 3 ? 9 : 6, life: 0.2 });
  },
  swipeFx(e, a, R) {
    this.particles.add({ x: e.x, y: e.y - e.hgt * 0.5, r: R * 0.8, a0: a - 1, sweep: 2, dir: 1, type: 'slash', color: 'rgba(255,90,70,0.9)', size: 7, life: 0.22 });
  },
  footstep(p) {
    const t = this.map === this.world ? this.world.tile(Math.floor(p.x / TS), Math.floor(p.y / TS)) : -1;
    const c = t === T.SNOW ? 'rgba(255,255,255,0.8)' : t === T.DESERT || t === T.SAND ? 'rgba(230,200,140,0.8)' : t === T.ASH ? 'rgba(90,80,80,0.8)' : 'rgba(200,190,160,0.5)';
    this.particles.add({ x: p.x - p.facing * 6, y: p.y, vx: -p.facing * 10, vy: -12, life: 0.35, size: 3, color: c, type: 'smoke' });
  },

  // ---------------------------------------------------------
  // COMBAT
  // ---------------------------------------------------------
  damageEnemy(e, dmg, o = {}) {
    if (e.dead) return;
    if (e.def.armored && !o.magic) { dmg *= 0.7; this.burst(e.x, e.y - e.hgt * 0.6, '#c8d2dc', 4, 80, 'spark'); }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flashT = 0.1;
    e.aggro = true; e.dormant = false;
    if (o.fromX != null) {
      const a = angleTo(o.fromX, o.fromY, e.x, e.y);
      const k = (o.knock || 0) * (e.boss ? 0.08 : 1 / Math.sqrt(e.size));
      e.vx += Math.cos(a) * k; e.vy += Math.sin(a) * k;
    }
    if (!e.boss) {
      if (o.stagger && e.state === 'windup') { e.cancelAttack(); e.stunT = Math.max(e.stunT, 0.35); }
      else if (e.state !== 'windup' && !e.dash && !e.leap) e.stunT = Math.max(e.stunT, 0.12);
    }
    const hx = e.x + rand(-8, 8), hy = e.y - e.hgt - 6;
    if (o.crit) { this.floatText(hx, hy, dmg + '!', '#ffd23f', 24); Sound.sfx('crit'); this.shake(4); }
    else { this.floatText(hx, hy, String(dmg), o.magic ? '#c8b0ff' : '#ffffff', 17); Sound.sfx('hit', { pitch: rand(0.9, 1.15) }); }
    for (let i = 0; i < (o.crit ? 12 : 7); i++) {
      const a = rand(0, TAU), s = rand(80, 240);
      this.particles.add({ x: e.x, y: e.y - e.hgt * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.22, size: 2.5, color: o.crit ? '#ffd23f' : '#ffffff', type: 'spark' });
    }
    if (e.hp <= 0) this.killEnemy(e, o.player);
  },

  killEnemy(e) {
    e.hp = 0; e.dead = true; e.deadT = 0;
    for (const tt of e.tele) tt.cancel = true;
    e.tele = [];
    Sound.sfx('catDie', { pitch: 1.2 / Math.sqrt(e.size) });
    this.poof(e.x, e.y - e.hgt * 0.5, e.def.fur);
    const st = this.state;
    const xp = Math.round((6 + 4 * e.level) * e.def.xp * (e.boss ? 15 : 1) * (e.xpMul == null ? 1 : e.xpMul));
    const gold = Math.round((2 + 1.6 * e.level) * e.def.gold * rand(0.7, 1.3) * (e.boss ? 12 : 1) * (e.xpMul == null ? 1 : e.xpMul));
    this.gainXp(xp, e.x, e.y - e.hgt - 20);
    // coins
    const coins = Math.min(12, Math.max(1, Math.ceil(gold / Math.max(3, e.level * 2))));
    for (let i = 0; i < coins; i++) this.loot.push(new Loot('coin', e.x, e.y - 4, Math.max(1, Math.round(gold / coins))));
    if (!e.boss) {
      if (Math.random() < 0.035) {
        const tier = clamp(Math.ceil(e.level / 9), 1, 5);
        const pool = Object.values(ITEMS).filter(it => !it.chestOnly && it.tier === tier);
        if (pool.length) this.loot.push(new Loot('item', e.x, e.y, choose(pool).id));
      }
      if (Math.random() < 0.1) this.loot.push(new Loot('heart', e.x, e.y, 0));
    }
    st.kills++;
    st.killsByType[e.typeId] = (st.killsByType[e.typeId] || 0) + 1;
    this.questEvent('kill', e);
    if (e.boss) this.onBossKilled(e);
  },

  damagePlayer(p, dmg, o = {}) {
    if (p.down || p.invuln > 0 || this.godMode) return false;
    if (p.state === 'roll') return false;
    if (p.shield) {
      const ab = Math.min(p.shield.hp, dmg);
      p.shield.hp -= ab; dmg -= ab;
      this.floatText(p.x, p.y - 44, 'Blocked', '#f4f0e6', 14);
      this.burst(p.x, p.y - 14, '#f4f0e6', 6, 100);
      if (dmg <= 0.5) { p.invuln = 0.3; return true; }
    }
    dmg = dmg * 70 / (70 + p.stats.def) * rand(0.9, 1.1);
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.flashT = 0.15; p.invuln = 0.55;
    if (o.slow) p.slowT = Math.max(p.slowT || 0, o.slow);
    if (o.fromX != null) {
      const a = angleTo(o.fromX, o.fromY, p.x, p.y);
      const k = o.knock || 150;
      p.vx = Math.cos(a) * k; p.vy = Math.sin(a) * k;
    }
    if (p.state === 'attack') { p.state = 'idle'; p.attackQueued = false; }
    this.floatText(p.x, p.y - 46, '-' + dmg, '#ff5a5a', 18);
    Sound.sfx('hurt');
    this.shake(4);
    this.burst(p.x, p.y - 14, '#ffffff', 8, 140, 'spark');
    if (p.hp <= 0) {
      p.hp = 0; p.down = true; p.downT = 10; p.state = 'idle'; p.shield = null; p.reviveT = 0;
      Sound.sfx('gameover');
      if (this.players.length > 1) this.toast(`${BREEDS[p.breed].name} is down! Stay close to revive!`, '#ff8a8a');
    }
    return true;
  },

  aoeDamagePlayers(x, y, r, dmg, fx, fy, knock) {
    for (const p of this.players) if (!p.down && dist2(x, y, p.x, p.y) < (r + p.r) ** 2) this.damagePlayer(p, dmg, { fromX: fx, fromY: fy, knock });
  },
  inTele(tt, px, py, pr) {
    const d = dist(tt.x, tt.y, px, py);
    switch (tt.kind) {
      case 'circle': return d <= tt.r + pr;
      case 'ring': return d <= tt.r + pr && d >= tt.r2 - pr;
      case 'cone': return d <= tt.r + pr && (d < pr + 4 || Math.abs(angleDiff(tt.angle, angleTo(tt.x, tt.y, px, py))) <= tt.spread + 0.12);
      case 'line': {
        const dx = Math.cos(tt.angle), dy = Math.sin(tt.angle);
        const rx = px - tt.x, ry = py - tt.y;
        const along = rx * dx + ry * dy, perp = Math.abs(-rx * dy + ry * dx);
        return along >= -pr && along <= tt.len + pr && perp <= tt.width / 2 + pr;
      }
    }
    return false;
  },
  teleDamage(tt, dmg, fx, fy, knock, extra) {
    if (!tt) return;
    for (const p of this.players) {
      if (p.down) continue;
      if (this.inTele(tt, p.x, p.y - 6, p.r)) this.damagePlayer(p, dmg, Object.assign({ fromX: fx, fromY: fy, knock }, extra || {}));
    }
  },
  spawnProjectile(o) { const pr = new Projectile(o); this.projectiles.push(pr); return pr; },

  castSpell(p, id, lvl) {
    const st = p.stats, m = spellMult(lvl), mag = st.mag, sp = SPELLS[id];
    let aim = Math.atan2(p.aimY, p.aimX);
    const tgt = this.nearestEnemy(p.x, p.y - 12, 420);
    if (tgt && Math.abs(angleDiff(aim, angleTo(p.x, p.y - 12, tgt.x, tgt.y - tgt.hgt * 0.5))) < 1.2) aim = angleTo(p.x, p.y - 12, tgt.x, tgt.y - tgt.hgt * 0.5);
    const ax = Math.cos(aim), ay = Math.sin(aim);
    if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
    this.burst(p.x, p.y - 20, sp.color, 10, 90);
    switch (id) {
      case 'flame':
        this.spawnProjectile({ team: 'player', kind: 'fireball', x: p.x + ax * 16, y: p.y - 14 + ay * 10, vx: ax * 470, vy: ay * 470, r: 9, dmg: mag * sp.power * m, aoe: 56 + lvl * 3, life: 1.1, color: '#ff7b2e' });
        Sound.sfx('fire');
        break;
      case 'frost':
        for (let i = -2; i <= 2; i++) {
          const a = aim + i * 0.17;
          this.spawnProjectile({ team: 'player', kind: 'ice', x: p.x + ax * 14, y: p.y - 14, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500, r: 8, dmg: mag * sp.power * m, life: 0.7, color: '#aee8ff', pierce: true });
        }
        Sound.sfx('ice');
        break;
      case 'thunder': {
        const targets = this.enemies.filter(e => !e.dead && dist2(p.x, p.y, e.x, e.y) < 340 * 340).sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y)).slice(0, 3 + Math.floor(lvl / 4));
        if (!targets.length) this.bolt(p.x + ax * 140, p.y + ay * 140);
        for (const e of targets) {
          this.bolt(e.x, e.y - e.hgt * 0.5);
          this.damageEnemy(e, mag * sp.power * m, { magic: true, knock: 40, fromX: p.x, fromY: p.y });
          if (!e.dead && !e.boss) e.stunT = Math.max(e.stunT, 0.5);
        }
        Sound.sfx('thunder'); this.shake(5);
        break;
      }
      case 'heal': {
        const amt = mag * sp.power * m;
        for (const q of this.players) {
          if (q !== p && dist(q.x, q.y, p.x, p.y) > 300) continue;
          const h = Math.round(amt + q.stats.maxHp * 0.12);
          if (q.down) { q.down = false; q.hp = 0; q.invuln = 1.5; this.toast(`${BREEDS[q.breed].name} was revived!`, '#8fe38f'); }
          q.hp = Math.min(q.stats.maxHp, q.hp + h);
          this.floatText(q.x, q.y - 50, '+' + h, '#6aff8a', 20);
          for (let i = 0; i < 10; i++) this.particles.add({ x: q.x + rand(-16, 16), y: q.y - rand(0, 30), vx: rand(-10, 10), vy: rand(-80, -40), life: rand(0.6, 1), size: rand(4, 6), color: '#6aff8a', type: i % 3 ? 'dot' : 'heart' });
        }
        Sound.sfx('heal');
        break;
      }
      case 'shield':
        p.shield = { hp: mag * 3 * m + 25, t: 8 + lvl * 0.4, angle: 0, tick: 0, dmg: mag * sp.power * m };
        Sound.sfx('shield');
        break;
      case 'quake': {
        const R = 120 + lvl * 6;
        this.dustRing(p.x, p.y, R); this.shake(10); Sound.sfx('quake');
        this.particles.add({ x: p.x, y: p.y, r: R, type: 'ring', color: 'rgba(200,160,100,0.9)', life: 0.5, width: 10, flat: 0.5 });
        for (const e of this.enemies) {
          if (e.dead || dist2(p.x, p.y, e.x, e.y) > (R + e.r) ** 2) continue;
          this.damageEnemy(e, mag * sp.power * m, { magic: true, knock: 320, fromX: p.x, fromY: p.y });
          if (!e.dead) e.stunT = Math.max(e.stunT, e.boss ? 0 : 1.1);
        }
        break;
      }
      case 'spirit':
        for (let i = -1; i <= 1; i++) {
          const a = aim + i * 0.5;
          this.spawnProjectile({ team: 'player', kind: 'spirit', x: p.x, y: p.y - 14, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, r: 12, dmg: mag * sp.power * m, life: 3, color: '#9ab8ff', homing: 6 });
        }
        Sound.sfx('spirit');
        break;
      case 'meteor': {
        const e = this.nearestEnemy(p.x, p.y, 460);
        const tx = e ? e.x : p.x + ax * 180, ty = e ? e.y : p.y + ay * 180;
        const R = 100 + lvl * 4;
        this.telegraphs.push({ kind: 'circle', x: tx, y: ty, r: R, t: 0, dur: 0.7, friendly: true, owner: null, color: '#ffd23f', onDone: () => {
          this.meteorFx(tx, ty, R, true);
          for (const en of this.enemies) if (!en.dead && dist2(tx, ty, en.x, en.y) < (R + en.r) ** 2) this.damageEnemy(en, mag * sp.power * m, { magic: true, knock: 260, fromX: tx, fromY: ty });
        } });
        Sound.sfx('meteor');
        break;
      }
    }
  },
  bolt(x, y) {
    const pts = [x + rand(-30, 30), y - 340];
    let cx = pts[0], cy = pts[1];
    while (cy < y) { cy += rand(25, 45); cx += rand(-18, 18); if (cy > y) { cy = y; cx = x; } pts.push(cx, cy); }
    this.particles.add({ type: 'bolt', pts, color: '#ffe84a', life: 0.25, x: 0, y: 0 });
    this.particles.add({ x, y, r: 36, type: 'ring', color: '#ffe84a', life: 0.3, width: 5, flat: 0.5 });
    this.burst(x, y, '#fff6a0', 10, 160, 'spark');
  },

  // ---------------------------------------------------------
  // PROGRESSION
  // ---------------------------------------------------------
  gainXp(xp, x, y) {
    const st = this.state;
    if (st.level >= MAX_LEVEL) return;
    st.xp += xp;
    if (x != null) this.floatText(x, y, '+' + xp + ' XP', '#9fe0ff', 13);
    let leveled = false;
    while (st.level < MAX_LEVEL && st.xp >= xpForLevel(st.level)) {
      st.xp -= xpForLevel(st.level);
      st.level++;
      leveled = true;
    }
    if (st.level >= MAX_LEVEL) st.xp = 0;
    if (leveled) {
      for (const p of this.players) {
        p.refresh(); p.hp = p.stats.maxHp; p.mp = p.stats.maxMp;
        if (p.down) { p.down = false; p.invuln = 1.5; }
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; this.particles.add({ x: p.x, y: p.y - 14, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 40, life: 0.7, size: 5, color: '#ffd23f', type: 'star', drag: 0.1 }); }
        this.particles.add({ x: p.x, y: p.y, r: 70, type: 'ring', color: '#ffd23f', life: 0.6, width: 6, flat: 0.5 });
      }
      Sound.sfx('levelup');
      this.showBanner('LEVEL UP!', `Level ${st.level}`, '#ffd23f', 2.5);
    }
  },
  addGold(n) { this.state.gold += n; },

  // item acquisition: new item or level up duplicate
  giveItem(id, silent = false) {
    const st = this.state, it = ITEMS[id];
    if (!it) return;
    let msg;
    if (st.inv[id]) {
      if (st.inv[id] < 10) { st.inv[id]++; msg = `${it.name} upgraded to Lv ${st.inv[id]}!`; }
      else { const g = Math.round(it.price * 0.3) + 50; st.gold += g; msg = `${it.name} is maxed! +${g} gold`; }
    } else { st.inv[id] = 1; msg = `Got ${it.name}!`; }
    for (const p of this.players) p.refresh();
    if (!silent) { this.itemGet = { item: it, text: msg, t: 0 }; Sound.sfx('pickup'); }
    return msg;
  },

  pickupLoot(l, p) {
    if (l.kind === 'coin') { this.state.gold += l.value; Sound.sfx('coin'); this.particles.add({ x: l.x, y: l.y - 10, vy: -40, life: 0.4, type: 'coinfx' }); }
    else if (l.kind === 'item') this.giveItem(l.value);
    else if (l.kind === 'heart') {
      const h = Math.round(p.stats.maxHp * 0.15);
      p.hp = Math.min(p.stats.maxHp, p.hp + h);
      this.floatText(p.x, p.y - 46, '+' + h, '#6aff8a', 16); Sound.sfx('heal');
    }
  },

  rollChestLoot(tier, isReward, dungeonLevel) {
    const st = this.state;
    if (isReward) {
      const t = clamp(Math.ceil(dungeonLevel / 9), 1, 5);
      const pool = Object.values(ITEMS).filter(it => !it.chestOnly && (it.tier === t || it.tier === t - 1 || (t === 1 && it.tier === 1)));
      this.giveItem(choose(pool).id);
      const g = Math.round(40 + dungeonLevel * 25);
      st.gold += g; this.toast(`+${g} gold`, '#ffd23f');
      return;
    }
    const r = Math.random();
    if (tier === 5 && r < 0.14) {
      const legends = Object.values(ITEMS).filter(it => it.legendary);
      const notOwned = legends.filter(it => !st.inv[it.id]);
      this.giveItem(choose(notOwned.length ? notOwned : legends).id);
    } else if (r < 0.6) {
      const pool = Object.values(ITEMS).filter(it => !it.chestOnly && (it.tier === tier || it.tier === tier - 1));
      this.giveItem(choose(pool).id);
    } else {
      const g = Math.round(40 * Math.pow(tier, 2.3) * rand(0.9, 1.3) + st.level * 10);
      st.gold += g;
      this.itemGet = { gold: g, text: `Found ${fmt(g)} gold!`, t: 0 };
      Sound.sfx('coin');
    }
  },

  openChest(ch, isDungeon) {
    const st = this.state;
    if (st.chests[ch.id]) return;
    const tier = ch.tier;
    if (tier > 0 && !st.keys[tier]) {
      Sound.sfx('locked');
      this.floatText(ch.x, ch.y - 40, `Needs ${KEYS[tier].name}`, KEYS[tier].color, 15);
      return;
    }
    st.chests[ch.id] = true;
    st.chestsOpened++;
    ch.openT = 0;
    Sound.sfx('chest');
    this.burst(ch.x, ch.y - 16, tier ? KEYS[tier].color : '#ffd23f', 24, 200, 'star');
    this.rollChestLoot(tier, tier === 0, isDungeon ? this.dungeon.def.level : this.state.level);
    this.questEvent('chest');
    this.save(true);
  },

  // ---------------------------------------------------------
  // QUESTS
  // ---------------------------------------------------------
  questActive(id) { const q = this.state.quests[id]; return q && q.status === 'active'; },
  questDone(id) { const q = this.state.quests[id]; return q && q.status === 'done'; },
  startQuest(id, silent) {
    const st = this.state;
    if (st.quests[id]) return;
    const q = QUESTS[id];
    st.quests[id] = { status: 'active', progress: 0 };
    if (!silent) { this.toast(`New Quest: ${q.name}`, q.main ? '#ffd23f' : '#9fe0ff', 4); Sound.sfx('quest'); }
    // already satisfied?
    if (q.obj.type === 'clear' && st.cleared[q.obj.dungeon]) this.completeQuest(id);
    if (q.obj.type === 'chests') { st.quests[id].base = st.chestsOpened; }
    if (q.obj.type === 'kill' && !q.obj.enemy && !q.obj.region && q.obj.count > 50) st.quests[id].progress = 0;
  },
  completeQuest(id) {
    const st = this.state, q = QUESTS[id];
    const qs = st.quests[id];
    if (!qs || qs.status === 'done') return;
    qs.status = 'done';
    Sound.sfx('quest');
    this.showBanner('QUEST COMPLETE', q.name, '#8fe38f', 3);
    const r = q.reward || {};
    if (r.gold) { st.gold += r.gold; this.toast(`+${fmt(r.gold)} gold`, '#ffd23f'); }
    if (r.item) this.giveItem(r.item);
    if (r.xp) this.gainXp(r.xp);
    if (id === 'm13') { st.barrier = false; this.toast("The barrier around the Lion's Keep has shattered!", '#ff9aff', 5); }
    if (q.next) this.startQuest(q.next);
    this.save(true);
  },
  questProgressText(id) {
    const q = QUESTS[id], qs = this.state.quests[id];
    if (!qs) return '';
    if (q.obj.type === 'kill') return `${Math.min(qs.progress, q.obj.count)}/${q.obj.count}`;
    if (q.obj.type === 'chests') return `${Math.min(this.state.chestsOpened - (qs.base || 0), q.obj.count)}/${q.obj.count}`;
    return '';
  },
  questEvent(type, data) {
    const st = this.state;
    for (const id in st.quests) {
      const qs = st.quests[id];
      if (qs.status !== 'active') continue;
      const q = QUESTS[id], o = q.obj;
      if (type === 'kill' && o.type === 'kill') {
        if (o.enemy && data.typeId !== o.enemy && data.def.base !== o.enemy) continue;
        if (o.region != null && data.region !== o.region) continue;
        qs.progress++;
        if (qs.progress >= o.count) this.completeQuest(id);
      } else if (type === 'clear' && o.type === 'clear' && o.dungeon === data) this.completeQuest(id);
      else if (type === 'talk' && o.type === 'talk' && o.npc === data) this.completeQuest(id);
      else if (type === 'chest' && o.type === 'chests' && st.chestsOpened - (qs.base || 0) >= o.count) this.completeQuest(id);
      else if (type === 'goto' && o.type === 'goto' && data === id) this.completeQuest(id);
    }
  },
  ensureMainQuest() {
    const st = this.state;
    if (this.currentMainQuest()) return;
    for (const id of MAIN_ORDER) {
      if (this.questDone(id)) continue;
      if (!st.quests[id]) this.startQuest(id, true);
      return;
    }
  },
  currentMainQuest() {
    for (const id of MAIN_ORDER) if (this.questActive(id)) return id;
    return null;
  },
  trackedQuest() {
    const m = this.currentMainQuest();
    if (m) return m;
    for (const id in this.state.quests) if (this.questActive(id)) return id;
    return null;
  },
  questTarget(id) {
    const q = QUESTS[id];
    if (!q) return null;
    const o = q.obj;
    if (o.type === 'talk') { const s = this.world.npcSpots.find(s => s.npc.id === o.npc); return s ? { x: s.x, y: s.y } : null; }
    if (o.type === 'clear') { const d = DUNGEON_BY_ID[o.dungeon]; return { x: d.tx * TS + 16, y: d.ty * TS + 40, dungeon: d.id }; }
    if (o.type === 'goto') return this.world.gotoSpots[id];
    if (o.type === 'kill' && o.region != null) { const r = REGIONS[o.region]; if (this.world.regionAt(this.players[0].x, this.players[0].y) !== o.region) return { x: r.cx * TS, y: r.cy * TS }; }
    return null;
  },
  npcHasQuest(npcId) {
    const m = this.currentMainQuest();
    return m && QUESTS[m].obj.type === 'talk' && QUESTS[m].obj.npc === npcId;
  },
  availableBoardQuests(town) {
    const st = this.state;
    return Object.values(QUESTS).filter(q => q.town === town && !st.quests[q.id] && (!q.after || this.questDone(q.after)));
  },

  // ---------------------------------------------------------
  // DUNGEONS
  // ---------------------------------------------------------
  enterDungeon(def) {
    const st = this.state;
    if (def.final && st.barrier) {
      UI.dialog([{ name: 'Mysterious Barrier', text: 'A crackling magic barrier seals the gate. Gather the four Royal Seals and speak with Elder Barkus in Pawston.' }]);
      Sound.sfx('locked');
      return;
    }
    this.fadeTo(() => {
      this.worldReturn = { x: def.tx * TS + 16, y: (def.ty + 1) * TS + 22 };
      const dg = new Dungeon(def);
      this.dungeon = dg; this.map = dg;
      this.enemies = []; this.projectiles = []; this.loot = []; this.telegraphs = [];
      dg.bossSpawned = !!st.cleared[def.id];
      dg.bossDead = !!st.cleared[def.id];
      dg.gateClosed = false;
      for (const s of dg.spawns) {
        const lvl = Math.max(1, def.level + randInt(-1, 1));
        this.enemies.push(new Enemy(s.type, lvl, s.x, s.y, { dormant: true, room: s.room, region: def.region }));
      }
      dg.rewardChest = null;
      if (st.cleared[def.id]) { dg.bossPortal = { x: dg.bossSpawn.x, y: dg.bossSpawn.y + 60 }; }
      this.placePlayers(dg.start.x, dg.start.y);
      this.cam.x = dg.start.x; this.cam.y = dg.start.y;
      this.boss = null;
      Sound.play('dungeon');
      this.showBanner(def.name, `Recommended Lv ${def.level}` + (st.cleared[def.id] ? '  ·  Cleared' : ''), '#ffe0a0', 3);
    });
  },
  exitDungeon() {
    this.fadeTo(() => {
      this.dungeon = null; this.map = this.world;
      this.enemies = []; this.projectiles = []; this.loot = []; this.telegraphs = [];
      this.boss = null;
      const r = this.worldReturn || { x: TOWNS.pawston.tx * TS, y: TOWNS.pawston.ty * TS };
      this.placePlayers(r.x, r.y);
      this.cam.x = r.x; this.cam.y = r.y;
      this.regionId = -1; this.townId = null;
      this.save(true);
    });
  },
  triggerBoss() {
    const dg = this.dungeon;
    if (!dg || dg.bossSpawned) return;
    dg.bossSpawned = true;
    dg.gateClosed = true;
    Sound.sfx('door');
    // pull all players inside the boss room
    const B = dg.bossRoom;
    for (const p of this.players) {
      if (!dg.insideBossRoom(p.x, p.y, 1)) {
        const inside = this.players.find(q => dg.insideBossRoom(q.x, q.y, 1));
        if (inside) { p.x = inside.x + 20; p.y = inside.y; if (this.collides(p.x, p.y, 8)) p.x = inside.x; }
        if (p.down) { p.down = false; p.hp = Math.round(p.stats.maxHp * 0.3); }
      }
    }
    // remove leftover enemies outside the room so the fight is focused
    this.enemies = this.enemies.filter(e => e.dead || dg.insideBossRoom(e.x, e.y, 0));
    const def = dg.def;
    const bdef = BOSSES[def.boss];
    this.bossIntro = 1.4;
    this.later(0.9, () => {
      if (this.dungeon !== dg) return;
      const e = new Enemy(bdef.base, def.level + (def.final ? 2 : 1), dg.bossSpawn.x, dg.bossSpawn.y, { boss: def.boss, region: def.region });
      e.aggro = true; e.atkCd = 1.2;
      this.enemies.push(e);
      this.boss = e;
      this.poof(e.x, e.y - 20, '#ffffff');
      Sound.sfx(bdef.lion ? 'roar' : 'hiss');
      this.shake(10);
    });
    this.showBanner(bdef.name.toUpperCase(), def.final ? 'Ruler of the Cat Clans' : 'Boss', '#ff6a5a', 3);
    Sound.play(def.final ? 'final' : 'boss');
  },
  bossPhase2(e) {
    Sound.sfx('roar'); this.shake(12);
    this.floatText(e.x, e.y - e.hgt - 40, 'ENRAGED!', '#ff4a2a', 26);
    this.shockwave(e.x, e.y, 200);
  },
  onBossKilled(e) {
    const dg = this.dungeon;
    if (!dg) return;
    const st = this.state, def = dg.def;
    const first = !st.cleared[def.id];
    dg.bossDead = true;
    dg.gateClosed = false;
    this.boss = null;
    // clear remaining minions
    for (const m of this.enemies) if (!m.dead && m !== e) { m.xpMul = 0; this.killEnemy(m); }
    this.telegraphs = this.telegraphs.filter(t => t.friendly);
    this.projectiles = this.projectiles.filter(p => p.team === 'player');
    this.slowmoT = 1.2;
    this.shake(16);
    for (let i = 0; i < 40; i++) { const a = rand(0, TAU), s = rand(80, 320); this.particles.add({ x: e.x, y: e.y - e.hgt * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1.2), size: rand(4, 7), color: choose(['#ffd23f', '#ffffff', '#ff9a4a']), type: 'star', drag: 0.1 }); }
    st.cleared[def.id] = true;
    dg.bossPortal = { x: dg.bossSpawn.x, y: dg.bossSpawn.y + 60 };
    if (first && !st.rewards[def.id]) {
      dg.rewardChest = { id: def.id + '_reward', tier: 0, x: dg.bossSpawn.x, y: dg.bossSpawn.y + 10 };
      const rw = def.reward || {};
      if (rw.gold) { st.gold += rw.gold; this.toast(`+${fmt(rw.gold)} gold`, '#ffd23f'); }
      if (rw.key && !st.keys[rw.key]) {
        st.keys[rw.key] = true;
        this.later(1.5, () => { this.itemGet = { key: rw.key, text: `Obtained the ${KEYS[rw.key].name}! ${KEYS[rw.key].name.split(' ')[0]} chests can now be opened.`, t: 0 }; Sound.sfx('levelup'); });
      }
      if (rw.seal) {
        st.seals[rw.seal] = true;
        this.later(3.2, () => this.toast(`Obtained the ${SEALS[rw.seal].name}! (${Object.keys(st.seals).length}/4)`, SEALS[rw.seal].color, 5));
      }
    }
    this.showBanner('VICTORY!', `${def.name} cleared`, '#ffd23f', 3);
    Sound.play('victory');
    this.later(6.5, () => { if (this.dungeon === dg && !def.final) Sound.play('dungeon'); });
    this.questEvent('clear', def.id);
    this.save(true);
    if (def.final) {
      st.finished = true;
      this.save(true);
      this.later(5.2, () => { if (this.dungeon === dg) this.fadeTo(() => this.setScene(new StoryScene(ENDING_SLIDES, 'ending')), 1.2); });
    }
  },

  // ---------------------------------------------------------
  // WORLD SYSTEMS
  // ---------------------------------------------------------
  worldSpawner(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 1.0;
    const w = this.world;
    const cx = this.cam.x, cy = this.cam.y;
    // despawn far away
    this.enemies = this.enemies.filter(e => {
      if (e.dead) return true;
      let near = false;
      for (const p of this.players) if (dist2(p.x, p.y, e.x, e.y) < 1500 * 1500) near = true;
      return near;
    });
    const alive = this.enemies.filter(e => !e.dead && dist2(cx, cy, e.x, e.y) < 1100 * 1100).length;
    const want = 7 + (this.players.length > 1 ? 2 : 0);
    if (alive >= want) return;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand(0, TAU), d = rand(620, 900);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (!w.inb(tx, ty) || w.solidTile(tx, ty) || !w.reach[w.idx(tx, ty)]) continue;
      if (w.inSafeZone(x, y, 4)) continue;
      const tt = w.tile(tx, ty);
      if (tt === T.BRIDGE) continue;
      const reg = REGIONS[w.regionAtTile(tx, ty)];
      let lvl;
      if (reg.id === 0) {
        const dd = dist(tx, ty, TOWNS.pawston.tx, TOWNS.pawston.ty);
        lvl = clamp(1 + Math.floor((dd - 10) / 6), 1, 8);
      } else lvl = randInt(reg.lv[0], reg.lv[1]);
      const n = this.state.level <= 2 && reg.id === 0 ? randInt(1, 2) : randInt(1, 3);
      for (let i = 0; i < n; i++) {
        const ex = x + rand(-50, 50), ey = y + rand(-40, 40);
        if (w.isSolid(ex, ey)) continue;
        let type = choose(reg.enemies);
        if (reg.id === 0 && lvl <= 2) type = Math.random() < 0.75 ? 'kitten' : 'tabby';
        this.enemies.push(new Enemy(type, Math.max(1, lvl + randInt(-1, 0)), ex, ey, { region: reg.id }));
      }
      return;
    }
  },

  updateRegion() {
    const p = this.players[0];
    if (!p || this.dungeon) return;
    const town = this.world.townAt(p.x, p.y);
    if (town !== this.townId) {
      this.townId = town;
      if (town) {
        this.showBanner(TOWNS[town].name, 'Safe Haven', '#ffe0a0', 2.5);
        Sound.play('town');
        if (this.state.lastTown !== town) { this.state.lastTown = town; this.save(true); }
      } else { this.regionId = -1; }
    }
    if (town) return;
    const reg = this.world.regionAt(p.x, p.y);
    if (reg !== this.regionId) {
      this.regionId = reg;
      const r = REGIONS[reg];
      this.showBanner(r.name, `Lv ${r.lv[0]} - ${r.lv[1]}`, '#ffffff', 3);
      Sound.play(r.music);
    }
  },

  // interactables near a player
  findInteractable(p) {
    const st = this.state;
    let best = null, bd = 1e9;
    const consider = (d2, r, obj) => { if (d2 < r * r && d2 < bd) { bd = d2; best = obj; } };
    const px = p.x, py = p.y;
    if (this.dungeon) {
      const dg = this.dungeon;
      consider(dist2(px, py, dg.exitPortal.x, dg.exitPortal.y), 46, { kind: 'exit', x: dg.exitPortal.x, y: dg.exitPortal.y, label: 'Leave dungeon' });
      if (dg.bossPortal) consider(dist2(px, py, dg.bossPortal.x, dg.bossPortal.y), 46, { kind: 'exit', x: dg.bossPortal.x, y: dg.bossPortal.y, label: 'Leave dungeon' });
      for (const c of dg.chests) if (!st.chests[c.id]) consider(dist2(px, py, c.x, c.y), 48, { kind: 'chest', chest: c, x: c.x, y: c.y, label: c.tier && !st.keys[c.tier] ? `Locked (${KEYS[c.tier].name})` : 'Open chest' });
      if (dg.rewardChest && !st.chests[dg.rewardChest.id]) consider(dist2(px, py, dg.rewardChest.x, dg.rewardChest.y), 50, { kind: 'chest', chest: dg.rewardChest, x: dg.rewardChest.x, y: dg.rewardChest.y, label: 'Open reward chest' });
      return best;
    }
    const w = this.world;
    for (const n of this.npcs) consider(dist2(px, py, n.x, n.y), 52, { kind: 'npc', npc: n, x: n.x, y: n.y, label: 'Talk' });
    if (this.townId || w.inSafeZone(px, py, 2)) {
      for (const b of w.buildings) {
        if (!b.door) continue;
        const lbl = { smith: 'Blacksmith', mage: 'Mage Tower', inn: 'Inn (Rest & Save)', house: 'House', board: 'Quest Board' }[b.kind];
        consider(dist2(px, py, b.door.x, b.door.y), b.kind === 'board' ? 46 : 40, { kind: 'building', b, x: b.door.x, y: b.door.y - (b.kind === 'board' ? 4 : 36), label: lbl });
      }
    }
    for (const e of w.entrances) {
      const d = e.dungeon;
      consider(dist2(px, py, e.x, e.y + 14), 56, { kind: 'entrance', e, x: e.x, y: e.y - 60, label: `Enter ${d.name} (Lv ${d.level})` });
    }
    for (const c of w.chests) if (!st.chests[c.id]) consider(dist2(px, py, c.x, c.y + 8), 50, { kind: 'chest', chest: c, x: c.x, y: c.y, label: c.tier && !st.keys[c.tier] ? `Locked (${KEYS[c.tier].name})` : 'Open chest' });
    return best;
  },

  interact(p, it) {
    switch (it.kind) {
      case 'npc': UI.talkTo(it.npc); break;
      case 'building': {
        const b = it.b;
        if (b.kind === 'smith') UI.open(new ShopOverlay('smith', b.town, p));
        else if (b.kind === 'mage') UI.open(new ShopOverlay('mage', b.town, p));
        else if (b.kind === 'board') UI.open(new BoardOverlay(b.town));
        else if (b.kind === 'inn') UI.dialog([{ name: 'Innkeeper', text: 'Welcome, weary heroes! Rest here to restore your health and save your journey.', choices: ['Rest & Save', 'Leave'] }], (c) => {
          if (c === 0) this.fadeTo(() => {
            for (const q of this.players) { q.down = false; q.refresh(); q.hp = q.stats.maxHp; q.mp = q.stats.maxMp; }
            this.state.lastTown = b.town;
            this.save();
            Sound.sfx('heal');
          }, 0.6);
        });
        else UI.dialog([{ name: 'Locked Door', text: 'Nobody seems to be home. You hear snoring inside... Zzz.' }]);
        break;
      }
      case 'entrance': this.enterDungeon(it.e.dungeon); break;
      case 'chest': this.openChest(it.chest, !!this.dungeon); break;
      case 'exit': this.exitDungeon(); break;
    }
  },

  gotoCheck() {
    for (const id in this.state.quests) {
      if (!this.questActive(id)) continue;
      const q = QUESTS[id];
      if (q.obj.type !== 'goto') continue;
      const s = this.world.gotoSpots[id];
      for (const p of this.players) {
        if (!p.down && dist2(p.x, p.y, s.x, s.y) < 70 * 70) {
          const who = id === 's_puppy' ? 'Biscuit' : 'Stranded Trader';
          const text = id === 's_puppy' ? 'Woof! Woof! *Biscuit wags his tail and runs back home to Pawston.*' : 'Heroes! Thank goodness! The cats stole my camel... er, dog-sled. Here, take this for your trouble!';
          UI.dialog([{ name: who, text }], () => this.questEvent('goto', id));
          return;
        }
      }
    }
  },

  respawn() {
    const st = this.state;
    const lost = Math.floor(st.gold * 0.1);
    st.gold -= lost;
    this.dungeon = null; this.map = this.world;
    this.enemies = []; this.projectiles = []; this.loot = []; this.telegraphs = []; this.boss = null;
    const town = TOWNS[st.lastTown] || TOWNS.pawston;
    for (const p of this.players) { p.down = false; p.refresh(); p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; p.invuln = 2; p.shield = null; p.state = 'idle'; }
    this.placePlayers(town.tx * TS + 16, (town.ty + 2) * TS + 16);
    this.cam.x = this.players[0].x; this.cam.y = this.players[0].y;
    this.regionId = -1; this.townId = null;
    this.setScene(new PlayScene());
    if (lost) this.toast(`You lost ${fmt(lost)} gold...`, '#ff9a8a');
  },
};

// ============================================================
// PLAY SCENE
// ============================================================
class PlayScene {
  constructor() { this.name = 'play'; this.downTimer = 0; this.weather = []; }
  enter() {}

  update(dt) {
    const G = Game;
    const st = G.state;
    st.playTime += dt;
    // overlays block gameplay
    if (G.overlays.length) {
      const top = G.overlays[G.overlays.length - 1];
      top.update(dt, Input.menu);
      return;
    }
    if (G.fade && !G.fade.fired) return;
    // pause
    for (const p of G.players) {
      const inp = Input.state(p.device);
      if (inp.pause) { UI.open(new PauseOverlay(p)); Sound.sfx('menu'); return; }
      if (inp.map) { UI.open(new PauseOverlay(p, 'map')); Sound.sfx('menu'); return; }
    }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    let sdt = dt;
    if (G.slowmoT > 0) { G.slowmoT -= dt; sdt = dt * 0.35; }
    this.simulate(sdt);
  }

  simulate(dt) {
    const G = Game;
    G.runTimers(dt);
    // players
    for (const p of G.players) {
      const inp = Input.state(p.device);
      if (p.slowT > 0) { p.slowT -= dt; inp.mx *= 0.6; inp.my *= 0.6; }
      p.update(dt, inp);
      p.interactable = p.down ? null : G.findInteractable(p);
      if (inp.interact && p.interactable && !G.overlays.length) { G.interact(p, p.interactable); Input.consume(); }
    }
    // co-op revive
    if (G.players.length > 1) {
      for (const p of G.players) {
        if (!p.down) continue;
        const o = G.players[1 - p.pid];
        if (!o.down && dist(o.x, o.y, p.x, p.y) < 60) p.reviveT = (p.reviveT || 0) + dt; else p.reviveT = Math.max(0, (p.reviveT || 0) - dt);
        if (p.downT <= 0 || p.reviveT >= 2) {
          p.down = false; p.hp = Math.round(p.stats.maxHp * 0.5); p.invuln = 1.5; p.reviveT = 0;
          G.floatText(p.x, p.y - 50, 'Revived!', '#8fe38f', 18); Sound.sfx('heal');
        }
      }
    }
    if (G.players.every(p => p.down)) {
      this.downTimer += dt;
      if (this.downTimer > 1.8) { G.setScene(new GameOverScene()); return; }
    } else this.downTimer = 0;

    // enemies
    for (const e of G.enemies) e.update(dt);
    G.enemies = G.enemies.filter(e => !(e.dead && e.deadT > 0.6));
    // telegraphs
    for (const tt of G.telegraphs) {
      if (tt.cancel) continue;
      if (tt.owner && tt.owner.dead) { tt.cancel = true; continue; }
      if (tt.follow && tt.owner) { tt.x = tt.owner.x; tt.y = tt.owner.y; }
      if (tt.aimAt && tt.t < tt.dur * 0.55 && !tt.aimAt.down) {
        tt.angle = angleTo(tt.x, tt.y - 12, tt.aimAt.x, tt.aimAt.y - 12);
        if (tt.owner) tt.owner.facing = tt.aimAt.x > tt.owner.x ? 1 : -1;
      }
      tt.t += dt;
      if (tt.t >= tt.dur && !tt.done) {
        tt.done = true;
        if (tt.onDone) tt.onDone.call(tt);
      }
    }
    G.telegraphs = G.telegraphs.filter(tt => !tt.cancel && !tt.done);
    // projectiles, loot, npcs, particles, texts
    for (const pr of G.projectiles) pr.update(dt);
    G.projectiles = G.projectiles.filter(p => !p.dead);
    for (const l of G.loot) l.update(dt);
    G.loot = G.loot.filter(l => !l.dead);
    if (!G.dungeon) for (const n of G.npcs) n.update(dt);
    G.particles.update(dt);
    for (const t of G.texts) t.update(dt);
    G.texts = G.texts.filter(t => t.t < t.life);
    // world/dungeon systems
    if (G.dungeon) {
      const dg = G.dungeon;
      if (!dg.bossSpawned && !dg.bossDead) {
        for (const p of G.players) if (!p.down && dg.insideBossRoom(p.x, p.y, 1)) { G.triggerBoss(); break; }
      }
      for (const c of dg.chests) if (c.openT != null) c.openT += dt;
    } else {
      G.worldSpawner(dt);
      G.updateRegion();
      G.gotoCheck();
      G.autosaveT += dt;
      if (G.autosaveT > 90) { G.autosaveT = 0; G.save(true); }
    }
    this.updateCamera(dt);
    this.updateWeather(dt);
  }

  updateCamera(dt) {
    const G = Game, cam = G.cam;
    const ps = G.players.filter(p => !p.down);
    const list = ps.length ? ps : G.players;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const p of list) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
    const tx = (minx + maxx) / 2, ty = (miny + maxy) / 2 - 10;
    const needW = (maxx - minx) + 360, needH = (maxy - miny) + 260;
    const tz = clamp(Math.min(VIEW_W / needW, VIEW_H / needH), 0.62, 1);
    cam.zoom = lerp(cam.zoom, tz, 1 - Math.pow(0.02, dt));
    cam.x = lerp(cam.x, tx, 1 - Math.pow(0.0005, dt));
    cam.y = lerp(cam.y, ty, 1 - Math.pow(0.0005, dt));
    // clamp to map bounds
    const m = G.map, mw = m.w * TS, mh = m.h * TS;
    const hw = VIEW_W / 2 / cam.zoom, hh = VIEW_H / 2 / cam.zoom;
    cam.x = mw > hw * 2 ? clamp(cam.x, hw, mw - hw) : mw / 2;
    cam.y = mh > hh * 2 ? clamp(cam.y, hh, mh - hh) : mh / 2;
    if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 30);
  }

  updateWeather(dt) {
    const G = Game;
    let kind = null;
    if (!G.dungeon) {
      const r = G.world.regionAt(G.cam.x, G.cam.y);
      kind = ['leaf', 'sand', 'snow', 'firefly', 'ember', 'leaf'][r];
      if (G.townId) kind = null;
    }
    const W = this.weather;
    if (kind && W.length < (kind === 'snow' ? 90 : 40) && Math.random() < 0.7) {
      W.push({ kind, x: rand(0, VIEW_W), y: kind === 'ember' ? VIEW_H + 10 : rand(-20, VIEW_H), t: 0, life: rand(3, 7), s: rand(0.6, 1.4), ph: rand(0, TAU) });
    }
    for (const w of W) {
      w.t += dt;
      switch (w.kind) {
        case 'snow': w.y += 40 * w.s * dt; w.x += Math.sin(w.t * 2 + w.ph) * 20 * dt - 10 * dt; break;
        case 'sand': w.x += 160 * w.s * dt; w.y += Math.sin(w.t * 3 + w.ph) * 10 * dt; break;
        case 'ember': w.y -= 40 * w.s * dt; w.x += Math.sin(w.t * 2 + w.ph) * 15 * dt; break;
        case 'firefly': w.x += Math.sin(w.t + w.ph) * 20 * dt; w.y += Math.cos(w.t * 1.3 + w.ph) * 20 * dt; break;
        case 'leaf': w.x += 30 * w.s * dt; w.y += 25 * w.s * dt; break;
      }
    }
    this.weather = W.filter(w => w.t < w.life && w.kind === kind);
  }

  // ---------------------------------------------------------
  draw(ctx) {
    const G = Game, cam = G.cam;
    const z = cam.zoom;
    const shx = cam.shake ? rand(-cam.shake, cam.shake) : 0, shy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z;
    const x0 = cam.x - hw, y0 = cam.y - hh, x1 = cam.x + hw, y1 = cam.y + hh;
    ctx.save();
    ctx.translate(VIEW_W / 2 + shx, VIEW_H / 2 + shy);
    ctx.scale(z, z);
    ctx.translate(-Math.round(cam.x * z) / z, -Math.round(cam.y * z) / z);
    const map = G.map;
    if (G.dungeon) { ctx.fillStyle = '#08070a'; ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20); }
    map.cache.draw(ctx, x0 - 2, y0 - 2, x1 + 2, y1 + 2, Math.ceil(map.w / 8), Math.ceil(map.h / 8));
    if (!G.dungeon) G.world.drawAnimated(ctx, x0, y0, x1, y1, G.time);
    // flat props
    const draws = [];
    if (!G.dungeon) {
      const props = G.world.propsInRect(x0 - 100, y0 - 60, x1 + 100, y1 + 160, []);
      for (const p of props) {
        if (p.type === 'flower') drawFlower(ctx, p.x, p.y, p.seed, G.time);
        else draws.push(p);
      }
      for (const e of G.world.entrances) if (e.x > x0 - 120 && e.x < x1 + 120 && e.y > y0 - 40 && e.y < y1 + 160) draws.push({ type: 'entrance', e, x: e.x, y: e.y });
      for (const c of G.world.chests) if (c.x > x0 - 40 && c.x < x1 + 40 && c.y > y0 - 40 && c.y < y1 + 60) draws.push({ type: 'chest', c, x: c.x, y: c.y });
      for (const n of G.npcs) draws.push({ type: 'ent', ent: n, x: n.x, y: n.y });
      // goto quest targets
      for (const id in G.state.quests) {
        if (!G.questActive(id) || QUESTS[id].obj.type !== 'goto') continue;
        const s = G.world.gotoSpots[id];
        draws.push({ type: 'gotoNpc', id, x: s.x, y: s.y });
      }
    } else {
      const dg = G.dungeon;
      dg.drawGates(ctx, G.time);
      for (const p of dg.props) if (p.x > x0 - 60 && p.x < x1 + 60 && p.y > y0 - 20 && p.y < y1 + 80) draws.push(p);
      for (const c of dg.chests) draws.push({ type: 'chest', c, x: c.x, y: c.y });
      if (dg.rewardChest) draws.push({ type: 'chest', c: dg.rewardChest, x: dg.rewardChest.x, y: dg.rewardChest.y });
      for (const tch of dg.torches) if (tch.x > x0 - 20 && tch.x < x1 + 20 && tch.y > y0 - 20 && tch.y < y1 + 20) drawTorch(ctx, tch.x, tch.y, G.time, dg.theme.light);
      drawPortal(ctx, dg.exitPortal.x, dg.exitPortal.y, G.time, '#7fe0ff');
      if (dg.bossPortal) drawPortal(ctx, dg.bossPortal.x, dg.bossPortal.y, G.time, '#ffd23f');
    }
    // telegraphs (ground)
    for (const tt of G.telegraphs) UI.drawTelegraph(ctx, tt);
    for (const l of G.loot) draws.push({ type: 'ent', ent: l, x: l.x, y: l.y });
    for (const e of G.enemies) draws.push({ type: 'ent', ent: e, x: e.x, y: e.y });
    for (const p of G.players) draws.push({ type: 'ent', ent: p, x: p.x, y: p.y });
    draws.sort((a, b) => a.y - b.y);
    const st = G.state;
    for (const d of draws) {
      switch (d.type) {
        case 'tree': drawTree(ctx, d.x, d.y, d.kind, d.seed, G.time); break;
        case 'rock': drawRock(ctx, d.x, d.y, d.kind, d.seed); break;
        case 'building': drawBuilding(ctx, Object.assign(d.b, { alert: d.b.kind === 'board' && G.availableBoardQuests(d.b.town).length > 0 }), G.time); break;
        case 'entrance': drawEntrance(ctx, d.x, d.y, d.e.dungeon.theme, st.cleared[d.e.dungeon.id], G.time, d.e.dungeon.final && st.barrier); break;
        case 'chest': drawChest(ctx, d.x, d.y, d.c.tier, !!st.chests[d.c.id], G.time, d.c.tier > 0 && !st.keys[d.c.tier]); break;
        case 'pillar': case 'ddeco': drawDungeonProp(ctx, d, G.dungeon.def.theme, G.time); break;
        case 'gotoNpc': {
          if (d.id === 's_puppy') drawDog(ctx, { x: d.x, y: d.y, facing: Math.sin(G.time) > 0 ? 1 : -1, t: G.time, look: { fur: '#e8c080', fur2: '#fff6e8', ear: 'floppy', tail: 'feather', small: true }, move: 0 });
          else drawDog(ctx, { x: d.x, y: d.y, facing: -1, t: G.time, look: { fur: '#8a6a4a', fur2: '#e8d8c0', ear: 'rose', tail: 'stub', hat: 'turban', hatColor: '#2a8a8a' }, move: 0 });
          ctx.font = 'bold 22px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f'; ctx.fillText('?', d.x, d.y - 46 + Math.sin(G.time * 5) * 3);
          break;
        }
        case 'ent': d.ent.draw(ctx); break;
      }
    }
    for (const pr of G.projectiles) pr.draw(ctx);
    G.particles.draw(ctx);
    // enemy health bars & alerts
    for (const e of G.enemies) UI.drawEnemyBar(ctx, e);
    for (const p of G.players) UI.drawPlayerTag(ctx, p);
    for (const t of G.texts) t.draw(ctx);
    // interact prompts
    for (const p of G.players) if (p.interactable && !G.overlays.length) UI.drawPrompt(ctx, p);
    ctx.restore();

    // lighting in dungeons
    if (G.dungeon) this.drawLighting(ctx, x0, y0, z);
    else this.drawAmbience(ctx);
    this.drawWeather(ctx);
    UI.drawHUD(ctx);
    for (const o of G.overlays) o.draw(ctx);
  }

  drawLighting(ctx, x0, y0, z) {
    const G = Game, dg = G.dungeon;
    if (!this.lightCanvas) { this.lightCanvas = document.createElement('canvas'); this.lightCanvas.width = VIEW_W / 2; this.lightCanvas.height = VIEW_H / 2; }
    const lc = this.lightCanvas, g = lc.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lc.width, lc.height);
    g.fillStyle = `rgba(4,2,10,${dg.theme.dark})`;
    g.fillRect(0, 0, lc.width, lc.height);
    g.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r, a = 1) => {
      const sx = ((wx - x0) * z) / 2, sy = ((wy - y0) * z) / 2, sr = r * z / 2;
      if (sx < -sr || sy < -sr || sx > lc.width + sr || sy > lc.height + sr) return;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    };
    for (const p of G.players) light(p.x, p.y - 14, 230, 1);
    const fl = 1 + Math.sin(G.time * 9) * 0.04;
    for (const t of dg.torches) light(t.x, t.y, 150 * fl, 0.85);
    light(dg.exitPortal.x, dg.exitPortal.y, 120, 0.8);
    if (dg.bossPortal) light(dg.bossPortal.x, dg.bossPortal.y, 120, 0.8);
    for (const pr of G.projectiles) light(pr.x, pr.y, 90, 0.7);
    if (G.boss) light(G.boss.x, G.boss.y - 20, 200, 0.6);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0, VIEW_W, VIEW_H);
    // warm tint
    ctx.fillStyle = rgba(dg.theme.light, 0.05);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawAmbience(ctx) {
    const G = Game;
    const r = G.world.regionAt(G.cam.x, G.cam.y);
    const tint = [null, 'rgba(255,200,120,0.06)', 'rgba(170,210,255,0.08)', 'rgba(20,30,70,0.18)', 'rgba(255,80,30,0.1)', 'rgba(255,190,80,0.07)'][r];
    if (tint && !G.townId) { ctx.fillStyle = tint; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    // vignette
    if (!this.vig) {
      this.vig = document.createElement('canvas'); this.vig.width = VIEW_W; this.vig.height = VIEW_H;
      const g = this.vig.getContext('2d');
      const gr = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.drawImage(this.vig, 0, 0);
  }

  drawWeather(ctx) {
    for (const w of this.weather) {
      const a = Math.min(1, w.t, (w.life - w.t)) ;
      ctx.globalAlpha = clamp(a, 0, 1);
      switch (w.kind) {
        case 'snow': fillCirc(ctx, '#ffffff', w.x, w.y, 1.5 * w.s + 0.5); break;
        case 'sand': fillCirc(ctx, 'rgba(240,210,150,0.7)', w.x, w.y, 1.2 * w.s); break;
        case 'ember': fillCirc(ctx, '#ff8a3a', w.x, w.y, 1.4 * w.s); break;
        case 'firefly': ctx.globalAlpha *= 0.5 + Math.sin(w.t * 4 + w.ph) * 0.5; fillCirc(ctx, 'rgba(220,255,120,0.4)', w.x, w.y, 5); fillCirc(ctx, '#f0ffa0', w.x, w.y, 1.6); break;
        case 'leaf': ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.t * 2 + w.ph); fillEll(ctx, w.ph > 3 ? '#8ac858' : '#e8a040', 0, 0, 3.5, 1.8); ctx.restore(); break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

window.addEventListener('load', () => {
  const start = () => Game.init();
  if (document.fonts && document.fonts.load) {
    Promise.race([document.fonts.load('20px Fredoka'), new Promise(r => setTimeout(r, 1500))]).then(start, start);
  } else start();
});
