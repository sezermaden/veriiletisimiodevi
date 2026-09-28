/* NPCs and ragdolls.

   A humanoid is a hierarchy of joint groups with rigid segment meshes (mannequin style),
   animated procedurally while alive. Movement uses a kinematic character controller. On
   death every segment becomes a dynamic body joined by ball sockets — a real ragdoll the
   Physics Gun can grab limb by limb. */
import * as THREE from 'three';
import { R, GROUPS, GRAVITY, FIXED } from '../physics/physics.js';
import { Entity } from './entities.js';
import { makeGlitch, material } from '../render/materials.js';
import { Audio } from '../core/audio.js';
import { settings, DIFFICULTY } from '../core/settings.js';
import { TEX } from '../render/textures.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

/* ------------------------------------------------------------------ rig definition
   name: [parent, pivot (relative to parent pivot, metres at scale 1), segment {len, r, dir}] */
const BONES = [
  ['pelvis', null, [0, 0.95, 0], { box: [0.34, 0.2, 0.2], off: [0, 0.02, 0] }],
  ['chest', 'pelvis', [0, 0.12, 0], { box: [0.42, 0.42, 0.24], off: [0, 0.2, 0] }],
  ['head', 'chest', [0, 0.45, 0], { head: 0.13, off: [0, 0.14, 0] }],
  ['thighL', 'pelvis', [0.1, -0.06, 0], { cap: [0.36, 0.075], off: [0, -0.2, 0] }],
  ['shinL', 'thighL', [0, -0.42, 0], { cap: [0.36, 0.06], off: [0, -0.2, 0] }],
  ['footL', 'shinL', [0, -0.42, 0], { box: [0.1, 0.07, 0.24], off: [0, -0.02, 0.05] }],
  ['thighR', 'pelvis', [-0.1, -0.06, 0], { cap: [0.36, 0.075], off: [0, -0.2, 0] }],
  ['shinR', 'thighR', [0, -0.42, 0], { cap: [0.36, 0.06], off: [0, -0.2, 0] }],
  ['footR', 'shinR', [0, -0.42, 0], { box: [0.1, 0.07, 0.24], off: [0, -0.02, 0.05] }],
  ['armL', 'chest', [0.26, 0.36, 0], { cap: [0.28, 0.055], off: [0, -0.16, 0] }],
  ['foreL', 'armL', [0, -0.31, 0], { cap: [0.26, 0.048], off: [0, -0.15, 0] }],
  ['armR', 'chest', [-0.26, 0.36, 0], { cap: [0.28, 0.055], off: [0, -0.16, 0] }],
  ['foreR', 'armR', [0, -0.31, 0], { cap: [0.26, 0.048], off: [0, -0.15, 0] }],
];
// bones that become ragdoll bodies (feet merge into shins for stability)
const RAGDOLL = ['pelvis', 'chest', 'head', 'thighL', 'shinL', 'thighR', 'shinR', 'armL', 'foreL', 'armR', 'foreR'];

export const NPC_TYPES = {
  citizen: { name: 'Citizen', health: 60, speed: 2.4, run: 5, scale: 1, hostile: false, look: 'citizen' },
  mannequin: { name: 'Mannequin', health: 40, speed: 0, run: 0, scale: 1, hostile: false, look: 'mannequin', ragdollOnly: true },
  null: { name: 'Null', health: 70, speed: 3.2, run: 6.2, scale: 1, hostile: true, look: 'null', damage: 12, reach: 1.5, attackTime: 0.9 },
  brute: { name: 'Null Brute', health: 320, speed: 2.4, run: 4.2, scale: 1.42, hostile: true, look: 'brute', damage: 30, reach: 2.2, attackTime: 1.5, knockback: 9 },
  drone: { name: 'Null Drone', health: 45, speed: 4, run: 6, scale: 1, hostile: true, look: 'drone', flying: true, damage: 9 },
};

/* ------------------------------------------------------------------ looks */
function looks(kind, seed = Math.random()) {
  const pick = (arr) => arr[Math.floor(seed * 997) % arr.length];
  if (kind === 'citizen') {
    const shirt = pick(['#3d5a80', '#8d3b3b', '#4f6d3a', '#6b4f8f', '#b0802f', '#2f6f73', '#7a7a7a']);
    const pants = pick(['#2b2f38', '#3b3226', '#1e2a3a', '#4a4a4a']);
    const skin = pick(['#e0b896', '#c99a78', '#a8765a', '#7a5238', '#f0c8a8']);
    const m = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const S = m(shirt), P = m(pants), K = m(skin, 0.7), B = m('#1c1c1c', 0.6), H = m(pick(['#2a1c12', '#6b4a2a', '#111111', '#b58a4a', '#8a8a8a']), 0.9);
    return { pelvis: P, chest: S, head: K, thighL: P, shinL: P, footL: B, thighR: P, shinR: P, footR: B, armL: S, foreL: K, armR: S, foreR: K, hair: H };
  }
  if (kind === 'mannequin') {
    const m = new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.45, metalness: 0.05 });
    return Object.fromEntries(BONES.map(([n]) => [n, m]));
  }
  // corrupted: missing-texture checker with a glitch vertex shader, magenta emissive
  const mat = new THREE.MeshStandardMaterial({ map: TEX.checker.map, emissive: '#ff00dc', emissiveMap: TEX.checker.map, emissiveIntensity: kind === 'brute' ? 0.9 : 0.6, roughness: 0.4 });
  mat.map = TEX.checker.map.clone(); mat.map.needsUpdate = true;
  mat.map.repeat.set(2, 2);
  const u = makeGlitch(mat, kind === 'brute' ? 0.05 : 0.035);
  const out = Object.fromEntries(BONES.map(([n]) => [n, mat]));
  out._glitch = u;
  return out;
}

function segmentGeometry(seg, s) {
  if (seg.box) return new THREE.BoxGeometry(seg.box[0] * s, seg.box[1] * s, seg.box[2] * s);
  if (seg.cap) return new THREE.CapsuleGeometry(seg.cap[1] * s, (seg.cap[0] - seg.cap[1] * 2) * s, 4, 10);
  if (seg.head) return new THREE.SphereGeometry(seg.head * s, 16, 12).scale(0.9, 1.08, 1);
  return new THREE.BoxGeometry(0.1, 0.1, 0.1);
}

/** Build the joint hierarchy. Returns { root, joints{name: Group}, meshes{name: Mesh} }. */
export function buildHumanoid(look, scale = 1, lookKind = 'citizen') {
  const root = new THREE.Group();
  const joints = {}, meshes = {};
  for (const [name, parent, pivot, seg] of BONES) {
    const j = new THREE.Group();
    j.position.set(pivot[0] * scale, pivot[1] * scale, pivot[2] * scale);
    (parent ? joints[parent] : root).add(j);
    joints[name] = j;
    const mesh = new THREE.Mesh(segmentGeometry(seg, scale), look[name]);
    mesh.position.set(seg.off[0] * scale, seg.off[1] * scale, seg.off[2] * scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    j.add(mesh);
    meshes[name] = mesh;
  }
  if (lookKind === 'citizen') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair);
    hair.position.set(0, 0.16 * scale, -0.01 * scale);
    joints.head.add(hair);
    const eyeM = new THREE.MeshStandardMaterial({ color: '#111' });
    for (const x of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.015 * scale, 8, 6), eyeM); e.position.set(x * scale, 0.16 * scale, 0.11 * scale); joints.head.add(e); }
  } else if (lookKind === 'null' || lookKind === 'brute') {
    // a single burning eye slit
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.025 * scale, 0.02 * scale), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 3.5) }));
    eye.position.set(0, 0.15 * scale, 0.12 * scale);
    joints.head.add(eye);
  }
  return { root, joints, meshes, scale };
}

/* ------------------------------------------------------------------ NPC */
export class NPC {
  constructor(game, type, pos, yaw = 0, opts = {}) {
    this.game = game;
    this.type = type;
    this.def = NPC_TYPES[type];
    const diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    this.maxHealth = this.def.health * (this.def.hostile ? diff.enemyHealth : 1) * (opts.healthScale ?? 1);
    this.health = this.maxHealth;
    this.scale = this.def.scale;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.state = opts.state || (this.def.hostile ? 'idle' : 'wander');
    this.target = null;
    this.alive = true;
    this.phase = Math.random() * 10;
    this.attackT = 0;
    this.cooldown = 0;
    this.stagger = 0;
    this.stuckT = 0;
    this.thinkT = Math.random() * 0.3;
    this.wanderGoal = null;
    this.alert = !!opts.alert;
    this.onDeath = opts.onDeath || null;
    this.flying = !!this.def.flying;
    this.hoverY = pos.y;
    this.home = this.pos.clone();
    this.leash = opts.leash ?? 60;
    const look = looks(this.def.look, opts.seed ?? Math.random());
    this.look = look;
    if (this.flying) this._buildDrone();
    else {
      const h = buildHumanoid(look, this.scale, this.def.look);
      this.rig = h;
      this.object3d = h.root;
    }
    this.object3d.position.copy(this.pos);
    game.renderer.scene.add(this.object3d);
    this._createBody();
  }

  _buildDrone() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), this.look.pelvis);
    core.castShadow = true;
    g.add(core);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 2.6) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 24), ringMat);
    g.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 3.5) }));
    eye.position.z = 0.31;
    g.add(eye);
    this.drone = { core, ring, eye };
    this.object3d = g;
  }

  _createBody() {
    const w = this.game.physics.world;
    const s = this.scale;
    const hh = this.flying ? 0.05 : 0.55 * s, r = this.flying ? 0.38 : 0.32 * s;
    this.halfH = hh; this.radius = r;
    this.body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, this.pos.y, this.pos.z));
    this.collider = w.createCollider(R.ColliderDesc.capsule(hh, r).setTranslation(0, this.flying ? 0 : hh + r, 0).setCollisionGroups(GROUPS.npc), this.body);
    this.entity = new Entity(this.game, { kind: 'npc', name: this.def.name, object3d: null, body: null, colliders: [this.collider], surface: this.def.hostile ? 'glitch' : 'flesh' });
    this.entity.npc = this;
    this.entity.hostile = this.def.hostile;
    this.game.physics.register(this.collider, this.entity);
    if (!this.flying) {
      this.cc = w.createCharacterController(0.02);
      this.cc.enableAutostep(0.4 * s, 0.2, false);
      this.cc.enableSnapToGround(0.4);
      this.cc.setMaxSlopeClimbAngle(0.9);
      this.cc.setApplyImpulsesToDynamicBodies(true);
      this.cc.setCharacterMass(90 * s * s);
    }
  }

  get center() { return _v.set(this.pos.x, this.pos.y + (this.flying ? 0 : 1.0 * this.scale), this.pos.z); }
  get headY() { return this.pos.y + 1.55 * this.scale; }

  /* ---------------------------------------------------------- damage */
  hurt(amount, info = {}) {
    if (!this.alive) return;
    let dmg = amount;
    if (info.point && !this.flying && info.point.y > this.headY - 0.08 * this.scale) dmg *= 2.2;   // headshot
    this.health -= dmg;
    this.lastHit = info;
    this.stagger = Math.min(0.5, this.stagger + dmg / 60);
    if (this.def.hostile) { this.alert = true; this.state = 'chase'; }
    else { this.state = 'flee'; this.fleeT = 6; }
    if (info.dir && info.force) this.vel.addScaledVector(new THREE.Vector3(info.dir.x, 0, info.dir.z), info.force * 0.08 / this.scale);
    this.game.fx.impact(info.point ? new THREE.Vector3(info.point.x, info.point.y, info.point.z) : this.center.clone(), info.normal, this.def.hostile ? 'glitch' : 'flesh');
    if (this.def.hostile && Math.random() < 0.35) Audio.play('glitch', { pos: this.pos, volume: 0.6 });
    if (this.health <= 0) this.die(info);
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.game.npcs.onDeath(this, info);
    this.onDeath?.(this, info);
    if (this.def.hostile) Audio.play('null_die', { pos: this.pos });
    else Audio.play('impact_flesh', { pos: this.pos, volume: 1 });
    const impulse = info.dir ? new THREE.Vector3(info.dir.x, info.dir.y, info.dir.z).multiplyScalar((info.force || 20) * 1.5) : new THREE.Vector3();
    if (this.flying) {
      this.game.fx.glitchBurst(this.pos, 30, 1.2);
      this.game.fx.flash(this.pos, 0xff40e0, 12, 0.3, 8);
    } else {
      makeRagdoll(this.game, this.rig, this.object3d, {
        velocity: this.vel.clone().add(impulse.multiplyScalar(0.1)),
        dissolveAfter: this.def.hostile ? 5 : 0,
        glitch: this.def.hostile,
        hitPoint: info.point,
        impulse: impulse,
      });
      this.rig = null;
    }
    this._destroyBody();
    if (this.flying) this.object3d.removeFromParent();
    this.object3d = null;
  }

  _destroyBody() {
    const w = this.game.physics.world;
    if (this.cc) { w.removeCharacterController(this.cc); this.cc = null; }
    if (this.body) { this.game.physics.unregister(this.collider); w.removeRigidBody(this.body); this.body = null; }
  }

  remove() {
    if (this.body) this._destroyBody();
    this.object3d?.removeFromParent();
    this.alive = false;
  }

  /* ---------------------------------------------------------- AI */
  canSee(p) {
    const from = { x: this.pos.x, y: this.headY, z: this.pos.z };
    const to = _w.set(p.x - from.x, p.y - from.y, p.z - from.z);
    const d = to.length();
    if (d < 0.01) return true;
    to.divideScalar(d);
    const hit = this.game.physics.raycast(from, to, d, { excludeBody: this.body, groups: GROUPS.npc, predicate: (c) => !c.isSensor() && this.game.physics.colliderOwner.get(c.handle)?.kind !== 'player' });
    return !hit;
  }

  step(dt) {
    if (!this.alive) return;
    this.prevPos.copy(this.pos);
    const player = this.game.player;
    const pp = player.pos;
    const toP = _v.set(pp.x - this.pos.x, 0, pp.z - this.pos.z);
    const distP = toP.length();
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stagger = Math.max(0, this.stagger - dt);

    // perception
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.25 + Math.random() * 0.15;
      if (this.def.hostile && player.alive && !player.noclip && this.game.aiEnabled !== false) {
        const eye = { x: pp.x, y: pp.y + 1.5, z: pp.z };
        const inRange = distP < (this.alert ? 45 : 26);
        this.seesPlayer = inRange && this.canSee(eye);
        if (this.seesPlayer) { this.alert = true; this.state = this.state === 'attack' ? 'attack' : 'chase'; this.lastSeen = pp.clone(); }
        else if (this.state === 'chase' && !this.lastSeen) this.state = 'idle';
        if (this.alert && Math.random() < 0.08) Audio.play('null_growl', { pos: this.pos, volume: 0.7 });
      } else if (!this.def.hostile) {
        // citizens run from nearby corrupted things
        const threat = this.game.npcs.nearestHostile(this.pos, 10);
        if (threat) { this.state = 'flee'; this.fleeFrom = threat.pos.clone(); this.fleeT = 3; }
      }
    }

    let wish = new THREE.Vector3();
    let speed = this.def.speed;
    if (this.flying) return this._droneStep(dt, distP);

    switch (this.state) {
      case 'wander': {
        if (!this.wanderGoal || this.pos.distanceTo(this.wanderGoal) < 1 || Math.random() < dt * 0.05) {
          const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8;
          this.wanderGoal = this.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
          this.pauseT = Math.random() < 0.4 ? 1 + Math.random() * 3 : 0;
        }
        if (this.pauseT > 0) { this.pauseT -= dt; break; }
        wish.subVectors(this.wanderGoal, this.pos).setY(0);
        break;
      }
      case 'flee': {
        this.fleeT -= dt;
        const from = this.fleeFrom || pp;
        wish.set(this.pos.x - from.x, 0, this.pos.z - from.z);
        speed = this.def.run;
        if (this.fleeT <= 0) { this.state = 'wander'; this.home.copy(this.pos); }
        break;
      }
      case 'chase': {
        const goal = this.seesPlayer ? pp : this.lastSeen;
        if (!goal) { this.state = 'idle'; break; }
        wish.set(goal.x - this.pos.x, 0, goal.z - this.pos.z);
        speed = this.def.run;
        if (this.seesPlayer && distP < this.def.reach * this.scale * 0.85 + 0.4 && this.cooldown <= 0) { this.state = 'attack'; this.attackT = this.def.attackTime; Audio.play('null_attack', { pos: this.pos }); }
        if (!this.seesPlayer && this.lastSeen && this.pos.distanceTo(this.lastSeen) < 1.2) this.lastSeen = null;
        break;
      }
      case 'attack': {
        this.attackT -= dt;
        const k = 1 - this.attackT / this.def.attackTime;
        wish.set(pp.x - this.pos.x, 0, pp.z - this.pos.z).multiplyScalar(0.001);
        if (k > 0.55 && !this.hitDone) {
          this.hitDone = true;
          if (distP < this.def.reach * this.scale + 0.5 && Math.abs(pp.y - this.pos.y) < 2 * this.scale) {
            const kb = toP.clone().normalize().multiplyScalar(this.def.knockback || 3);
            kb.y = (this.def.knockback || 3) * 0.4;
            player.takeDamage(this.def.damage, { type: 'melee', from: this.pos.clone(), force: kb });
          }
          // swipes knock props around too
          for (const e of this.game.physics.overlapSphere({ x: this.pos.x + Math.sin(this.yaw) * this.scale, y: this.pos.y + this.scale, z: this.pos.z + Math.cos(this.yaw) * this.scale }, 0.9 * this.scale)) {
            if (e.body?.isDynamic()) e.applyImpulse({ x: Math.sin(this.yaw) * 60 * this.scale, y: 30, z: Math.cos(this.yaw) * 60 * this.scale });
            if (e.kind === 'prop' && isFinite(e.maxHealth)) e.damage(this.def.damage, { type: 'melee' });
          }
        }
        if (this.attackT <= 0) { this.state = 'chase'; this.cooldown = 0.5; this.hitDone = false; }
        break;
      }
      default: {
        if (this.alert && this.lastSeen) this.state = 'chase';
      }
    }

    // steering: go around obstacles by probing ahead
    const len = wish.length();
    if (len > 0.05) {
      wish.divideScalar(len);
      const probe = this.game.physics.raycast({ x: this.pos.x, y: this.pos.y + 0.6 * this.scale, z: this.pos.z }, { x: wish.x, y: 0, z: wish.z }, 1.2 * this.scale, { excludeBody: this.body, groups: GROUPS.npc });
      if (probe && probe.entity?.kind !== 'player') {
        const side = new THREE.Vector3(-wish.z, 0, wish.x);
        if (this._avoidSide === undefined || Math.random() < 0.02) this._avoidSide = Math.random() < 0.5 ? 1 : -1;
        wish.addScaledVector(side, 1.4 * this._avoidSide).normalize();
      }
      const targetYaw = Math.atan2(wish.x, wish.z);
      let dy = targetYaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 8);
    } else if (this.state === 'attack' || (this.seesPlayer && distP < 6)) {
      const targetYaw = Math.atan2(toP.x, toP.z);
      let dy = targetYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 10);
    }
    const sp = len > 0.05 && this.stagger <= 0.1 ? speed : 0;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.vel.x += (fwd.x * sp - this.vel.x) * Math.min(1, dt * 6);
    this.vel.z += (fwd.z * sp - this.vel.z) * Math.min(1, dt * 6);
    this.vel.y -= GRAVITY * dt;
    this.cc.computeColliderMovement(this.collider, { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt }, R.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.npc);
    const m = this.cc.computedMovement();
    if (this.cc.computedGrounded()) this.vel.y = -0.5;
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    const moved = Math.hypot(m.x, m.z);
    this.moveSpeed = moved / dt;
    this.phase += moved * 3.2 / this.scale;
    // stuck: the corruption blinks forward
    if (sp > 0 && moved < sp * dt * 0.2) this.stuckT += dt; else this.stuckT = 0;
    if (this.def.hostile && this.stuckT > 1.6 && this.state === 'chase') this._blink(pp);
    if (this.pos.y < (this.game.level?.killY ?? -60)) this.die({});
    if (this.pos.distanceTo(this.home) > this.leash && !this.def.hostile) this.state = 'wander';
  }

  _blink(toward) {
    this.stuckT = 0;
    const dir = new THREE.Vector3(toward.x - this.pos.x, 0, toward.z - this.pos.z);
    const d = Math.min(4, dir.length() - 1.5);
    if (d <= 0.5) return;
    dir.normalize();
    const dest = this.pos.clone().addScaledVector(dir, d);
    const down = this.game.physics.raycast({ x: dest.x, y: dest.y + 2, z: dest.z }, { x: 0, y: -1, z: 0 }, 5, { excludeBody: this.body });
    if (!down) return;
    this.game.fx.glitchBurst(this.center.clone(), 12, 0.8);
    Audio.play('glitch', { pos: this.pos });
    this.pos.set(dest.x, down.point.y + 0.02, dest.z);
    this.prevPos.copy(this.pos);
    this.body.setTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, true);
    this.game.fx.glitchBurst(this.center.clone(), 12, 0.8);
  }

  _droneStep(dt, distP) {
    const pp = this.game.player.pos;
    const want = new THREE.Vector3();
    if (this.alert && this.seesPlayer) {
      const to = new THREE.Vector3(pp.x - this.pos.x, 0, pp.z - this.pos.z);
      const d = to.length();
      to.normalize();
      want.addScaledVector(to, d > 9 ? 1 : d < 6 ? -1 : 0);
      want.addScaledVector(new THREE.Vector3(-to.z, 0, to.x), Math.sin(this.phase * 0.7) * 0.8);
      this.hoverY += ((pp.y + 3.5) - this.hoverY) * Math.min(1, dt * 0.8);
      if (this.cooldown <= 0 && distP < 30) {
        this.cooldown = 1.3 + Math.random() * 0.8;
        this.game.npcs.shootOrb(this.pos.clone(), new THREE.Vector3(pp.x, pp.y + 1.3, pp.z), this.def.damage);
      }
      this.yaw = Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z);
    } else if (this.alert && this.lastSeen) {
      want.set(this.lastSeen.x - this.pos.x, 0, this.lastSeen.z - this.pos.z).normalize();
    }
    this.phase += dt * 2;
    this.vel.x += (want.x * this.def.speed - this.vel.x) * Math.min(1, dt * 2);
    this.vel.z += (want.z * this.def.speed - this.vel.z) * Math.min(1, dt * 2);
    const ty = this.hoverY + Math.sin(this.phase * 1.3) * 0.3;
    this.vel.y += ((ty - this.pos.y) * 3 - this.vel.y) * Math.min(1, dt * 3);
    const next = this.pos.clone().addScaledVector(this.vel, dt);
    // do not fly through walls
    const d = next.clone().sub(this.pos);
    const len = d.length();
    if (len > 1e-4) {
      const hit = this.game.physics.raycast(this.pos, d.clone().divideScalar(len), len + 0.4, { excludeBody: this.body, groups: GROUPS.npc });
      if (hit && hit.entity?.kind !== 'player') { this.vel.multiplyScalar(-0.3); next.copy(this.pos); }
    }
    this.pos.copy(next);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  /* ---------------------------------------------------------- visuals */
  render(alpha, dt) {
    if (!this.object3d) return;
    this.object3d.position.lerpVectors(this.prevPos, this.pos, alpha);
    this.object3d.rotation.y = this.yaw;
    if (this.look._glitch) this.look._glitch.uTime.value += dt;
    if (this.flying) {
      const d = this.drone;
      d.ring.rotation.x += dt * 3; d.ring.rotation.y += dt * 2;
      d.core.rotation.y += dt * 0.7;
      if (Math.random() < dt * 2) d.core.position.set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, 0); else d.core.position.multiplyScalar(0.9);
      return;
    }
    const J = this.rig.joints;
    const sp = Math.min(1, (this.moveSpeed || 0) / Math.max(0.1, this.def.run));
    const ph = this.phase;
    const swing = Math.sin(ph) * 0.75 * sp;
    const t = performance.now() / 1000;
    J.thighL.rotation.x = swing; J.thighR.rotation.x = -swing;
    J.shinL.rotation.x = Math.max(0, -Math.sin(ph)) * 1.1 * sp; J.shinR.rotation.x = Math.max(0, Math.sin(ph)) * 1.1 * sp;
    J.armL.rotation.x = -swing * 0.8; J.armR.rotation.x = swing * 0.8;
    J.armL.rotation.z = 0.12; J.armR.rotation.z = -0.12;
    J.foreL.rotation.x = -0.3 - sp * 0.4; J.foreR.rotation.x = -0.3 - sp * 0.4;
    J.chest.rotation.x = 0.06 + sp * 0.12 + Math.sin(t * 2) * 0.015;
    J.pelvis.position.y = 0.95 * this.scale + Math.abs(Math.cos(ph)) * 0.04 * sp * this.scale;
    J.head.rotation.set(0, 0, 0);
    if (this.state === 'attack') {
      const k = 1 - this.attackT / this.def.attackTime;
      const raise = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45;
      J.armL.rotation.x = -2.6 * raise; J.armR.rotation.x = -2.6 * raise;
      J.chest.rotation.x = -0.25 * raise + (k > 0.55 ? 0.5 * (1 - raise) : 0);
    }
    if (this.stagger > 0) { J.chest.rotation.x -= this.stagger * 0.8; J.head.rotation.x = -this.stagger; }
    if (this.def.hostile) {
      // twitch
      if (Math.random() < dt * 3) this._twitch = { bone: ['head', 'armL', 'armR', 'chest'][Math.floor(Math.random() * 4)], v: (Math.random() - 0.5) * 1.2, t: 0.12 };
      if (this._twitch) { J[this._twitch.bone].rotation.z += this._twitch.v; this._twitch.t -= dt; if (this._twitch.t <= 0) this._twitch = null; }
    }
  }
}

/* ------------------------------------------------------------------ ragdolls */
/**
 * Turn a posed humanoid into physics bodies. Each ragdoll bone is its own Entity so the
 * Physics Gun can pick up a single limb; removing any limb removes the whole body.
 */
export function makeRagdoll(game, rig, root, { velocity = new THREE.Vector3(), dissolveAfter = 0, glitch = false, hitPoint = null, impulse = null, owner = 'world' } = {}) {
  root.updateMatrixWorld(true);
  const scene = game.renderer.scene;
  const bodies = {};
  const ents = [];
  const w = game.physics.world;
  const parentOf = Object.fromEntries(BONES.map(([n, p]) => [n, p]));
  const segOf = Object.fromEntries(BONES.map(([n, , , s]) => [n, s]));
  const s = rig.scale || 1;
  const group = { ents, removed: false };
  for (const name of RAGDOLL) {
    const joint = rig.joints[name];
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    joint.matrixWorld.decompose(wp, wq, ws);
    const holder = new THREE.Group();
    holder.position.copy(wp); holder.quaternion.copy(wq);
    // move the segment mesh (and children like the foot) into the holder
    const mesh = rig.meshes[name];
    holder.add(mesh);
    const jointSet = new Set(Object.values(rig.joints));
    for (const child of [...joint.children]) if (child !== mesh && !jointSet.has(child)) holder.add(child);
    if (name === 'shinL' || name === 'shinR') {
      const foot = rig.joints[name === 'shinL' ? 'footL' : 'footR'];
      const fm = rig.meshes[name === 'shinL' ? 'footL' : 'footR'];
      fm.position.add(foot.position);
      holder.add(fm);
    }
    scene.add(holder);
    const seg = segOf[name];
    let shape;
    if (seg.box) shape = { box: [seg.box[0] * s * 0.5, seg.box[1] * s * 0.5, seg.box[2] * s * 0.5], p: [seg.off[0] * s, seg.off[1] * s, seg.off[2] * s] };
    else if (seg.cap) shape = { capsule: [Math.max(0.02, (seg.cap[0] / 2 - seg.cap[1]) * s), seg.cap[1] * s], p: [seg.off[0] * s, seg.off[1] * s, seg.off[2] * s] };
    else shape = { ball: seg.head * s, p: [seg.off[0] * s, seg.off[1] * s, seg.off[2] * s] };
    const { body, colliders } = game.entities.buildBody([shape], { pos: wp, quat: wq, density: 10, surface: 'flesh', groups: GROUPS.ragdoll, angDamp: 1.2, linDamp: 0.1 });
    body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    const e = new Entity(game, { kind: 'ragdoll', name: glitch ? 'Null remains' : 'Ragdoll', object3d: holder, body, colliders, surface: glitch ? 'glitch' : 'flesh', density: 1.0, halfHeight: 0.15, owner });
    e.ragdoll = group;
    e.onRemove = () => { if (!group.removed) { group.removed = true; for (const o of ents) if (o !== e) o.remove({ effect: glitch ? 'dissolve' : 'none' }); } };
    game.entities.add(e);
    bodies[name] = { body, e, pivot: wp.clone() };
    ents.push(e);
  }
  // joints at each child pivot
  for (const name of RAGDOLL) {
    const parent = parentOf[name];
    if (!parent) continue;
    const a = bodies[parent], b = bodies[name];
    const pivot = b.pivot;
    const la = a.e.worldToLocal(pivot), lb = b.e.worldToLocal(pivot);
    const j = w.createImpulseJoint(R.JointData.spherical({ x: la.x, y: la.y, z: la.z }, { x: lb.x, y: lb.y, z: lb.z }), a.body, b.body, true);
    j.setContactsEnabled?.(false);
    const c = { type: 'ragdoll', a: a.e, b: b.e, removed: false, remove() { if (this.removed) return; this.removed = true; try { w.removeImpulseJoint(j, true); } catch { /* */ } a.e.constraints.delete(this); b.e.constraints.delete(this); }, update() {}, data: {} };
    a.e.constraints.add(c); b.e.constraints.add(c);
  }
  if (impulse && hitPoint) {
    // shove the limb nearest the hit
    let best = null, bd = Infinity;
    for (const x of Object.values(bodies)) { const d = x.e.curr.p.distanceTo(hitPoint); if (d < bd) { bd = d; best = x; } }
    best?.body.applyImpulse({ x: impulse.x * 0.5, y: impulse.y * 0.5 + 2, z: impulse.z * 0.5 }, true);
  }
  root.removeFromParent();
  if (dissolveAfter > 0) {
    const first = ents[0];
    first.life = dissolveAfter;
    first.behaviours.push((dt) => {
      first.life -= dt;
      if (Math.random() < 0.2) game.fx.glitchBurst(first.curr.p, 1, 0.4);
      if (first.life <= 0) { first.remove({ effect: 'dissolve' }); }
    });
  }
  game.npcs.trackRagdoll(group);
  return group;
}

/* ------------------------------------------------------------------ manager */
export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.orbs = [];
    this.ragdolls = [];
    this.maxRagdolls = 10;
    this._acc = 0;
    this.kills = 0;
  }

  spawn(type, pos, yaw = 0, opts = {}) {
    if (NPC_TYPES[type]?.ragdollOnly) return this.spawnRagdoll(type, pos, yaw, opts);
    const n = new NPC(this.game, type, pos, yaw, opts);
    this.list.push(n);
    if (NPC_TYPES[type].hostile) { this.game.fx.glitchBurst(n.center.clone(), 16, 1); Audio.play('glitch', { pos }); }
    return n;
  }

  /** A standing mannequin that immediately goes limp — the classic sandbox dummy. */
  spawnRagdoll(type, pos, yaw = 0, opts = {}) {
    const look = looks(NPC_TYPES[type]?.look || 'mannequin');
    const rig = buildHumanoid(look, 1, NPC_TYPES[type]?.look || 'mannequin');
    rig.root.position.set(pos.x, pos.y + 0.02, pos.z);
    rig.root.rotation.y = yaw;
    rig.joints.armL.rotation.z = 0.25; rig.joints.armR.rotation.z = -0.25;
    this.game.renderer.scene.add(rig.root);
    const g = makeRagdoll(this.game, rig, rig.root, { owner: opts.owner || 'world' });
    return g;
  }

  trackRagdoll(group) {
    this.ragdolls.push(group);
    this.ragdolls = this.ragdolls.filter((r) => !r.removed);
    while (this.ragdolls.length > this.maxRagdolls) {
      const old = this.ragdolls.shift();
      if (!old.removed && old.ents[0]?.owner !== 'player') old.ents[0].remove({ effect: 'dissolve' });
    }
  }

  onDeath(npc, info) {
    this.list = this.list.filter((n) => n !== npc);
    if (npc.def.hostile) { this.kills++; this.game.progress.kills++; }
    this.game.onNpcKilled?.(npc, info);
  }

  nearestHostile(p, maxD) {
    let best = null, bd = maxD;
    for (const n of this.list) if (n.def.hostile && n.alive) { const d = n.pos.distanceTo(p); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  hostilesAlive() { return this.list.filter((n) => n.def.hostile && n.alive).length; }

  shootOrb(from, to, damage) {
    const dir = to.clone().sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 3.6) }));
    mesh.position.copy(from);
    this.game.renderer.scene.add(mesh);
    this.orbs.push({ mesh, pos: from.clone(), vel: dir.multiplyScalar(13), life: 4, damage });
    Audio.play('drone_shot', { pos: from });
  }

  step(dt) {
    for (const n of [...this.list]) n.step(dt);
    // projectile orbs
    const p = this.game.player;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      const next = o.pos.clone().addScaledVector(o.vel, dt);
      const seg = next.clone().sub(o.pos);
      const len = seg.length();
      const hit = this.game.physics.raycast(o.pos, seg.divideScalar(len), len, { groups: GROUPS.npc | 0xffff, predicate: (c) => this.game.physics.colliderOwner.get(c.handle)?.kind !== 'npc' });
      const nearPlayer = next.distanceTo(new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z)) < 0.7;
      if (nearPlayer || hit || o.life <= 0) {
        if (nearPlayer) p.takeDamage(o.damage, { type: 'energy', from: o.pos.clone() });
        else if (hit?.entity?.body) hit.entity.applyImpulse({ x: o.vel.x * 2, y: o.vel.y * 2, z: o.vel.z * 2 });
        this.game.fx.glitchBurst(next, 8, 0.5);
        this.game.fx.flash(next, 0xff40e0, 4, 0.2, 6);
        Audio.play('zap', { pos: next, volume: 0.6 });
        o.mesh.removeFromParent(); o.mesh.geometry.dispose(); o.mesh.material.dispose();
        this.orbs.splice(i, 1);
        continue;
      }
      o.pos.copy(next);
      o.mesh.position.copy(next);
      if (Math.random() < 0.5) this.game.fx.add.emit(next, new THREE.Vector3(), { color: new THREE.Color(3, 0.2, 2.6), size: 0.25, size1: 0.02, life: 0.25 });
    }
  }

  render(alpha, dt) { for (const n of this.list) n.render(alpha, dt); }

  clear() {
    for (const n of this.list) n.remove();
    this.list = [];
    for (const o of this.orbs) { o.mesh.removeFromParent(); o.mesh.geometry.dispose(); o.mesh.material.dispose(); }
    this.orbs = [];
    this.ragdolls = [];
  }
}

export { BONES, FIXED, _q, material, looks };
