// Ink Jet: strap on a jetpack and hover ~5 m above the launch point for 8 s. Move freely (WASD /
// stick, or `botMove` for bots), Fire shoots slow explosive shots, the exhaust rains ink on the
// ground below. When the fuel runs out you drift back down with a splash landing.
import * as THREE from 'three';
import { Special, registerSpecial, aimDir } from '../base.js';
import { makeJetpackModel, makeBlasterModel, addPoseHook } from '../models.js';
import { wishDir, blast, sfx, LoopSound, toWorld, UP, DOWN } from '../mains/shared.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();

export class InkJet extends Special {
  static defaults = {
    duration: 8, hover: 5, clearance: 3, speed: 6.6, accel: 7,
    fireInterval: 0.72, shotSpeed: 21, direct: 110, splashDamage: 70, splashRadius: 2.5, paintRadius: 2.1,
  };

  constructor(w, stats) {
    super(w, stats);
    this.jet = null;
    this.gun = null;
    this.loop = new LoopSound(w.session.audio, 'jet');
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  get drivesMovement() { return this.active; }
  get hidesMain() { return this.active; }

  activate() {
    super.activate();
    const w = this.w, S = w.session;
    this.phase = 'rise';
    this.t = 0;
    this.fireCool = 0.3;
    this.dripT = 0;
    this.launchY = w.position.y;
    this.shotKick = 0;
    w.velocity.set(w.velocity.x * 0.3, 10, w.velocity.z * 0.3);
    const color = S.ink.color(w.team);
    S.ink.paint(w.position, 2, w.team, UP, { source: w });
    S.fx.explosion(w.position, UP, color, 1.6);
    S.fx.ring(w.position, UP, color, 2.4, 0.5);
    sfx(w, 'jet_start', { volume: 0.9 });
    sfx(w, 'special', { volume: 0.6 });
    const m = w.model;
    if (m?.torso) {
      this.jet = makeJetpackModel(color);
      this.jet.position.set(0, 0.16, -0.22);
      m.torso.add(this.jet);
      if (m.pack) m.pack.visible = false;
      this.gun = makeBlasterModel(color, '#eef1f5');
      m.weaponSocket.add(this.gun);
    }
  }

  update(dt, ctrl) {
    const w = this.w, S = w.session, s = this.s;
    this.t += dt;
    this.fireCool -= dt;
    this.shotKick = Math.max(0, this.shotKick - dt * 5);
    if (w.sinceFire !== undefined) w.sinceFire = 0;   // keep the Player facing the aim while flying
    const v = w.velocity;
    const g = S.level.groundBelow(w.position, 40);
    const groundY = g ? g.point.y : this.launchY;
    const targetY = Math.max(this.launchY + s.hover, groundY + s.clearance) + Math.sin(this.t * 2.3) * 0.18;

    if (this.phase === 'rise' || this.phase === 'fly') {
      wishDir(w, _w);
      const k = Math.min(1, s.accel * dt);
      v.x += (_w.x * s.speed - v.x) * k;
      v.z += (_w.z * s.speed - v.z) * k;
      const vy = THREE.MathUtils.clamp((targetY - w.position.y) * (this.phase === 'rise' ? 4 : 3), -6, 11);
      v.y += (vy - v.y) * Math.min(1, dt * (this.phase === 'rise' ? 6 : 8));
      if (this.phase === 'rise' && this.t > 0.7) this.phase = 'fly';
      // the main weapon is blocked while flying (blocksFire), so read the trigger directly
      // (level-triggered): the player's input, a turf bot's BotInput, or an explicit botFire flag
      const src = w.isPlayer ? S.input : w.bot?.input;
      const fire = ctrl.fire || !!w.botFire || !!src?.isDown?.('fire');
      if (fire && this.fireCool <= 0 && this.t > 0.25) this.shoot();
      if (this.t >= s.duration) { this.phase = 'land'; this.landT = 0; sfx(w, 'special_end', { volume: 0.6 }); }
      if (w.isPlayer) this.loop.keep(Math.min(1, Math.hypot(v.x, v.z) / s.speed * 0.5 + 0.5), 1);
    } else if (this.phase === 'land') {
      this.landT += dt;
      v.x *= 0.92; v.z *= 0.92;
      v.y += (-9 - v.y) * Math.min(1, dt * 4);
      if (w.isPlayer) this.loop.keep(0.2, 0.6);
      if (w.grounded || this.landT > 3) { this.touchDown(); return; }
    }

    // exhaust: ink drips that paint the ground under the flight path
    this.dripT -= dt;
    if (this.dripT <= 0 && this.phase !== 'land') {
      this.dripT = 0.1;
      const color = S.ink.color(w.team);
      this.nozzle(Math.random() < 0.5 ? 0 : 1, _m);
      S.projectiles.spawn({
        pos: _m, vel: _d.set(v.x * 0.6, -11, v.z * 0.6), team: w.team, owner: w, damage: 0, size: 0.09, radius: 0.08,
        gravity: 10, life: 3, paint: { radius: 0.62 }, fx: false, ignoreActors: true,
      });
      S.fx.spray(_m, _d.set(v.x * 0.3, -7, v.z * 0.3), color, 2, 1.5, { size: 0.06, life: 0.35, gravity: 6 });
      if (Math.random() < 0.5) S.fx.puff(_m.setY(_m.y - 0.3), '#ffffff', 0.35, 0.35, _d.set(0, -2, 0), 2.2, 0.35);
    }
  }

  nozzle(i, out) {
    const f = this.jet?.userData.flames?.[i];
    if (f && this.w.model?.kid?.visible) return this.jet.localToWorld(out.copy(f.nozzle));
    return toWorld(this.w, i ? 0.15 : -0.15, 0.8, -0.3, out);
  }

  muzzle(out) {
    const g = this.gun?.userData.muzzle;
    if (g && this.w.model?.kid?.visible) return g.getWorldPosition(out);
    return toWorld(this.w, -0.22, 1.05, 0.55, out);
  }

  shoot() {
    const w = this.w, S = w.session, s = this.s;
    this.fireCool = s.fireInterval;
    const color = S.ink.color(w.team);
    this.muzzle(_m);
    aimDir(w, _m, 1.2, _d);
    let done = false;
    const det = (pos, n, skip) => {
      if (done) return;
      done = true;
      blast(S, pos, n, w.team, { owner: w, damage: s.splashDamage, radius: s.splashRadius, paintRadius: s.paintRadius, skip, sound: 'blaster_boom' });
    };
    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.shotSpeed), team: w.team, owner: w, damage: s.direct,
      size: 0.24, radius: 0.28, gravity: 7, gravityDelay: 0.25, life: 1.7, fx: false,
      trail: { every: 2, radius: 0.35 },
      onHit: (p, hit) => det(hit.point.clone(), hit.actor ? UP : hit.normal, hit.actor || null),
      onExpire: (p) => det(p.pos.clone(), null, null),
      onStep: (p) => { if (Math.random() < 0.5) S.fx.spray(p.pos, _p.copy(p.vel).multiplyScalar(0.1), color, 1, 0.7, { size: 0.06, life: 0.25 }); },
    });
    S.fx.burst(_m, _d, color, 10, 4, { size: 0.06 });
    S.fx.ring(_m, _d, color, 0.5, 0.22);
    sfx(w, 'blaster_fire', { volume: 0.85, pitch: 0.8 });
    S.shake?.(w.position, 0.1);
    this.shotKick = 1;
  }

  touchDown() {
    const w = this.w, S = w.session;
    const g = S.level.groundBelow(w.position, 3);
    const p = g ? g.point : w.position.clone();
    S.ink.paint(p, 2.2, w.team, g ? g.normal : UP, { source: w });
    S.fx.explosion(p, g ? g.normal : UP, S.ink.color(w.team), 1.8);
    sfx(w, 'jet_land', { volume: 0.8 });
    S.shake?.(p, 0.3);
    this.end();
  }

  end() {
    if (!this.active && !this.jet) return;
    super.end();
    const w = this.w, m = w.model;
    this.loop.stop();
    if (this.jet) { this.jet.parent?.remove(this.jet); this.jet.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.jet = null; }
    if (this.gun) { this.gun.parent?.remove(this.gun); this.gun.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.gun = null; }
    if (m?.pack) m.pack.visible = true;
    const mm = w.kit?.main?.model;
    if (mm) mm.scale.setScalar(1);
    if (w.velocity.y > 0) w.velocity.y = 0;
  }

  pose(dt, st, m) {
    if (!this.active || !this.jet) return;
    const w = this.w;
    const mm = w.kit?.main?.model;
    if (mm) mm.scale.setScalar(0.0001);
    if (st.hidden || !m.kid.visible) return;
    // flames flicker, longer while climbing
    const boost = this.phase === 'rise' ? 1.4 : this.phase === 'land' ? 0.5 : 1 + Math.min(0.4, Math.hypot(w.velocity.x, w.velocity.z) * 0.06);
    for (const f of this.jet.userData.flames) {
      const r = 0.85 + Math.random() * 0.3;
      f.core.scale.set(r, boost * (0.9 + Math.random() * 0.25), r);
      f.outer.scale.set(r, boost * (0.85 + Math.random() * 0.35), r);
    }
    // pose: gun arm aims, off arm out for balance, legs dangle
    const pitch = st.aimPitch || 0;
    m.gunArm.sh.rotation.set(-Math.PI / 2 - pitch + this.shotKick * 0.35, 0, 0.1);
    m.gunArm.elbow.rotation.set(-0.12, 0, 0);
    const off = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
    off.sh.rotation.set(-0.5 + Math.sin(this.t * 3) * 0.1, 0, off.side * 0.9);
    off.elbow.rotation.set(-0.6, 0, 0);
    for (const L of m.legs) {
      const p = this.t * 4 + (L.side > 0 ? 1.4 : 0);
      L.thigh.rotation.x = 0.1 + Math.sin(p) * 0.18;
      L.knee.rotation.x = 0.35 + Math.sin(p + 0.8) * 0.2;
      L.foot.rotation.x = 0.4;
    }
    m.torso.rotation.x = 0.12 + (w.velocity.x * Math.sin(w.yaw) + w.velocity.z * Math.cos(w.yaw)) * 0.02;
    if (this.gun) this.gun.userData.inner.position.z = -this.shotKick * 0.06;
  }

  dispose() {
    this.unhook?.();
    if (this.active || this.jet) this.end();
    this.loop.stop();
  }
}

registerSpecial('ink-jet', InkJet);
