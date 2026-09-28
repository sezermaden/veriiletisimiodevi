/* Entities: every dynamic thing in the world (props, attachments, NPC bodies, pickups).
   An Entity owns a THREE object, a Rapier body and its colliders; the manager steps their
   behaviours, interpolates them for rendering and handles damage, fire and removal. */
import * as THREE from 'three';
import { R, GROUPS, FIXED } from '../physics/physics.js';
import { PROPS, propTemplate } from './props.js';
import { material, materialInstance, surfaceOf, makeDissolve, SURFACES } from '../render/materials.js';
import { Audio } from '../core/audio.js';
import { disposeTree } from './geometry.js';

export const DENSITY_SCALE = 100;       // catalogue densities are in 100 kg/m³ units

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

let NEXT_ID = 1;

export class Entity {
  constructor(game, o) {
    this.game = game;
    this.id = NEXT_ID++;
    this.kind = o.kind || 'prop';
    this.key = o.key || null;
    this.name = o.name || o.key || this.kind;
    this.object3d = o.object3d;
    this.body = o.body || null;
    this.colliders = o.colliders || [];
    this.surface = o.surface || 'concrete';
    this.maxHealth = o.health ?? Infinity;
    this.health = this.maxHealth;
    this.density = o.density ?? 1;
    this.halfHeight = o.halfHeight ?? 0.5;
    this.frozen = false;
    this.gravity = true;
    this.collide = true;
    this.color = null;
    this.materialKey = null;
    this.constraints = new Set();
    this.attachments = new Set();    // entities welded onto this one by tools (thrusters…)
    this.burning = 0;
    this.removed = false;
    this.owner = o.owner || 'world'; // 'player' for spawned things (undo, cleanup)
    this.persistent = !!o.persistent;
    this.flags = o.flags || {};
    this.prev = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.curr = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.behaviours = [];
    this.lastImpact = 0;
    if (this.body) {
      this.body.userData = { entity: this };
      this.capture(); this.capture();
    }
  }

  get position() { return this.curr.p; }
  get quaternion() { return this.curr.q; }
  get mass() { return this.body ? this.body.mass() : 0; }
  get isDynamic() { return this.body?.isDynamic(); }

  capture() {
    if (!this.body) return;
    this.prev.p.copy(this.curr.p); this.prev.q.copy(this.curr.q);
    const t = this.body.translation(), r = this.body.rotation();
    this.curr.p.set(t.x, t.y, t.z); this.curr.q.set(r.x, r.y, r.z, r.w);
  }

  render(alpha) {
    if (!this.body || !this.object3d) return;
    this.object3d.position.lerpVectors(this.prev.p, this.curr.p, alpha);
    this.object3d.quaternion.slerpQuaternions(this.prev.q, this.curr.q, alpha);
  }

  /** Teleport body and snap interpolation (no lerp across the jump). */
  setTransform(p, q) {
    if (!this.body) return;
    this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    if (q) this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.capture(); this.capture();
  }

  worldToLocal(p, out = new THREE.Vector3()) {
    _q.copy(this.curr.q).invert();
    return out.copy(p).sub(this.curr.p).applyQuaternion(_q);
  }

  localToWorld(p, out = new THREE.Vector3()) { return out.copy(p).applyQuaternion(this.curr.q).add(this.curr.p); }

  setFrozen(f, fx = true) {
    if (!this.body || this.frozen === f) return;
    this.frozen = f;
    this.body.setBodyType(f ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true);
    if (!f) this.body.wakeUp();
    if (fx) this.game.fx?.spawnBurst(this.curr.p, 0.4);
  }

  setGravity(on) {
    this.gravity = on;
    this.body?.setGravityScale(on ? (this.baseGravityScale ?? 1) : 0, true);
  }

  setCollisions(on) {
    this.collide = on;
    for (const c of this.colliders) c.setCollisionGroups(on ? (this._groups ?? GROUPS.prop) : GROUPS.nocollide);
  }

  /** Tint every mesh (the Colour tool). Uses private material copies. */
  setColor(hex) {
    this.color = hex;
    this.object3d.traverse((o) => {
      if (!o.isMesh || o.userData.noTint) return;
      if (!o.userData.ownMaterial) { o.material = o.material.clone(); o.userData.ownMaterial = true; }
      if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
      o.material.color.copy(o.userData.baseColor).multiply(new THREE.Color(hex));
    });
  }

  /** Swap surface material (the Material tool) — look, sound and friction. */
  setMaterial(key) {
    this.materialKey = key;
    this.surface = surfaceOf(key);
    this.object3d.traverse((o) => {
      if (!o.isMesh || o.userData.noTint) return;
      o.material = materialInstance(key);
      o.userData.ownMaterial = true;
      o.userData.baseColor = o.material.color.clone();
    });
    if (this.color) this.setColor(this.color);
    const s = SURFACES[this.surface];
    for (const c of this.colliders) { c.setFriction(s.friction); c.setRestitution(s.restitution); }
  }

  setMass(kg) {
    if (!this.colliders.length) return;
    const per = kg / this.colliders.length;
    for (const c of this.colliders) c.setMass(per);
  }

  applyImpulse(imp, point = null) {
    if (!this.body?.isDynamic()) return;
    if (point) this.body.applyImpulseAtPoint(imp, point, true);
    else this.body.applyImpulse(imp, true);
  }

  damage(amount, info = {}) {
    if (this.removed || !isFinite(this.maxHealth) || amount <= 0) return;
    this.health -= amount;
    this.onDamage?.(amount, info);
    const def = PROPS[this.key];
    if (def?.explode && this.health < this.maxHealth * 0.6 && this.health > 0 && !this.burning) this.ignite(2.5 + Math.random());
    if (this.health <= 0) this.destroy(info);
  }

  destroy(info = {}) {
    if (this.removed) return;
    const def = PROPS[this.key];
    if (def?.explode) {
      this.game.explode(this.curr.p.clone(), def.explode, this);
      this.remove({ effect: 'none' });
    } else if (def?.breakable) {
      this.game.entities.shatter(this, def.breakable, info);
    } else if (this.onDestroy) {
      this.onDestroy(info);
    }
  }

  ignite(seconds = 8) {
    if (this.removed) return;
    if (!this.burning) Audio.play('fire_ignite', { pos: this.curr.p });
    this.burning = Math.max(this.burning, seconds);
  }

  extinguish() { this.burning = 0; }

  remove({ effect = 'none' } = {}) {
    if (this.removed) return;
    this.removed = true;
    for (const c of [...this.constraints]) c.remove();
    for (const a of [...this.attachments]) a.remove({ effect });
    this.parentEntity?.attachments.delete(this);
    this.game.entities._detach(this, effect);
  }

  serialize() {
    return {
      kind: this.kind, key: this.key, p: this.curr.p.toArray(), q: this.curr.q.toArray(),
      frozen: this.frozen, color: this.color, material: this.materialKey, gravity: this.gravity, collide: this.collide,
      data: this.serializeData?.() ?? null,
    };
  }
}

/* ============================================================================ manager */
export class Entities {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byId = new Map();
    this.dissolving = [];
    this.limit = 400;
  }

  get physics() { return this.game.physics; }
  get scene() { return this.game.renderer.scene; }

  add(e) {
    this.list.push(e);
    this.byId.set(e.id, e);
    if (e.object3d && !e.object3d.parent) this.scene.add(e.object3d);
    for (const c of e.colliders) this.physics.register(c, e);
    return e;
  }

  count(owner = null) { return owner ? this.list.filter((e) => e.owner === owner).length : this.list.length; }

  /** Build a body + colliders from shape descriptors. */
  buildBody(shapes, { pos, quat, dynamic = true, density = 1, surface = 'concrete', groups = GROUPS.prop, ccd = false, restitution = null, events = true, gravityScale = 1, linDamp = 0.05, angDamp = 0.1 }) {
    const w = this.physics.world;
    const bd = (dynamic ? R.RigidBodyDesc.dynamic() : R.RigidBodyDesc.fixed())
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setCcdEnabled(ccd)
      .setLinearDamping(linDamp)
      .setAngularDamping(angDamp)
      .setGravityScale(gravityScale);
    const body = w.createRigidBody(bd);
    const colliders = [];
    const s = SURFACES[surface] || SURFACES.concrete;
    for (const sh of shapes) {
      let cd;
      if (sh.box) cd = R.ColliderDesc.cuboid(...sh.box);
      else if (sh.cyl) cd = R.ColliderDesc.cylinder(...sh.cyl);
      else if (sh.cone) cd = R.ColliderDesc.cone(...sh.cone);
      else if (sh.ball !== undefined) cd = R.ColliderDesc.ball(sh.ball);
      else if (sh.capsule) cd = R.ColliderDesc.capsule(...sh.capsule);
      else if (sh.hull) {
        const p = sh.hull.attributes.position.array;
        cd = R.ColliderDesc.convexHull(new Float32Array(p)) || R.ColliderDesc.ball(0.2);
      }
      if (!cd) continue;
      if (sh.p) cd.setTranslation(...sh.p);
      if (sh.r) { _q.setFromEuler(new THREE.Euler(...sh.r)); cd.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }); }
      cd.setDensity(density * DENSITY_SCALE)
        .setFriction(s.friction)
        .setRestitution(restitution ?? s.restitution)
        .setCollisionGroups(groups);
      if (events && dynamic) {
        cd.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS | R.ActiveEvents.COLLISION_EVENTS);
      }
      const col = w.createCollider(cd, body);
      colliders.push(col);
    }
    // Contact force threshold relative to weight, so resting contact never "impacts".
    if (dynamic) {
      const m = Math.max(0.5, body.mass());
      for (const col of colliders) col.setContactForceEventThreshold(m * 60 * 2.2);
    }
    return { body, colliders };
  }

  /** Spawn a catalogue prop. */
  spawnProp(key, pos, quat = new THREE.Quaternion(), opts = {}) {
    const def = PROPS[key];
    if (!def) return null;
    const t = propTemplate(key);
    const group = new THREE.Group();
    for (const [g, m, p, r] of t.parts) {
      const mesh = new THREE.Mesh(g, typeof m === 'string' ? material(m) : m);
      if (p) mesh.position.set(...p);
      if (r) mesh.rotation.set(...r);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (t.light) {
      const l = new THREE.PointLight(t.light.color, t.light.intensity, t.light.distance, 2);
      l.position.set(...t.light.pos);
      group.add(l);
    }
    group.position.copy(pos); group.quaternion.copy(quat);
    const { body, colliders } = this.buildBody(t.shapes, {
      pos, quat, dynamic: true, density: def.density, surface: def.surface, restitution: def.restitution ?? null,
      ccd: t.size.length() < 0.8,
    });
    const e = new Entity(this.game, {
      kind: 'prop', key, name: def.name, object3d: group, body, colliders, surface: def.surface,
      health: def.health ?? Infinity, density: def.density, halfHeight: t.halfHeight, owner: opts.owner || 'world',
    });
    this.add(e);
    if (opts.frozen) e.setFrozen(true, false);
    if (opts.color) e.setColor(opts.color);
    if (opts.material) e.setMaterial(opts.material);
    if (def.sharp) e.flags.sharp = true;
    e.onSplash = (v) => { this.game.fx.splash(e.curr.p, Math.min(2, v / 5)); Audio.play('splash', { pos: e.curr.p, intensity: Math.min(1, v / 8) }); };
    if (opts.effect !== false) this.spawnEffect(e);
    return e;
  }

  /** Spawn-in shimmer: the prop fades up from a cyan wireframe glow. */
  spawnEffect(e) {
    this.game.fx.spawnBurst(e.curr.p, 0.6);
    e.object3d.traverse((o) => { if (o.isMesh) o.userData.spawnT = 0; });
    e._spawnT = 0.35;
  }

  /** Place an entity so it rests on a surface point along its normal. */
  placeOnSurface(key, point, normal, yaw = 0) {
    const t = propTemplate(key);
    const n = new THREE.Vector3(normal.x, normal.y, normal.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // push out by the extent along the normal (approximate with the bounds)
    const ext = Math.abs(n.x) * t.size.x / 2 + Math.abs(n.y) * (t.bounds.max.y > -t.bounds.min.y ? -t.bounds.min.y : t.bounds.max.y) + Math.abs(n.z) * t.size.z / 2;
    const pos = new THREE.Vector3(point.x, point.y, point.z).addScaledVector(n, ext + 0.02);
    return { pos, quat: q };
  }

  /* ------------------------------------------------------------------ lifecycle */
  _detach(e, effect) {
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
    this.byId.delete(e.id);
    this.game.weapons?.owned.forEach((w) => w.onEntityRemoved?.(e));
    this.game.undo?.forget(e);
    e.onRemove?.();
    if (e.body) {
      for (const c of e.colliders) this.physics.unregister(c);
      this.physics.world.removeRigidBody(e.body);
      e.body = null;
    }
    if (effect === 'dissolve' && e.object3d) {
      const us = [];
      e.object3d.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        us.push(makeDissolve(o.material));
      });
      this.dissolving.push({ obj: e.object3d, us, t: 0 });
      this.game.fx.spawnBurst(e.object3d.position, 0.8);
    } else if (e.object3d) {
      this._disposeObject(e.object3d);
    }
  }

  _disposeObject(obj) { disposeTree(obj); }

  clear() {
    for (const e of [...this.list]) e.remove({ effect: 'none' });
    for (const d of this.dissolving) this._disposeObject(d.obj);
    this.dissolving.length = 0;
  }

  removeOwned(owner = 'player') {
    for (const e of [...this.list]) if (e.owner === owner) e.remove({ effect: 'dissolve' });
  }

  /* ------------------------------------------------------------------ per step */
  prePhysics(dt) {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      for (const b of e.behaviours) b(dt);
      if (e.burning > 0) this._burn(e, dt);
    }
  }

  postPhysics() {
    for (const e of this.list) e.capture();
    // fell out of the world
    for (const e of [...this.list]) {
      if (e.body && e.curr.p.y < (this.game.level?.killY ?? -60)) e.remove();
    }
  }

  _burn(e, dt) {
    e.burning -= dt;
    if (Math.random() < 0.6) {
      const p = _v.copy(e.curr.p);
      p.x += (Math.random() - 0.5) * 0.5; p.z += (Math.random() - 0.5) * 0.5; p.y += e.halfHeight * 0.6;
      this.game.fx.fire(p, 0.8);
    }
    if (!e._fireLoop) e._fireLoop = Audio.loop('fire', { pos: e.curr.p, volume: 0.5 });
    e._fireLoop.set(1); e._fireLoop.move(e.curr.p);
    if (isFinite(e.maxHealth)) e.damage(dt * (PROPS[e.key]?.explode ? 6 : 4), { type: 'fire' });
    // spread to neighbours rarely
    if (Math.random() < dt * 0.3) {
      for (const o of this.physics.overlapSphere(e.curr.p, 1.2)) if (o !== e && (o.surface === 'wood' || PROPS[o.key]?.explode) && !o.burning) o.ignite(6);
    }
    if (e.burning <= 0 || e.removed) {
      e.burning = 0;
      e._fireLoop?.stop(); e._fireLoop = null;
      if (PROPS[e.key]?.explode && !e.removed) e.destroy({ type: 'fire' });
    }
  }

  render(alpha, dt) {
    for (const e of this.list) {
      e.render(alpha);
      e.visualUpdate?.(dt);
      if (e._spawnT > 0) {
        e._spawnT -= dt;
        const k = Math.max(0, e._spawnT / 0.35);
        e.object3d.scale.setScalar(1 - k * 0.08);
      }
    }
    for (let i = this.dissolving.length - 1; i >= 0; i--) {
      const d = this.dissolving[i];
      d.t += dt;
      for (const u of d.us) u.uDissolve.value = Math.min(1.05, d.t / 0.9);
      if (d.t > 1) { this._disposeObject(d.obj); this.dissolving.splice(i, 1); }
    }
  }

  /* ------------------------------------------------------------------ breakables */
  shatter(e, kind, info = {}) {
    const p = e.curr.p.clone(), q = e.curr.q.clone();
    const size = propTemplate(e.key).size;
    const v = e.body ? e.body.linvel() : { x: 0, y: 0, z: 0 };
    e.remove({ effect: 'none' });
    const fx = this.game.fx;
    if (kind === 'glass') {
      Audio.play('glass_break', { pos: p });
      for (let i = 0; i < 26; i++) fx.cube(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * size.x, (Math.random() - 0.5) * size.y, (Math.random() - 0.5) * size.z)), new THREE.Vector3((Math.random() - 0.5) * 4 + v.x, Math.random() * 3 + v.y, (Math.random() - 0.5) * 4 + v.z), 0.04 + Math.random() * 0.05, 0xbfe3ff, 1.4);
      fx.sparks(p, null, 12, new THREE.Color(1.5, 2, 2.4), 4);
    } else if (kind === 'melon') {
      Audio.play('impact_flesh', { pos: p, volume: 1.2 });
      for (let i = 0; i < 14; i++) fx.cube(p, new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), 0.05 + Math.random() * 0.05, Math.random() < 0.5 ? 0xd9443a : 0x3f8f2e, 1.6);
      fx.blood(p, null);
    } else {
      // wood: real physical planks as debris gibs that fade out
      Audio.play('impact_wood', { pos: p, volume: 1.4, intensity: 1 });
      fx.dust(p, null, 10, new THREE.Color(0.55, 0.42, 0.28));
      const n = Math.min(6, 2 + Math.floor(size.length() * 2));
      for (let i = 0; i < n; i++) {
        const len = Math.max(size.x, size.z) * (0.5 + Math.random() * 0.5);
        const g = new THREE.BoxGeometry(len, 0.03, 0.12);
        const mesh = new THREE.Mesh(g, material('wood'));
        mesh.castShadow = true;
        mesh.userData.ownGeometry = true;
        const off = new THREE.Vector3((Math.random() - 0.5) * size.x, (Math.random() - 0.5) * size.y, (Math.random() - 0.5) * size.z).applyQuaternion(q);
        const pos = p.clone().add(off);
        const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
        const group = new THREE.Group(); group.add(mesh); group.position.copy(pos); group.quaternion.copy(rq);
        const { body, colliders } = this.buildBody([{ box: [len / 2, 0.015, 0.06] }], { pos, quat: rq, density: 0.6, surface: 'wood', groups: GROUPS.debris, events: false });
        body.setLinvel({ x: v.x + off.x * 4, y: v.y + 2 + Math.random() * 2, z: v.z + off.z * 4 }, true);
        const gib = new Entity(this.game, { kind: 'gib', object3d: group, body, colliders, surface: 'wood', density: 0.6, halfHeight: 0.05 });
        this.add(gib);
        gib.life = 6 + Math.random() * 3;
        gib.behaviours.push((dt) => { gib.life -= dt; if (gib.life <= 0) gib.remove({ effect: 'dissolve' }); });
      }
    }
    this.game.onEntityDestroyed?.(e, info);
  }
}

export { FIXED };
