// Wave Roller. Hold Fire while moving to roll: the drum paints a wide lane and runs over anything
// in its way (heavy contact damage). Tap Fire to flick: the roller swings overhead and hurls a
// wide fan of heavy blobs (a tall, narrow fan when flicked in mid-air).
import * as THREE from 'three';
import { MainWeapon, registerMain } from '../base.js';
import { makeRollerModel, addPoseHook, holdTwoHanded, rootMatrix } from '../models.js';
import { toWorld, aimYaw, hitActor, sfx, DOWN } from './shared.js';

const PIVOT_Y = 0.98;          // shoulder-height pivot the roller swings around (body space)
const PIVOT_Z = 0.02;
const T_RAISE = 0.13, T_SLAM = 0.22, T_RELEASE = 0.19, T_END = 0.42;

const _drum = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _v = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _g = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;

export class Roller extends MainWeapon {
  static defaults = {
    moveMul: 0.62,            // rolling walk speed multiplier
    flickMoveMul: 0.45,
    rollInkPerM: 1.4,         // ink per metre of lane
    flickInk: 8,
    rollDamage: 125,          // running someone over
    rollDamageSlow: 45,       // nudging into them
    rollMinSpeed: 1.6,
    rollHitCool: 0.45,
    paintSpacing: 0.3,
    laneR: 0.48,
    flickDamage: 35,
    flickBlobs: 11,
    flickSpread: 0.52,        // radians either side
    flickSpeedFar: 13.5,
    flickSpeedNear: 9,
    flickPaint: 0.62,
    range: 5.5,
  };

  constructor(w, stats) {
    super(w, stats);
    this.state = 'idle';
    this.t = 0;
    this.released = false;
    this.airFlick = false;
    this.groundDy = 0;
    this.phiVis = this.restPhi(true);
    this.spinA = 0;
    this.paintAcc = 0;
    this.hasPrev = false;
    this.fxT = 0;
    this.sndT = 0;
    this.hitCool = new Map();
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  buildModel() { return makeRollerModel(this.w.session.ink.color(this.w.team)); }

  get moveMul() { return this.state === 'roll' ? this.s.moveMul : this.state === 'flick' ? this.s.flickMoveMul : 1; }

  /** Roller angle that puts the drum on the ground (or lifted a little when carried). */
  restPhi(carry) {
    const md = this.model?.userData || { R: 1.2, rad: 0.165 };
    const y = (this.groundDy || 0) + md.rad + (carry ? 0.2 : 0);
    return Math.asin(THREE.MathUtils.clamp((y - PIVOT_Y) / md.R, -1, 1));
  }

  /** Target swing angle for the current state (0 = straight forward at shoulder height). */
  targetPhi() {
    if (this.state !== 'flick') return this.restPhi(this.state === 'idle');
    const t = this.t, rest = this.restPhi(false);
    if (t < T_RAISE) return THREE.MathUtils.lerp(rest, 2.15, easeOut(t / T_RAISE));
    if (t < T_SLAM) return THREE.MathUtils.lerp(2.15, -0.35, easeIn((t - T_RAISE) / (T_SLAM - T_RAISE)));
    return THREE.MathUtils.lerp(-0.35, rest, easeOut(Math.min(1, (t - T_SLAM) / (T_END - T_SLAM))));
  }

  drumWorld(phi, out) {
    const R = this.model?.userData.R ?? 1.2;
    return toWorld(this.w, 0, PIVOT_Y + Math.sin(phi) * R, PIVOT_Z + Math.cos(phi) * R, out);
  }

  update(dt, ctrl) {
    const w = this.w, s = this.s;
    for (const [a, t] of this.hitCool) { if (t - dt <= 0) this.hitCool.delete(a); else this.hitCool.set(a, t - dt); }

    // ground under the drum (keeps it on slopes and stairs)
    this.drumWorld(this.restPhi(false), _drum);
    const g = w.session.level.raycast(_v.set(_drum.x, w.position.y + 0.9, _drum.z), DOWN, 1.8, { staticOnly: false });
    const dy = g ? THREE.MathUtils.clamp(g.point.y - w.position.y, -0.6, 0.6) : -0.6;
    this.groundDy += (dy - this.groundDy) * Math.min(1, dt * 20);

    if (this.state === 'idle') {
      this.firing = false;
      if (ctrl.fire) this.startFlick();
    }
    if (this.state === 'flick') {
      this.firing = true;
      this.t += dt;
      if (!this.released && this.t >= T_RELEASE) this.release();
      if (this.t >= T_END) {
        this.state = ctrl.fire ? 'roll' : 'idle';
        this.hasPrev = false;
      }
    } else if (this.state === 'roll') {
      this.firing = true;
      if (!ctrl.fire) { this.state = 'idle'; this.firing = false; } else this.roll(dt, g);
    }
  }

  startFlick() {
    this.state = 'flick';
    this.t = 0;
    this.released = false;
    this.airFlick = !this.w.grounded;
    sfx(this.w, 'whoosh', { volume: 0.35, pitch: 1.3 });
  }

  release() {
    const w = this.w, s = this.s, S = w.session;
    this.released = true;
    if (!w.useInk(s.flickInk)) { w.onOutOfInk?.(); return; }
    const color = S.ink.color(w.team);
    this.drumWorld(0.15, _drum);
    const yaw0 = aimYaw(w);
    const pitch0 = Math.asin(THREE.MathUtils.clamp(w.aim.dir.y, -1, 1));
    const n = this.airFlick ? 7 : s.flickBlobs;
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0.5;
      let yaw, pitch, speed;
      if (this.airFlick) {
        yaw = yaw0 + (Math.random() - 0.5) * 0.06;
        pitch = pitch0 * 0.7 + THREE.MathUtils.lerp(-0.12, 0.3, k);
        speed = THREE.MathUtils.lerp(18, 13, k) * (0.95 + Math.random() * 0.1);
      } else {
        yaw = yaw0 + THREE.MathUtils.lerp(-s.flickSpread, s.flickSpread, k) + (Math.random() - 0.5) * 0.05;
        pitch = pitch0 * 0.55 + 0.19 + (Math.random() - 0.5) * 0.08;
        speed = (i % 2 ? s.flickSpeedNear : s.flickSpeedFar) * (0.92 + Math.random() * 0.16);
      }
      const cp = Math.cos(pitch);
      _v.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(speed);
      _v.x += w.velocity.x * 0.4; _v.z += w.velocity.z * 0.4;
      const lateral = THREE.MathUtils.lerp(-0.4, 0.4, k);
      const from = _g.copy(_drum).add(_right.set(Math.cos(yaw0), 0, -Math.sin(yaw0)).multiplyScalar(this.airFlick ? 0 : lateral));
      S.projectiles.spawn({
        pos: from, vel: _v, team: w.team, owner: w,
        damage: this.airFlick ? 45 : s.flickDamage, size: 0.15 + Math.random() * 0.04, radius: 0.2,
        gravity: 22, gravityDelay: 0.05, life: 2,
        paint: { radius: s.flickPaint * (0.85 + Math.random() * 0.3) },
        falloff: this.airFlick ? { start: 6, end: 11, min: 0.4 } : { start: 3.5, end: 8, min: 0.35 },
      });
    }
    S.fx.spray(_drum, _v.set(Math.sin(yaw0), 0.4, Math.cos(yaw0)).multiplyScalar(7), color, 14, 5, { size: 0.08, life: 0.5 });
    S.fx.burst(_drum, _v.set(Math.sin(yaw0), 0.2, Math.cos(yaw0)), color, 10, 4, { size: 0.07 });
    sfx(w, 'roller_flick', { volume: 0.8 });
    S.shake?.(w.position, 0.14);
    this.recoil = 1;
  }

  roll(dt, ground) {
    const w = this.w, s = this.s, S = w.session;
    const color = S.ink.color(w.team);
    this.drumWorld(this.restPhi(false), _drum);
    const speed = Math.hypot(w.velocity.x, w.velocity.z);
    _fwd.set(Math.sin(w.yaw), 0, Math.cos(w.yaw));
    _right.set(Math.cos(w.yaw), 0, -Math.sin(w.yaw));
    if (!this.hasPrev) { _prev.copy(_drum); this.hasPrev = true; this.paintAcc = s.paintSpacing; }
    const moved = Math.hypot(_drum.x - _prev.x, _drum.z - _prev.z);
    const fwdMove = (_drum.x - _prev.x) * _fwd.x + (_drum.z - _prev.z) * _fwd.z;
    _prev.copy(_drum);
    if (!w.grounded || !ground || moved > 2) return;
    this.spinA += fwdMove / (this.model?.userData.rad ?? 0.165);

    // paint the lane
    this.paintAcc += moved;
    if (this.paintAcc >= s.paintSpacing) {
      const segs = this.paintAcc;
      this.paintAcc = 0;
      if (w.useInk(s.rollInkPerM * segs)) {
        const p = ground.point, n = ground.normal;
        S.ink.paint(p, s.laneR, w.team, n, { source: w });
        for (const side of [-1, 1]) {
          _g.copy(p).addScaledVector(_right, side * 0.3);
          S.ink.paint(_g, s.laneR * 0.78, w.team, n, { source: w });
        }
      } else {
        w.onOutOfInk?.();
      }
    }

    // juice: droplets kicked up behind the drum + squelch
    this.fxT -= dt;
    if (speed > 0.8 && this.fxT <= 0) {
      this.fxT = 0.06;
      _g.copy(_drum).addScaledVector(_right, (Math.random() - 0.5) * 0.8).setY(ground.point.y + 0.05);
      S.fx.spray(_g, _v.set(-_fwd.x * 1.5, 2.2, -_fwd.z * 1.5), color, 2, 1.2, { size: 0.045, life: 0.35 });
    }
    this.sndT -= dt;
    if (speed > 0.8 && this.sndT <= 0) {
      this.sndT = 0.16;
      sfx(w, 'roller_roll', { volume: 0.35, pitch: 0.8 + speed * 0.08, throttle: 0.05 });
    }

    // contact damage: anyone in front of / under the drum
    const width = (this.model?.userData.width ?? 0.82) * 0.5;
    for (const a of S.actors) {
      if (!a.alive || a.team === w.team || a.untargetable || this.hitCool.has(a)) continue;
      a.hitCenter(_hc);
      const rx = _hc.x - _drum.x, rz = _hc.z - _drum.z;
      const lat = rx * _right.x + rz * _right.z;
      const fw = rx * _fwd.x + rz * _fwd.z;
      const r = a.hitRadius ?? 0.5;
      if (Math.abs(lat) > width + r * 0.8 || fw < -0.45 || fw > 0.25 + r) continue;
      const feet = a.position.y, top = feet + (a.hitHeight ?? 1.2);
      if (top < _drum.y - 0.35 || feet > _drum.y + 0.5) continue;
      const fast = speed > s.rollMinSpeed;
      const dmg = fast ? s.rollDamage : s.rollDamageSlow;
      this.hitCool.set(a, s.rollHitCool);
      hitActor(S, a, dmg, { source: w, team: w.team, point: _hc.clone(), dir: _fwd.clone(), kind: 'roll' });
      S.fx.burst(_hc, _v.copy(_fwd).setY(0.5).normalize(), color, fast ? 18 : 8, fast ? 6 : 3.5, { size: 0.08 });
      S.fx.ring(_g.copy(_drum).setY(ground.point.y), ground.normal, color, 1.4, 0.35);
      sfx(w, 'roller_hit', { volume: fast ? 0.9 : 0.5 });
      S.shake?.(w.position, fast ? 0.3 : 0.12);
    }
  }

  cancel() {
    this.firing = false;
    this.state = 'idle';
    this.hasPrev = false;
  }

  /** Per rendered frame: swing the roller about the shoulders, hands on the grip. */
  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    const target = this.targetPhi();
    const k = this.state === 'flick' ? 45 : 14;
    this.phiVis += (target - this.phiVis) * Math.min(1, dt * k);
    rootMatrix(_mat, 0, PIVOT_Y, PIVOT_Z, -this.phiVis);
    const ud = this.model.userData;
    holdTwoHanded(this.model, m, _mat, ud.grips, 0.12);
    ud.spin.rotation.x = this.spinA;
  }

  dispose() {
    this.unhook?.();
    super.dispose();
  }
}

registerMain('roller', Roller);
