// ============================================================
// Dog Quest - entities: players, enemies, projectiles, particles
// ============================================================
'use strict';

function itemLevelMult(id) { return 1 + 0.12 * ((Game.state.inv[id] || 1) - 1); }
function xpForLevel(L) { return Math.floor(20 + 16 * Math.pow(L, 1.55)); }
function spellMult(lvl) { return 1 + 0.18 * (lvl - 1); }

function computeStats(p) {
  const b = BREEDS[p.breed];
  const L = Game.state.level;
  const eq = p.equip;
  const w = ITEMS[eq.weapon] || ITEMS.stick;
  const he = eq.helmet ? ITEMS[eq.helmet] : null;
  const ar = eq.armor ? ITEMS[eq.armor] : null;
  const wl = itemLevelMult(w.id), hl = he ? itemLevelMult(he.id) : 1, al = ar ? itemLevelMult(ar.id) : 1;
  const st = {};
  st.maxHp = Math.round((50 + 14 * L) * b.hp + (he ? he.hp * hl : 0) + (ar ? ar.hp * al : 0));
  st.maxMp = Math.round((40 + 3 * L) * b.mp);
  st.atk = (6 + 2.4 * L) * b.atk + w.atk * wl;
  st.mag = (5 + 2.4 * L) * b.mag + (w.mag * wl) + (he ? he.mag * hl : 0) + (ar ? ar.mag * al : 0);
  st.def = ((he ? he.def * hl : 0) + (ar ? ar.def * al : 0)) * b.def + L * 0.5;
  st.crit = b.crit;
  st.speed = 158 * b.spd;
  st.wtype = WEAPON_TYPES[w.type];
  st.weapon = w; st.helmet = he; st.armor = ar;
  return st;
}

// ------------------------------------------------------------
// PLAYER
// ------------------------------------------------------------
class Player {
  constructor(pid, breed, device) {
    this.pid = pid; this.breed = breed; this.device = device;
    this.look = BREEDS[breed];
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = 11; this.hgt = 26;
    this.facing = 1; this.aimX = 1; this.aimY = 0;
    this.state = 'idle'; this.t = Math.random() * 10; this.phase = 0; this.move = 0;
    this.attackT = 0; this.attackDur = 0.3; this.combo = 0; this.comboTimer = 0; this.hitSet = new Set(); this.attackQueued = false; this.hitDone = false;
    this.rollT = 0; this.rollCd = 0; this.rollDX = 0; this.rollDY = 0;
    this.castT = -1; this.castColor = '#fff';
    this.spellCd = {};
    this.flashT = 0; this.invuln = 0;
    this.shield = null;
    this.down = false; this.downT = 0;
    this.equip = { weapon: null, helmet: null, armor: null };
    this.spells = [null, null, null, null];
    this.stats = null;
    this.hp = 1; this.mp = 1;
    this.stepT = 0;
  }
  get alive() { return !this.down; }
  cx() { return this.x; }
  cy() { return this.y - 12; }

  refresh(keepRatio = true) {
    const old = this.stats;
    this.stats = computeStats(this);
    if (!old) { this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; return; }
    if (keepRatio) { this.hp = Math.min(this.stats.maxHp, Math.max(1, Math.round(this.hp / old.maxHp * this.stats.maxHp))); this.mp = Math.min(this.stats.maxMp, this.mp); }
  }

  update(dt, inp) {
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.rollCd > 0) this.rollCd -= dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    for (const k in this.spellCd) if (this.spellCd[k] > 0) this.spellCd[k] -= dt;
    if (this.castT >= 0) { this.castT += dt * 3; if (this.castT >= 1) this.castT = -1; }
    if (this.shield) {
      this.shield.t -= dt; this.shield.angle += dt * 4;
      if (this.shield.t <= 0 || this.shield.hp <= 0) { this.shield = null; Game.burst(this.x, this.y - 14, '#f4f0e6', 14, 120); }
      else this.shieldHits(dt);
    }
    // knockback
    if (this.vx || this.vy) {
      Game.moveEntity(this, this.vx * dt, this.vy * dt);
      this.vx *= Math.pow(0.001, dt); this.vy *= Math.pow(0.001, dt);
      if (Math.abs(this.vx) < 5 && Math.abs(this.vy) < 5) { this.vx = this.vy = 0; }
    }
    if (this.down) {
      this.downT -= dt;
      this.move = 0;
      return;
    }
    const st = this.stats;
    // passive mana regen
    this.mp = Math.min(st.maxMp, this.mp + dt * (1.2 + st.maxMp * 0.006));

    if (this.state === 'roll') {
      this.rollT += dt;
      const sp = st.speed * 2.5 * (1 - this.rollT / 0.4 * 0.4);
      Game.moveEntity(this, this.rollDX * sp * dt, this.rollDY * sp * dt);
      this.move = 1; this.phase += dt * 20;
      if (this.rollT >= 0.36) { this.state = 'idle'; }
      if (Math.random() < 0.5) Game.particles.add({ x: this.x + rand(-6, 6), y: this.y - 2, vx: rand(-20, 20), vy: rand(-30, -5), life: 0.4, size: rand(3, 5), color: 'rgba(200,190,170,0.7)', type: 'smoke' });
      return;
    }

    let mx = inp.mx, my = inp.my;
    const moving = Math.hypot(mx, my) > 0.15;
    if (moving) {
      const m = Math.hypot(mx, my);
      this.aimX = mx / m; this.aimY = my / m;
      if (Math.abs(mx) > 0.2) this.facing = mx > 0 ? 1 : -1;
    }

    if (this.state === 'attack') {
      this.attackT += dt;
      const p = this.attackT / this.attackDur;
      // lunge
      const lungeSp = p < 0.5 ? 110 : 0;
      Game.moveEntity(this, this.aimX * lungeSp * dt, this.aimY * lungeSp * dt);
      if (!this.hitDone && p >= 0.38) { this.hitDone = true; this.doMeleeHit(); }
      if (inp.attack && p > 0.45 && this.combo < 3) this.attackQueued = true;
      if (p >= 1) {
        this.state = 'idle';
        if (this.attackQueued) { this.attackQueued = false; this.startAttack(); }
      }
      this.move = 0.2;
    } else {
      const slow = this.castT >= 0 ? 0.5 : 1;
      const sp = st.speed * slow;
      if (moving) {
        Game.moveEntity(this, mx * sp * dt, my * sp * dt);
        this.phase += dt * 15 * Math.hypot(mx, my);
        this.move = Math.min(1, Math.hypot(mx, my));
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.28; Game.footstep(this); }
      } else { this.move = Math.max(0, this.move - dt * 6); }
      if (inp.attack) this.startAttack();
    }
    if (inp.roll && this.rollCd <= 0 && this.state !== 'roll') {
      this.state = 'roll'; this.rollT = 0;
      this.rollCd = this.breed === 'shiba' ? 0.35 : 0.55;
      if (moving) { this.rollDX = this.aimX; this.rollDY = this.aimY; } else { this.rollDX = this.facing; this.rollDY = 0; }
      if (Math.abs(this.rollDX) > 0.2) this.facing = this.rollDX > 0 ? 1 : -1;
      this.invuln = Math.max(this.invuln, 0.38);
      this.combo = 0; this.attackQueued = false;
      Sound.sfx('roll');
    }
    for (let i = 0; i < 4; i++) if (inp.spell[i]) this.castSpell(i);
  }

  startAttack() {
    if (this.state === 'attack') return;
    const wt = this.stats.wtype;
    this.combo = (this.combo % 3) + 1;
    this.comboTimer = 0.7;
    this.state = 'attack';
    this.attackT = 0;
    this.attackDur = (this.combo === 3 ? 0.4 : 0.3) / wt.speed;
    this.hitDone = false;
    this.hitSet.clear();
    // auto-aim assist: turn towards the nearest enemy in front
    const tgt = Game.nearestEnemy(this.x, this.y - 10, wt.range + 60);
    if (tgt) {
      const a = angleTo(this.x, this.y - 10, tgt.x, tgt.y - tgt.hgt * 0.5);
      const cur = Math.atan2(this.aimY, this.aimX);
      if (Math.abs(angleDiff(cur, a)) < 1.3) { this.aimX = Math.cos(a); this.aimY = Math.sin(a); if (Math.abs(this.aimX) > 0.15) this.facing = this.aimX > 0 ? 1 : -1; }
    } else if (Math.abs(this.aimX) < 0.01 && Math.abs(this.aimY) < 0.01) { this.aimX = this.facing; }
    Sound.sfx(wt.sfx, { pitch: 0.9 + this.combo * 0.1 });
  }

  doMeleeHit() {
    const st = this.stats, wt = st.wtype;
    const reach = wt.range + (this.combo === 3 ? 8 : 0);
    const ox = this.x, oy = this.y - 10;
    const aim = Math.atan2(this.aimY, this.aimX);
    Game.slashFx(this, aim, reach);
    let hitAny = false;
    for (const e of Game.enemies) {
      if (e.dead || this.hitSet.has(e)) continue;
      const ex = e.x, ey = e.y - e.hgt * 0.5;
      const d = dist(ox, oy, ex, ey);
      if (d > reach + e.r) continue;
      if (d > e.r + 6 && Math.abs(angleDiff(aim, angleTo(ox, oy, ex, ey))) > wt.arc) continue;
      this.hitSet.add(e);
      const crit = Math.random() < st.crit;
      let dmg = st.atk * rand(0.9, 1.1) * (this.combo === 3 ? 1.5 : 1) * (crit ? 1.8 : 1);
      Game.damageEnemy(e, dmg, { crit, knock: this.combo === 3 ? 260 : 110, fromX: this.x, fromY: this.y, stagger: this.combo === 3, player: this });
      this.mp = Math.min(st.maxMp, this.mp + 3.5 + st.maxMp * 0.02);
      hitAny = true;
    }
    if (hitAny) Game.hitstop = Math.max(Game.hitstop, this.combo === 3 ? 0.07 : 0.035);
  }

  castSpell(slot) {
    const id = this.spells[slot];
    if (!id) { Game.floatText(this.x, this.y - 44, 'No spell', '#aaaaaa', 12); Sound.sfx('error'); return; }
    const sp = SPELLS[id];
    if ((this.spellCd[id] || 0) > 0) return;
    if (this.mp < sp.cost) { Game.floatText(this.x, this.y - 44, 'Not enough mana!', '#6ab5ff', 13); Sound.sfx('error'); return; }
    this.mp -= sp.cost;
    this.spellCd[id] = sp.cd;
    this.castT = 0; this.castColor = sp.color;
    Game.castSpell(this, id, Game.state.spells[id] || 1);
  }

  shieldHits(dt) {
    const sh = this.shield;
    sh.tick -= dt;
    if (sh.tick > 0) return;
    sh.tick = 0.35;
    for (let i = 0; i < 4; i++) {
      const a = sh.angle + i * TAU / 4;
      const bx = this.x + Math.cos(a) * 34, by = this.y - 12 + Math.sin(a) * 20;
      for (const e of Game.enemies) {
        if (e.dead) continue;
        if (dist2(bx, by, e.x, e.y - e.hgt * 0.5) < (e.r + 10) ** 2) Game.damageEnemy(e, sh.dmg, { knock: 90, fromX: this.x, fromY: this.y, magic: true });
      }
    }
  }

  draw(ctx) {
    const st = this.stats;
    const dead = this.down ? 1 : 0;
    if (this.invuln > 0 && this.state !== 'roll' && !this.down && Math.floor(this.t * 20) % 2 === 0) ctx.globalAlpha = 0.55;
    drawDog(ctx, {
      x: this.x, y: this.y, facing: this.facing, t: this.t, phase: this.phase, move: this.move,
      attack: this.state === 'attack' ? clamp(this.attackT / this.attackDur, 0, 1) : -1, attackUp: this.combo === 2,
      roll: this.state === 'roll' ? this.rollT / 0.36 : -1, cast: this.castT, castColor: this.castColor,
      dead, flash: this.flashT > 0 ? '#ffffff' : null, look: this.look, seed: this.pid * 3,
      equip: { weapon: st.weapon, helmet: st.helmet, armor: st.armor },
    });
    ctx.globalAlpha = 1;
    if (this.shield) {
      for (let i = 0; i < 4; i++) {
        const a = this.shield.angle + i * TAU / 4;
        drawBone(ctx, this.x + Math.cos(a) * 34, this.y - 12 + Math.sin(a) * 20, 16, 0.8, '#f4f0e6', a * 2);
      }
      ctx.globalAlpha = 0.18; fillEll(ctx, '#f4f0e6', this.x, this.y - 14, 26, 24); ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------
// ENEMY (cat)
// ------------------------------------------------------------
class Enemy {
  constructor(typeId, level, x, y, opts = {}) {
    const base = ENEMIES[typeId];
    this.typeId = typeId;
    this.bossId = opts.boss || null;
    const bd = this.bossId ? BOSSES[this.bossId] : null;
    this.def = bd ? Object.assign({}, ENEMIES[bd.base], bd, { id: bd.base }) : base;
    if (bd) { this.def.name = bd.name; if (!bd.fur) this.def.fur = ENEMIES[bd.base].fur; }
    this.boss = !!bd;
    this.level = level;
    const coop = Game.players.length > 1 ? 1.5 : 1;
    const baseHp = 28 + 15 * level;
    this.maxHp = Math.round(baseHp * (bd ? bd.hp : base.hp) * coop);
    this.hp = this.maxHp;
    this.atk = (5 + 3.1 * level) * (bd ? bd.atk : base.atk);
    this.size = bd ? bd.scale : base.size;
    this.r = 11 * Math.sqrt(this.size) * (bd ? 1.2 : 1);
    this.hgt = 22 * this.size;
    this.speed = (bd ? 95 : base.spd) * (bd && bd.lion ? 1.1 : 1);
    this.x = x; this.y = y; this.homeX = x; this.homeY = y;
    this.vx = 0; this.vy = 0;
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.t = Math.random() * 10; this.phase = 0; this.move = 0; this.seed = Math.random() * 10;
    this.state = 'idle'; this.stateT = 0; this.atkCd = rand(0.4, 1.2);
    this.flashT = 0; this.slowT = 0; this.stunT = 0;
    this.dead = false; this.deadT = 0;
    this.dormant = !!opts.dormant; this.room = opts.room != null ? opts.room : -1;
    this.target = null; this.aggro = false;
    this.wanderT = rand(0.5, 2); this.wx = 0; this.wy = 0;
    this.tele = []; this.move_ = null;
    this.moveIdx = 0; this.phase2 = false;
    this.dash = null; this.leap = null;
    this.alertT = 0;
    this.region = opts.region != null ? opts.region : 0;
  }
  get ai() { return this.def.ai; }

  nearestPlayer(maxD = 1e9) {
    let best = null, bd = maxD * maxD;
    for (const p of Game.players) {
      if (p.down) continue;
      const d = dist2(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  update(dt) {
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.alertT > 0) this.alertT -= dt;
    if (this.dead) { this.deadT += dt; return; }
    if (this.slowT > 0) this.slowT -= dt;
    // knockback
    if (this.vx || this.vy) {
      Game.moveEntity(this, this.vx * dt, this.vy * dt);
      const k = Math.pow(this.boss ? 0.0001 : 0.002, dt);
      this.vx *= k; this.vy *= k;
      if (Math.abs(this.vx) < 5 && Math.abs(this.vy) < 5) this.vx = this.vy = 0;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.move = 0; if (this.state === 'windup') this.cancelAttack(); return; }
    if (this.dormant) {
      const p = this.nearestPlayer(230);
      let wake = !!p;
      if (!wake && Game.map.roomAt) for (const pl of Game.players) if (!pl.down && Game.map.roomAt(pl.x, pl.y) === this.room && this.room >= 0) wake = true;
      if (!wake) { this.move = 0; return; }
      this.dormant = false;
    }
    const spMul = (this.slowT > 0 ? 0.5 : 1) * (this.phase2 ? 1.25 : 1);
    this.stateT += dt;
    this.atkCd -= dt * (this.phase2 ? 1.3 : 1);

    // dash / leap motion
    if (this.dash) { this.updateDash(dt); return; }
    if (this.leap) { this.updateLeap(dt); return; }

    const aggroR = this.boss ? 2000 : 330;
    let tgt = this.nearestPlayer(this.aggro ? aggroR * 1.6 : aggroR);
    // towns are safe
    if (tgt && Game.map.inSafeZone(tgt.x, tgt.y, 0) && !this.boss) tgt = null;
    if (Game.map.inSafeZone(this.x, this.y, -1) && !this.boss) {
      const town = Game.map.townAt(this.x, this.y);
      if (town) { const tw = TOWNS[town]; const a = angleTo(tw.tx * TS, tw.ty * TS, this.x, this.y); this.walk(Math.cos(a), Math.sin(a), this.speed, dt); }
      this.aggro = false; this.target = null;
      if (this.state === 'windup') this.cancelAttack();
      this.state = 'idle';
      return;
    }
    if (tgt && !this.aggro) { this.aggro = true; this.alertT = 0.8; if (Math.random() < 0.5) Sound.sfx(Math.random() < 0.5 ? 'meow' : 'hiss', { pitch: 1.3 / Math.sqrt(this.size) }); }
    if (!tgt) this.aggro = false;
    this.target = tgt;

    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = rand(1, 3);
          if (Math.random() < 0.6) { const a = rand(0, TAU); this.wx = Math.cos(a); this.wy = Math.sin(a); } else { this.wx = this.wy = 0; }
          if (dist(this.x, this.y, this.homeX, this.homeY) > 160) { const a = angleTo(this.x, this.y, this.homeX, this.homeY); this.wx = Math.cos(a); this.wy = Math.sin(a); }
        }
        if (this.wx || this.wy) this.walk(this.wx, this.wy, this.speed * 0.35, dt); else this.move = Math.max(0, this.move - dt * 4);
        if (tgt) { this.state = 'chase'; this.stateT = 0; }
        break;
      }
      case 'chase': {
        if (!tgt) { this.state = 'idle'; break; }
        const d = dist(this.x, this.y, tgt.x, tgt.y);
        const a = angleTo(this.x, this.y, tgt.x, tgt.y);
        this.facing = tgt.x > this.x ? 1 : -1;
        const want = this.preferredRange();
        if (this.atkCd <= 0 && d <= want.attack) { this.beginAttack(tgt); break; }
        if (d > want.max) this.walk(Math.cos(a), Math.sin(a), this.speed * spMul, dt);
        else if (d < want.min) this.walk(-Math.cos(a), -Math.sin(a), this.speed * 0.7 * spMul, dt);
        else {
          // strafe
          const s = Math.sin(this.t * 0.8 + this.seed) > 0 ? 1 : -1;
          this.walk(Math.cos(a + s * Math.PI / 2), Math.sin(a + s * Math.PI / 2), this.speed * 0.4 * spMul, dt);
        }
        // separation from other enemies
        break;
      }
      case 'windup': {
        this.move = 0;
        if (this.tele.length === 0 || this.tele.every(tt => tt.done)) {
          this.state = 'attack'; this.stateT = 0;
        }
        break;
      }
      case 'attack': {
        this.move = 0;
        if (this.stateT > 0.3) { this.state = 'recover'; this.stateT = 0; }
        break;
      }
      case 'recover': {
        this.move = 0;
        if (this.stateT > (this.boss ? (this.phase2 ? 0.35 : 0.6) : 0.55)) { this.state = 'chase'; this.stateT = 0; }
        break;
      }
    }
    if (this.boss && !this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      Game.bossPhase2(this);
    }
  }

  walk(dx, dy, sp, dt) {
    // separation
    let sx = 0, sy = 0;
    for (const o of Game.enemies) {
      if (o === this || o.dead) continue;
      const d2 = dist2(this.x, this.y, o.x, o.y), rr = (this.r + o.r) * 1.2;
      if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2); sx += (this.x - o.x) / d * (rr - d) / rr; sy += (this.y - o.y) / d * (rr - d) / rr; }
    }
    dx += sx * 1.5; dy += sy * 1.5;
    const m = Math.hypot(dx, dy);
    if (m < 0.01) { this.move = 0; return; }
    dx /= m; dy /= m;
    const ox = this.x, oy = this.y;
    Game.moveEntity(this, dx * sp * dt, dy * sp * dt);
    const moved = Math.hypot(this.x - ox, this.y - oy);
    this.phase += moved * 0.12;
    this.move = clamp(moved / (sp * dt + 0.001), 0, 1) * Math.min(1, sp / 60);
    if (Math.abs(dx) > 0.2) this.facing = dx > 0 ? 1 : -1;
  }

  preferredRange() {
    const s = this.size;
    switch (this.ai) {
      case 'archer': return { min: 150, max: 300, attack: 380 };
      case 'caster': return { min: 170, max: 280, attack: 340 };
      case 'breath': return { min: 40, max: 100, attack: 120 * Math.sqrt(s) };
      case 'dasher': return { min: 120, max: 220, attack: 260 };
      case 'pouncer': return { min: 90, max: 180, attack: 220 };
      case 'ninja': return { min: 110, max: 220, attack: 260 };
      case 'brute': return { min: 0, max: 36 * s, attack: 60 * s };
      default: return { min: 0, max: 26 * s + 14, attack: 44 * s + 16 };
    }
  }

  cancelAttack() {
    for (const tt of this.tele) { tt.cancel = true; }
    this.tele = [];
    this.state = 'chase'; this.stateT = 0;
  }

  beginAttack(tgt) {
    this.state = 'windup'; this.stateT = 0;
    this.tele = [];
    let move;
    if (this.boss) {
      const moves = this.def.moves;
      move = moves[this.moveIdx % moves.length];
      this.moveIdx++;
      if (move === 'summon' && Game.enemies.filter(e => !e.dead && !e.boss).length >= (this.phase2 ? 5 : 3)) move = moves[this.moveIdx++ % moves.length];
      if (move === 'summon' && Game.enemies.filter(e => !e.dead && !e.boss).length >= 5) move = 'swipe';
      this.atkCd = this.phase2 ? rand(0.2, 0.6) : rand(0.6, 1.2);
    } else {
      move = { melee: 'swipe', brute: 'slam', archer: 'arrow', caster: 'orb', dasher: 'dash', pouncer: 'pounce', breath: 'breath', ninja: 'ninja' }[this.ai] || 'swipe';
      this.atkCd = rand(1.3, 2.4);
    }
    Enemy.MOVES[move].call(this, tgt);
    if (this.tele.length === 0) { this.state = 'attack'; this.stateT = 0; }
  }

  addTele(opts, onDone) {
    const wmul = this.boss ? (this.phase2 ? 0.8 : 1) : 1;
    const tt = Object.assign({ t: 0, dur: 0.7 * wmul, owner: this, done: false, cancel: false, onDone }, opts);
    tt.dur = (opts.dur || 0.7) * wmul;
    this.tele.push(tt);
    Game.telegraphs.push(tt);
    return tt;
  }

  dmg(mult) { return this.atk * mult; }

  updateDash(dt) {
    const d = this.dash;
    d.t += dt;
    const step = d.speed * dt;
    const ox = this.x, oy = this.y;
    Game.moveEntity(this, d.dx * step, d.dy * step);
    this.move = 1; this.phase += dt * 25;
    if (Math.random() < 0.8) Game.particles.add({ x: this.x + rand(-8, 8), y: this.y - rand(4, 16), vx: -d.dx * 40, vy: -d.dy * 40, life: 0.3, size: rand(3, 6), color: rgba(this.def.fur, 0.6), type: 'smoke' });
    for (const p of Game.players) {
      if (p.down || d.hit.has(p)) continue;
      if (dist2(this.x, this.y - this.hgt / 2, p.x, p.y - 12) < (this.r + p.r + 6) ** 2) {
        d.hit.add(p);
        Game.damagePlayer(p, this.dmg(d.mult), { fromX: this.x, fromY: this.y, knock: 280 });
      }
    }
    d.traveled += Math.hypot(this.x - ox, this.y - oy);
    if (d.traveled >= d.len || d.t > d.len / d.speed + 0.2 || Math.hypot(this.x - ox, this.y - oy) < step * 0.2) {
      this.dash = null;
      if (d.then) d.then();
      else { this.state = 'recover'; this.stateT = 0; }
    }
  }
  updateLeap(dt) {
    const l = this.leap;
    l.t += dt;
    const p = Math.min(1, l.t / l.dur);
    const nx = lerp(l.sx, l.tx, p), ny = lerp(l.sy, l.ty, p);
    // try to follow path; walls stop horizontal progress
    Game.moveEntity(this, nx - this.x, ny - this.y);
    this.z = Math.sin(p * Math.PI) * 50 * Math.sqrt(this.size);
    this.move = 0.3;
    if (p >= 1) {
      this.z = 0; this.leap = null;
      Game.shake(this.boss ? 8 : 4);
      Game.dustRing(this.x, this.y, 50 * this.size);
      Game.aoeDamagePlayers(this.x, this.y, l.r, this.dmg(l.mult), this.x, this.y, 240);
      this.state = 'recover'; this.stateT = 0;
    }
  }

  draw(ctx) {
    const z = this.z || 0;
    if (z > 0) drawShadow(ctx, this.x, this.y, 14 * this.size, 0.3);
    let alpha = this.dead ? Math.max(0, 1 - this.deadT / 0.6) : 1;
    if (this.teleportT > 0) alpha *= 0.3;
    drawCat(ctx, {
      x: this.x, y: this.y - z, facing: this.facing, t: this.t, phase: this.phase, move: this.move,
      windup: this.state === 'windup' ? clamp(this.stateT / 0.8, 0, 1) : -1,
      attack: this.state === 'attack' ? clamp(this.stateT / 0.3, 0, 1) : -1,
      dead: this.dead ? this.deadT / 0.6 : 0, flash: this.flashT > 0 ? '#ffffff' : null,
      def: this.def, scale: this.size, alpha, seed: this.seed, phase2: this.phase2,
    });
    if (this.stunT > 0 && !this.dead) {
      for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * TAU / 3; drawStar(ctx, '#ffe84a', this.x + Math.cos(a) * 12 * this.size, this.y - this.hgt - 14 * this.size + Math.sin(a) * 4, 4); }
    }
    if (this.slowT > 0 && !this.dead) { ctx.globalAlpha = 0.3; fillEll(ctx, '#7fe0ff', this.x, this.y - this.hgt * 0.5, this.r * 1.6, this.hgt * 0.7); ctx.globalAlpha = 1; }
  }
}

// ---- attack move library ----
Enemy.MOVES = {
  swipe(tgt) {
    const a = angleTo(this.x, this.y, tgt.x, tgt.y);
    const R = (this.boss ? 70 : 40) * Math.sqrt(this.size) + 22;
    this.addTele({ kind: 'cone', x: this.x, y: this.y, angle: a, spread: this.boss ? 1.1 : 0.95, r: R, dur: this.boss ? 0.7 : 0.6, follow: true }, () => {
      Game.swipeFx(this, a, R);
      Game.teleDamage(this.tele[0], this.dmg(1), this.x, this.y, 200);
      Sound.sfx('swing', { pitch: 0.8 });
      this.lunge(a, 16);
    });
  },
  slam(tgt) {
    const R = (this.boss ? 110 : 62) * Math.sqrt(this.size);
    this.addTele({ kind: 'circle', x: this.x, y: this.y, r: R, dur: this.boss ? 0.9 : 0.85, follow: true }, () => {
      Game.shake(this.boss ? 10 : 5); Game.dustRing(this.x, this.y, R); Sound.sfx('quake');
      Game.teleDamage(this.tele[0], this.dmg(1.35), this.x, this.y, 300);
    });
  },
  quake(tgt) {
    Sound.sfx('telegraph');
    for (let i = 0; i < 3; i++) {
      const r1 = 40 + i * 70;
      this.addTele({ kind: 'ring', x: this.x, y: this.y, r2: r1, r: r1 + 70, dur: 0.8 + i * 0.35 }, function () {
        Game.shake(6); Game.dustRing(this.x, this.y, this.r);
        Game.teleDamage(this, this.owner.dmg(1.1), this.x, this.y, 220);
      });
    }
  },
  arrow(tgt) {
    const a = angleTo(this.x, this.y - 12, tgt.x, tgt.y - 12);
    this.addTele({ kind: 'line', x: this.x, y: this.y, angle: a, len: 420, width: 14, dur: 0.75, aimAt: tgt }, () => {
      const tt = this.tele[0];
      Game.spawnProjectile({ team: 'enemy', kind: 'arrow', x: this.x + Math.cos(tt.angle) * 12, y: this.y - 12 + Math.sin(tt.angle) * 12, vx: Math.cos(tt.angle) * 620, vy: Math.sin(tt.angle) * 620, r: 6, dmg: this.dmg(0.95), life: 0.9, color: '#d8c8a8' });
      Sound.sfx('arrow');
    });
  },
  volley(tgt) {
    const a = angleTo(this.x, this.y, tgt.x, tgt.y);
    const n = this.phase2 ? 7 : 5;
    this.addTele({ kind: 'cone', x: this.x, y: this.y, angle: a, spread: 0.6, r: 360, dur: 0.75 }, () => {
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.2;
        const kind = this.def.id === 'ninja' ? 'shuriken' : 'arrow';
        Game.spawnProjectile({ team: 'enemy', kind, x: this.x, y: this.y - 16, vx: Math.cos(aa) * 480, vy: Math.sin(aa) * 480, r: 7, dmg: this.dmg(0.8), life: 1.1, color: '#e0e6ee' });
      }
      Sound.sfx('arrow');
    });
  },
  orb(tgt) {
    const el = this.def.element === 'ice' ? 'ice' : 'dark';
    this.addTele({ kind: 'circle', x: tgt.x, y: tgt.y, r: 48, dur: 1.0, color: el === 'ice' ? '#7fe0ff' : null }, function () {
      Game.magicBlast(this.x, this.y, this.r, el);
      Game.teleDamage(this, this.owner.dmg(1.15), this.x, this.y, 150, el === 'ice' ? { slow: 1.5 } : null);
    });
    Sound.sfx('magic');
  },
  orbs(tgt) {
    const n = this.phase2 ? 16 : 11;
    const el = this.def.element === 'ice' ? 'ice' : this.def.element === 'fire' ? 'fire' : 'dark';
    this.addTele({ kind: 'circle', x: this.x, y: this.y, r: 60 * Math.sqrt(this.size), dur: 0.6, color: '#b46cff', follow: true, noDamage: true }, () => {
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + i * TAU / n;
        Game.spawnProjectile({ team: 'enemy', kind: 'orb', element: el, x: this.x, y: this.y - this.hgt * 0.5, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 9, dmg: this.dmg(0.8), life: 2.6, color: el === 'ice' ? '#7fe0ff' : el === 'fire' ? '#ff7b2e' : '#b46cff' });
      }
      Sound.sfx('magic');
    });
  },
  circles(tgt) {
    const n = this.phase2 ? 7 : 5;
    const pts = [];
    for (const p of Game.players) if (!p.down) pts.push([p.x, p.y]);
    while (pts.length < n) { const b = rand(0, TAU), d = rand(60, 220); pts.push([tgt.x + Math.cos(b) * d, tgt.y + Math.sin(b) * d]); }
    const el = this.def.element === 'ice' ? 'ice' : this.def.element === 'fire' ? 'fire' : 'dark';
    pts.forEach(([x, y], i) => {
      this.addTele({ kind: 'circle', x, y, r: 52, dur: 1.0 + i * 0.08 }, function () {
        Game.magicBlast(this.x, this.y, this.r, el);
        Game.teleDamage(this, this.owner.dmg(1.1), this.x, this.y, 160);
      });
    });
    Sound.sfx('magic');
  },
  meteor(tgt) {
    const n = this.phase2 ? 12 : 8;
    const pts = [];
    for (const p of Game.players) if (!p.down) pts.push([p.x, p.y]);
    const room = Game.map.bossRoom;
    while (pts.length < n) {
      if (room) pts.push([rand(room.x + 1, room.x + room.w - 1) * TS, rand(room.y + 1, room.y + room.h - 1) * TS]);
      else pts.push([tgt.x + rand(-250, 250), tgt.y + rand(-200, 200)]);
    }
    pts.forEach(([x, y], i) => {
      this.addTele({ kind: 'circle', x, y, r: 62, dur: 1.2 + i * 0.12, color: '#ff7b2e' }, function () {
        Game.meteorFx(this.x, this.y, this.r, false);
        Game.teleDamage(this, this.owner.dmg(1.3), this.x, this.y, 220);
      });
    });
    Sound.sfx('roar');
  },
  dash(tgt) {
    const a = angleTo(this.x, this.y, tgt.x, tgt.y);
    const len = this.boss ? 420 : 300;
    this.addTele({ kind: 'line', x: this.x, y: this.y, angle: a, len, width: this.r * 2 + 16, dur: this.boss ? 0.65 : 0.6 }, () => {
      const tt = this.tele[0];
      this.dash = { dx: Math.cos(tt.angle), dy: Math.sin(tt.angle), speed: this.boss ? 950 : 800, len, traveled: 0, t: 0, hit: new Set(), mult: 1.2 };
      this.facing = Math.cos(tt.angle) > 0 ? 1 : -1;
      Sound.sfx('dash');
    });
  },
  charge(tgt) {
    let count = this.phase2 ? 4 : 3;
    const go = () => {
      const t2 = this.nearestPlayer() || tgt;
      const a = angleTo(this.x, this.y, t2.x, t2.y);
      const tt = this.addTele({ kind: 'line', x: this.x, y: this.y, angle: a, len: 520, width: this.r * 2 + 24, dur: 0.55 }, () => {
        this.dash = { dx: Math.cos(a), dy: Math.sin(a), speed: 1050, len: 520, traveled: 0, t: 0, hit: new Set(), mult: 1.3, then: --count > 0 ? go : null };
        this.facing = Math.cos(a) > 0 ? 1 : -1;
        Game.shake(4); Sound.sfx('dash');
      });
      this.state = 'windup';
      return tt;
    };
    go();
  },
  pounce(tgt) {
    const R = (this.boss ? 80 : 46) * Math.sqrt(this.size);
    const tx = tgt.x, ty = tgt.y;
    this.addTele({ kind: 'circle', x: tx, y: ty, r: R, dur: this.boss ? 0.8 : 0.75 }, () => {
      this.leap = { sx: this.x, sy: this.y, tx, ty, t: 0, dur: 0.38, r: R, mult: 1.2 };
      this.facing = tx > this.x ? 1 : -1;
      Sound.sfx('dash');
    });
  },
  breath(tgt) {
    const a = angleTo(this.x, this.y, tgt.x, tgt.y);
    const R = (this.boss ? 230 : 150) * Math.sqrt(this.size) * 0.9;
    const el = this.def.element || 'fire';
    this.addTele({ kind: 'cone', x: this.x, y: this.y, angle: a, spread: 0.5, r: R, dur: 0.85, color: el === 'ice' ? '#7fe0ff' : '#ff7b2e' }, () => {
      Game.breathFx(this, a, R, el);
      Game.teleDamage(this.tele[0], this.dmg(1.25), this.x, this.y, 180, el === 'ice' ? { slow: 2 } : null);
      Sound.sfx(el === 'ice' ? 'ice' : 'fire');
    });
  },
  ninja(tgt) {
    Enemy.MOVES.teleport.call(this, tgt, true);
  },
  teleport(tgt, thenVolley) {
    Game.poof(this.x, this.y - 12, this.def.fur);
    const a = rand(0, TAU), d = this.boss ? 150 : 130;
    let nx = tgt.x + Math.cos(a) * d, ny = tgt.y + Math.sin(a) * d;
    const ok = (x, y) => !Game.map.isSolid(x, y) && !Game.map.isSolid(x, y - 10) && (!this.boss || !Game.dungeon || Game.dungeon.insideBossRoom(x, y, 1));
    if (!ok(nx, ny)) { nx = tgt.x - Math.cos(a) * d; ny = tgt.y - Math.sin(a) * d; }
    if (!ok(nx, ny)) { nx = tgt.x + Math.cos(a) * d * 0.5; ny = tgt.y + Math.sin(a) * d * 0.5; }
    if (ok(nx, ny)) { this.x = nx; this.y = ny; }
    Game.poof(this.x, this.y - 12, this.def.fur);
    Sound.sfx('portal');
    this.facing = tgt.x > this.x ? 1 : -1;
    if (thenVolley && !this.boss) {
      const aa = angleTo(this.x, this.y, tgt.x, tgt.y);
      this.addTele({ kind: 'cone', x: this.x, y: this.y, angle: aa, spread: 0.4, r: 320, dur: 0.55 }, () => {
        for (let i = -1; i <= 1; i++) Game.spawnProjectile({ team: 'enemy', kind: 'shuriken', x: this.x, y: this.y - 14, vx: Math.cos(aa + i * 0.22) * 470, vy: Math.sin(aa + i * 0.22) * 470, r: 7, dmg: this.dmg(0.85), life: 1, color: '#c8d2dc' });
        Sound.sfx('arrow');
      });
    } else {
      Enemy.MOVES.swipe.call(this, tgt);
      this.tele[0].dur *= 0.75;
    }
  },
  summon(tgt) {
    this.addTele({ kind: 'circle', x: this.x, y: this.y, r: 50 * Math.sqrt(this.size), dur: 0.8, color: '#b46cff', follow: true, noDamage: true }, () => {
      const pool = Game.dungeon ? Game.dungeon.def.enemies : REGIONS[this.region].enemies;
      const n = this.phase2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        let x = this.x + Math.cos(a) * 90, y = this.y + Math.sin(a) * 90;
        const inRoom = !Game.dungeon || !this.boss || Game.dungeon.insideBossRoom(x, y, 1);
        if (Game.map.isSolid(x, y) || !inRoom) { x = this.x; y = this.y + 30; }
        const e = new Enemy(choose(pool), Math.max(1, this.level - 2), x, y, { region: this.region });
        e.aggro = true; e.xpMul = 0.3;
        Game.enemies.push(e);
        Game.poof(x, y - 12, '#b46cff');
      }
      Sound.sfx('meow', { pitch: 0.7 });
    });
  },
  roar(tgt) {
    const R = 280;
    this.addTele({ kind: 'ring', x: this.x, y: this.y, r2: 70, r: R, dur: 1.1, follow: true }, () => {
      Sound.sfx('roar'); Game.shake(14);
      Game.shockwave(this.x, this.y, R);
      Game.teleDamage(this.tele[0], this.dmg(1.2), this.x, this.y, 420);
    });
  },
};

Enemy.prototype.lunge = function (a, d) { Game.moveEntity(this, Math.cos(a) * d, Math.sin(a) * d); };

// ------------------------------------------------------------
// NPC (friendly town dog)
// ------------------------------------------------------------
class NPC {
  constructor(spot) {
    this.spot = spot; this.npc = spot.npc; this.id = spot.npc.id; this.name = spot.npc.name;
    this.x = spot.x; this.y = spot.y; this.hx = spot.x; this.hy = spot.y;
    this.r = 10; this.t = Math.random() * 10; this.phase = 0; this.move = 0; this.facing = 1;
    const L = spot.npc.look;
    const b = BREEDS[L.breed];
    this.look = Object.assign({}, b, L, { hat: L.hat || 'none' });
    this.equip = { weapon: null, helmet: L.helmet ? ITEMS[L.helmet] : null, armor: null };
    this.wander = !!spot.npc.wander; this.wt = rand(1, 3); this.dx = 0; this.dy = 0;
  }
  update(dt) {
    this.t += dt;
    const p = Game.nearestPlayerTo(this.x, this.y);
    const near = p && dist(p.x, p.y, this.x, this.y) < 90;
    if (near) { this.facing = p.x > this.x ? 1 : -1; this.move = Math.max(0, this.move - dt * 5); return; }
    if (!this.wander) { this.move = 0; return; }
    this.wt -= dt;
    if (this.wt <= 0) {
      this.wt = rand(1.5, 3.5);
      if (Math.random() < 0.5) { const a = rand(0, TAU); this.dx = Math.cos(a); this.dy = Math.sin(a); } else this.dx = this.dy = 0;
      if (dist(this.x, this.y, this.hx, this.hy) > 70) { const a = angleTo(this.x, this.y, this.hx, this.hy); this.dx = Math.cos(a); this.dy = Math.sin(a); }
    }
    if (this.dx || this.dy) {
      Game.moveEntity(this, this.dx * 45 * dt, this.dy * 45 * dt);
      this.phase += dt * 8; this.move = 0.6;
      if (Math.abs(this.dx) > 0.2) this.facing = this.dx > 0 ? 1 : -1;
    } else this.move = 0;
  }
  draw(ctx) {
    drawDog(ctx, { x: this.x, y: this.y, facing: this.facing, t: this.t, phase: this.phase, move: this.move, look: this.look, equip: this.equip, seed: this.x });
    const q = Game.npcHasQuest(this.id);
    if (q) {
      const b = Math.sin(this.t * 5) * 3;
      ctx.font = 'bold 22px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#3a2a00'; ctx.fillText('!', this.x + 1, this.y - 50 + b + 1);
      ctx.fillStyle = '#ffd23f'; ctx.fillText('!', this.x, this.y - 50 + b);
    }
  }
}

// ------------------------------------------------------------
// Projectiles
// ------------------------------------------------------------
class Projectile {
  constructor(o) {
    Object.assign(this, { t: 0, dead: false, hit: new Set(), pierce: false, homing: 0, gravity: 0 }, o);
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.life) { this.expire(); return; }
    if (this.homing) {
      const tgt = this.team === 'player' ? Game.nearestEnemy(this.x, this.y, 500, this.hit) : null;
      if (tgt) {
        const want = angleTo(this.x, this.y, tgt.x, tgt.y - tgt.hgt * 0.5);
        const cur = Math.atan2(this.vy, this.vx);
        const sp = Math.hypot(this.vx, this.vy);
        const na = cur + clamp(angleDiff(cur, want), -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // trail particles
    if (this.kind === 'fireball' || this.kind === 'orb' || this.kind === 'spirit' || this.kind === 'ice') {
      if (Math.random() < 0.9) Game.particles.add({ x: this.x + rand(-3, 3), y: this.y + rand(-3, 3), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.35, size: rand(2, 5), color: this.color, type: 'dot', glow: true });
    }
    if (Game.map.isSolid(this.x, this.y + 10)) {
      if (this.kind === 'spirit') { /* spirits pass walls */ }
      else { this.expire(true); return; }
    }
    if (this.team === 'player') {
      for (const e of Game.enemies) {
        if (e.dead || this.hit.has(e)) continue;
        if (dist2(this.x, this.y, e.x, e.y - e.hgt * 0.5) < (this.r + e.r) ** 2) {
          this.hit.add(e);
          this.onHitEnemy(e);
          if (!this.pierce) { this.expire(true); return; }
        }
      }
    } else {
      for (const p of Game.players) {
        if (p.down) continue;
        if (dist2(this.x, this.y, p.x, p.y - 12) < (this.r + p.r) ** 2) {
          if (Game.damagePlayer(p, this.dmg, { fromX: this.x - this.vx * 0.1, fromY: this.y - this.vy * 0.1, knock: 150, slow: this.element === 'ice' ? 1.5 : 0 })) {
            this.expire(true); return;
          }
        }
      }
    }
  }
  onHitEnemy(e) {
    switch (this.kind) {
      case 'fireball': break; // explode on expire
      case 'ice':
        Game.damageEnemy(e, this.dmg, { knock: 60, fromX: this.x - this.vx, fromY: this.y - this.vy, magic: true });
        e.slowT = Math.max(e.slowT, 2.5);
        break;
      default:
        Game.damageEnemy(e, this.dmg, { knock: 80, fromX: this.x - this.vx, fromY: this.y - this.vy, magic: true });
    }
  }
  expire(impact) {
    if (this.dead) return;
    this.dead = true;
    if (this.kind === 'fireball') {
      Game.explosion(this.x, this.y, this.aoe, '#ff7b2e');
      for (const e of Game.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y - e.hgt * 0.5) < (this.aoe + e.r) ** 2) Game.damageEnemy(e, this.dmg, { knock: 180, fromX: this.x, fromY: this.y, magic: true });
      }
    } else if (impact) {
      Game.burst(this.x, this.y, this.color, 8, 90);
    }
  }
  draw(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    switch (this.kind) {
      case 'arrow':
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        line(ctx, '#8a5a2a', 2, -14, 0, 6, 0); fillPoly(ctx, '#c8d2dc', [6, -3, 12, 0, 6, 3]);
        fillPoly(ctx, '#f4f0e6', [-14, 0, -18, -4, -12, 0]); fillPoly(ctx, '#f4f0e6', [-14, 0, -18, 4, -12, 0]);
        ctx.restore(); break;
      case 'shuriken':
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 20);
        drawStar(ctx, '#c8d2dc', 0, 0, 8, 4); fillCirc(ctx, '#3a3a42', 0, 0, 2);
        ctx.restore(); break;
      case 'fireball':
        ctx.globalAlpha = 0.35; fillCirc(ctx, '#ff7b2e', this.x, this.y, 16); ctx.globalAlpha = 1;
        fillCirc(ctx, '#ff7b2e', this.x, this.y, 9); fillCirc(ctx, '#ffe07a', this.x, this.y, 5); break;
      case 'ice':
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
        fillPoly(ctx, '#aee8ff', [-9, -4, 10, 0, -9, 4]); fillPoly(ctx, '#ffffff', [-6, -1.5, 8, 0, -6, 0.5]);
        ctx.restore(); break;
      case 'spirit': {
        ctx.save(); ctx.translate(this.x, this.y); if (this.vx < 0) ctx.scale(-1, 1);
        ctx.globalAlpha = 0.75;
        drawDog(ctx, { x: 0, y: 12, facing: 1, t: this.t, phase: this.t * 20, move: 1, look: { fur: '#9ab8ff', fur2: '#e0e8ff', ear: 'pointy', tail: 'bushy', eye: '#ffffff' }, scale: 0.8 });
        ctx.restore(); ctx.globalAlpha = 1; break;
      }
      default: // orb
        ctx.globalAlpha = 0.35; fillCirc(ctx, this.color, this.x, this.y, this.r * 1.8); ctx.globalAlpha = 1;
        fillCirc(ctx, this.color, this.x, this.y, this.r); fillCirc(ctx, '#ffffff', this.x - 2, this.y - 2, this.r * 0.35);
    }
  }
}

// ------------------------------------------------------------
// Particles (pooled)
// ------------------------------------------------------------
class Particles {
  constructor() { this.list = []; }
  add(p) {
    if (this.list.length > 1400) this.list.shift();
    p.t = 0; p.life = p.life || 0.5;
    this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.drag) { p.vx *= Math.pow(p.drag, dt); p.vy *= Math.pow(p.drag, dt); }
      L[j++] = p;
    }
    L.length = j;
  }
  draw(ctx) {
    for (const p of this.list) {
      const k = p.t / p.life, a = 1 - k;
      switch (p.type) {
        case 'dot':
          ctx.globalAlpha = a; fillCirc(ctx, p.color, p.x, p.y, p.size * (1 - k * 0.5)); break;
        case 'smoke':
          ctx.globalAlpha = a * 0.7; fillCirc(ctx, p.color, p.x, p.y, p.size * (1 + k * 1.5)); break;
        case 'spark':
          ctx.globalAlpha = a; S(ctx, p.color); ctx.lineWidth = p.size; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); break;
        case 'ring':
          ctx.globalAlpha = a; S(ctx, p.color); ctx.lineWidth = (p.width || 4) * a + 0.5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(0.1, p.r * easeOutCubic(k)), Math.max(0.1, p.r * easeOutCubic(k) * (p.flat || 1)), 0, 0, TAU); ctx.stroke(); break;
        case 'slash': {
          ctx.globalAlpha = a; S(ctx, p.color); ctx.lineWidth = p.size * a + 1; ctx.lineCap = 'round';
          const sweep = p.sweep * Math.min(1, k * 3);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.a0, p.a0 + sweep * p.dir, p.dir < 0); ctx.stroke();
          ctx.globalAlpha = a * 0.5; S(ctx, '#ffffff'); ctx.lineWidth = p.size * a * 0.4 + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 2, p.a0, p.a0 + sweep * p.dir, p.dir < 0); ctx.stroke();
          break;
        }
        case 'bolt': {
          ctx.globalAlpha = a; S(ctx, p.color); ctx.lineWidth = 4 * a + 1; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(p.pts[0], p.pts[1]); for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]); ctx.stroke();
          S(ctx, '#ffffff'); ctx.lineWidth = 1.5 * a + 0.5; ctx.stroke(); break;
        }
        case 'star':
          ctx.globalAlpha = a; drawStar(ctx, p.color, p.x, p.y, p.size * (1 - k * 0.3)); break;
        case 'coinfx':
          ctx.globalAlpha = a; drawCoin(ctx, p.x, p.y, p.t, 4); break;
        case 'heart':
          ctx.globalAlpha = a; drawHeart(ctx, p.x, p.y, p.size, p.color); break;
        case 'flame': {
          ctx.globalAlpha = a; const s = p.size * (1 - k * 0.6);
          fillCirc(ctx, k < 0.3 ? '#fff0a0' : k < 0.6 ? '#ffb040' : '#e8401a', p.x, p.y, s); break;
        }
        case 'snow':
          ctx.globalAlpha = a; fillCirc(ctx, '#ffffff', p.x, p.y, p.size); break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

class FloatText {
  constructor(x, y, text, color, size = 16) { Object.assign(this, { x, y, text, color, size, t: 0, life: 0.9, vy: -70 }); }
  update(dt) { this.t += dt; this.y += this.vy * dt; this.vy *= Math.pow(0.05, dt); }
  draw(ctx) {
    const k = this.t / this.life;
    const pop = k < 0.15 ? 1 + (1 - k / 0.15) * 0.6 : 1;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.font = `bold ${Math.round(this.size * pop)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

// Loot on the ground (coins / items)
class Loot {
  constructor(kind, x, y, value) {
    this.kind = kind; this.x = x; this.y = y; this.value = value;
    const a = rand(0, TAU), sp = rand(60, 160);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.6; this.z = 0; this.vz = rand(120, 220);
    this.t = 0; this.dead = false; this.delay = 0.35;
  }
  update(dt) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 600 * dt; this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0 && this.vz < 0) { this.vz = Math.abs(this.vz) > 80 ? -this.vz * 0.4 : 0; }
    }
    if (!Game.map.isSolid(this.x + this.vx * dt, this.y + this.vy * dt)) { this.x += this.vx * dt; this.y += this.vy * dt; }
    this.vx *= Math.pow(0.05, dt); this.vy *= Math.pow(0.05, dt);
    if (this.t < this.delay) return;
    const p = Game.nearestPlayerTo(this.x, this.y);
    if (!p) return;
    const d = dist(this.x, this.y, p.x, p.y - 8);
    const mag = this.kind === 'coin' ? 150 : 60;
    if (d < mag) {
      const a = angleTo(this.x, this.y, p.x, p.y - 8);
      const sp = 380 * (1 - d / mag) + 120;
      this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt;
    }
    if (d < 16) { this.dead = true; Game.pickupLoot(this, p); }
    if (this.t > 60) this.dead = true;
  }
  draw(ctx) {
    drawShadow(ctx, this.x, this.y, 5, 0.25);
    if (this.kind === 'coin') drawCoin(ctx, this.x, this.y - 5 - this.z, this.t + this.x, 5);
    else if (this.kind === 'item') {
      const it = ITEMS[this.value];
      const b = Math.sin(this.t * 4) * 3;
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 6) * 0.15; fillCirc(ctx, TIER_COLORS[it.tier], this.x, this.y - 14 - this.z + b, 16); ctx.globalAlpha = 1;
      drawItemIcon(ctx, it, this.x, this.y - 14 - this.z + b, 26, this.t);
    } else if (this.kind === 'heart') {
      drawHeart(ctx, this.x, this.y - 8 - this.z + Math.sin(this.t * 5) * 2, 6);
    }
  }
}
