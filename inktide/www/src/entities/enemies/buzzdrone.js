// Buzzdrone — a Murk quad-rotor with a hanging ink tank. Hovers at `alt` metres, drifts on
// patrol, and when it spots you it flies over your head and drops impact ink bombs (a red ring
// marks the drop zone first).
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { inkExplosion } from '../../weapons/base.js';
import { MurkEnemy, G, mesh, UP, DOWN, clamp, bombModel } from './common.js';

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const TANK_LOCAL = new THREE.Vector3(0, -0.34, 0);
const RING_RED = new THREE.Color('#ff3b2a');

export class Buzzdrone extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 60, hitRadius: 0.6, hitHeight: 0.5, aggro: 18, walker: false, turnRate: 3.2, knockMul: 0,
      pearls: [1, 2], deathPaint: 1.7, popupH: 0.95, eyeH: 0, loseTime: 3.2,
    });
    this.alt = def.alt ?? 4;
    this.position.y += this.alt;
    this.home.copy(this.position);
    if (this.patrol) for (const p of this.patrol) p.y += this.alt;
    this.floorY = this.position.y - this.alt;
    this.probeT = 0;
    this.coolT = 1.2;
    this.armT = -1;
    this.markT = 0;
    this.rotorT = Math.random() * 0.3;
    this.tilt = new THREE.Vector2();
    this.swing = { x: 0, vx: 0, z: 0, vz: 0 };
    this.spin = 0;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.drop = new THREE.Vector3();
    this._build();
  }

  hitCenter(out) { return out.copy(this.position); }
  eyePos(out) { return out.copy(this.position); }
  get visionCone() { return -1; }

  _build() {
    const P = this.pal;
    const tar = this.mat(P.tar, { ink: true, rim: 0.6, emissiveIntensity: 0.1 });
    const steel = this.metal(P.steel, { roughness: 0.3, metalness: 0.6, rim: 0.35 });
    const steelDark = this.metal(P.steelDark, { roughness: 0.4, metalness: 0.5, rim: 0.3 });
    const hatM = this.matte(P.hat, { roughness: 0.38, rim: 0.35 });
    const inkM = this.mat(P.ink, { ink: true, rim: 0.5, emissiveIntensity: 0.25 });
    this.eyeM = this.glowMat(P.glow, 1.5);
    const lureM = this.glowMat(P.glow, 1.8);
    const dark = this.mat(P.dark, { roughness: 0.2, rim: 0.1 });

    const body = new THREE.Group();
    this.root.add(body);
    this.body = body;
    // pod chassis
    const pod = mesh(G.sphere(0.3, 24, 16), tar, body);
    pod.scale.set(1.2, 0.68, 1.2);
    const skirt = mesh(G.torus(0.34, 0.045, 8, 28), steelDark, body);
    skirt.rotation.x = Math.PI / 2;
    skirt.position.y = -0.03;
    const stripe = mesh(G.torus(0.3, 0.022, 6, 28), hatM, body);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.09;
    // eye
    const eye = new THREE.Group();
    eye.position.set(0, 0.02, 0.33);
    body.add(eye);
    mesh(G.torus(0.12, 0.035, 10, 24), steel, eye).scale.set(1, 1, 1.2);
    mesh(G.sphere(0.12, 20, 14), this.eyeM, eye, false).scale.set(1, 1, 0.5);
    const pupil = mesh(G.sphere(0.05, 12, 8), dark, eye, false);
    pupil.scale.set(0.6, 1.4, 0.35);
    pupil.position.z = 0.058;
    pupil.userData.keep = true;
    this.pupil = pupil;
    this.detail(this.halo(P.glow, 0.5, eye, 0.25));
    // lure antenna on top
    const lure = new THREE.Group();
    lure.position.set(0, 0.18, 0.02);
    body.add(lure);
    mesh(G.tube('drone-lure', [[0, 0, 0], [0, 0.14, -0.04], [0, 0.26, 0.05], [0, 0.26, 0.16], [0, 0.2, 0.21]], 0.013, 16, 6), steelDark, lure);
    const bulb = mesh(G.sphere(0.045, 12, 8), lureM, lure, false);
    bulb.position.set(0, 0.19, 0.215);
    this.detail(this.halo(P.glow, 0.28, bulb, 0.5));
    this.lure = lure;
    // arms + rotors
    this.props = [];
    this.blurs = [];
    const blurMat = new THREE.MeshBasicMaterial({ color: '#e8e4f0', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    this.own(blurMat);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const ax = Math.sin(a), az = Math.cos(a);
      const arm = mesh(G.rbox(0.08, 0.055, 0.46, 0.025), steelDark, body);
      arm.position.set(ax * 0.42, 0.02, az * 0.42);
      arm.rotation.y = a;
      const hub = mesh(G.cyl(0.055, 0.07, 0.12, 12), steel, body);
      hub.position.set(ax * 0.66, 0.06, az * 0.66);
      const guard = mesh(G.torus(0.24, 0.022, 6, 28), hatM, body);
      guard.rotation.x = Math.PI / 2;
      guard.position.set(ax * 0.66, 0.1, az * 0.66);
      const prop = new THREE.Group();
      prop.position.set(ax * 0.66, 0.13, az * 0.66);
      body.add(prop);
      const blade = mesh(G.rbox(0.42, 0.012, 0.055, 0.005), steel, prop);
      blade.rotation.x = 0.15;
      const blade2 = mesh(G.rbox(0.42, 0.012, 0.055, 0.005), steel, prop);
      blade2.rotation.set(-0.15, Math.PI / 2, 0);
      const blur = mesh(G.cyl(0.215, 0.215, 0.004, 24), blurMat, prop, false);
      blur.renderOrder = 3;
      this.props.push(prop);
      this.blurs.push(blur);
      this.rigid(prop, 'prop');
    }
    // hanging ink tank on a swinging clamp
    const hang = new THREE.Group();
    hang.position.set(0, -0.14, 0);
    body.add(hang);
    this.hang = hang;
    const tankMat = this.glowMat(P.ink, 0.5);
    tankMat.roughness = 0.08;
    this.tankMat = tankMat;
    mesh(G.cyl(0.018, 0.018, 0.16, 6), steelDark, hang).position.y = -0.06;
    const tank = mesh(G.capsule(0.12, 0.16, 6, 16), tankMat, hang);
    tank.position.y = -0.3;
    for (const y of [-0.22, -0.38]) {
      const band = mesh(G.torus(0.123, 0.018, 6, 20), steel, hang);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
    }
    const cap = mesh(G.cyl(0.07, 0.09, 0.07, 12), steelDark, hang);
    cap.position.y = -0.14;
    const nozzle = mesh(G.cyl(0.05, 0.03, 0.08, 12), inkM, hang);
    nozzle.position.y = -0.5;
    // warning light on the tail
    this.lightMat = new THREE.MeshBasicMaterial({ color: '#ff3b2a' });
    this.own(this.lightMat);
    const light = mesh(G.sphere(0.035, 10, 8), this.lightMat, body, false);
    light.position.set(0, 0.08, -0.36);
    this.rigid(body, 'body');
    this.rigid(hang, 'hang');
  }

  /** Point we want to hover at this step. */
  _goal(out) {
    const T = this.target;
    switch (this.state) {
      case 'attack': {
        // hover over the target's near-future position, a little off to one side so the
        // player can still see it; hang back a bit while reloading
        _p.copy(T.position).addScaledVector(T.velocity, 0.55);
        if (!this.canSee) _p.copy(this.lastSeen);
        const reload = this.coolT > 0.9 && this.armT < 0;
        const off = reload ? 4.5 : 0.9;
        _d.set(this.position.x - _p.x, 0, this.position.z - _p.z);
        if (_d.lengthSq() < 1e-3) _d.set(this.side, 0, 0);
        _d.normalize();
        _d.applyAxisAngle(UP, this.side * 0.6 * Math.sin(this.t * 0.4));
        out.copy(_p).addScaledVector(_d, off);
        return out;
      }
      case 'patrol': {
        const tgt = this.patrol[this.patrolIdx];
        if (this.distXZ(tgt) < 1) this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
        return out.copy(tgt);
      }
      case 'search': return out.copy(this.lastSeen);
      case 'alert': return out.copy(this.position);
      default: // idle / return: lazy figure-eight around home
        return out.copy(this.home).add(_t.set(Math.sin(this.t * 0.45) * 1.6, 0, Math.sin(this.t * 0.9) * 0.8));
    }
  }

  behave(dt) {
    const S = this.session;
    if (this.state === 'return' && this.distXZ(this.home) < 1) { this.setState(this.patrol ? 'patrol' : 'idle'); }
    // ground under us (throttled) → hover height
    this.probeT -= dt;
    if (this.probeT <= 0) {
      this.probeT = 0.2;
      const g = S.level.raycast(_a.copy(this.position), DOWN, this.alt + 12, { staticOnly: true });
      if (g) this.floorY = g.point.y;
    }
    const goal = this._goal(_b);
    const fast = this.state === 'attack';
    const maxSp = fast ? 4.8 * Math.min(1.2, this.diff) : 2.4;
    _d.set(goal.x - this.position.x, 0, goal.z - this.position.z);
    const dist = _d.length();
    if (dist > 0.05) _d.multiplyScalar(Math.min(maxSp, dist * 1.3) / dist);
    const bob = Math.sin(this.t * 2.3) * 0.25;
    const vy = clamp((this.floorY + this.alt + bob - this.position.y) * 2.2, -3, 3);
    const k = Math.min(1, dt * (fast ? 3 : 2));
    const v = this.velocity;
    v.x += (_d.x - v.x) * k;
    v.z += (_d.z - v.z) * k;
    v.y += (vy - v.y) * Math.min(1, dt * 4);
    // integrate + keep out of walls
    this.position.addScaledVector(v, dt);
    _a.copy(this.position).setY(this.position.y - 0.05);
    _b.copy(this.position).setY(this.position.y + 0.05);
    const c = S.level.collideCapsule(_a, _b, 0.55, this.contacts);
    this.position.set(_a.x, _a.y + 0.05, _a.z);
    if (c.wall) {
      const n = c.wallNormal, vn = v.dot(n);
      if (vn < 0) v.addScaledVector(n, -vn);
      this.side = -this.side;
    }
    // face: target when fighting, travel direction otherwise
    if (this.aware && this.target) this.faceTarget();
    else if (Math.hypot(v.x, v.z) > 0.3) this.faceYaw = Math.atan2(v.x, v.z);

    // bombing run
    if (this.state === 'attack') {
      this.coolT -= dt;
      const T = this.target;
      _p.copy(T.position).addScaledVector(T.velocity, 0.45);
      const over = Math.hypot(_p.x - this.position.x, _p.z - this.position.z);
      if (this.armT < 0 && this.coolT <= 0 && this.canSee && over < 1.6) {
        this.armT = 0.5 / Math.sqrt(this.diff);
        S.audio?.sfx('fuse_beep', { pos: this.position, volume: 0.6, pitch: 1.2 });
      }
      if (this.armT >= 0) {
        this.armT -= dt;
        // ring telegraph where the bomb will land
        this.markT -= dt;
        if (this.markT <= 0) {
          this.markT = 0.12;
          const g = S.level.raycast(_a.copy(this.position), DOWN, this.alt + 12, { staticOnly: true });
          if (g) S.fx.ring(g.point, g.normal, RING_RED, 2.2, 0.3);
        }
        if (this.armT < 0) this._dropBomb();
      }
    } else this.armT = -1;

    this.rotorT -= dt;
    if (this.rotorT <= 0) {
      this.rotorT = 0.3;
      if (S.player && this.position.distanceToSquared(S.player.position) < 26 * 26) S.audio?.sfx('rotor', { pos: this.position, volume: 0.32, pitch: 0.95 + (this.aware ? 0.12 : 0), throttle: 0.05 });
    }
  }

  _dropBomb() {
    const S = this.session;
    this.coolT = (2.3 + Math.random() * 0.6) / Math.sqrt(this.diff);
    const from = this.worldOf(this.hang, TANK_LOCAL, _a).setY(this.position.y - 0.62);
    const mesh3 = bombModel(this.pal.ink, 0.17);
    const owner = this, team = this.team, diff = this.diff;
    const boom = (pos, n) => inkExplosion(S, pos, n || UP, team, { paintRadius: 2.3, damage: 55 * diff, dmgRadius: 2.3, owner, sound: 'boom' });
    S.projectiles.spawn({
      pos: from, vel: _d.set(this.velocity.x * 0.6, -1.5, this.velocity.z * 0.6), team, owner, damage: 0, radius: 0.22,
      gravity: 20, life: 5, mesh: mesh3, fx: false,
      onHit: (p, hit) => boom(hit.point, hit.normal),
      onExpire: (p) => boom(p.pos, UP),
      onStep: (p, dt) => { mesh3.rotation.x += dt * 5; mesh3.userData.light.visible = (p.age * 12) % 2 < 1; },
    });
    S.audio?.sfx('bomb_whistle', { pos: from, volume: 0.6, dur: 0.7 });
    this.swing.vx += 4;
    this.squashV -= 2;
  }

  onPop(c) {
    const S = this.session;
    S.fx.burst(c, UP, this.pal.steel, 10, 6, { size: 0.07, spread: 1.5 });
    S.fx.burst(c, UP, this.pal.hat, 6, 5, { size: 0.05 });
  }

  animate(dt) {
    const v = this.velocity;
    // bank into motion
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwd = v.x * sy + v.z * cy, side = v.x * cy - v.z * sy;
    this.tilt.x += (clamp(fwd * 0.09, -0.35, 0.35) - this.tilt.x) * Math.min(1, dt * 5);
    this.tilt.y += (clamp(-side * 0.09, -0.35, 0.35) - this.tilt.y) * Math.min(1, dt * 5);
    this.body.rotation.x = this.tilt.x + (this.hurtT > 0 ? Math.sin(this.t * 50) * 0.15 : 0);
    this.body.rotation.z = this.tilt.y;
    this.body.position.y = Math.sin(this.t * 3.1) * 0.03;
    // rotors
    this.spin += dt * (this.alive ? 42 : 10);
    for (let i = 0; i < 4; i++) {
      this.props[i].rotation.y = this.spin * (i % 2 ? 1 : -1) + i;
      this.blurs[i].material.opacity = 0.16 + Math.sin(this.spin * 0.7 + i) * 0.03;
    }
    // tank pendulum
    const W = this.swing;
    W.vx += ((-this.tilt.x * 1.2 - W.x) * 30 - W.vx * 3) * dt;
    W.vz += ((-this.tilt.y * 1.2 - W.z) * 30 - W.vz * 3) * dt;
    W.x += W.vx * dt; W.z += W.vz * dt;
    this.hang.rotation.x = -W.x;
    this.hang.rotation.z = W.z;
    this.lure.rotation.x = -this.tilt.x * 0.8 + Math.sin(this.t * 2) * 0.08;
    // eye mood + arming glow
    const want = this.aware ? this.pal.angry : this.state === 'search' ? this.pal.wary : this.pal.glow;
    this.eyeM.color.lerp(want, Math.min(1, dt * 8));
    this.eyeM.emissive.copy(this.eyeM.color);
    const armed = this.armT >= 0;
    this.tankMat.emissiveIntensity = armed ? 0.6 + Math.abs(Math.sin(this.t * 30)) * 1.4 : 0.5;
    this.lightMat.color.setRGB(1, 0.23, 0.16).multiplyScalar((this.t * (armed ? 8 : 1.5)) % 1 < 0.5 ? 1 : 0.25);
    this.pupil.position.x = Math.sin(this.t * 0.8) * 0.02;
  }
}

registerEntity('buzzdrone', (s, d) => new Buzzdrone(s, d));
