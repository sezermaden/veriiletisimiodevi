// Murk Refinery kit — shared by the World 3 stages (and the Gray Heart in 4-2).
//
// Stage-local mechanics (registered on import, same contract as entities/stage/*):
//   { type: 'steam-vent', pos, radius?: 0.85, height?: 4.5, period?: 3.6, on?: 1.4, warn?: 0.8, offset?: 0, dps?: 44 }
//       floor vent: idle wisps → warning hiss + blinking lamps → a scalding steam column that hurts
//       (dps) and blows the player up and away. pos = centre of the floor grille.
//   { type: 'conveyor', pos, dir: '+x'|'-x'|'+z'|'-z', size: [width, length], speed?: 3,
//     running?: true, stopOn?: spec, startOn?: spec, cargo?: 0, color? }
//       belt that carries whoever stands on it (a dynamic collider whose lastDelta is the belt
//       motion — the player's rider code does the rest). pos = centre of the belt TOP. Put a static
//       unpaintable bed brush under it (see beltBed) so validation and enemies see the floor.
//   { type: 'sludge-pool', pos, radius? | size:[w,d], color?, glow?, lake?: false }
//       liquid Murk surface (glowing, bubbling). Touching it splats the player like a fall.
//       lake: true → a huge sheet replacing the stage water (set def.water = false); bubbles
//       then spawn around the player instead of across the whole sheet.
//
// Brush helpers: island, hpipe (chamfered horizontal pipe, climbable), vatRing (open tank wall),
// catwalk (grate deck on posts), beltBed, tank (closed cylinder tank with bands).
import * as THREE from 'three';
import { Entity, registerEntity } from '../../entities/base.js';
import { geo, mat, rimMat, glowMat, canvasTex, boxCollider, makeGlowSprite, onSpec, TEAM_MURK, UP, clamp } from '../../entities/stage/common.js';
import { block, box, ramp, cyl, prism } from '../kit.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _dn = new THREE.Vector3(0, -1, 0);
const DIR_YAW = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

// ---------------------------------------------------------------------------------------------
// Textures

function hazardRingTex() {
  return canvasTex('rk-hazard-diag', 128, 128, (x, w, h) => {
    x.fillStyle = '#ffc21a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1c1c28';
    for (let i = -4; i < 8; i++) {
      x.beginPath(); x.moveTo(i * 24, 0); x.lineTo(i * 24 + 12, 0); x.lineTo(i * 24 + 12 + h, h); x.lineTo(i * 24 + h, h); x.fill();
    }
  }, { repeat: true });
}

function steamTex() {
  return canvasTex('rk-steam', 64, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const px = Math.random() * w, py = Math.random() * h, r = 6 + Math.random() * 16;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) x.fillRect(px - r + ox, py - r + oy, r * 2, r * 2);
    }
  }, { repeat: true });
}

/** Static vertical alpha ramp for the steam column: solid low, fading out at the top. */
function steamAlpha() {
  return canvasTex('rk-steam-alpha', 4, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#000000'); g.addColorStop(0.45, '#9a9a9a'); g.addColorStop(0.9, '#ffffff'); g.addColorStop(1, '#bbbbbb');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

function beltTex() {
  return canvasTex('rk-belt', 128, 128, (x, w, h) => {
    x.fillStyle = '#26282f'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { x.fillStyle = '#34363f'; x.fillRect(0, y, w, 7); x.fillStyle = '#1b1c22'; x.fillRect(0, y + 7, w, 2); }
    // chevrons pointing toward the canvas bottom (= the belt's travel direction, local +Z)
    x.strokeStyle = '#f2c230'; x.lineWidth = 9; x.lineJoin = 'miter';
    x.beginPath(); x.moveTo(30, 40); x.lineTo(64, 76); x.lineTo(98, 40); x.stroke();
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 8, h); x.fillRect(w - 8, 0, 8, h);
  }, { repeat: true });
}

function sludgeTex() {
  return canvasTex('rk-sludge', 256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const px = Math.random() * w, py = Math.random() * h, r = 8 + Math.random() * 34;
      const light = Math.random() < 0.5;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(128,128,128,0)');
      x.fillStyle = g;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) x.fillRect(px - r + ox, py - r + oy, r * 2, r * 2);
    }
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 2;
    for (let i = 0; i < 22; i++) { x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 9, 0, Math.PI * 2); x.stroke(); }
  }, { repeat: true });
}

// ---------------------------------------------------------------------------------------------
// steam-vent

class SteamVent extends Entity {
  constructor(session, def) {
    super(session, def);
    this.r = def.radius ?? 0.85;
    this.h = def.height ?? 4.5;
    this.period = def.period ?? 3.6;
    this.onTime = def.on ?? 1.4;
    this.warn = def.warn ?? 0.8;
    this.dps = def.dps ?? 44;
    this.t = ((def.offset ?? 0) % this.period + this.period) % this.period;
    this.state = 'idle';
    this.hitT = 0;
    this.wispT = Math.random();
    this.blastK = 0;
    const r = this.r, g = this.group;
    const steel = mat('rk-vent-steel', () => rimMat('#4a5163', { roughness: 0.42, metalness: 0.6, rim: 0.2 }));
    const dark = mat('rk-vent-dark', () => rimMat('#121319', { roughness: 0.75, metalness: 0.3, rim: 0.05 }));
    const hz = mat('rk-vent-hz', () => rimMat('#ffffff', { map: hazardRingTex(), roughness: 0.5, rim: 0.15 }));
    const base = new THREE.Mesh(this.own(new THREE.CylinderGeometry(r + 0.32, r + 0.42, 0.14, 28)), steel);
    base.position.y = 0.07;
    const ring = new THREE.Mesh(this.own(new THREE.RingGeometry(r + 0.02, r + 0.3, 32).rotateX(-Math.PI / 2)), hz);
    ring.position.y = 0.145;
    const hole = new THREE.Mesh(this.own(new THREE.CylinderGeometry(r, r, 0.1, 28)), dark);
    hole.position.y = 0.1;
    g.add(base, ring, hole);
    const barG = geo('rk-vent-bar', () => new THREE.BoxGeometry(1, 0.06, 0.08));
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(barG, steel);
      const z = i * r * 0.36;
      b.scale.x = 2 * Math.sqrt(Math.max(0.01, r * r - z * z));
      b.position.set(0, 0.155, z);
      g.add(b);
    }
    for (const m of [base, hole]) { m.receiveShadow = true; }
    // warning lamps
    this.lampMat = this.own(glowMat('#ffae1f', 1.2));
    const lampG = geo('rk-vent-lamp', () => new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const l = new THREE.Mesh(lampG, this.lampMat);
      l.position.set(Math.cos(a) * (r + 0.28), 0.14, Math.sin(a) * (r + 0.28));
      g.add(l);
    }
    this.glow = makeGlowSprite('#ffb04a', r * 2.2, 0.0);
    this.own(this.glow.material);
    this.glow.position.y = 0.4;
    g.add(this.glow);
    // steam column: two nested open cylinders with scrolling soft noise
    const tex = steamTex().clone();
    this.own(tex);
    tex.repeat.set(2, 1);
    this.steamTex = tex;
    this.steamMat = this.own(new THREE.MeshBasicMaterial({ map: tex, alphaMap: steamAlpha(), color: '#eef4ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const colG = this.own(new THREE.CylinderGeometry(r * 1.55, r * 0.8, this.h, 18, 1, true).translate(0, this.h / 2, 0));
    this.column = new THREE.Mesh(colG, this.steamMat);
    this.column.position.y = 0.15;
    this.column.renderOrder = 3;
    this.column.visible = false;
    const inner = new THREE.Mesh(this.own(new THREE.CylinderGeometry(r * 0.95, r * 0.5, this.h * 0.85, 14, 1, true).translate(0, this.h * 0.425, 0)), this.steamMat);
    this.column.add(inner);
    g.add(this.column);
    g.updateMatrixWorld(true);
  }

  _state() {
    const blast = this.period - this.onTime, warn = blast - this.warn;
    return this.t >= blast ? 'blast' : this.t >= warn ? 'warn' : 'idle';
  }

  step(dt) {
    const S = this.session;
    this.t = (this.t + dt) % this.period;
    const st = this._state();
    if (st !== this.state) {
      const near = S.player.position.distanceToSquared(this.position) < 30 * 30;
      if (near && st === 'warn') S.audio?.sfx('fuse_beep', { pos: this.position, volume: 0.35, pitch: 0.7 });
      if (near && st === 'blast') { S.audio?.sfx('whoosh', { pos: this.position, volume: 0.8, pitch: 0.55 }); S.audio?.sfx('murk_blast', { pos: this.position, volume: 0.35, pitch: 1.6 }); }
      this.state = st;
    }
    if (st !== 'blast') { this.hitT = 0; return; }
    const p = S.player;
    if (!p.alive || p.frozen) return;
    const dx = p.position.x - this.position.x, dz = p.position.z - this.position.z;
    const dy = p.position.y - this.position.y;
    const rr = this.r + 0.3;
    if (dx * dx + dz * dz > rr * rr || dy < -0.4 || dy > this.h) { this.hitT = 0; return; }
    this.hitT -= dt;
    if (this.hitT <= 0) {
      this.hitT = 0.25;
      p.damage(this.dps * 0.25, { team: TEAM_MURK, kind: 'steam', source: this });
    }
    // blown up and outward
    const len = Math.hypot(dx, dz) || 1;
    p.velocity.y = Math.max(p.velocity.y, 7.2);
    p.velocity.x += (dx / len) * 22 * dt;
    p.velocity.z += (dz / len) * 22 * dt;
    p.grounded = false;
  }

  render(dt) {
    const S = this.session;
    const st = this.state;
    const blast = this.period - this.onTime;
    // column envelope
    const want = st === 'blast' ? 1 : 0;
    this.blastK += (want - this.blastK) * Math.min(1, dt * (want ? 14 : 5));
    const k = this.blastK;
    this.column.visible = k > 0.02;
    if (this.column.visible) {
      this.column.scale.set(0.8 + k * 0.25, Math.max(0.05, st === 'blast' ? Math.min(1, (this.t - blast) * 6) : k), 0.8 + k * 0.25);
      this.steamMat.opacity = 0.62 * k;
      this.steamTex.offset.y -= dt * 2.4;
      this.steamTex.offset.x += dt * 0.15;
    }
    // lamps + glow
    if (st === 'warn') {
      const on = Math.sin(this.t * 28) > 0;
      this.lampMat.color.set(on ? '#ff5a1f' : '#3a1a10').multiplyScalar(on ? 3 : 1);
      this.glow.material.opacity = on ? 0.5 : 0.15;
    } else if (st === 'blast') {
      this.lampMat.color.set('#ff3a1f').multiplyScalar(3.2);
      this.glow.material.opacity = 0.35 + k * 0.3;
    } else {
      this.lampMat.color.set('#ffae1f').multiplyScalar(1.2);
      this.glow.material.opacity = 0.08;
    }
    // particles (only near the player)
    if (S.player.position.distanceToSquared(this.position) > 45 * 45) return;
    this.wispT -= dt;
    if (this.wispT <= 0) {
      const top = _v.copy(this.position).setY(this.position.y + 0.25);
      if (st === 'blast') {
        this.wispT = 0.12;
        S.fx.puff(top.setY(this.position.y + this.h * (0.3 + Math.random() * 0.5)), '#f2f6ff', this.r * 1.5, 0.9, _w.set((Math.random() - 0.5) * 1.2, 3.5, (Math.random() - 0.5) * 1.2), 2.2, 0.35);
        S.fx.spray(_v.copy(this.position).setY(this.position.y + 0.3), _w.set(0, 9, 0), '#dfe8f5', 3, 2.4, { size: 0.05, life: 0.45, gravity: 8 });
      } else if (st === 'warn') {
        this.wispT = 0.18;
        S.fx.puff(top, '#e6ecf5', this.r * 0.8, 0.7, _w.set((Math.random() - 0.5) * 0.6, 1.6, (Math.random() - 0.5) * 0.6), 1.8, 0.3);
      } else {
        this.wispT = 0.9 + Math.random() * 0.8;
        S.fx.puff(top, '#d8e0ea', this.r * 0.6, 1.2, _w.set(0, 0.9, 0), 1.6, 0.18);
      }
    }
  }
}
registerEntity('steam-vent', (s, d) => new SteamVent(s, d));

// ---------------------------------------------------------------------------------------------
// conveyor

class Conveyor extends Entity {
  constructor(session, def) {
    const d0 = { ...def, yaw: def.yaw ?? DIR_YAW[def.dir || '+z'] ?? 0 };
    super(session, d0);
    const [w, L] = def.size || [3, 10];
    this.w = w; this.L = L;
    this.speed = def.speed ?? 3;
    this.running = def.running !== false;
    this.cur = this.running ? this.speed : 0;
    this.lastDelta = new THREE.Vector3();
    this.fwd = new THREE.Vector3(Math.sin(d0.yaw), 0, Math.cos(d0.yaw));
    this.t = 0;
    const g = this.group;
    // belt surface
    const tex = beltTex().clone();
    this.own(tex);
    tex.repeat.set(1, L / 1.6);
    this.tex = tex;
    const beltMat = this.own(rimMat(def.color || '#ffffff', { map: tex, roughness: 0.8, rim: 0.1 }));
    const belt = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, L).rotateX(-Math.PI / 2)), beltMat);
    belt.position.y = 0.035;
    belt.receiveShadow = true;
    g.add(belt);
    // side rails + end rollers
    const yellow = mat('rk-belt-rail', () => rimMat('#f2c230', { roughness: 0.45, metalness: 0.3, rim: 0.2 }));
    const steel = mat('rk-belt-steel', () => rimMat('#3c4254', { roughness: 0.4, metalness: 0.6, rim: 0.2 }));
    const railG = geo('rk-unit-box', () => new THREE.BoxGeometry(1, 1, 1));
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(railG, steel);
      r.scale.set(0.16, 0.22, L + 0.3);
      r.position.set(sx * (w / 2 + 0.08), -0.05, 0);
      const y = new THREE.Mesh(railG, yellow);
      y.scale.set(0.17, 0.05, L + 0.3);
      y.position.set(sx * (w / 2 + 0.08), 0.085, 0);
      r.castShadow = true;
      g.add(r, y);
    }
    const rollG = geo('rk-roller', () => new THREE.CylinderGeometry(0.22, 0.22, 1, 14).rotateZ(Math.PI / 2));
    for (const sz of [-1, 1]) {
      const rl = new THREE.Mesh(rollG, steel);
      rl.scale.x = w + 0.1;
      rl.position.set(0, -0.2, sz * (L / 2));
      g.add(rl);
    }
    // direction lights along the rails (Murk violet, chase in the travel direction)
    this.lights = [];
    const lg = geo('rk-belt-light', () => new THREE.BoxGeometry(0.1, 0.06, 0.35));
    this.lightMat = this.own(glowMat('#b58cff', 2.2));
    this.lightOff = mat('rk-belt-light-off', () => glowMat('#3a3350', 1));
    const n = Math.max(2, Math.floor(L / 1.6));
    for (let i = 0; i < n; i++) {
      for (const sx of [-1, 1]) {
        const l = new THREE.Mesh(lg, this.lightMat);
        l.position.set(sx * (w / 2 + 0.17), 0.02, -L / 2 + 0.8 + i * ((L - 1.6) / Math.max(1, n - 1)));
        g.add(l);
        this.lights.push({ m: l, i });
      }
    }
    this.nLights = n;
    // cargo riding the belt (visual only)
    this.cargo = [];
    const cargoN = def.cargo ?? 0;
    if (cargoN > 0) {
      const barrelG = geo('rk-cargo-barrel', () => new THREE.CylinderGeometry(0.32, 0.32, 0.86, 14).translate(0, 0.43, 0));
      const bandG = geo('rk-cargo-band', () => new THREE.CylinderGeometry(0.335, 0.335, 0.08, 14));
      const purple = mat('rk-cargo-purple', () => rimMat('#5b3fa0', { roughness: 0.4, metalness: 0.3, rim: 0.25 }));
      const band = mat('rk-cargo-glow', () => glowMat('#9dff5a', 2.2));
      for (let i = 0; i < cargoN; i++) {
        const c = new THREE.Group();
        const b = new THREE.Mesh(barrelG, purple);
        b.castShadow = true;
        const gb = new THREE.Mesh(bandG, band);
        gb.position.y = 0.5;
        c.add(b, gb);
        c.position.set((((i * 0.37) % 1) - 0.5) * (w - 0.9), 0.04, 0);
        c.userData.s = (i / cargoN) * L;
        g.add(c);
        this.cargo.push(c);
      }
    }
    // collider (top 3 cm above the static bed so it wins the ground probe)
    this.col = boxCollider(w, 0.3, L);
    this.col.position.y = 0.03 - 0.3;
    g.add(this.col);
    g.updateMatrixWorld(true);
    this.dyn = session.level.addDynamic(this.col, { owner: this, tag: 'conveyor' });
    this.offs = [];
    const a = onSpec(session, def.stopOn, () => this.setRunning(false));
    const b = onSpec(session, def.startOn, () => this.setRunning(true));
    if (a) this.offs.push(a);
    if (b) this.offs.push(b);
  }

  setRunning(on) {
    if (this.running === on) return;
    this.running = on;
    this.session.audio?.sfx(on ? 'gate_open' : 'gate_clank', { pos: this.position, volume: 0.6, pitch: on ? 1.2 : 0.8 });
  }

  step(dt) {
    this.t += dt;
    const want = this.running ? this.speed : 0;
    this.cur += (want - this.cur) * Math.min(1, dt * 2.5);
    if (Math.abs(this.cur) < 0.02 && !this.running) this.cur = 0;
    this.lastDelta.copy(this.fwd).multiplyScalar(this.cur * dt);
  }

  render(dt) {
    const v = this.cur;
    this.tex.offset.y += (v * dt) / 1.6;
    const phase = (this.t * v * 0.6) % this.nLights;
    for (const l of this.lights) {
      const on = v > 0.2 && Math.abs(((l.i - phase) % this.nLights + this.nLights) % this.nLights) < 1.2;
      l.m.material = on ? this.lightMat : this.lightOff;
    }
    for (const c of this.cargo) {
      let s = c.userData.s + v * dt;
      if (s > this.L) s -= this.L;
      c.userData.s = s;
      c.position.z = -this.L / 2 + s;
      const edge = Math.min(s, this.L - s);
      c.scale.setScalar(clamp(edge / 0.5, 0.05, 1));
    }
  }

  dispose() {
    for (const o of this.offs) o?.();
    this.session.level.removeDynamic(this.dyn);
    super.dispose();
  }
}
registerEntity('conveyor', (s, d) => new Conveyor(s, d));

// ---------------------------------------------------------------------------------------------
// sludge-pool

class SludgePool extends Entity {
  constructor(session, def) {
    super(session, def);
    this.radius = def.radius ?? null;
    this.size = def.size || null;
    if (!this.radius && !this.size) this.radius = 3;
    this.t = Math.random() * 10;
    this.bubT = 0;
    const color = new THREE.Color(def.color || '#7a3fe0');
    const glow = new THREE.Color(def.glow || '#b98cff');
    const tex = sludgeTex().clone();
    this.own(tex);
    const span = this.radius ? this.radius * 2 : Math.max(this.size[0], this.size[1]);
    this.lake = !!def.lake;
    tex.repeat.set(span / (this.lake ? 9 : 5), span / (this.lake ? 9 : 5));
    this.tex = tex;
    this.mat = this.own(new THREE.MeshStandardMaterial({
      color, map: tex, roughness: this.lake ? 0.42 : 0.3, metalness: 0.05, emissive: glow, emissiveMap: tex,
      emissiveIntensity: this.lake ? 0.32 : 0.55, envMapIntensity: 0.35,
    }));
    this.baseGlow = this.lake ? 0.3 : 0.5;
    const g = this.radius ? new THREE.CircleGeometry(this.radius, 40) : new THREE.PlaneGeometry(this.size[0], this.size[1]);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(this.own(g), this.mat);
    m.receiveShadow = true;
    this.group.add(m);
    this.glowCol = glow;
    this.group.updateMatrixWorld(true);
  }

  inside(p, margin = 0.15) {
    const dx = p.x - this.position.x, dz = p.z - this.position.z;
    if (this.radius) return dx * dx + dz * dz < (this.radius - margin) ** 2;
    const c = Math.cos(-this.group.rotation.y), s = Math.sin(-this.group.rotation.y);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return Math.abs(lx) < this.size[0] / 2 - margin && Math.abs(lz) < this.size[1] / 2 - margin;
  }

  step(dt) {
    this.t += dt;
    const p = this.session.player;
    if (!p.alive) return;
    const dy = p.position.y - this.position.y;
    if (dy < 0.05 && dy > -3 && this.inside(p.position)) {
      const S = this.session;
      S.fx.explosion(_v.copy(p.position).setY(this.position.y + 0.05), UP, this.glowCol, 1.6);
      S.audio?.sfx('splash_big', { pos: p.position, volume: 0.8, pitch: 0.7 });
      p.splat({ team: TEAM_MURK, kind: 'fall' });
    }
  }

  render(dt) {
    this.tex.offset.x += dt * 0.03;
    this.tex.offset.y += dt * 0.017;
    this.mat.emissiveIntensity = this.baseGlow + Math.sin(this.t * 1.7) * 0.1;
    const S = this.session;
    if (!this.lake && S.player.position.distanceToSquared(this.position) > 50 * 50) return;
    this.bubT -= dt;
    if (this.bubT <= 0) {
      this.bubT = this.lake ? 0.25 + Math.random() * 0.3 : 0.35 + Math.random() * 0.5;
      if (this.lake) {
        const pl = S.player.position, a = Math.random() * Math.PI * 2, rr = 4 + Math.random() * 22;
        _v.set(pl.x + Math.cos(a) * rr, this.position.y + 0.05, pl.z + Math.sin(a) * rr);
        if (!this.inside(_v, 1) || S.level.raycast(_w.set(_v.x, _v.y + 30, _v.z), _dn, 29.9, { staticOnly: true })) return;
      } else {
        const a = Math.random() * Math.PI * 2;
        const rr = this.radius ? Math.sqrt(Math.random()) * (this.radius - 0.4) : 0;
        const px = this.radius ? Math.cos(a) * rr : (Math.random() - 0.5) * (this.size[0] - 0.6);
        const pz = this.radius ? Math.sin(a) * rr : (Math.random() - 0.5) * (this.size[1] - 0.6);
        _v.set(px, 0.05, pz).applyAxisAngle(UP, this.group.rotation.y).add(this.position);
      }
      S.fx.ring(_v, UP, this.glowCol, 0.5 + Math.random() * 0.5, 0.6);
      S.fx.burst(_v, UP, this.glowCol, 3, 2.2, { size: 0.06 });
    }
  }
}
registerEntity('sludge-pool', (s, d) => new SludgePool(s, d));

// ---------------------------------------------------------------------------------------------
// Brush helpers

/**
 * Refinery island: a steel caisson rising out of the sludge with a floor cap on top.
 * top = walking height. o: { base, mat, color, cap, capColor, lip }
 */
export function island(cx, cz, w, d, top, o = {}) {
  const base = o.base ?? -2.8, lip = o.lip ?? 0.15;
  return [
    block(cx, cz, w, d, base, top - 0.3 - base, { mat: o.mat || 'metal', color: o.color || '#6f7a8c' }),
    block(cx, cz, w + lip * 2, d + lip * 2, top - 0.3, 0.3, { mat: o.cap || 'concrete', color: o.capColor || '#c3c8d2' }),
  ];
}

/**
 * Horizontal pipe along 'x' or 'z' from a0 to a1, cross-axis centre c, bottom y0, radius R.
 * Flat-sided lower half (climbable once inked), 45° chamfered top (walkable), clamp collars.
 * o: { color, collar, every, paint }
 */
export function hpipe(axis, a0, a1, c, y0, R, o = {}) {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  const k1 = 0.924 * R, k2 = 0.383 * R;
  const yc = y0 + k1;
  const body = { mat: 'metal', color: o.color || '#3aa0a8', ...(o.paint === false ? { paint: false } : {}) };
  const collar = { mat: 'metal', color: o.collar || '#2b3142', ...(o.paint === false ? { paint: false } : {}) };
  const out = [];
  const B = (u0, v0, y_0, u1, v1, y_1, props) => (axis === 'x' ? box(u0, y_0, v0, u1, y_1, v1, props) : box(v0, y_0, u0, v1, y_1, u1, props));
  const R_ = (u0, v0, y_0, u1, v1, y_1, side, props) => {
    // side: +1 → wedge on the +cross side (high edge toward the centre)
    const dir = axis === 'x' ? (side > 0 ? '-z' : '+z') : (side > 0 ? '-x' : '+x');
    return axis === 'x' ? ramp(u0, y_0, v0, u1, y_1, v1, dir, props) : ramp(v0, y_0, u0, v1, y_1, u1, dir, props);
  };
  out.push(B(lo, c - k1, y0, hi, c + k1, yc + k2, body));
  out.push(B(lo, c - k2, yc + k2, hi, c + k2, yc + k1, body));
  out.push(R_(lo, c + k2, yc + k2, hi, c + k1, yc + k1, 1, body));
  out.push(R_(lo, c - k1, yc + k2, hi, c - k2, yc + k1, -1, body));
  const every = o.every ?? 4.5;
  if (every > 0) {
    const n = Math.max(1, Math.floor((hi - lo) / every));
    for (let i = 0; i <= n; i++) {
      const u = lo + 0.4 + i * ((hi - lo - 0.8) / Math.max(1, n));
      out.push(B(u - 0.16, c - k1 - 0.07, y0, u + 0.16, c + k1 + 0.07, yc + k2 + 0.07, collar));
      out.push(B(u - 0.16, c - k2 - 0.07, yc + k2 + 0.07, u + 0.16, c + k2 + 0.07, yc + k1 + 0.07, collar));
    }
  }
  return out;
}
/** Total height of an hpipe of radius R. */
export const pipeH = (R) => 1.848 * R;

/** Ring wall (open-topped vat / tank rim) of N quad segments. */
export function vatRing(cx, cz, r, t, y0, y1, o = {}) {
  const n = o.sides ?? 20, out = [];
  const ri = r - t;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    out.push(prism([
      [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r],
      [cx + Math.cos(a1) * ri, cz + Math.sin(a1) * ri], [cx + Math.cos(a0) * ri, cz + Math.sin(a0) * ri],
    ], y0, y1, { mat: o.mat || 'metal', color: o.color || '#8d93a6', ...(o.paint === false ? { paint: false } : {}) }));
  }
  if (o.rim !== false) {
    const rr = r + 0.12, rri = ri - 0.08;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      out.push(prism([
        [cx + Math.cos(a0) * rr, cz + Math.sin(a0) * rr], [cx + Math.cos(a1) * rr, cz + Math.sin(a1) * rr],
        [cx + Math.cos(a1) * rri, cz + Math.sin(a1) * rri], [cx + Math.cos(a0) * rri, cz + Math.sin(a0) * rri],
      ], y1, y1 + 0.12, { mat: 'metal', color: o.rimColor || '#ffc53a' }));
    }
  }
  return out;
}

/** Grate catwalk deck (unpaintable) at walking height y with posts down to `base`. */
export function catwalk(x0, z0, x1, z1, y, o = {}) {
  const out = [box(x0, y - 0.18, z0, x1, y, z1, { mat: 'grate', color: o.color || '#c9d2dc' })];
  const base = o.base ?? -2.6, every = o.every ?? 5;
  if (o.posts !== false) {
    const lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0);
    const along = lx >= lz ? 'x' : 'z';
    const L = Math.max(lx, lz), n = Math.max(1, Math.round(L / every));
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      if (along === 'x') {
        const x = Math.min(x0, x1) + 0.2 + s * (L - 0.4);
        for (const z of [Math.min(z0, z1) + 0.15, Math.max(z0, z1) - 0.15]) out.push(block(x, z, 0.2, 0.2, base, y - 0.18 - base, { mat: 'metal', color: '#2b3142', paint: false }));
      } else {
        const z = Math.min(z0, z1) + 0.2 + s * (L - 0.4);
        for (const x of [Math.min(x0, x1) + 0.15, Math.max(x0, x1) - 0.15]) out.push(block(x, z, 0.2, 0.2, base, y - 0.18 - base, { mat: 'metal', color: '#2b3142', paint: false }));
      }
    }
  }
  return out;
}

/** Static unpaintable bed under a conveyor entity: centre (cx, cz), belt top y, along 'x'|'z'. */
export function beltBed(cx, cz, w, L, y, along, o = {}) {
  const [sx, sz] = along === 'x' ? [L, w] : [w, L];
  return [block(cx, cz, sx + 0.4, sz + 0.2, (o.base ?? y - 1.2), y - (o.base ?? y - 1.2), { mat: 'rubber', color: '#3a3d48', paint: false })];
}

/** Closed storage tank: cylinder + roof cone ring + bands. */
export function tank(cx, cz, r, y0, h, o = {}) {
  const c = o.color || '#b9c2cf';
  return [
    cyl(cx, y0, cz, r, h, { mat: 'metal', color: c, sides: o.sides ?? 18 }),
    cyl(cx, y0 + h, cz, r * 0.72, 0.5, { mat: 'metal', color: o.roof || '#7d8799', sides: o.sides ?? 18 }),
    cyl(cx, y0 + h * 0.3, cz, r + 0.06, 0.3, { mat: 'metal', color: o.band || '#2b3142', sides: o.sides ?? 18, paint: false }),
    cyl(cx, y0 + h * 0.72, cz, r + 0.06, 0.3, { mat: 'metal', color: o.band || '#2b3142', sides: o.sides ?? 18, paint: false }),
  ];
}

/** Decor shorthand. */
export const D = (kind, x, y, z, o = {}) => ({ type: 'decor', kind, pos: [x, y, z], ...o });

/** The sludge lake: a huge glowing Murk sheet that replaces the stage water (pair with water: false). */
export const lake = (y, cx = 0, cz = -100, size = 760) => ({
  type: 'sludge-pool', pos: [cx, y, cz], size: [size, size], lake: true, color: '#4a2a7a', glow: '#7a4ae0',
});
