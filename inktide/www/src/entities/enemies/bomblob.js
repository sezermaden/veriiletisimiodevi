// Bomblob — a fat Murk trooper with a satchel of splash bombs. Keeps its distance and lobs bombs
// in high arcs (a red ring marks the landing zone during the wind-up); a bomb that lands sticks,
// blinks faster and faster, then bursts into a big Murk splat.
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import { inkExplosion } from '../../weapons/base.js';
import { MurkEnemy, buildTrooper, animateTrooper, angleDiff, clamp, G, mesh, UP, DOWN, bombModel } from './common.js';

const _h = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const RING_RED = new THREE.Color('#ff3b2a');
const HAND = new THREE.Vector3(0, 0, 0);
const GRAV = 18;

/** A splash bomb stuck to a surface, fizzing on its fuse. */
class MurkFuseBomb extends Entity {
  constructor(session, def) {
    super(session, def);
    this.team = def.team;
    this.owner = def.owner || null;
    this.damage = def.damage;
    this.fuse = def.fuse ?? 0.8;
    this.t = 0;
    this.normal = new THREE.Vector3().fromArray(def.normal || [0, 1, 0]);
    this.model = bombModel(session.ink.color(this.team), 0.19);
    this.model.quaternion.setFromUnitVectors(UP, this.normal);
    this.group.add(this.model);
    this.beepT = 0;
  }

  step(dt) {
    this.t += dt;
    this.beepT -= dt;
    const k = this.t / this.fuse;
    if (this.beepT <= 0) {
      this.beepT = Math.max(0.07, 0.22 * (1 - k));
      this.session.audio?.sfx('fuse_beep', { pos: this.position, volume: 0.45, pitch: 1 + k * 0.5, throttle: 0.03 });
    }
    if (this.t >= this.fuse) {
      inkExplosion(this.session, this.position, this.normal, this.team, { paintRadius: 2.6, damage: this.damage, dmgRadius: 2.6, owner: this.owner, sound: 'boom' });
      this.remove();
    }
  }

  render() {
    const k = Math.min(1, this.t / this.fuse);
    const s = 1 + k * 0.35 + Math.sin(this.t * (20 + k * 40)) * 0.06 * k;
    this.model.scale.set(s, s * (1 - k * 0.1), s);
    this.model.userData.light.visible = Math.sin(this.t * (12 + k * 50)) > 0;
  }
}

export class Bomblob extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 110, hitRadius: 0.65, hitHeight: 1.2, aggro: 20, speed: 1.9, radius: 0.52, height: 1.15,
      turnRate: 5, knockMul: 0.6, pearls: [2, 2], deathPaint: 2.2, popupH: 1.85,
    });
    this.parts = buildTrooper(this, { scale: 1.06, width: 1.38, tall: 0.9, gun: false, leftArm: 'nub' });
    this._buildSatchel();
    this.coolT = 0.6 + Math.random() * 0.6;
    this.windT = -1;
    this.throwT = 0;
    this.markT = 0;
    this.landing = new THREE.Vector3();
    this.flight = 1;
  }

  _buildSatchel() {
    const P = this.pal, parts = this.parts, m = parts.mats;
    const canvasM = this.matte('#5a4633', { roughness: 0.85, rim: 0.3 });
    const flapM = this.matte('#4a3928', { roughness: 0.85, rim: 0.3 });
    const body = parts.body;
    // strap across the belly
    const strap = mesh(G.torus(0.5, 0.03, 6, 36), flapM, body);
    strap.position.set(0, 0.3, 0);
    strap.rotation.set(Math.PI / 2 + 0.08, 0.55, 0);
    strap.scale.set(1.24, 1.2, 1);
    const buckle = mesh(G.rbox(0.07, 0.07, 0.03, 0.01), m.steel, body);
    buckle.position.set(0.3, 0.33, 0.52);
    buckle.rotation.set(-0.2, 0.5, 0.5);
    // satchel on the left hip with bombs poking out
    const bag = new THREE.Group();
    bag.position.set(-0.6, 0.12, -0.08);
    bag.rotation.set(0, -0.45, 0.12);
    body.add(bag);
    mesh(G.rbox(0.26, 0.3, 0.4, 0.07), canvasM, bag);
    const flap = mesh(G.rbox(0.28, 0.06, 0.42, 0.03), flapM, bag);
    flap.position.set(0.02, 0.15, 0);
    flap.rotation.z = -0.25;
    const clasp = mesh(G.rbox(0.03, 0.06, 0.08, 0.01), m.steel, bag);
    clasp.position.set(-0.14, 0.05, 0);
    this.rigid(bag, 'bag');
    // spare bombs poking out of the satchel (plain meshes so the bag bakes into few draws)
    for (const [z, y] of [[-0.1, 0.2], [0.08, 0.22]]) {
      const b = mesh(G.sphere(0.1, 14, 10), m.inkM, bag);
      b.position.set(0.05, y, z);
      const cap = mesh(G.cyl(0.036, 0.044, 0.035, 10), m.steelDark, bag);
      cap.position.set(0.02, y + 0.095, z);
      cap.rotation.z = 0.3;
    }
    // bomb in the throwing hand (shown during the wind-up)
    const held = bombModel(P.ink, 0.14);
    held.position.set(0, 0.06, 0.02);
    parts.handR.add(held);
    held.visible = false;
    this.held = held;
    // right arm hangs lower (no gun)
    parts.armR.children[0].rotation.set(0.9, 0.1, 0);
    parts.handR.position.set(0.02, -0.14, 0.1);
  }

  onState(s) {
    if (s !== 'attack') { this.windT = -1; this.held.visible = false; }
  }

  behave(dt) {
    const S = this.session;
    this.throwT = Math.max(0, this.throwT - dt);
    if (this.state !== 'attack') {
      if (this.state === 'alert') this.faceTarget(); else this.wander(dt);
      return;
    }
    const T = this.target;
    if (!T) return;
    // stand still while winding up, otherwise keep a lobbing distance
    if (this.windT < 0) this.combatMove(dt, 7, 15, 1.2);
    else this.faceTarget();
    this.coolT -= dt;
    const dist = this.distXZ(T.position);
    if (this.windT < 0 && this.coolT <= 0 && this.canSee && dist < 22 && Math.abs(angleDiff(this.yaw, this.faceYaw)) < 0.5) {
      this.windT = 0;
      this.held.visible = true;
      S.audio?.sfx('fuse_beep', { pos: this.position, volume: 0.4, pitch: 0.8 });
    }
    if (this.windT >= 0) {
      this.windT += dt;
      // predicted landing spot (partial lead) + a red ring telegraph on the ground
      this.flight = clamp(0.55 + dist * 0.045, 0.8, 1.45);
      this.landing.copy(this.canSee ? T.position : this.lastSeen);
      if (this.canSee) { this.landing.x += T.velocity.x * this.flight * 0.55; this.landing.z += T.velocity.z * this.flight * 0.55; }
      this.markT -= dt;
      if (this.markT <= 0) {
        this.markT = 0.14;
        const g = S.level.raycast(_a.copy(this.landing).setY(this.landing.y + 1.5), DOWN, 4, { staticOnly: true });
        if (g) S.fx.ring(g.point, g.normal, RING_RED, 2.6, 0.32);
      }
      if (this.windT > 0.6 / Math.sqrt(this.diff)) this.lob();
    }
  }

  lob() {
    const S = this.session;
    this.windT = -1;
    this.held.visible = false;
    this.coolT = (2.3 + Math.random() * 0.7) / Math.sqrt(this.diff);
    this.throwT = 0.35;
    this.squashV += 3;
    const from = this.worldOf(this.parts.handR, HAND, _h);
    from.y += 0.1;
    const Tt = this.flight;
    _v.subVectors(this.landing, from).divideScalar(Tt);
    _v.y += 0.5 * GRAV * Tt;
    const model = bombModel(this.pal.ink, 0.17);
    const team = this.team, owner = this, dmg = 70 * this.diff;
    const explode = (pos, n) => inkExplosion(S, pos, n || UP, team, { paintRadius: 2.6, damage: dmg, dmgRadius: 2.6, owner, sound: 'boom' });
    S.projectiles.spawn({
      pos: from, vel: _v, team, owner, damage: 0, radius: 0.2, gravity: GRAV, life: 4, mesh: model, fx: false,
      onHit: (p, hit) => {
        if (hit.actor) { explode(hit.point, UP); return; }
        const n = hit.normal || UP;
        const e = new MurkFuseBomb(S, { type: 'murk-fuse-bomb', pos: [hit.point.x + n.x * 0.16, hit.point.y + n.y * 0.16, hit.point.z + n.z * 0.16], normal: [n.x, n.y, n.z], team, owner, damage: dmg, fuse: 0.8 });
        S.addEntity(e);
        S.fx.burst(hit.point, n, this.pal.ink, 6, 3, { size: 0.05 });
        S.audio?.sfx('clack', { pos: hit.point, volume: 0.6 });
      },
      onExpire: (p) => explode(p.pos, UP),
      onStep: (p, dt) => { model.rotation.x += dt * 7; model.rotation.z += dt * 3; },
    });
    S.audio?.sfx('throw', { pos: from, volume: 0.7 });
  }

  onPop(c) {
    // the satchel goes up too — harmless confetti in the attacker's colour
    const S = this.session;
    S.fx.burst(_p.copy(c).setY(c.y + 0.3), UP, this.pal.ink, 10, 7, { size: 0.08 });
    S.fx.burst(c, UP, '#5a4633', 6, 4, { size: 0.06 });
  }

  animate(dt) {
    const P = this.parts;
    const wind = this.windT >= 0 ? Math.min(1, this.windT / 0.45) : 0;
    const thr = this.throwT / 0.35;
    animateTrooper(this, P, dt, { stride: 5.4, leanX: -wind * 0.15 + thr * 0.2 });
    // throwing arm: wind back over the shoulder, then whip forward
    P.armR.rotation.x = -wind * 2.4 + thr * 1.2;
    P.armR.rotation.z = wind * 0.3;
    if (this.held.visible) this.held.userData.light.visible = Math.sin(this.t * 30) > 0;
    // belly jiggle
    const jig = 1 + Math.sin(this.t * 7.5) * 0.02 * Math.min(1, Math.hypot(this.velocity.x, this.velocity.z));
    P.blob.scale.x = 1.38 * jig;
    P.blob.scale.z = 1.38 * 0.96 * jig;
  }
}

registerEntity('bomblob', (s, d) => new Bomblob(s, d));
