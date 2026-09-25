// 'target-dummy' — a weighted punching-bag target for the weapon range. Wobbles when hit, shows
// floating damage numbers and a health bar, pops when splatted and springs back up a moment later.
// Health refills after a short pause so combos can be tested.
//   { type: 'target-dummy', pos, yaw?, hp? (100), team? ('murk'|'hero'), regen? (2.5 s),
//     respawn? (1.8 s), slide?: { axis:[x,y,z], amp (m), speed (rad/s) } }
import * as THREE from 'three';
import { Actor, registerEntity } from '../entities/base.js';
import { TEAM_HERO, TEAM_MURK } from '../ink/ink-system.js';
import { charMat } from '../actors/materials.js';

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const POPUPS = 5;

function textCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { c, x: c.getContext('2d'), tex };
}

export class TargetDummy extends Actor {
  constructor(session, def) {
    const team = def.team === 'hero' ? TEAM_HERO : TEAM_MURK;
    super(session, def, { team, hp: def.hp ?? 100, hitRadius: 0.5, hitHeight: 1.55 });
    this.regenDelay = def.regen ?? 2.5;
    this.respawnTime = def.respawn ?? 1.8;
    this.sinceHit = 99;
    this.respawnT = 0;
    this.home = this.group.position.clone();
    this.slide = def.slide ? { axis: new THREE.Vector3().fromArray(def.slide.axis || [1, 0, 0]).normalize(), amp: def.slide.amp ?? 3, speed: def.slide.speed ?? 0.9 } : null;
    this.phase = 0;
    this.wob = new THREE.Vector2();      // tilt (x about X, y about Z)
    this.wobV = new THREE.Vector2();
    this.squash = 0;
    this.squashV = 0;
    this.downK = 0;                      // 0 standing … 1 knocked flat
    this.t = Math.random() * 10;
    this._build();
  }

  _build() {
    const g = this.group;
    const own = (m) => { this.own(m.geometry, m.material); return m; };
    const dark = charMat('#2d303b', { roughness: 0.55 });
    const wood = charMat('#b98352', { roughness: 0.7 });
    const canvas = charMat('#efe6d2', { roughness: 0.8 });
    const red = charMat('#e8484f', { roughness: 0.6 });
    const white = charMat('#fbf8f1', { roughness: 0.6 });
    this.mats = [canvas, red, white];
    this.own(dark, wood, canvas, red, white);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.16, 24), dark);
    base.position.y = 0.08;
    this.own(base.geometry);
    g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 28).rotateX(Math.PI / 2), charMat('#ffd23f', { roughness: 0.5 }));
    ring.position.y = 0.16;
    this.own(ring.geometry, ring.material);
    g.add(ring);
    // wobble pivot at the base
    this.body = new THREE.Group();
    this.body.position.y = 0.16;
    g.add(this.body);
    const post = own(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 10), wood));
    post.position.y = 0.2;
    this.body.add(post);
    const bag = own(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 8, 20), canvas));
    bag.position.y = 0.72;
    bag.scale.set(1, 1, 0.9);
    this.body.add(bag);
    this.bag = bag;
    // bullseye on the front
    const rings = [[0.27, red], [0.2, white], [0.13, red], [0.06, white]];
    rings.forEach(([r, m], i) => {
      const d = own(new THREE.Mesh(new THREE.CircleGeometry(r, 28), m));
      d.position.set(0, 0.72, 0.308 + i * 0.002);
      this.body.add(d);
    });
    // stitched belt + head
    const belt = own(new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.025, 6, 28).rotateX(Math.PI / 2), dark));
    belt.position.y = 0.4;
    belt.scale.set(1, 1, 0.9);
    this.body.add(belt);
    const head = own(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), canvas));
    head.position.y = 1.32;
    this.body.add(head);
    this.head = head;
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.075, 1.35, 0.185);
      for (const r of [0.7, -0.7]) {
        const bar = own(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.01), dark));
        bar.rotation.z = r;
        e.add(bar);
      }
      this.body.add(e);
      this.eyes.push(e);
    }
    const mouth = own(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 12, Math.PI), dark));
    mouth.position.set(0, 1.26, 0.19);
    mouth.rotation.z = Math.PI;
    this.body.add(mouth);
    // stub arms
    for (const s of [-1, 1]) {
      const arm = own(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10), canvas));
      arm.position.set(s * 0.42, 0.9, 0);
      arm.rotation.z = s * 0.9;
      this.body.add(arm);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // health bar
    this.bar = textCanvas(128, 24);
    this.barSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bar.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.barSprite.scale.set(0.9, 0.17, 1);
    this.barSprite.position.y = 1.85;
    this.barSprite.renderOrder = 5;
    this.own(this.bar.tex, this.barSprite.material);
    g.add(this.barSprite);
    this._barHp = -1;
    this._drawBar();

    // damage popups
    this.popups = [];
    for (let i = 0; i < POPUPS; i++) {
      const tc = textCanvas(256, 96);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tc.tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
      sp.visible = false;
      sp.renderOrder = 6;
      this.own(tc.tex, sp.material);
      this.session.scene.add(sp);
      this.popups.push({ sp, tc, t: 0, life: 0, amount: 0, x: 0, big: false });
    }
    this.popCursor = 0;
    this.activePop = null;
  }

  _drawBar() {
    const hp = Math.max(0, Math.round(this.hp));
    if (hp === this._barHp) return;
    this._barHp = hp;
    const { x, c, tex } = this.bar;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(20,22,32,0.75)';
    roundRect(x, 2, 4, 124, 16, 8); x.fill();
    const f = Math.max(0, hp / this.maxHp);
    x.fillStyle = f > 0.5 ? '#57e389' : f > 0.25 ? '#ffd23f' : '#ff5a5a';
    if (f > 0) { roundRect(x, 5, 7, 118 * f, 10, 5); x.fill(); }
    tex.needsUpdate = true;
  }

  _drawPopup(p) {
    const { x, c, tex } = p.tc;
    x.clearRect(0, 0, c.width, c.height);
    const txt = p.kill ? `${Math.round(p.amount)}!` : String(Math.round(p.amount));
    x.font = `${p.big ? 64 : 50}px Bungee, "Lilita One", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = 12;
    x.strokeStyle = 'rgba(20,18,30,0.95)';
    x.strokeText(txt, 128, 50);
    x.fillStyle = p.kill ? '#ffd23f' : p.big ? '#ffe9a8' : '#ffffff';
    x.fillText(txt, 128, 50);
    tex.needsUpdate = true;
  }

  onDamaged(amount, info) {
    this.sinceHit = 0;
    const S = this.session;
    // wobble away from the hit
    const dir = info.dir || (info.point ? _v.subVectors(this.position, info.point).setY(0).normalize() : _v.set(0, 0, -1));
    const k = Math.min(2.4, 0.4 + amount * 0.025);
    const lx = dir.x * Math.cos(this.group.rotation.y) - dir.z * Math.sin(this.group.rotation.y);
    const lz = dir.x * Math.sin(this.group.rotation.y) + dir.z * Math.cos(this.group.rotation.y);
    this.wobV.x += lz * k * 3;
    this.wobV.y -= lx * k * 3;
    this.squashV += 2 + amount * 0.04;
    // damage number: merge rapid hits into one popup
    let p = this.activePop;
    if (!p || p.t > 0.4) {
      p = this.popups[this.popCursor];
      this.popCursor = (this.popCursor + 1) % POPUPS;
      p.amount = 0;
      p.t = 0;
      p.x = (Math.random() - 0.5) * 0.5;
      this.activePop = p;
    }
    p.amount += amount;
    p.t = Math.min(p.t, 0.1);
    p.life = 1.1;
    p.big = p.amount >= 100;
    p.kill = this.hp <= 0;
    p.sp.visible = true;
    this._drawPopup(p);
    const c = this.hitCenter(_v);
    S.fx.burst(c, UP, '#fff3d6', 4, 2.5, { size: 0.03, life: 0.3 });
  }

  onDeath(info) {
    const S = this.session;
    const color = S.ink.color(info.team ?? (this.team === TEAM_MURK ? TEAM_HERO : TEAM_MURK));
    const c = this.hitCenter(_v).clone();
    S.fx.explosion(c, UP, color, 1.4);
    S.fx.burst(c, UP, '#efe6d2', 14, 5, { size: 0.06 });
    S.audio?.sfx('splat_death', { pos: c, volume: 0.6 });
    this.respawnT = this.respawnTime;
    if (this.activePop) { this.activePop.kill = true; this._drawPopup(this.activePop); }
  }

  step(dt) {
    this.t += dt;
    if (this.slide) {
      this.phase += dt * this.slide.speed;
      const prev = _v.copy(this.group.position);
      this.group.position.copy(this.home).addScaledVector(this.slide.axis, Math.sin(this.phase) * this.slide.amp);
      this.velocity.subVectors(this.group.position, prev).divideScalar(Math.max(dt, 1e-4));
    }
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.invulnerable = 0.4;
        this.squashV += 4;
        this.session.audio?.sfx('pop', { pos: this.position, volume: 0.35 });
        this.session.fx.ring(this.position, UP, '#ffffff', 1.2, 0.35);
      }
      return;
    }
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.sinceHit += dt;
    if (this.sinceHit > this.regenDelay && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 1.5);
  }

  render(dt) {
    const d = Math.min(dt, 0.05);
    // spring wobble
    for (const a of ['x', 'y']) {
      this.wobV[a] += (-this.wob[a] * 90 - this.wobV[a] * 7) * d;
      this.wob[a] += this.wobV[a] * d;
      this.wob[a] = THREE.MathUtils.clamp(this.wob[a], -0.9, 0.9);
    }
    this.squashV += (-this.squash * 160 - this.squashV * 9) * d;
    this.squash += this.squashV * d;
    const downTarget = this.alive ? 0 : 1;
    this.downK += (downTarget - this.downK) * Math.min(1, d * (this.alive ? 9 : 14));
    this.body.rotation.set(this.wob.x - this.downK * 1.45, 0, this.wob.y);
    const sq = THREE.MathUtils.clamp(this.squash * 0.08, -0.25, 0.25);
    this.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    // hit flash
    this.flashT = Math.max(0, (this.flashT || 0) - d);
    const fl = this.flashT > 0 ? 0.6 : 0;
    for (const m of this.mats) m.emissive.setRGB(fl, fl, fl);
    // X eyes squeeze shut on a hit
    const blink = this.sinceHit < 0.25 && this.alive ? 0.4 : 1;
    for (const e of this.eyes) e.scale.set(1, blink, 1);
    // bar + popups
    this._drawBar();
    this.barSprite.material.opacity = this.alive ? (this.hp < this.maxHp || this.sinceHit < 2 ? 1 : 0.35) : 0;
    for (const p of this.popups) {
      if (!p.sp.visible) continue;
      p.t += d;
      if (p.t >= p.life) { p.sp.visible = false; if (this.activePop === p) this.activePop = null; continue; }
      const k = p.t / p.life;
      const pop = p.t < 0.12 ? 1 + (1 - p.t / 0.12) * 0.6 : 1;
      p.sp.position.set(this.position.x + p.x, this.position.y + 1.9 + k * 0.8, this.position.z);
      const base = p.big ? 1.25 : 0.95;
      p.sp.scale.set(base * pop, base * 0.375 * pop, 1);
      p.sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  dispose() {
    for (const p of this.popups) this.session.scene.remove(p.sp);
    super.dispose();
  }
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

registerEntity('target-dummy', (session, def) => new TargetDummy(session, def));
