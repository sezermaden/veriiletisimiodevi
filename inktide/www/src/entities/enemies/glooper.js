// Glooper — the Murk Corps grunt: a glossy tar blob in a hardhat with an ink blaster.
// Shield Glooper — same trooper behind a riveted riot shield (front shots clank off; flanks,
// back and explosions get through).
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { TEAM_HERO } from '../../ink/ink-system.js';
import { MurkEnemy, buildTrooper, animateTrooper, angleDiff, G, M, mesh } from './common.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _f = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1);

export class Glooper extends MurkEnemy {
  constructor(session, def, o = {}) {
    super(session, def, {
      hp: 80, hitRadius: 0.5, hitHeight: 1.15, aggro: 16, speed: 2.7, radius: 0.4, height: 1.1,
      pearls: [1, 2], turnRate: 7.5, ...o,
    });
    this.parts = buildTrooper(this, { leftArm: o.shield ? 'forward' : 'nub' });
    // combat tuning (≈2 shots/s for 18 damage)
    this.minD = 4.5;
    this.maxD = 10;
    this.range = 14;
    this.strafeSpeed = 1.9;
    this.volleySize = 3;
    this.shotGap = 0.2;
    this.coolBase = 0.8;
    this.volley = 0;
    this.shotT = 0;
    this.coolT = 0.4 + Math.random() * 0.5;
    this.windT = 0;
  }

  behave(dt) {
    if (this.state === 'attack') this.fight(dt);
    else if (this.state === 'alert') { this.faceTarget(); this.volley = 0; }
    else { this.volley = 0; this.wander(dt); }
    this.windT = Math.max(0, this.windT - dt);
  }

  fight(dt) {
    const T = this.target;
    if (!T) return;
    this.combatMove(dt, this.minD, this.maxD, this.strafeSpeed);
    this.coolT -= dt;
    const dist = this.distXZ(T.position);
    if (this.volley > 0) {
      this.shotT -= dt;
      if (this.shotT <= 0) {
        if (this.canSee || this.sinceSeen < 0.4) this.fireOne();
        this.volley--;
        this.shotT = this.shotGap;
        if (this.volley === 0) this.coolT = this.coolBase + Math.random() * 0.45;
      }
    } else if (this.coolT <= 0 && this.canSee && dist < this.range && Math.abs(angleDiff(this.yaw, this.faceYaw)) < 0.5) {
      this.volley = this.volleySize;
      this.shotT = 0.3;          // wind-up: the canister flares first
      this.windT = 0.3;
    }
  }

  muzzle(out) { return this.worldOf(this.parts.gun, this.parts.gun.userData.muzzle, out); }

  fireOne() {
    const m = this.muzzle(_m);
    const o = { speed: 19, damage: 18, gravity: 20, gravityDelay: 0.2, lead: 0.7, spread: 3.2 };
    this.aimAt(m, o.speed, o, _d);
    this.shoot(m, _d, { ...o, paint: 0.55, trailEvery: 1.3, trailRadius: 0.32, falloff: { start: 9, end: 16, min: 0.5 } });
    this.parts.recoil = 1;
    this.squashV += 1.1;
  }

  animate(dt) {
    const P = this.parts;
    animateTrooper(this, P, dt, { armAim: this.aware ? -0.1 : 0.25 });
    const can = P.gun.userData.canister;
    can.emissiveIntensity = 0.35 + (this.windT > 0 ? 1.4 : 0) + P.recoil * 0.6;
  }
}

// ---------------------------------------------------------------------------------------------
function shieldRivets() {
  return G.merged('shield-rivets', () => {
    const parts = [];
    const W = 0.33, H = 0.39;
    for (let i = 0; i <= 5; i++) {
      const x = -W + (i / 5) * W * 2;
      parts.push([G.sphere(0.02, 8, 6), M(x, H, 0.04)], [G.sphere(0.02, 8, 6), M(x, -H, 0.04)]);
    }
    for (const y of [-0.2, 0, 0.2]) parts.push([G.sphere(0.02, 8, 6), M(-W - 0.01, y, 0.04)], [G.sphere(0.02, 8, 6), M(W + 0.01, y, 0.04)]);
    return parts;
  });
}

export class ShieldGlooper extends Glooper {
  constructor(session, def) {
    super(session, def, { shield: true, speed: 2.3, turnRate: 2.6, hitRadius: 0.52, pearls: [2, 2] });
    this.minD = 3;
    this.maxD = 7.5;
    this.strafeSpeed = 0.8;
    this.volleySize = 2;
    this.coolBase = 0.9;
    this.shieldKick = 0;
    this.blockFlash = 0;
    this._buildShield();
  }

  _buildShield() {
    const P = this.pal, parts = this.parts;
    this.shieldMat = this.mat(P.steel.clone().lerp(new THREE.Color('#9aa3b8'), 0.25), { roughness: 0.28, metalness: 0.65, rim: 0.45 }, false);
    this.shieldBase = this.shieldMat.emissive.clone();
    const dark = parts.mats.steelDark;
    const glass = this.mat(P.dark, { roughness: 0.08, metalness: 0.2, rim: 0.3 });
    this.cls(dark, 'metal');
    const s = new THREE.Group();
    s.position.set(0.36, 0.02, 0.5);
    s.rotation.y = 0.12;
    parts.armL.add(s);
    mesh(G.rbox(0.8, 0.95, 0.07, 0.13), this.shieldMat, s);
    mesh(shieldRivets(), dark, s);
    const slit = mesh(G.rbox(0.42, 0.075, 0.03, 0.03), glass, s);
    slit.position.set(0, 0.27, 0.035);
    const band = mesh(G.rbox(0.66, 0.1, 0.024, 0.02), parts.mats.inkM, s);
    band.position.set(0, -0.29, 0.038);
    const emb = mesh(G.cylZ(0.12, 0.12, 0.024, 24), dark, s);
    emb.position.set(0, -0.02, 0.04);
    const arc = mesh(G.torus(0.06, 0.013, 6, 14, Math.PI * 1.15), parts.mats.hatM, s);
    arc.position.set(0.01, -0.03, 0.056);
    arc.rotation.z = 0.2;
    const bulb = mesh(G.sphere(0.026, 10, 8), parts.mats.lureM, s, false);
    bulb.position.set(-0.055, 0.02, 0.058);
    this.shield = s;
    this.rigid(s, 'shield');
    // gun peeks around the right edge of the shield
    parts.gun.position.x += 0.05;
  }

  /** Front shots clank off the shield; explosions, splash, flanks and back hits get through. */
  blocks(info) {
    const k = info.kind;
    if (k === 'explosion' || k === 'splash' || k === 'fall' || k === 'special') return false;
    let dx, dz;
    if (info.dir) { dx = info.dir.x; dz = info.dir.z; }
    else if (info.source?.position) { dx = this.position.x - info.source.position.x; dz = this.position.z - info.source.position.z; }
    else return false;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return false;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / l < -0.42;
  }

  damage(amount, info = {}) {
    if (this.alive && this.invulnerable <= 0 && this.blocks(info)) { this.onBlocked(info); return; }
    super.damage(amount, info);
  }

  onBlocked(info) {
    const S = this.session;
    this.shieldKick = 1;
    this.blockFlash = 0.12;
    this.squashV += 1.2;
    _f.set(Math.sin(this.yaw), 0.25, Math.cos(this.yaw)).normalize();
    if (info.point) _p.copy(info.point); else this.worldOf(this.shield, _p.set(0, 0, 0.05), _p);
    S.fx.burst(_p, _f, '#fff3c0', 8, 7.5, { size: 0.028, gravity: 14, life: 0.3, spread: 1.1 });
    S.fx.burst(_p, _f, S.ink.color(info.team ?? TEAM_HERO), 4, 3, { size: 0.05 });
    S.audio?.sfx('shield_clank', { pos: _p, volume: 0.75, pitch: 0.9 + Math.random() * 0.2, throttle: 0.05 });
    const src = info.source;
    if (src && src.position && src.team !== this.team) {
      this.lastSeen.copy(src.position);
      if (!this.aware) { this.target = src; this.becomeAlert(true); }
    }
  }

  animate(dt) {
    super.animate(dt);
    this.shieldKick = Math.max(0, this.shieldKick - dt * 6);
    this.blockFlash = Math.max(0, this.blockFlash - dt);
    const s = this.shield;
    s.position.z = 0.5 - this.shieldKick * 0.08;
    s.rotation.x = -this.shieldKick * 0.12;
    const k = Math.max(this._flashK, this.blockFlash / 0.12);
    this.shieldMat.emissive.copy(this.shieldBase).lerp(WHITE, k);
    this.shieldMat.emissiveIntensity = k * 1.1;
  }
}

registerEntity('glooper', (s, d) => new Glooper(s, d));
registerEntity('shield-glooper', (s, d) => new ShieldGlooper(s, d));
