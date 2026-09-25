// Rollerbrute — a chunky Murk trooper pushing a huge ink roller. Rolls a Murk lane wherever it
// goes; when it spots you it revs up (telegraph), then charges in a straight line. Hitting a wall
// stuns it — the best moment to unload on it.
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { TEAM_MURK } from '../../ink/ink-system.js';
import { makeContacts } from '../../world/level.js';
import { MurkEnemy, buildTrooper, animateTrooper, angleDiff, clamp, G, mesh, UP, DOWN } from './common.js';

const _d = new THREE.Vector3();
const _ra = new THREE.Vector3();
const _rb = new THREE.Vector3();
const _pa = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);
const _hc = new THREE.Vector3();

const SCALE = 1.42;
const ROLLER_R = 0.26;          // rig units
const AXLE_Z = 0.96;

function strut(parent, a, b, g, m) {
  _d.subVectors(b, a);
  const len = _d.length();
  const o = mesh(g(len), m, parent);
  o.position.copy(a).addScaledVector(_d, 0.5);
  o.quaternion.copy(_q.setFromUnitVectors(_z, _d.divideScalar(len)));
  return o;
}

export class Rollerbrute extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 180, hitRadius: 0.8, hitHeight: 1.6, aggro: 16, speed: 1.9, accel: 6, radius: 0.6, height: 1.5,
      turnRate: 3.2, knockMul: 0.3, pearls: [2, 3], deathPaint: 2.4, popupH: 2.25, maxDrop: 0.7,
    });
    this.parts = buildTrooper(this, { scale: SCALE, width: 1.3, tall: 0.95, gun: false, leftArm: 'forward' });
    this._buildRoller();
    this.mode = 'approach';
    this.modeT = 0;
    this.coolT = 0.6;
    this.chargeDir = new THREE.Vector3(0, 0, 1);
    this.chargeHit = false;
    this.rollAngle = 0;
    this.paintAcc = 0;
    this.contactCool = 0;
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    this.rev = 0;
    // the roller sits ~1.4 m ahead of the body capsule, so it gets its own collision
    this.rollerContacts = makeContacts();
    this.bumpN = new THREE.Vector3();
  }

  _buildRoller() {
    const P = this.pal, parts = this.parts, m = parts.mats;
    const rig = parts.rig;
    // straighten the right arm onto the handle too
    parts.armR.children[0].rotation.set(0.15, -0.1, 0);
    parts.handR.position.set(0.0, -0.04, 0.27);

    const inkRoll = this.mat(P.ink, { ink: true, rim: 0.55, emissiveIntensity: 0.22 });
    const handleY = 0.44, handleZ = 0.4, hx = 0.62;
    const bar = mesh(G.cylX(0.04, hx * 2 + 0.1, 12), m.steelDark, rig);
    bar.position.set(0, handleY, handleZ);
    for (const s of [-1, 1]) {
      const grip = mesh(G.cylX(0.055, 0.18, 12), m.rubber, rig);
      grip.position.set(s * 0.5, handleY, handleZ);
      strut(rig, new THREE.Vector3(s * hx, handleY, handleZ), new THREE.Vector3(s * 0.68, ROLLER_R, AXLE_Z), (l) => G.rbox(0.07, 0.07, l + 0.06, 0.025), m.steel);
    }
    // roller: glossy Murk-soaked drum with steel end caps; blobs show it turning
    const roller = new THREE.Group();
    roller.position.set(0, ROLLER_R, AXLE_Z);
    rig.add(roller);
    mesh(G.cylX(ROLLER_R, 1.24, 28), inkRoll, roller);
    for (const s of [-1, 1]) {
      const cap = mesh(G.cylX(ROLLER_R + 0.03, 0.06, 28), m.steel, roller);
      cap.position.x = s * 0.65;
      const hub = mesh(G.cylX(0.07, 0.1, 12), m.steelDark, roller);
      hub.position.x = s * 0.7;
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, x = -0.55 + (i / 6) * 1.1;
      const blob = mesh(G.sphere(0.07, 10, 8), inkRoll, roller);
      blob.position.set(x, Math.sin(a) * ROLLER_R, Math.cos(a) * ROLLER_R);
      blob.scale.set(1.4, 0.6, 1);
      blob.quaternion.setFromUnitVectors(UP, _d.set(0, Math.sin(a), Math.cos(a)));
    }
    this.roller = roller;
    this.rigid(roller, 'roller');
    this.rigid(rig, 'rig');
    // ink tank backpack + hose to the roller frame
    const tankMat = this.glowMat(P.ink, 0.45);
    tankMat.roughness = 0.1;
    const tank = mesh(G.capsule(0.17, 0.3, 6, 16), tankMat, parts.body);
    tank.position.set(0, 0.45, -0.44);
    for (const y of [0.3, 0.6]) {
      const band = mesh(G.torus(0.175, 0.022, 6, 20), m.steel, parts.body);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, y, -0.44);
    }
    const cap = mesh(G.cyl(0.08, 0.1, 0.08, 12), m.steelDark, parts.body);
    cap.position.set(0, 0.83, -0.44);
    const hose = mesh(G.tube('brute-hose', [[0.12, 0.3, -0.5], [0.45, 0.2, -0.35], [0.55, 0.1, 0.05], [0.6, 0.12, 0.3]], 0.03, 16, 6), m.rubber, parts.body);
    void hose;
    this.tankMat = tankMat;
    this.rigid(parts.body, 'body');
  }

  /** World position of the roller's ground contact, and the axle ends. */
  rollerPoint(out) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return out.set(this.position.x + s * AXLE_Z * SCALE, this.position.y, this.position.z + c * AXLE_Z * SCALE);
  }

  _physics(dt) {
    super._physics(dt);
    if (this.hitWall) this.bumpN.copy(this.contacts.wallNormal); else this.bumpN.set(0, 0, 0);
    this._collideRoller();
  }

  /**
   * Keep the drum out of walls: collide a capsule along the axle and push the whole brute back by
   * the wall-normal part of the correction (ground pushes on ramps are ignored).
   */
  _collideRoller() {
    const p = this.position, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const R = ROLLER_R * SCALE, ax = AXLE_Z * SCALE, half = 0.55 * SCALE, r = R - 0.02;
    // lifted ~0.2 m off the floor so kerbs and stair risers read as ground, not walls
    const cx = p.x + s * ax, cz = p.z + c * ax, cy = p.y + R + 0.18;
    // axle runs along local X: world (cos yaw, 0, -sin yaw)
    _ra.set(cx + c * half, cy, cz - s * half);
    _rb.set(cx - c * half, cy, cz + s * half);
    const x0 = _ra.x, z0 = _ra.z;
    const k = this.session.level.collideCapsule(_ra, _rb, r, this.rollerContacts);
    if (!k.wall) return;
    const n = k.wallNormal, nl = Math.hypot(n.x, n.z);
    if (nl < 1e-3) return;
    const nx = n.x / nl, nz = n.z / nl;
    const push = (_ra.x - x0) * nx + (_ra.z - z0) * nz;
    if (push <= 1e-4) return;
    p.x += nx * push; p.z += nz * push;
    const v = this.velocity, vn = v.x * nx + v.z * nz;
    if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
    this.hitWall = true;
    this.bumpN.set(nx, 0, nz);
  }

  /** Ledge probe that also checks under the roller when rolling forward (it hangs 1.4 m ahead). */
  _probeAhead(vx, vz, sp) {
    if (!super._probeAhead(vx, vz, sp)) return false;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    if ((vx * s + vz * c) / sp < 0.25) return true;
    // (+ speed lookahead: the base probe is cached for a few steps at charge speed)
    const look = (AXLE_Z + ROLLER_R * 0.7) * SCALE + Math.min(0.5, sp * 0.05), p = this.position;
    _pa.set(p.x + s * look, p.y + 0.9, p.z + c * look);
    const h = this.session.level.raycast(_pa, DOWN, 0.9 + this.maxDrop);
    if (!h) return false;
    return h.normal.y > 0.5 || h.normal.y < -0.3;
  }

  onState(s) {
    if (s !== 'attack') { this.mode = 'approach'; this.modeT = 0; this.turnRate = 3.2; }
  }

  setMode(m) {
    this.mode = m;
    this.modeT = 0;
    const S = this.session;
    if (m === 'windup') {
      S.audio?.sfx('roller_rev', { pos: this.position, volume: 0.9 });
      this.squashV -= 3;
    } else if (m === 'charge') {
      const T = this.target;
      // lock onto where the target is heading (partial lead so side-steps still work)
      _p.copy(T.position).addScaledVector(T.velocity, 0.35);
      this.chargeDir.set(_p.x - this.position.x, 0, _p.z - this.position.z);
      if (this.chargeDir.lengthSq() < 1e-4) this.chargeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.chargeDir.normalize();
      this.chargeHit = false;
      this.squashV += 4;
    } else if (m === 'stunned') {
      S.audio?.sfx('bonk', { pos: this.position, volume: 1 });
      S.shake?.(this.position, 0.35);
      this.rollerPoint(_p).setY(this.position.y + 0.5);
      S.fx.burst(_p, UP, '#fff3c0', 12, 7, { size: 0.035, life: 0.35 });
      S.fx.puff(_p, '#c9c2b5', 1, 0.6, null, 2, 0.5);
      this.squashV += 7;
      this.velocity.x *= -0.25; this.velocity.z *= -0.25;
    }
  }

  behave(dt) {
    const S = this.session;
    this.contactCool = Math.max(0, this.contactCool - dt);
    this.rev = Math.max(0, this.rev - dt * 2);
    if (this.state !== 'attack') {
      this.accel = 6;
      if (this.state === 'alert') this.faceTarget(); else this.wander(dt);
    } else {
      this.modeT += dt;
      const T = this.target;
      const dist = T ? this.distXZ(T.position) : 99;
      switch (this.mode) {
        case 'approach':
          this.accel = 6;
          this.coolT -= dt;
          this.faceTarget();
          if (!this.canSee) { if (this.distXZ(this.lastSeen) > 1.5) this.steerTo(this.lastSeen, this.speed, false); }
          else if (dist > 3.2) this.steerTo(T.position, this.speed, false);
          if (this.canSee && dist < 13 && this.coolT <= 0 && Math.abs(angleDiff(this.yaw, this.faceYaw)) < 0.4) this.setMode('windup');
          break;
        case 'windup': {
          this.faceTarget();
          this.turnRate = 4.5;
          this.rev = 1;
          // spin the roller in place, spraying ink and dust behind it
          if (Math.random() < 0.5) {
            this.rollerPoint(_p).setY(this.position.y + 0.15);
            _d.set(-Math.sin(this.yaw) * 4, 2.5, -Math.cos(this.yaw) * 4);
            S.fx.spray(_p, _d, this.pal.ink, 2, 2, { size: 0.06 });
          }
          if (this.modeT > 0.85 / Math.sqrt(this.diff)) { this.turnRate = 3.2; this.setMode('charge'); }
          break;
        }
        case 'charge': {
          this.accel = 12;
          // gentle homing so a charge is dodgeable but not trivially
          if (T && this.canSee) {
            const want = Math.atan2(T.position.x - this.position.x, T.position.z - this.position.z);
            const cur = Math.atan2(this.chargeDir.x, this.chargeDir.z);
            const na = cur + clamp(angleDiff(cur, want), -0.55 * dt, 0.55 * dt);
            this.chargeDir.set(Math.sin(na), 0, Math.cos(na));
          }
          const sp = 8.5 * Math.min(1.15, this.diff);
          this.wish.set(this.chargeDir.x * sp, 0, this.chargeDir.z * sp);
          this.faceYaw = Math.atan2(this.chargeDir.x, this.chargeDir.z);
          this.turnRate = 10;
          this.rev = 1;
          // bonk only on a head-on hit; a glancing scrape just slides along the wall
          const headOn = this.bumpN.x * this.chargeDir.x + this.bumpN.z * this.chargeDir.z < -0.45;
          if (this.modeT > 0.25 && this.hitWall && headOn && !this.atLedge) { this.turnRate = 3.2; this.setMode('stunned'); break; }
          if (this.atLedge || this.modeT > 1.9 || this.chargeHit) { this.turnRate = 3.2; this.setMode('recover'); }
          if (Math.random() < 0.35) S.audio?.sfx('roller_roll', { pos: this.position, volume: 0.7, throttle: 0.2 });
          break;
        }
        case 'recover':
          this.accel = 3;
          if (this.modeT > 1.1) { this.coolT = 1.3; this.setMode('approach'); }
          break;
        case 'stunned':
          this.accel = 4;
          if (this.modeT > 1.8) { this.coolT = 0.8; this.setMode('approach'); }
          break;
      }
    }
  }

  step(dt) {
    super.step(dt);
    if (!this.alive) return;
    const S = this.session;
    // roll + paint a Murk lane
    const dx = this.position.x - this.lastX, dz = this.position.z - this.lastZ;
    this.lastX = this.position.x; this.lastZ = this.position.z;
    const moved = Math.hypot(dx, dz);
    this.rollAngle += (moved + this.rev * dt * 4) / (ROLLER_R * SCALE);
    if (this.grounded && moved > 0.001) {
      this.paintAcc += moved;
      const charging = this.mode === 'charge' && this.state === 'attack';
      if (this.paintAcc > (charging ? 0.3 : 0.4)) {
        this.paintAcc = 0;
        this.rollerPoint(_p);
        S.ink.paint(_p, charging ? 0.95 : 0.8, TEAM_MURK, UP, { source: this });
      }
    }
    // run-over damage from the roller
    const P = S.player;
    if (P?.alive && this.contactCool <= 0 && moved > 0.012) {
      this.rollerPoint(_p).setY(this.position.y + 0.3);
      P.hitCenter(_hc);
      // distance from the player to the roller's axle segment
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const rx = _hc.x - _p.x, rz = _hc.z - _p.z;
      const along = clamp(rx * c - rz * s, -0.9, 0.9);
      const px = _p.x + c * along, pz = _p.z - s * along;
      const d = Math.hypot(_hc.x - px, _hc.z - pz);
      if (d < 0.75 && Math.abs(_hc.y - _p.y) < 1.2) {
        const charging = this.mode === 'charge' && this.state === 'attack';
        const dmg = (charging ? 70 : 25) * this.diff;
        _d.set(s, 0, c);
        P.damage(dmg, { source: this, team: this.team, point: _hc.clone(), dir: _d.clone(), kind: 'roll' });
        S.events.emit('hit', { target: P, source: this, damage: dmg, point: _hc.clone() });
        P.velocity.x += s * (charging ? 7 : 3); P.velocity.z += c * (charging ? 7 : 3);
        if (P.grounded) { P.velocity.y = charging ? 5 : 3; P.grounded = false; }
        S.fx.burst(_hc, _d, this.pal.ink, 14, 6);
        S.audio?.sfx('splat', { pos: _hc, volume: 0.9 });
        this.contactCool = charging ? 1.2 : 0.8;
        if (charging) this.chargeHit = true;
      }
    }
  }

  animate(dt) {
    const P = this.parts;
    const lean = this.state === 'attack' ? (this.mode === 'windup' ? -0.18 : this.mode === 'charge' ? 0.28 : this.mode === 'stunned' ? -0.1 : 0.06) : 0.04;
    animateTrooper(this, P, dt, { leanX: lean, stride: 5.2, legSwing: 0.9, eyeBoost: this.mode === 'windup' && this.aware ? 1.4 : 1 });
    this.roller.rotation.x = this.rollAngle;
    // windup shudder
    if (this.state === 'attack' && this.mode === 'windup') P.rig.position.x = Math.sin(this.t * 60) * 0.02;
    else P.rig.position.x = 0;
    // dizzy wobble when stunned
    if (this.state === 'attack' && this.mode === 'stunned') {
      P.body.rotation.z += Math.sin(this.t * 7) * 0.12;
      P.hat.rotation.y = this.t * 6;
      if (Math.random() < dt * 8) {
        _p.copy(this.position).setY(this.position.y + this.hitHeight + 0.15);
        _p.x += Math.cos(this.t * 6) * 0.35; _p.z += Math.sin(this.t * 6) * 0.35;
        this.session.fx.burst(_p, UP, '#fff27a', 1, 1, { size: 0.05, gravity: 0, life: 0.35 });
      }
    } else P.hat.rotation.y = 0;
    this.tankMat.emissiveIntensity = 0.45 + this.rev * 0.8 + Math.sin(this.t * 4) * 0.08;
  }
}

registerEntity('rollerbrute', (s, d) => new Rollerbrute(s, d));
