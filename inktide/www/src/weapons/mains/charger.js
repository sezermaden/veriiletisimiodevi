// Longshot charger. Hold Fire to charge (rising whine, laser sight in the team colour, charge ring
// on the crosshair via `charge`), release to fire an instant long shot that paints a line along
// its path. A full charge splats in one hit (160) and pierces through everyone in the line.
import * as THREE from 'three';
import { MainWeapon, registerMain, muzzleOf, aimDir } from '../base.js';
import { makeChargerModel, addPoseHook, reachArm, glowTexture } from '../models.js';
import { rayActor, paintBelow, sfx, Beam, LoopSound } from './shared.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

export class Charger extends MainWeapon {
  static defaults = {
    chargeTime: 0.95,
    airChargeMul: 0.55,
    moveMul: 0.32,
    minDamage: 40,
    partialMax: 90,
    fullDamage: 160,
    minRange: 11,
    maxRange: 22,
    fullInk: 18,
    minInkFrac: 0.3,
    speed: 170,
    range: 22,
  };

  constructor(w, stats) {
    super(w, stats);
    this.chg = 0;
    this.charging = false;
    this.full = false;
    this.fullFlash = 0;
    this.shotFade = 0;
    const S = w.session, color = S.ink.color(w.team);
    this.laser = new Beam(S.scene, color, 0.012, 0.55, false);
    this.laserGlow = new Beam(S.scene, color, 0.035, 0.18, false);
    this.dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, toneMapped: false }));
    this.dot.visible = false;
    this.dot.renderOrder = 4;
    S.scene.add(this.dot);
    this.tracer = new Beam(S.scene, '#ffffff', 0.03, 0.9);
    this.tracerGlow = new Beam(S.scene, color, 0.12, 0.5, false);
    this.loop = new LoopSound(S.audio, 'charge');
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
    this._laserFrom = new THREE.Vector3();
    this._laserTo = new THREE.Vector3();
  }

  buildModel() { return makeChargerModel(this.w.session.ink.color(this.w.team)); }

  get charge() { return this.charging ? Math.max(0.001, this.chg) : 0; }
  get moveMul() { return this.charging ? this.s.moveMul : 1; }
  get range() { return this.s.maxRange; }

  muzzle(out) {
    const mz = this.model?.userData.muzzle;
    if (mz && this.model.visible && this.w.model?.kid?.visible) return mz.getWorldPosition(out);
    return muzzleOf(this.w, out, 0.75, 0.2, 1.12);
  }

  update(dt, ctrl) {
    const w = this.w, s = this.s, S = w.session;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.fullFlash = Math.max(0, this.fullFlash - dt * 3);
    if (this.shotFade > 0) {
      this.shotFade = Math.max(0, this.shotFade - dt / 0.22);
      const k = this.shotFade;
      this.tracer.mat.opacity = 0.95 * k;
      this.tracerGlow.mat.opacity = 0.55 * k;
      this.tracer.mesh.scale.x = this.tracer.mesh.scale.z = 0.03 * (0.4 + k * 0.6);
      this.tracerGlow.mesh.scale.x = this.tracerGlow.mesh.scale.z = this.tracerGlowR * (1.4 - k * 0.4);
      if (k <= 0) { this.tracer.hide(); this.tracerGlow.hide(); }
    }
    if (ctrl.fire) {
      if (!this.charging) {
        if (w.ink < s.fullInk * s.minInkFrac) { if (ctrl.firePressed) w.onOutOfInk?.(); this.firing = false; return; }
        this.charging = true;
        this.chg = 0;
        this.full = false;
      }
      const rate = (1 / s.chargeTime) * (w.grounded ? 1 : s.airChargeMul);
      const inkCap = Math.max(s.minInkFrac, w.ink / s.fullInk);
      const before = this.chg;
      this.chg = Math.min(1, inkCap, this.chg + rate * dt);
      if (this.chg < before) this.chg = before;
      if (!this.full && this.chg >= 1) {
        this.full = true;
        this.fullFlash = 1;
        this.muzzle(_m);
        const color = S.ink.color(w.team);
        S.fx.burst(_m, _n.set(0, 1, 0), '#ffffff', 8, 2.5, { size: 0.03, life: 0.35, gravity: 2 });
        S.fx.burst(_m, _n, color, 6, 2, { size: 0.04, life: 0.4, gravity: 4 });
        sfx(w, 'charger_full', { volume: 0.6 });
      }
      this.firing = true;
      if (w.isPlayer) this.loop.keep(this.chg, 1);
      if (!w.model) this.updateLaser();
    } else if (this.charging) {
      this.fire();
      this.charging = false;
      this.firing = false;
    }
    if (!this.charging) { this.laser.hide(); this.laserGlow.hide(); this.dot.visible = false; }
  }

  /** Laser sight: muzzle → first thing in the way within the current range. */
  updateLaser() {
    const w = this.w, S = w.session, s = this.s;
    if (!this.charging) return;
    this.muzzle(_m);
    aimDir(w, _m, 0, _d);
    const range = s.minRange + (s.maxRange - s.minRange) * this.chg;
    const hit = S.level.raycast(_m, _d, range);
    let dist = hit ? hit.distance : range;
    const ah = rayActor(S, w.team, _m, _d, dist, 0.05);
    if (ah) dist = ah.dist;
    _e.copy(_m).addScaledVector(_d, dist);
    const pulse = this.full ? 1 + Math.sin(S.time * 30) * 0.25 : 1;
    this.laser.set(_m, _e, 0.01 + this.chg * 0.006);
    this.laserGlow.set(_m, _e, (0.025 + this.chg * 0.02) * pulse);
    this.laser.mat.opacity = 0.35 + this.chg * 0.5;
    this.laserGlow.mat.opacity = 0.08 + this.chg * 0.14 + this.fullFlash * 0.3;
    this.dot.visible = !!(hit || ah);
    this.dot.position.copy(_e).addScaledVector(_d, -0.05);
    this.dot.scale.setScalar((0.3 + this.chg * 0.25) * pulse);
  }

  fire() {
    const w = this.w, s = this.s, S = w.session;
    const lv = this.chg, full = lv >= 1;
    const cost = s.fullInk * Math.max(s.minInkFrac, lv);
    if (!w.useInk(Math.min(cost, w.ink))) { w.onOutOfInk?.(); return; }
    const color = S.ink.color(w.team);
    this.muzzle(_m);
    aimDir(w, _m, 0, _d);
    const range = s.minRange + (s.maxRange - s.minRange) * lv;
    const damage = full ? s.fullDamage : THREE.MathUtils.lerp(s.minDamage, s.partialMax, lv);
    const hit = S.level.raycast(_m, _d, range);
    let end = hit ? hit.distance : range;
    if (!full) { const ah = rayActor(S, w.team, _m, _d, end, 0.1); if (ah) end = ah.dist; }

    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.speed), team: w.team, owner: w,
      damage, size: 0.07, radius: 0.1, gravity: 0, life: range / s.speed + 0.02, pierce: full, noRender: true,
      paint: { radius: full ? 1.05 : 0.55 + lv * 0.3 },
      onExpire: (p) => paintBelow(S, p.pos, 0.55, w.team, w, 6),
    });
    // the line of ink along the shot
    const step = 0.72;
    for (let d = 1.1; d < end; d += step) {
      _p.copy(_m).addScaledVector(_d, d);
      paintBelow(S, _p, (0.3 + lv * 0.08) * (0.85 + Math.random() * 0.3), w.team, w, 5);
    }
    // tracer
    _e.copy(_m).addScaledVector(_d, end);
    this.tracerGlowR = full ? 0.13 : 0.07;
    this.tracer.set(_m, _e, 0.03);
    this.tracerGlow.set(_m, _e, this.tracerGlowR);
    this.tracerGlow.mat.color.copy(color);
    this.shotFade = 1;
    for (let d = 1; d < end; d += 1.6) {
      _p.copy(_m).addScaledVector(_d, d);
      S.fx.spray(_p, _n.copy(_d).multiplyScalar(2.5), color, 1, 1.4, { size: 0.04 + lv * 0.02, life: 0.35 });
    }
    S.fx.burst(_m, _d, color, 6 + Math.round(lv * 10), 4 + lv * 3, { size: 0.05 });
    S.fx.ring(_m, _d, color, 0.35 + lv * 0.5, 0.2);
    sfx(w, 'charger_fire', { volume: 0.55 + lv * 0.35, level: lv });
    if (full) S.shake?.(w.position, 0.14);
    this.recoil = 0.6 + lv * 0.6;
    this.chg = 0;
    this.full = false;
  }

  cancel() {
    this.firing = false;
    this.charging = false;
    this.chg = 0;
    this.full = false;
    this.laser.hide(); this.laserGlow.hide(); this.dot.visible = false;
  }

  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    const off = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
    if (!st.aiming) {
      // port arms: rifle carried diagonally across the body
      m.gunArm.sh.rotation.set(-0.55, 0, 0.35);
      m.gunArm.elbow.rotation.set(-1.25, 0, 0);
    }
    m.root.updateMatrixWorld(true);
    reachArm(off, this.model.userData.foregrip.getWorldPosition(_p), 0.3);
    const glow = this.model.userData.glow;
    const c = this.charging ? this.chg : 0;
    glow.material.opacity = c * 0.75 + this.fullFlash * 0.25;
    glow.scale.setScalar(0.5 + c * 1.1 + (this.full ? Math.sin(performance.now() * 0.03) * 0.15 : 0));
    this.updateLaser();
  }

  dispose() {
    this.unhook?.();
    this.loop.stop();
    for (const b of [this.laser, this.laserGlow, this.tracer, this.tracerGlow]) b.dispose();
    this.w.session.scene.remove(this.dot);
    this.dot.material.dispose();
    super.dispose();
  }
}

registerMain('charger', Charger);
