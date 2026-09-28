/* Constraints created by the Tool Gun: weld, axis, ball socket, rope, elastic, no-collide.
   Each keeps enough data to be re-created by the duplicator and draws its own visual
   (ropes sag as a catenary-like curve). Anchors are stored in each body's local frame. */
import * as THREE from 'three';
import { R } from './physics.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const v3 = (v) => ({ x: v.x, y: v.y, z: v.z });

export class Constraint {
  constructor(game, type, a, b, data) {
    this.game = game;
    this.type = type;
    this.a = a;               // Entity
    this.b = b;               // Entity or null (= world)
    this.data = data;         // local anchors etc.
    this.joints = [];
    this.visual = null;
    this.removed = false;
    a.constraints.add(this);
    b?.constraints.add(this);
    game.constraints.add(this);
  }

  bodyB() { return this.b ? this.b.body : this.game.physics.fixedAnchor; }

  remove() {
    if (this.removed) return;
    this.removed = true;
    const w = this.game.physics.world;
    for (const j of this.joints) { try { w.removeImpulseJoint(j, true); } catch { /* body already gone */ } }
    this.joints.length = 0;
    if (this.type === 'nocollide' && this.a.body && this.b?.body) this.game.physics.noCollide.delete(this.game.physics.pairKey(this.a.body.handle, this.b.body.handle));
    this.a.constraints.delete(this);
    this.b?.constraints.delete(this);
    this.game.constraints.delete(this);
    if (this.visual) { this.visual.removeFromParent(); this.visual.geometry.dispose(); this.visual = null; }
    this.a.body?.wakeUp(); this.b?.body?.wakeUp();
  }

  update() {
    if (!this.visual) return;
    const pa = this.a.localToWorld(_a.fromArray(this.data.la));
    const pb = this.b ? this.b.localToWorld(_b.fromArray(this.data.lb)) : _b.fromArray(this.data.lb);
    const len = this.data.length ?? pa.distanceTo(pb);
    const pos = this.visual.geometry.attributes.position;
    const n = pos.count / 2;
    const dist = pa.distanceTo(pb);
    const sag = Math.max(0, len - dist) * 0.5 + 0.02 * dist;
    const side = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(this.data.width ?? 0.015);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = pa.x + (pb.x - pa.x) * t, z = pa.z + (pb.z - pa.z) * t;
      const y = pa.y + (pb.y - pa.y) * t - Math.sin(t * Math.PI) * sag;
      pos.setXYZ(i * 2, x - side.x, y - side.y + 0.012, z - side.z);
      pos.setXYZ(i * 2 + 1, x + side.x, y + side.y - 0.012, z + side.z);
    }
    pos.needsUpdate = true;
    this.visual.geometry.computeBoundingSphere();
  }

  serialize(indexOf) {
    return { type: this.type, a: indexOf(this.a), b: this.b ? indexOf(this.b) : -1, data: this.data };
  }
}

function ropeVisual(game, color = 0x4a3a28, width = 0.015) {
  const n = 16;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  m.castShadow = true;
  game.renderer.scene.add(m);
  void width;
  return m;
}

/* ------------------------------------------------------------------ factories
   All take world-space points. `b` may be null for "attach to world". */
export function weld(game, a, b) {
  const w = game.physics.world;
  const bodyB = b ? b.body : game.physics.fixedAnchor;
  // Joint frame = A's current pose, expressed in both bodies.
  const qa = a.curr.q, pa = a.curr.p;
  let anchor2, frame2;
  if (b) {
    anchor2 = b.worldToLocal(pa);
    frame2 = _q.copy(b.curr.q).invert().multiply(qa).clone();
  } else {
    anchor2 = pa.clone();
    frame2 = qa.clone();
  }
  const c = new Constraint(game, 'weld', a, b, { la: [0, 0, 0], lb: anchor2.toArray(), fb: frame2.toArray() });
  const jd = R.JointData.fixed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, v3(anchor2), { x: frame2.x, y: frame2.y, z: frame2.z, w: frame2.w });
  c.joints.push(w.createImpulseJoint(jd, a.body, bodyB, true));
  // welded pieces should not fight each other through contacts
  if (b) game.physics.noCollide.add(game.physics.pairKey(a.body.handle, b.body.handle)), enableHooks(a), enableHooks(b);
  return c;
}

export function ballsocket(game, a, b, worldPoint) {
  const w = game.physics.world;
  const la = a.worldToLocal(worldPoint);
  const lb = b ? b.worldToLocal(worldPoint) : worldPoint.clone();
  const c = new Constraint(game, 'ballsocket', a, b, { la: la.toArray(), lb: lb.toArray() });
  c.joints.push(w.createImpulseJoint(R.JointData.spherical(v3(la), v3(lb)), a.body, c.bodyB(), true));
  return c;
}

/** Hinge built from two ball joints on the axis line (works for any body orientation). */
export function axis(game, a, b, worldPoint, worldAxis, { friction = 0 } = {}) {
  const w = game.physics.world;
  const ax = new THREE.Vector3(worldAxis.x, worldAxis.y, worldAxis.z).normalize();
  const p0 = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
  const p1 = p0.clone().addScaledVector(ax, 0.35);
  const c = new Constraint(game, 'axis', a, b, { la: a.worldToLocal(p0).toArray(), lb: (b ? b.worldToLocal(p0) : p0).toArray(), la2: a.worldToLocal(p1).toArray(), lb2: (b ? b.worldToLocal(p1) : p1).toArray(), friction });
  for (const [x, y] of [[c.data.la, c.data.lb], [c.data.la2, c.data.lb2]]) {
    c.joints.push(w.createImpulseJoint(R.JointData.spherical({ x: x[0], y: x[1], z: x[2] }, { x: y[0], y: y[1], z: y[2] }), a.body, c.bodyB(), true));
  }
  if (b) { game.physics.noCollide.add(game.physics.pairKey(a.body.handle, b.body.handle)); enableHooks(a); enableHooks(b); }
  c.axisLocalA = a.worldToLocal(p1).sub(a.worldToLocal(p0)).normalize();
  return c;
}

export function rope(game, a, b, pa, pb, { slack = 0.2, width = 0.015, color = 0x4a3a28, length = null } = {}) {
  const w = game.physics.world;
  const la = a.worldToLocal(pa);
  const lb = b ? b.worldToLocal(pb) : new THREE.Vector3(pb.x, pb.y, pb.z);
  const len = length ?? (new THREE.Vector3(pa.x, pa.y, pa.z).distanceTo(new THREE.Vector3(pb.x, pb.y, pb.z)) + slack);
  const c = new Constraint(game, 'rope', a, b, { la: la.toArray(), lb: lb.toArray(), length: len, width });
  c.joints.push(w.createImpulseJoint(R.JointData.rope(len, v3(la), v3(lb)), a.body, c.bodyB(), true));
  c.visual = ropeVisual(game, color, width);
  c.update();
  return c;
}

export function elastic(game, a, b, pa, pb, { stiffness = 400, damping = 20 } = {}) {
  const w = game.physics.world;
  const la = a.worldToLocal(pa);
  const lb = b ? b.worldToLocal(pb) : new THREE.Vector3(pb.x, pb.y, pb.z);
  const rest = new THREE.Vector3(pa.x, pa.y, pa.z).distanceTo(new THREE.Vector3(pb.x, pb.y, pb.z));
  const c = new Constraint(game, 'elastic', a, b, { la: la.toArray(), lb: lb.toArray(), rest, stiffness, damping, width: 0.02 });
  const m = Math.max(1, a.mass);
  c.joints.push(w.createImpulseJoint(R.JointData.spring(rest, stiffness * m / 10, damping * m / 10, v3(la), v3(lb)), a.body, c.bodyB(), true));
  c.visual = ropeVisual(game, 0x2266cc, 0.02);
  c.update();
  return c;
}

export function nocollide(game, a, b) {
  if (!b?.body) return null;
  const c = new Constraint(game, 'nocollide', a, b, { la: [0, 0, 0], lb: [0, 0, 0] });
  game.physics.noCollide.add(game.physics.pairKey(a.body.handle, b.body.handle));
  enableHooks(a); enableHooks(b);
  return c;
}

function enableHooks(e) {
  for (const c of e.colliders) c.setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS);
}

/** Every entity connected to `e` through constraints (the "contraption"). */
export function contraption(e) {
  const seen = new Set([e]);
  const stack = [e];
  while (stack.length) {
    const x = stack.pop();
    const neighbours = [...x.constraints].flatMap((c) => [c.a, c.b]).concat([...x.attachments], x.parentEntity ? [x.parentEntity] : []);
    for (const n of neighbours) if (n && !seen.has(n)) { seen.add(n); stack.push(n); }
  }
  return [...seen];
}
