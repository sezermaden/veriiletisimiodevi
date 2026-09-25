// Swift Brush. Tap Fire to flick quick bristle splashes (mash for a flurry); hold Fire to dash
// (1.25× run speed) while the brush paints a lane under it and bowls through anyone in the way.
import * as THREE from 'three';
import { MainWeapon, registerMain } from '../base.js';
import { makeBrushModel, addPoseHook, holdTwoHanded, rootMatrix } from '../models.js';
import { toWorld, aimYaw, hitActor, sfx, DOWN } from './shared.js';

const PIVOT_Y = 1.0;
const _head = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _v = new THREE.Vector3();
const _g = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _tz = new THREE.Matrix4().makeTranslation(0, 0, 0.22);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export class Brush extends MainWeapon {
  static defaults = {
    moveMul: 1.25,           // dash speed while painting
    flickMoveMul: 0.9,
    holdToRun: 0.2,          // hold this long after a flick to start dashing
    flickInk: 2.2,
    flickCool: 0.16,
    flickBlobs: 5,
    flickSpread: 0.34,
    flickSpeed: 11,
    flickDamage: 30,
    flickPaint: 0.45,
    runInkPerM: 0.5,
    runDamage: 35,
    runHitCool: 0.35,
    paintSpacing: 0.28,
    laneR: 0.4,
    range: 4.5,
  };

  constructor(w, stats) {
    super(w, stats);
    this.state = 'idle';     // idle | flick | run
    this.held = 0;
    this.side = 1;           // alternating swipe direction
    this.swipeT = 1;         // 0..1 progress of the current swipe (visual)
    this.psiVis = -0.35;
    this.phiVis = -0.6;
    this.paintAcc = 0;
    this.hasPrev = false;
    this.fxT = 0;
    this.sndT = 0;
    this.hitCool = new Map();
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  buildModel() { return makeBrushModel(this.w.session.ink.color(this.w.team)); }

  get moveMul() { return this.state === 'run' ? this.s.moveMul : this.state === 'flick' ? this.s.flickMoveMul : 1; }

  /** Brush head angles: psi = sweep (yaw about the body), phi = pitch below the shoulders. */
  headAngles() {
    if (this.state === 'run') return { psi: -0.42, phi: -0.95 };
    if (this.swipeT < 1) {
      const k = this.swipeT, e = 1 - (1 - k) * (1 - k);
      return { psi: this.side * THREE.MathUtils.lerp(-1.05, 0.95, e), phi: -0.35 + Math.sin(k * Math.PI) * 0.2 };
    }
    return { psi: -0.55, phi: -0.75 };
  }

  headWorld(out) {
    const { psi, phi } = this.headAngles();
    const L = (this.model?.userData.len ?? 1.08) + 0.12;   // + the 0.22 m grip offset used by pose()
    const c = Math.cos(phi);
    return toWorld(this.w, Math.sin(psi) * c * L, PIVOT_Y + Math.sin(phi) * L, Math.cos(psi) * c * L + 0.05, out);
  }

  update(dt, ctrl) {
    const w = this.w, s = this.s;
    this.cool -= dt;
    this.swipeT = Math.min(1, this.swipeT + dt / 0.16);
    for (const [a, t] of this.hitCool) { if (t - dt <= 0) this.hitCool.delete(a); else this.hitCool.set(a, t - dt); }

    if (ctrl.fire) {
      this.held += dt;
      if (this.state !== 'run') {
        if ((ctrl.firePressed || this.state === 'idle') && this.cool <= 0) this.flick();
        if (this.held >= s.holdToRun && this.state !== 'idle') { this.state = 'run'; this.hasPrev = false; }
      }
      if (this.state === 'run') this.run(dt);
    } else {
      this.held = 0;
      if (this.state === 'run') this.state = 'idle';
      if (this.state === 'flick' && this.cool <= -0.12) this.state = 'idle';
    }
    this.firing = this.state !== 'idle';
    if (this.cool < -1) this.cool = -1;
  }

  flick() {
    const w = this.w, s = this.s, S = w.session;
    this.state = 'flick';
    this.cool = s.flickCool;
    if (!w.useInk(s.flickInk)) { w.onOutOfInk?.(); return; }
    this.side = -this.side;
    this.swipeT = 0;
    const color = S.ink.color(w.team);
    toWorld(w, 0, 1.05, 0.55, _head);
    const yaw0 = aimYaw(w);
    const pitch0 = Math.asin(THREE.MathUtils.clamp(w.aim.dir.y, -1, 1));
    for (let i = 0; i < s.flickBlobs; i++) {
      const k = i / (s.flickBlobs - 1);
      const yaw = yaw0 + THREE.MathUtils.lerp(-s.flickSpread, s.flickSpread, k) * this.side + (Math.random() - 0.5) * 0.08;
      const pitch = pitch0 * 0.6 + 0.12 + (Math.random() - 0.5) * 0.1;
      const cp = Math.cos(pitch);
      const sp = s.flickSpeed * (0.85 + Math.random() * 0.3);
      _v.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(sp);
      S.projectiles.spawn({
        pos: _head, vel: _v, team: w.team, owner: w, damage: s.flickDamage, size: 0.1, radius: 0.16,
        gravity: 26, gravityDelay: 0.04, life: 1.6, paint: { radius: s.flickPaint * (0.8 + Math.random() * 0.4) },
        falloff: { start: 2.5, end: 5.5, min: 0.4 },
      });
    }
    S.fx.spray(_head, _v.set(Math.sin(yaw0), 0.3, Math.cos(yaw0)).multiplyScalar(5), color, 6, 3, { size: 0.05, life: 0.3 });
    sfx(w, 'brush_flick', { volume: 0.55, pitch: 0.9 + Math.random() * 0.25 });
    this.recoil = 0.7;
  }

  run(dt) {
    const w = this.w, s = this.s, S = w.session;
    const color = S.ink.color(w.team);
    this.headWorld(_head);
    const g = S.level.raycast(_v.set(_head.x, w.position.y + 0.9, _head.z), DOWN, 1.8);
    if (!this.hasPrev) { _prev.copy(_head); this.hasPrev = true; this.paintAcc = s.paintSpacing; }
    const moved = Math.hypot(_head.x - _prev.x, _head.z - _prev.z);
    _prev.copy(_head);
    if (!w.grounded || !g || moved > 2) return;
    this.paintAcc += moved;
    if (this.paintAcc >= s.paintSpacing) {
      const d = this.paintAcc;
      this.paintAcc = 0;
      if (w.useInk(s.runInkPerM * d)) {
        S.ink.paint(g.point, s.laneR * (0.9 + Math.random() * 0.2), w.team, g.normal, { source: w });
        g.dynamic?.owner?.onInkHit?.({ team: w.team, owner: w, damage: 0, vel: _fwd.clone(), paint: { radius: s.laneR }, pos: g.point.clone() }, g);
      } else w.onOutOfInk?.();
    }
    const speed = Math.hypot(w.velocity.x, w.velocity.z);
    this.fxT -= dt;
    if (speed > 1 && this.fxT <= 0) {
      this.fxT = 0.05;
      S.fx.spray(_g.copy(g.point).setY(g.point.y + 0.05), _v.set(-w.velocity.x * 0.2, 2.4, -w.velocity.z * 0.2), color, 2, 1.4, { size: 0.04, life: 0.3 });
    }
    this.sndT -= dt;
    if (speed > 1 && this.sndT <= 0) { this.sndT = 0.11; sfx(w, 'brush_run', { volume: 0.3, pitch: 0.8 + speed * 0.06, throttle: 0.04 }); }

    // bowl through enemies in front of the brush
    _fwd.set(Math.sin(w.yaw), 0, Math.cos(w.yaw));
    _right.set(Math.cos(w.yaw), 0, -Math.sin(w.yaw));
    for (const a of S.actors) {
      if (!a.alive || a.team === w.team || a.untargetable || this.hitCool.has(a)) continue;
      a.hitCenter(_hc);
      const rx = _hc.x - _head.x, rz = _hc.z - _head.z;
      const r = a.hitRadius ?? 0.5;
      if (Math.hypot(rx, rz) > r + 0.4) continue;
      if (a.position.y > _head.y + 0.6 || a.position.y + (a.hitHeight ?? 1.2) < _head.y - 0.3) continue;
      this.hitCool.set(a, s.runHitCool);
      hitActor(S, a, speed > 2 ? s.runDamage : s.runDamage * 0.5, { source: w, team: w.team, point: _hc.clone(), dir: _fwd.clone(), kind: 'roll' });
      S.fx.burst(_hc, _fwd, color, 10, 4, { size: 0.06 });
      sfx(w, 'roller_hit', { volume: 0.5, pitch: 1.3 });
    }
  }

  cancel() { this.firing = false; this.state = 'idle'; this.held = 0; this.hasPrev = false; }

  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    const { psi, phi } = this.headAngles();
    const k = this.swipeT < 1 ? 40 : 12;
    this.psiVis += (psi - this.psiVis) * Math.min(1, dt * k);
    this.phiVis += (phi - this.phiVis) * Math.min(1, dt * k);
    // brush body frame: origin at the shoulders, +Z toward the head; grips near the body
    rootMatrix(_mat, 0, PIVOT_Y, 0.05, -this.phiVis, this.psiVis);
    // the grip end sits ~0.22 m out from the pivot so the hands have something to hold
    _mat.multiply(_tz);
    holdTwoHanded(this.model, m, _mat, this.model.userData.grips, 0.3);
  }

  dispose() { this.unhook?.(); super.dispose(); }
}

registerMain('brush', Brush);
