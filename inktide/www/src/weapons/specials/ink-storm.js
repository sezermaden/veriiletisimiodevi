// Ink Storm: throw a seed forward; it bursts into a raincloud that drifts slowly along the throw
// direction and rains ink over a ~4 m radius for ~6 s — painting the zone and chipping away at
// anyone caught under it.
import * as THREE from 'three';
import { Special, registerSpecial } from '../base.js';
import { Entity } from '../../entities/base.js';
import { makeCloudModel, addPoseHook } from '../models.js';
import { hitActor, sfx, UP, DOWN } from '../mains/shared.js';
import { ownModel } from '../subs/sprinkler.js';

const _m = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _hc = new THREE.Vector3();
const STREAKS = 70;

export class StormCloud extends Entity {
  constructor(session, owner, pos, drift, s) {
    super(session, { type: 'ink-storm-cloud', pos: [pos.x, pos.y, pos.z] });
    this.owner = owner;
    this.team = owner.team;
    this.s = s;
    this.drift = drift.clone();
    this.t = 0;
    this.dropAcc = 0;
    this.tickT = 0;
    this.sndT = 0;
    this.flashT = 1.5;
    this.flash = 0;
    const color = session.ink.color(this.team);
    this.color = color.clone();
    this.cloud = makeCloudModel(color);
    this.cloud.scale.setScalar(0.01);
    this.group.add(this.cloud);
    ownModel(this, this.cloud);
    // ground marker showing the rain zone
    this.groundY = pos.y - s.height;
    const zoneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
    this.zone = new THREE.Group();
    this.zone.add(new THREE.Mesh(new THREE.CircleGeometry(s.radius, 40).rotateX(-Math.PI / 2), zoneMat));
    this.zone.add(new THREE.Mesh(new THREE.RingGeometry(s.radius - 0.12, s.radius, 48).rotateX(-Math.PI / 2), edgeMat));
    this.zone.traverse((o) => { if (o.isMesh) { o.userData.ownGeometry = true; o.renderOrder = 1; } });
    this.own(zoneMat, edgeMat);
    session.scene.add(this.zone);
    // rain streaks
    const geo = new THREE.BufferGeometry();
    this.streakPos = new Float32Array(STREAKS * 6);
    this.streakData = [];
    for (let i = 0; i < STREAKS; i++) this.streakData.push({ x: 0, z: 0, y: -99, v: 0 });
    geo.setAttribute('position', new THREE.BufferAttribute(this.streakPos, 3));
    this.streakMat = new THREE.LineBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.25), transparent: true, opacity: 0.6, depthWrite: false });
    this.streaks = new THREE.LineSegments(geo, this.streakMat);
    this.streaks.frustumCulled = false;
    this.streaks.userData.ownGeometry = true;
    this.own(this.streakMat);
    session.scene.add(this.streaks);
    this._findGround();
    this.zone.position.set(pos.x, this.groundY + 0.04, pos.z);
  }

  _findGround() {
    const g = this.session.level.raycast(_p.copy(this.group.position).setY(this.group.position.y - 0.5), DOWN, this.s.height + 8, { staticOnly: true });
    if (g) this.groundY = g.point.y;
  }

  get fade() {
    const s = this.s;
    return Math.min(1, this.t / 0.45, Math.max(0, (s.life - this.t) / 0.6));
  }

  step(dt) {
    const S = this.session, s = this.s;
    this.t += dt;
    if (this.t >= s.life) { this.remove(); return; }
    this.group.position.addScaledVector(this.drift, dt);
    if (((this.t * 60) | 0) % 10 === 0) this._findGround();
    const raining = this.t > 0.35 && this.t < s.life - 0.4;
    if (!raining) return;
    const c = this.group.position;
    // ink drops
    this.dropAcc += dt * s.dropRate;
    const color = this.color;
    while (this.dropAcc >= 1) {
      this.dropAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.radius;
      _m.set(c.x + Math.cos(a) * r, c.y - 0.5, c.z + Math.sin(a) * r);
      _v.set(this.drift.x, -9 - Math.random() * 3, this.drift.z);
      S.projectiles.spawn({
        pos: _m, vel: _v, team: this.team, owner: this.owner, damage: 0, size: 0.06, radius: 0.05,
        gravity: 14, life: 2.2, paint: { radius: s.paintRadius * (0.8 + Math.random() * 0.45) }, fx: false, ignoreActors: true,
        onHit: (p, hit) => { if (Math.random() < 0.35 && hit.normal) S.fx.burst(hit.point, hit.normal, color, 3, 2, { size: 0.04, life: 0.35 }); },
      });
    }
    // damage tick for anyone under the cloud (and not under a roof)
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = s.tick;
      for (const a of S.actors) {
        if (!a.alive || a.team === this.team || a.untargetable) continue;
        a.hitCenter(_hc);
        if (_hc.y > c.y || _hc.y < this.groundY - 3) continue;
        if (Math.hypot(_hc.x - c.x, _hc.z - c.z) > s.radius + (a.hitRadius ?? 0.5) * 0.5) continue;
        if (!S.level.lineOfSight(_hc, _p.set(_hc.x, c.y - 0.6, _hc.z))) continue;
        hitActor(S, a, s.tickDamage, { source: this.owner, team: this.team, point: _hc.clone(), dir: DOWN.clone(), kind: 'special' });
      }
    }
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.11;
      S.audio?.sfx('rain', { pos: _p.set(c.x, this.groundY + 1, c.z), volume: 0.45, throttle: 0.05 });
    }
    this.flashT -= dt;
    if (this.flashT <= 0) {
      this.flashT = 0.9 + Math.random() * 1.4;
      this.flash = 1;
      S.fx.burst(_p.set(c.x + (Math.random() - 0.5) * 2, c.y - 0.2, c.z + (Math.random() - 0.5) * 2), DOWN, '#ffffff', 5, 4, { size: 0.03, life: 0.25, gravity: 0 });
    }
  }

  render(dt) {
    const s = this.s;
    const f = this.fade;
    const T = this.t;
    this.cloud.scale.setScalar(Math.max(0.01, f * (1 + Math.sin(T * 2.2) * 0.03)));
    this.cloud.rotation.y += dt * 0.15;
    this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.cloud.userData.puffs) {
      const b = m.userData.base;
      m.position.set(b.x, b.y + Math.sin(T * 1.7 + b.x * 2 + b.z) * 0.08, b.z);
    }
    for (const mat of this.cloud.userData.mats) mat.emissiveIntensity = 0.18 + this.flash * 1.4;
    const c = this.group.position;
    this.zone.position.set(c.x, this.groundY + 0.04, c.z);
    this.zone.scale.setScalar(Math.max(0.01, f));
    this.zone.children[1].material.opacity = 0.35 + Math.sin(T * 6) * 0.15;
    // rain streaks
    const raining = T > 0.35 && T < s.life - 0.4;
    const P = this.streakPos;
    for (let i = 0; i < STREAKS; i++) {
      const d = this.streakData[i];
      d.y -= d.v * dt;
      if (d.y < this.groundY) {
        if (!raining) { d.y = -999; } else {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.radius;
          d.x = Math.cos(a) * r; d.z = Math.sin(a) * r;
          d.y = c.y - 0.4 - Math.random() * (c.y - this.groundY) * (d.v === 0 ? 1 : 0.15);
          d.v = 11 + Math.random() * 4;
        }
      }
      const o = i * 6;
      const vis = d.y > this.groundY - 1;
      const x = c.x + d.x, z = c.z + d.z;
      P[o] = x; P[o + 1] = vis ? d.y : -999; P[o + 2] = z;
      P[o + 3] = x + this.drift.x * 0.04; P[o + 4] = vis ? d.y + 0.55 : -999; P[o + 5] = z + this.drift.z * 0.04;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.streakMat.opacity = 0.6 * f;
  }

  dispose() {
    this.session.scene.remove(this.zone, this.streaks);
    super.dispose();
    this.zone.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.streaks.geometry.dispose();
  }
}

export class InkStorm extends Special {
  static defaults = {
    throwSpeed: 12.5, lift: 0.5, seedTime: 0.62,
    life: 6.6, radius: 4, height: 4.4, dropRate: 34, paintRadius: 0.42, tick: 0.25, tickDamage: 4, drift: 0.9,
  };

  constructor(w, stats) {
    super(w, stats);
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  activate() {
    super.activate();
    this.t = 0;
    this.thrown = false;
    sfx(this.w, 'special', { volume: 0.8 });
  }

  get blocksFire() { return this.active && this.t < 0.32; }

  update(dt) {
    this.t += dt;
    if (!this.thrown && this.t >= 0.14) this.throwSeed();
    if (this.t >= 0.34) this.end();
  }

  throwSeed() {
    const w = this.w, S = w.session, s = this.s;
    this.thrown = true;
    const color = S.ink.color(w.team);
    _m.copy(w.position).setY(w.position.y + 1.7);
    _v.set(w.aim.dir.x, 0, w.aim.dir.z);
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(w.yaw), 0, Math.cos(w.yaw));
    _v.normalize();
    const drift = _v.clone().multiplyScalar(s.drift);
    _v.multiplyScalar(s.throwSpeed * Math.cos(s.lift)).setY(s.throwSpeed * Math.sin(s.lift));
    const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3 }));
    let spawned = false;
    const burst = (pos) => {
      if (spawned) return;
      spawned = true;
      seed.geometry.dispose(); seed.material.dispose();
      const g = S.level.raycast(_p.copy(pos).setY(pos.y + 0.5), DOWN, 30, { staticOnly: true });
      const gy = g ? g.point.y : pos.y - 2;
      const at = new THREE.Vector3(pos.x, gy + s.height, pos.z);
      // don't bury the cloud in a ceiling
      const up = S.level.raycast(_p.set(pos.x, gy + 0.5, pos.z), UP, s.height, { staticOnly: true });
      if (up) at.y = gy + Math.max(2.2, up.distance - 0.4);
      S.addEntity(new StormCloud(S, w, at, drift, s));
      S.fx.explosion(at, DOWN, color, 1.6);
      S.audio?.sfx('storm_spawn', { pos: at, volume: 0.9 });
    };
    S.projectiles.spawn({
      pos: _m, vel: _v, team: w.team, owner: w, damage: 0, radius: 0.2, gravity: 16, life: s.seedTime, mesh: seed, ignoreActors: true, fx: false,
      onStep: (p, dt) => { seed.rotation.x += dt * 9; seed.rotation.y += dt * 5; if (Math.random() < 0.6) S.fx.spray(p.pos, _hc.set(0, -1, 0), color, 1, 0.6, { size: 0.05, life: 0.3 }); },
      onHit: (p, hit) => burst(hit.point),
      onExpire: (p) => burst(p.pos),
    });
    sfx(w, 'storm_throw', { volume: 0.7 });
  }

  /** Off-hand overhead throw. */
  pose(dt, st, m) {
    if (!this.active || st.hidden || !m.kid.visible) return;
    const off = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
    const k = Math.min(1, this.t / 0.3);
    off.sh.rotation.set(THREE.MathUtils.lerp(-2.9, -1.0, k * k), 0, 0.2);
    off.elbow.rotation.set(THREE.MathUtils.lerp(-1.4, -0.1, k), 0, 0);
  }

  dispose() { this.unhook?.(); }
}

registerSpecial('ink-storm', InkStorm);
