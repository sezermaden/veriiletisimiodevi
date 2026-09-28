/* Tool-placed devices: balloon, thruster, wheel, hoverball, dynamite, lamp.
   Each is a real physics entity welded (or roped) to what it was placed on, so forces flow
   through the constraint solver exactly like any other contraption part. Devices listen on
   contraption channels 1–6 (numpad / I-J-K-L-U-O / D-pad). */
import * as THREE from 'three';
import { Entity } from '../world/entities.js';
import { GROUPS, GRAVITY } from '../physics/physics.js';
import { weld, rope, axis } from '../physics/constraints.js';
import { material } from '../render/materials.js';
import { cyl, boxGeo, roundBox } from '../world/geometry.js';
import { Audio } from '../core/audio.js';

const std = (c, r = 0.5, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

/** Orientation whose +Y axis points along n. */
export function quatFromNormal(n) { return new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(n.x, n.y, n.z).normalize()); }

function make(game, kind, name, object3d, shapes, pos, quat, { density = 1, surface = 'metal', health = Infinity, gravityScale = 1, groups = GROUPS.prop } = {}) {
  object3d.position.copy(pos); object3d.quaternion.copy(quat);
  object3d.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const { body, colliders } = game.entities.buildBody(shapes, { pos, quat, density, surface, gravityScale, groups });
  const e = new Entity(game, { kind, name, object3d, body, colliders, surface, health, density, halfHeight: 0.2, owner: 'player' });
  e.baseGravityScale = gravityScale;
  game.entities.add(e);
  return e;
}

function attach(game, e, target, point) {
  if (!target) return null;
  e.parentEntity = target;
  target.attachments.add(e);
  const c = weld(game, e, target);
  void point;
  return c;
}

const channelDown = (game, ch) => game.channelDown(ch);

/* ------------------------------------------------------------------ balloon */
export function createBalloon(game, pos, { color = '#ff3030', force = 1, ropeLength = 2, target = null, point = null, normal = null } = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, emissive: color, emissiveIntensity: 0.08 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 18), skin);
  b.scale.set(1, 1.18, 1);
  b.userData.noTint = false;
  g.add(b);
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 10).rotateX(Math.PI), skin).translateY(-0.44));
  const start = point ? new THREE.Vector3(point.x, point.y, point.z).addScaledVector(normal ? new THREE.Vector3(normal.x, normal.y, normal.z) : Y, ropeLength) : pos;
  const e = make(game, 'balloon', 'Balloon', g, [{ ball: 0.36 }], start, new THREE.Quaternion(), { density: 0.02, surface: 'rubber', health: 1, gravityScale: 0 });
  e.data = { color, force, ropeLength };
  e.body.setLinearDamping(0.8);
  e.body.setAngularDamping(2);
  // Lift: GMod-style force setting maps to a buoyant force in Newtons.
  const lift = force * 420;
  e.behaviours.push(() => { if (e.body) e.body.applyImpulse({ x: 0, y: lift / 60, z: 0 }, true); });
  e.onDestroy = () => pop(game, e);
  e.maxHealth = 1; e.health = 1;
  if (point) {
    const tgt = target;
    const c = rope(game, e, tgt, e.curr.p.clone().add(new THREE.Vector3(0, -0.4, 0)), point, { length: ropeLength, width: 0.008, color: 0xe8e8e8 });
    e.parentEntity = tgt || null;
    tgt?.attachments.add(e);
    e.ropeConstraint = c;
  }
  Audio.play('balloon_inflate', { pos: e.curr.p });
  e.serializeData = () => e.data;
  return e;
}

function pop(game, e) {
  const p = e.curr.p.clone();
  Audio.play('balloon_pop', { pos: p });
  game.fx.sparks(p, null, 6, new THREE.Color(e.data?.color || '#ff3030').multiplyScalar(2), 3);
  for (let i = 0; i < 8; i++) game.fx.cube(p, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), 0.05, new THREE.Color(e.data?.color || '#ff3030').getHex(), 1);
  e.remove();
}

/* ------------------------------------------------------------------ thruster */
export function createThruster(game, point, normal, target, { force = 1, keyFwd = 1, keyBack = 2, toggle = false } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cyl(0.14, 0.18, 20), std('#5a6068', 0.4, 0.8)).translateY(0.09));
  g.add(new THREE.Mesh(cyl(0.1, 0.12, 20, 0.14), std('#2a2d31', 0.5, 0.7)).translateY(0.24));
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ff8a30', emissive: '#ff6a10', emissiveIntensity: 0.2, roughness: 0.4 });
  const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16).rotateX(-Math.PI / 2), glowMat);
  nozzle.position.y = 0.301;
  g.add(nozzle);
  const q = quatFromNormal(normal);
  const pos = new THREE.Vector3(point.x, point.y, point.z);
  const e = make(game, 'thruster', 'Thruster', g, [{ cyl: [0.14, 0.14], p: [0, 0.14, 0] }], pos, q, { density: 2 });
  e.data = { force, keyFwd, keyBack, toggle };
  attach(game, e, target, point);
  let on = 0, toggled = false, prevDown = false;
  const loop = Audio.loop('thruster', { pos, volume: 0.6 });
  e.onRemove = () => loop.stop();
  const thrust = force * 1800;
  e.behaviours.push(() => {
    if (!e.body) return;
    const f = channelDown(game, keyFwd), b = channelDown(game, keyBack);
    if (toggle) { if (f && !prevDown) toggled = !toggled; prevDown = f; on = toggled ? 1 : 0; }
    else on = (f ? 1 : 0) - (b ? 1 : 0);
    if (!on) return;
    // Pushes away from the surface it was placed on: thrust along -Y (the nozzle faces out).
    const r = e.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    const dir = _v.set(0, -1, 0).applyQuaternion(_q).multiplyScalar(thrust * on / 60);
    e.body.applyImpulse({ x: dir.x, y: dir.y, z: dir.z }, true);
  });
  e.visualUpdate = (dt) => {
    loop.set(on ? 1 : 0, 1);
    loop.move(e.curr.p);
    glowMat.emissiveIntensity = on ? 6 : 0.2;
    if (on) {
      const n = _v.set(0, on > 0 ? 1 : -1, 0).applyQuaternion(e.curr.q);
      const p = e.localToWorld(new THREE.Vector3(0, 0.32, 0));
      for (let i = 0; i < 3; i++) game.fx.add.emit(p, n.clone().multiplyScalar(6 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5))), { color: new THREE.Color(3, 1.6, 0.5), color1: new THREE.Color(0.8, 0.2, 0.05), size: 0.18, size1: 0.02, life: 0.25 });
      if (Math.random() < 0.3) game.fx.smokePuff(p.addScaledVector(n, 1), 1, new THREE.Color(0.5, 0.5, 0.5), 0.2);
    }
    void dt;
  };
  e.serializeData = () => e.data;
  return e;
}

/* ------------------------------------------------------------------ wheel */
export function createWheel(game, point, normal, target, { radius = 0.45, torque = 1, keyFwd = 1, keyBack = 2, friction = 1.2 } = {}) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, radius * 0.24, 12, 28).rotateX(Math.PI / 2), material('rubber'));
  const hub = new THREE.Mesh(cyl(radius * 0.58, radius * 0.4, 20), material('chrome'));
  const nut = new THREE.Mesh(cyl(radius * 0.12, radius * 0.5, 6), std('#333', 0.4, 0.8));
  g.add(tire, hub, nut);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(boxGeo(radius * 0.08, radius * 0.42, radius * 0.9), std('#9ea4ab', 0.3, 0.9));
    s.rotation.y = (i / 5) * Math.PI * 2; g.add(s);
  }
  const q = quatFromNormal(normal);
  const pos = new THREE.Vector3(point.x, point.y, point.z).addScaledVector(new THREE.Vector3(normal.x, normal.y, normal.z), radius * 0.26 + 0.03);
  const e = make(game, 'wheel', 'Wheel', g, [{ cyl: [radius * 0.24, radius] }], pos, q, { density: 3, surface: 'rubber' });
  for (const c of e.colliders) c.setFriction(friction);
  e.data = { radius, torque, keyFwd, keyBack };
  if (target) {
    e.parentEntity = target; target.attachments.add(e);
    axis(game, e, target, pos, normal);
  }
  const loop = Audio.loop('wheel', { pos, volume: 0.4 });
  e.onRemove = () => loop.stop();
  const T = torque * 140 * radius;
  let drive = 0;
  e.behaviours.push(() => {
    if (!e.body) return;
    drive = (channelDown(game, keyFwd) ? 1 : 0) - (channelDown(game, keyBack) ? 1 : 0);
    if (!drive) return;
    const r = e.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    const ax = _v.set(0, 1, 0).applyQuaternion(_q);
    const av = e.body.angvel();
    const spin = av.x * ax.x + av.y * ax.y + av.z * ax.z;
    if (spin * drive > 40) return;               // motor speed limit
    e.body.applyTorqueImpulse({ x: ax.x * T * drive / 60, y: ax.y * T * drive / 60, z: ax.z * T * drive / 60 }, true);
  });
  e.visualUpdate = () => { loop.set(drive ? 1 : 0, 1); loop.move(e.curr.p); };
  e.serializeData = () => e.data;
  return e;
}

/* ------------------------------------------------------------------ hoverball */
export function createHoverball(game, point, normal, target, { strength = 1, keyUp = 1, keyDown = 2 } = {}) {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshStandardMaterial({ color: '#5fd0ff', emissive: '#3fb0ff', emissiveIntensity: 1.5, roughness: 0.2 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), std('#dfe3e8', 0.2, 0.9)));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24).rotateX(Math.PI / 2), glowMat));
  const pos = new THREE.Vector3(point.x, point.y, point.z).addScaledVector(new THREE.Vector3(normal.x, normal.y, normal.z), 0.22);
  const e = make(game, 'hoverball', 'Hoverball', g, [{ ball: 0.2 }], pos, new THREE.Quaternion(), { density: 2 });
  e.data = { strength, keyUp, keyDown };
  attach(game, e, target, point);
  let targetY = pos.y;
  const loop = Audio.loop('hover', { pos, volume: 0.25 });
  e.onRemove = () => loop.stop();
  e.behaviours.push((dt) => {
    if (!e.body) return;
    if (channelDown(game, keyUp)) targetY += dt * 2.5;
    if (channelDown(game, keyDown)) targetY -= dt * 2.5;
    // PD controller on the whole contraption's mass (approximated by the parent's mass)
    const t = e.body.translation(), v = e.body.linvel();
    const m = (e.parentEntity?.mass || 0) + e.mass;
    const f = ((targetY - t.y) * 12 - v.y * 4 + GRAVITY) * m * strength;
    e.body.applyImpulse({ x: -v.x * m * 0.4 * dt, y: Math.max(0, f) * dt, z: -v.z * m * 0.4 * dt }, true);
  });
  e.visualUpdate = () => { loop.move(e.curr.p); loop.set(1, 1 + Math.abs(e.body?.linvel().y || 0) * 0.1); glowMat.emissiveIntensity = 1.5 + Math.sin(performance.now() / 150) * 0.5; };
  e.serializeData = () => e.data;
  return e;
}

/* ------------------------------------------------------------------ dynamite */
export function createDynamite(game, point, normal, target, { key = 5, damage = 1, remove = true } = {}) {
  const g = new THREE.Group();
  const red = std('#c62a1d', 0.7, 0);
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(cyl(0.045, 0.35, 12), red).translateX(-0.09 + i * 0.09).translateY(0.05));
  g.add(new THREE.Mesh(boxGeo(0.28, 0.04, 0.1), std('#222', 0.5, 0.2)).translateY(0.05));
  const fuse = new THREE.Mesh(cyl(0.006, 0.12, 5), std('#ddd', 0.8, 0)); fuse.position.set(0, 0.28, 0); g.add(fuse);
  const q = quatFromNormal(normal).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const pos = new THREE.Vector3(point.x, point.y, point.z).addScaledVector(new THREE.Vector3(normal.x, normal.y, normal.z), 0.06);
  const e = make(game, 'dynamite', 'Dynamite', g, [{ box: [0.15, 0.18, 0.05], p: [0, 0.05, 0] }], pos, q, { density: 1.5, health: 15 });
  e.data = { key, damage, remove };
  attach(game, e, target, point);
  let armed = 0;
  e.behaviours.push((dt) => {
    if (armed > 0) {
      armed -= dt;
      if (Math.random() < 0.6) game.fx.sparks(e.localToWorld(new THREE.Vector3(0, 0.34, 0)), null, 1, new THREE.Color(3, 2, 0.5), 1.5);
      if (armed <= 0) boom();
    } else if (channelDown(game, key)) { armed = 0.6; Audio.play('fire_ignite', { pos: e.curr.p, volume: 0.6 }); }
  });
  const boom = () => {
    if (e.removed) return;
    game.explode(e.curr.p.clone(), { radius: 5 * damage, damage: 120 * damage, force: 50 * damage }, e);
    e.remove();
  };
  e.onDestroy = boom;
  e.serializeData = () => e.data;
  return e;
}

/* ------------------------------------------------------------------ lamp */
export function createLamp(game, point, normal, target, { color = '#fff2d6', brightness = 1, key = 6, on = true } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundBox(0.16, 0.26, 0.16, 0.03), std('#30343a', 0.5, 0.7));
  body.position.y = 0.13;
  const lensMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: on ? 3 : 0, roughness: 0.2 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2), lensMat);
  lens.position.y = 0.261;
  g.add(body, lens);
  const light = new THREE.SpotLight(color, 60 * brightness, 30, 0.55, 0.5, 1.6);
  light.position.y = 0.27;
  light.target.position.set(0, 5, 0);
  light.castShadow = game.renderer.q.maxLights >= 12;
  light.shadow.mapSize.set(512, 512);
  g.add(light, light.target);
  light.visible = on;
  const q = quatFromNormal(normal);
  const pos = new THREE.Vector3(point.x, point.y, point.z);
  const e = make(game, 'lamp', 'Lamp', g, [{ box: [0.08, 0.13, 0.08], p: [0, 0.13, 0] }], pos, q, { density: 1 });
  e.data = { color, brightness, key, on };
  attach(game, e, target, point);
  let prev = false;
  e.behaviours.push(() => {
    const d = channelDown(game, key);
    if (d && !prev) { e.data.on = !e.data.on; light.visible = e.data.on; lensMat.emissiveIntensity = e.data.on ? 3 : 0; Audio.play('button', { pos: e.curr.p, volume: 0.4 }); }
    prev = d;
  });
  e.onRemove = () => { if (light.shadow.map) light.shadow.map.dispose(); light.dispose(); };
  e.serializeData = () => e.data;
  return e;
}

export const ATTACHMENT_FACTORIES = {
  thruster: (game, p, n, t, d) => createThruster(game, p, n, t, d),
  wheel: (game, p, n, t, d) => createWheel(game, p, n, t, d),
  hoverball: (game, p, n, t, d) => createHoverball(game, p, n, t, d),
  dynamite: (game, p, n, t, d) => createDynamite(game, p, n, t, d),
  lamp: (game, p, n, t, d) => createLamp(game, p, n, t, d),
};
