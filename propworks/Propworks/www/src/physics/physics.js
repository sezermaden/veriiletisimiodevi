/* Rapier wrapper: world, fixed-step clock, collision groups, impact events, water.

   The step runs at a fixed 60 Hz with an accumulator (see Game.frame for the edge-input
   rule). Bodies are interpolated between the last two steps for rendering, so a 144 Hz
   display gets smooth motion without running physics faster. */
import RAPIER from 'rapier';

export let R = null;

export async function initPhysics() {
  await RAPIER.init();
  R = RAPIER;
  return R;
}

export const GRAVITY = 11.4;       // Source gravity (600 hu/s²) in metres
export const FIXED = 1 / 60;

/* Collision groups: membership bits (high 16) | filter bits (low 16). */
export const G = {
  WORLD: 1 << 0, PROP: 1 << 1, PLAYER: 1 << 2, NPC: 1 << 3, RAGDOLL: 1 << 4, DEBRIS: 1 << 5, TRIGGER: 1 << 6, PROJECTILE: 1 << 7, HELD: 1 << 8,
};
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const GROUPS = {
  world: groups(G.WORLD, 0xffff),
  prop: groups(G.PROP, G.WORLD | G.PROP | G.PLAYER | G.NPC | G.RAGDOLL | G.PROJECTILE | G.HELD),
  held: groups(G.HELD, G.WORLD | G.PROP | G.NPC | G.RAGDOLL | G.PROJECTILE | G.HELD),
  player: groups(G.PLAYER, G.WORLD | G.PROP | G.NPC),
  npc: groups(G.NPC, G.WORLD | G.PROP | G.PLAYER | G.NPC | G.PROJECTILE | G.HELD),
  ragdoll: groups(G.RAGDOLL, G.WORLD | G.PROP | G.RAGDOLL | G.PROJECTILE | G.HELD),
  debris: groups(G.DEBRIS, G.WORLD | G.PROP),
  trigger: groups(G.TRIGGER, G.PLAYER | G.PROP | G.NPC | G.RAGDOLL),
  nocollide: groups(G.PROP, G.WORLD),
};

export class Physics {
  constructor() {
    this.world = new R.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED;
    this.world.numSolverIterations = 6;
    this.events = new R.EventQueue(true);
    this.colliderOwner = new Map();   // collider handle -> entity
    this.noCollide = new Set();       // "h1|h2" body handle pairs
    this.waters = [];                 // { min, max, surface } boxes
    this.onImpact = null;             // (entityA, entityB, dv, colA, colB) => void
    this.onTrigger = null;            // (triggerCollider, otherCollider, started) => void
    this._ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const self = this;
    this.hooks = {
      filterContactPair(c1, c2, b1, b2) {
        if (b1 !== undefined && b2 !== undefined && self.noCollide.size) {
          const k = b1 < b2 ? b1 + '|' + b2 : b2 + '|' + b1;
          if (self.noCollide.has(k)) return null;
        }
        return R.SolverFlags.COMPUTE_IMPULSE;
      },
      filterIntersectionPair() { return true; },
    };
    this.fixedAnchor = this.world.createRigidBody(R.RigidBodyDesc.fixed());
  }

  pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  step() {
    this._buoyancy();
    this.world.step(this.events, this.hooks);
    this.events.drainContactForceEvents((e) => {
      const c1 = this.world.getCollider(e.collider1());
      const c2 = this.world.getCollider(e.collider2());
      if (!c1 || !c2 || !this.onImpact) return;
      const a = this.colliderOwner.get(c1.handle), b = this.colliderOwner.get(c2.handle);
      const ma = c1.parent()?.isDynamic() ? c1.parent().mass() : 0;
      const mb = c2.parent()?.isDynamic() ? c2.parent().mass() : 0;
      const m = ma && mb ? Math.min(ma, mb) : ma || mb || 1;
      // Force over one step on the lighter body approximates the velocity change of the hit.
      const dv = (e.totalForceMagnitude() * FIXED) / m;
      this.onImpact(a, b, dv, c1, c2);
    });
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!this.onTrigger) return;
      const c1 = this.world.getCollider(h1), c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;
      if (c1.isSensor()) this.onTrigger(c1, c2, started);
      if (c2.isSensor()) this.onTrigger(c2, c1, started);
    });
  }

  /** Buoyancy for bodies inside water boxes: up-force by submerged fraction, plus drag. */
  _buoyancy() {
    if (!this.waters.length) return;
    this.world.forEachActiveRigidBody((b) => {
      if (!b.isDynamic()) return;
      const p = b.translation();
      for (const w of this.waters) {
        if (p.x < w.min.x || p.x > w.max.x || p.z < w.min.z || p.z > w.max.z) continue;
        const e = b.userData?.entity;
        const h = e?.halfHeight ?? 0.5;
        const sub = Math.max(0, Math.min(1, (w.surface - (p.y - h)) / (2 * h)));
        if (sub <= 0) continue;
        const m = b.mass();
        const density = e?.density ?? 1;
        // Archimedes: buoyant force equals the weight of displaced water (density 1).
        const lift = (m / Math.max(0.1, density)) * GRAVITY * sub;
        b.applyImpulse({ x: 0, y: lift * FIXED, z: 0 }, true);
        const v = b.linvel(), av = b.angvel();
        const drag = 1 - Math.min(0.9, 2.2 * sub * FIXED);
        b.setLinvel({ x: v.x * drag, y: v.y * drag, z: v.z * drag }, true);
        b.setAngvel({ x: av.x * drag, y: av.y * drag, z: av.z * drag }, true);
        if (e && !e._wet && sub > 0.3 && Math.abs(v.y) > 2) { e._wet = true; e.onSplash?.(Math.abs(v.y)); }
        if (e && sub < 0.05) e._wet = false;
        break;
      }
    });
  }

  waterAt(p) {
    for (const w of this.waters) if (p.x > w.min.x && p.x < w.max.x && p.z > w.min.z && p.z < w.max.z && p.y < w.surface && p.y > w.min.y) return w;
    return null;
  }

  /** Raycast returning { point, normal, collider, entity, distance } or null. */
  raycast(origin, dir, maxDist, { exclude = null, excludeBody = null, groups: gr = undefined, predicate = undefined, solid = true } = {}) {
    this._ray.origin = origin;
    this._ray.dir = dir;
    const hit = this.world.castRayAndGetNormal(this._ray, maxDist, solid, undefined, gr, exclude || undefined, excludeBody || undefined, predicate);
    if (!hit) return null;
    const t = hit.timeOfImpact ?? hit.toi;
    return {
      distance: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: hit.normal,
      collider: hit.collider,
      entity: this.colliderOwner.get(hit.collider.handle) || null,
    };
  }

  /** Every entity whose collider overlaps a sphere. */
  overlapSphere(center, radius, filterGroups) {
    const out = new Set();
    const shape = new R.Ball(radius);
    this.world.intersectionsWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => {
      const e = this.colliderOwner.get(c.handle);
      if (e) out.add(e);
      return true;
    }, undefined, filterGroups);
    return out;
  }

  register(collider, entity) { this.colliderOwner.set(collider.handle, entity); }
  unregister(collider) { this.colliderOwner.delete(collider.handle); }

  dispose() {
    this.world.free();
    this.events.free();
    this.colliderOwner.clear();
  }
}
