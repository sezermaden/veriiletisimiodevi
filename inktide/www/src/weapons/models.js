// Weapon meshes (chunky, toy-like, procedural) plus the small "rig" toolkit weapons use to pose
// the Squidkin arms and to anchor two-handed weapons (rollers, brushes, gatlings) to the body.
//
// Conventions
//   Hand-held models (charger, blaster, slosher, dualies) are built in WEAPON SPACE: origin at the
//   grip, +Z out of the muzzle, +Y up. They are wrapped in an outer group rotated +90° about X so
//   weapon +Z runs along the arm (hand local -Y), exactly like makeGunModel in weapons/base.js.
//   Anchored models (roller, brush, splatling) are built in BODY SPACE (+Z forward, +Y up) and are
//   re-placed every frame with anchorToRoot() so they sit where the pose wants them, whatever the
//   arm animation does.
//   Ink-coloured parts carry userData.inkPart = true (MainWeapon.setColor recolours them).
import * as THREE from 'three';
import { charMat, inkMat } from '../actors/materials.js';

const DARK = '#2b2e38';
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _mA = new THREE.Matrix4();
const _mB = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);

// ---------------------------------------------------------------------------------------------
// small builders
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function ink(m) { m.userData.inkPart = true; return m; }
/** Cylinder along +Z. */
function cylZ(rt, rb, len, seg = 14, open = false) {
  return new THREE.CylinderGeometry(rt, rb, len, seg, 1, open).rotateX(Math.PI / 2);
}
/** Cylinder along X. */
function cylX(r, len, seg = 16) { return new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2); }
function rbox(w, h, d, r = 0.015) {
  // cheap rounded box: a box with bevel-ish chamfer via a scaled capsule-free approach (keeps tri count low)
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const p = g.attributes.position;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ex = Math.abs(x) > hw - 1e-4, ey = Math.abs(y) > hh - 1e-4, ez = Math.abs(z) > hd - 1e-4;
    if ((ex && ey) || (ex && ez) || (ey && ez)) {
      x -= Math.sign(x) * r * 0.6; y -= Math.sign(y) * r * 0.6; z -= Math.sign(z) * r * 0.6;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
function marker(parent, name, x, y, z) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
function handHeld(inner, scale = 1) {
  const g = new THREE.Group();
  g.add(inner);
  inner.scale.setScalar(scale);
  g.rotation.set(Math.PI / 2, 0, 0);
  g.userData.inner = inner;
  return g;
}
export function glowMat(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

// ---------------------------------------------------------------------------------------------
// MAINS

/** Wave Roller: wide ink drum on a fork, long handle. Body space, origin at the shoulder pivot,
 *  the whole assembly points down +Z (the pose rotates it about X). Returns group with
 *  userData { spin, R, grips: [right, left] }. */
export function makeRollerModel(color) {
  const R = 1.2;
  const g = new THREE.Group();
  const frame = charMat(DARK, { roughness: 0.45 });
  const handleM = charMat('#f3efe6', { roughness: 0.5 });
  const gripM = charMat('#e8484f', { roughness: 0.7 });
  const inkM = inkMat(color);
  const width = 0.82, rad = 0.165;
  // drum (spins about X)
  const spin = new THREE.Group();
  spin.position.set(0, 0, R);
  g.add(spin);
  const drum = ink(mesh(cylX(rad, width, 28), inkM));
  spin.add(drum);
  // nap grooves + dripping lip so the spin reads
  for (const x of [-0.26, 0, 0.26]) {
    const groove = mesh(new THREE.TorusGeometry(rad + 0.003, 0.012, 6, 28).rotateY(Math.PI / 2), frame, x, 0, 0);
    spin.add(groove);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bump = ink(mesh(new THREE.SphereGeometry(0.035, 8, 6), inkM, (Math.random() - 0.5) * 0.6, Math.cos(a) * rad, Math.sin(a) * rad));
    bump.scale.set(1.6, 0.6, 1);
    spin.add(bump);
  }
  const capGeo = cylX(0.07, 0.05, 16);
  spin.add(mesh(capGeo, frame, width / 2 + 0.02, 0, 0), mesh(capGeo, frame, -width / 2 - 0.02, 0, 0));
  // fork: crossbar + two arms to the axle
  const barZ = R - 0.32;
  g.add(mesh(rbox(width + 0.14, 0.05, 0.06, 0.02), frame, 0, 0, barZ));
  for (const s of [-1, 1]) {
    const arm = mesh(rbox(0.04, 0.04, 0.34, 0.012), frame, s * (width / 2 + 0.06), 0, barZ + 0.16);
    g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), frame, s * (width / 2 + 0.06), 0, R));
  }
  // yellow hazard stripe on the crossbar
  g.add(mesh(rbox(0.3, 0.056, 0.066, 0.01), charMat('#ffd23f', { roughness: 0.5 }), 0, 0, barZ));
  // handle: grip end at z≈0.28 (hands), shaft to the crossbar
  const shaftLen = barZ - 0.28;
  g.add(mesh(cylZ(0.022, 0.022, shaftLen, 10), handleM, 0, 0, 0.28 + shaftLen / 2));
  g.add(mesh(cylZ(0.031, 0.031, 0.22, 12), gripM, 0, 0, 0.36));
  g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), gripM, 0, 0, 0.245));
  // small ink reservoir on the shaft
  g.add(ink(mesh(cylZ(0.045, 0.045, 0.16, 14), inkM, 0, 0.045, 0.62)));
  g.add(mesh(cylZ(0.05, 0.05, 0.025, 14), frame, 0, 0.045, 0.54), mesh(cylZ(0.05, 0.05, 0.025, 14), frame, 0, 0.045, 0.7));
  g.userData.spin = spin;
  g.userData.R = R;
  g.userData.rad = rad;
  g.userData.width = width;
  g.userData.grips = [new THREE.Vector3(0, 0, 0.33), new THREE.Vector3(0, 0, 0.52)];
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Longshot charger: long rifle with a scope. Hand-held. userData: muzzle, foregrip, glow. */
export function makeChargerModel(color) {
  const w = new THREE.Group();
  const body = charMat('#eef1f5', { roughness: 0.38 });
  const dark = charMat(DARK, { roughness: 0.5 });
  const inkM = inkMat(color);
  w.add(mesh(rbox(0.08, 0.11, 0.34, 0.02), body, 0, 0.03, 0.1));                  // receiver
  const stock = mesh(rbox(0.065, 0.12, 0.24, 0.02), dark, 0, -0.005, -0.16);       // stock
  stock.rotation.x = 0.12;
  w.add(stock);
  w.add(mesh(rbox(0.07, 0.03, 0.05, 0.01), dark, 0, -0.03, -0.29));                // butt pad
  w.add(mesh(cylZ(0.021, 0.024, 0.56, 12), dark, 0, 0.045, 0.53));                // barrel
  w.add(ink(mesh(cylZ(0.034, 0.034, 0.22, 14), inkM, 0, 0.045, 0.38)));           // ink shroud
  for (const z of [0.27, 0.49]) w.add(mesh(cylZ(0.038, 0.038, 0.02, 14), body, 0, 0.045, z));
  w.add(ink(mesh(new THREE.TorusGeometry(0.026, 0.01, 6, 14), inkM, 0, 0.045, 0.81))); // muzzle ring
  // scope
  w.add(mesh(cylZ(0.03, 0.03, 0.24, 14), dark, 0, 0.125, 0.11));
  w.add(mesh(cylZ(0.04, 0.03, 0.05, 14), dark, 0, 0.125, 0.245));
  w.add(mesh(rbox(0.02, 0.04, 0.03, 0.005), dark, 0, 0.09, 0.04), mesh(rbox(0.02, 0.04, 0.03, 0.005), dark, 0, 0.09, 0.18));
  const lens = mesh(new THREE.CircleGeometry(0.034, 16), new THREE.MeshBasicMaterial({ color: '#9fe8ff', toneMapped: false }), 0, 0.125, 0.271);
  w.add(lens);
  // canister under the receiver + grip + trigger guard
  w.add(ink(mesh(cylZ(0.035, 0.035, 0.12, 12), inkM, 0, -0.045, 0.18)));
  const grip = mesh(rbox(0.05, 0.12, 0.055, 0.015), dark, 0, -0.055, 0.0);
  grip.rotation.x = 0.28;
  w.add(grip);
  w.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 5, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), dark, 0, -0.02, 0.06));
  const glow = mesh(new THREE.SphereGeometry(0.05, 12, 8), glowMat(color, 0.0), 0, 0.045, 0.83);
  glow.castShadow = false;
  glow.userData.inkPart = true;
  w.add(glow);
  const g = handHeld(w);
  g.userData.muzzle = marker(w, 'muzzle', 0, 0.045, 0.84);
  g.userData.foregrip = marker(w, 'foregrip', 0, -0.01, 0.34);
  g.userData.glow = glow;
  return g;
}

/** Burst Popper blaster: bulky body, round bell muzzle, dome ink tank. Hand-held. */
export function makeBlasterModel(color, bodyColor = '#ffcc33') {
  const w = new THREE.Group();
  const body = charMat(bodyColor, { roughness: 0.42 });
  const dark = charMat(DARK, { roughness: 0.5 });
  const inkM = inkMat(color);
  w.add(mesh(rbox(0.12, 0.14, 0.27, 0.035), body, 0, 0.035, 0.08));
  w.add(mesh(rbox(0.13, 0.03, 0.22, 0.01), dark, 0, -0.03, 0.08));                    // belly band
  const bell = mesh(cylZ(0.085, 0.05, 0.13, 20, true), dark, 0, 0.04, 0.28);
  bell.material = charMat(DARK, { roughness: 0.5, side: THREE.DoubleSide });
  w.add(bell);
  w.add(ink(mesh(new THREE.TorusGeometry(0.083, 0.016, 8, 22), inkM, 0, 0.04, 0.345)));
  w.add(ink(mesh(new THREE.CircleGeometry(0.06, 18), inkM, 0, 0.04, 0.26)));          // ink inside the bell
  // dome tank
  const dome = ink(mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), inkM, 0, 0.1, 0.03));
  w.add(dome);
  w.add(mesh(cylZ(0.075, 0.075, 0.02, 16).rotateX(Math.PI / 2), dark, 0, 0.1, 0.03));
  // fins on the side
  for (const s of [-1, 1]) {
    const fin = mesh(rbox(0.02, 0.07, 0.1, 0.008), dark, s * 0.07, 0.05, 0.17);
    w.add(fin);
  }
  const grip = mesh(rbox(0.055, 0.12, 0.06, 0.015), dark, 0, -0.06, 0.0);
  grip.rotation.x = 0.25;
  w.add(grip);
  const g = handHeld(w, 1.22);
  g.userData.muzzle = marker(w, 'muzzle', 0, 0.04, 0.36);
  g.userData.foregrip = marker(w, 'foregrip', 0, -0.02, 0.17);
  return g;
}

/** Slosh Bucket: a bucket held by its handle. Hand-held (hangs below the hand in the aim pose). */
export function makeSlosherModel(color) {
  const w = new THREE.Group();
  const metal = charMat('#d9dfe6', { roughness: 0.32, metalness: 0.25, side: THREE.DoubleSide });
  const band = charMat('#3f6df0', { roughness: 0.55 });
  const dark = charMat(DARK, { roughness: 0.5 });
  const inkM = inkMat(color);
  const hang = new THREE.Group();        // pivots at the grip so the bucket swings from the hand
  w.add(hang);
  const bucket = new THREE.Group();
  hang.add(bucket);
  bucket.add(mesh(new THREE.CylinderGeometry(0.14, 0.105, 0.22, 22, 1, true), metal));
  bucket.add(mesh(new THREE.CircleGeometry(0.105, 22).rotateX(Math.PI / 2), metal, 0, -0.11, 0));
  bucket.add(mesh(new THREE.TorusGeometry(0.14, 0.013, 6, 24).rotateX(Math.PI / 2), dark, 0, 0.11, 0));
  bucket.add(mesh(new THREE.CylinderGeometry(0.128, 0.122, 0.05, 22, 1, true), band, 0, 0.02, 0));
  const surface = ink(mesh(new THREE.CircleGeometry(0.128, 22).rotateX(-Math.PI / 2), inkM, 0, 0.085, 0));
  bucket.add(surface);
  // ink dribbles down the outside
  for (const a of [0.4, 2.2, 4.1]) {
    const d = ink(mesh(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), inkM, Math.cos(a) * 0.137, 0.06, Math.sin(a) * 0.137));
    bucket.add(d);
  }
  // handle arc over the top to the hand
  const arc = mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20, Math.PI), dark, 0, 0.11, 0);
  bucket.add(arc);
  bucket.add(mesh(cylX(0.022, 0.1, 10), charMat('#ffd23f', { roughness: 0.6 }), 0, 0.25, 0));
  const g = handHeld(w, 1.4);
  // hold at the handle: the arc top sits at the grip (origin)
  bucket.position.set(0, -0.25, 0);
  g.userData.muzzle = marker(bucket, 'muzzle', 0, 0.12, 0);
  g.userData.bucket = hang;
  g.userData.surface = surface;
  return g;
}

/** Gatling Spinner: gatling with a spinning barrel cluster and an ink drum. Body space, origin at
 *  the hip grip, +Z forward. userData: spin, muzzle. */
export function makeSplatlingModel(color) {
  const g = new THREE.Group();
  const k = new THREE.Group();
  const S = 1.22;
  k.scale.setScalar(S);
  g.add(k);
  const gun = charMat('#5b6477', { roughness: 0.4, metalness: 0.2 });
  const dark = charMat(DARK, { roughness: 0.5 });
  const accent = charMat('#ffd23f', { roughness: 0.5 });
  const inkM = inkMat(color);
  k.add(mesh(rbox(0.18, 0.18, 0.36, 0.045), gun, 0, 0.02, 0.1));                         // housing
  k.add(mesh(rbox(0.19, 0.045, 0.22, 0.012), accent, 0, 0.1, 0.12));                     // stripe
  k.add(mesh(cylZ(0.09, 0.09, 0.05, 20), dark, 0, 0.02, 0.3));                            // front collar
  const spin = new THREE.Group();
  spin.position.set(0, 0.02, 0.32);
  k.add(spin);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spin.add(mesh(cylZ(0.02, 0.02, 0.44, 8), dark, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.22));
  }
  spin.add(mesh(cylZ(0.075, 0.075, 0.03, 18), gun, 0, 0, 0.12));
  spin.add(mesh(cylZ(0.077, 0.077, 0.035, 18), gun, 0, 0, 0.42));
  spin.add(ink(mesh(new THREE.TorusGeometry(0.064, 0.013, 6, 18), inkM, 0, 0, 0.445)));
  // ink drum on top-back with dark caps
  k.add(ink(mesh(cylX(0.11, 0.22, 22), inkM, 0, 0.2, -0.03)));
  k.add(mesh(cylX(0.115, 0.03, 22), dark, 0.12, 0.2, -0.03), mesh(cylX(0.115, 0.03, 22), dark, -0.12, 0.2, -0.03));
  k.add(mesh(cylX(0.03, 0.3, 10), dark, 0, 0.2, -0.03));
  // carry handle + rear grip
  k.add(mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 16, Math.PI).rotateY(Math.PI / 2), dark, 0, 0.11, 0.2));
  const grip = mesh(rbox(0.05, 0.14, 0.06, 0.015), dark, -0.02, -0.1, -0.04);
  grip.rotation.x = 0.3;
  k.add(grip);
  g.userData.spin = spin;
  g.userData.muzzle = marker(k, 'muzzle', 0, 0.02, 0.78);
  g.userData.grips = [new THREE.Vector3(-0.02, -0.08, -0.03).multiplyScalar(S), new THREE.Vector3(0, 0.15, 0.2).multiplyScalar(S)];
  return g;
}

/** Swift Brush: long handle, metal ferrule, cream bristles with an ink-soaked tip. Body space,
 *  origin at the grip, +Z toward the head. userData: head, len. */
export function makeBrushModel(color) {
  const g = new THREE.Group();
  const wood = charMat('#c98a4b', { roughness: 0.55 });
  const rubber = charMat(DARK, { roughness: 0.8 });
  const metal = charMat('#c7ced8', { roughness: 0.25, metalness: 0.6 });
  const bristle = charMat('#f3e4c2', { roughness: 0.85 });
  const inkM = inkMat(color);
  const L = 0.78;
  g.add(mesh(cylZ(0.022, 0.026, L, 10), wood, 0, 0, L / 2));
  g.add(mesh(cylZ(0.03, 0.03, 0.18, 12), rubber, 0, 0, 0.1));
  g.add(mesh(new THREE.SphereGeometry(0.034, 10, 8), rubber, 0, 0, 0.0));
  const head = new THREE.Group();
  head.position.z = L;
  g.add(head);
  // ferrule: flattened metal collar + red band
  head.add(mesh(rbox(0.36, 0.1, 0.13, 0.03), metal, 0, 0, 0.05));
  head.add(mesh(rbox(0.37, 0.105, 0.03, 0.01), charMat('#e8484f', { roughness: 0.6 }), 0, 0, -0.005));
  // bristle body: wide tapered block that flares out
  const bGeo = new THREE.BoxGeometry(0.36, 0.1, 0.22, 4, 1, 4);
  const p = bGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = 1 + (z + 0.11) * 0.55;
    p.setX(i, p.getX(i) * k);
    p.setY(i, p.getY(i) * (1 - (z + 0.11) * 1.2));
  }
  bGeo.computeVertexNormals();
  head.add(mesh(bGeo, bristle, 0, 0, 0.22));
  // ink-soaked tip: fat squashed capsules fanned across the width, the middle ones longest
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.062;
    const tip = ink(mesh(new THREE.CapsuleGeometry(0.036, 0.1, 4, 10).rotateX(Math.PI / 2), inkM, x, 0, 0.39 - Math.abs(i - 3) * 0.014));
    tip.scale.set(1.0, 0.7, 1);
    head.add(tip);
  }
  // a couple of drips hanging off the tip
  for (const x of [-0.08, 0.1]) head.add(ink(mesh(new THREE.SphereGeometry(0.026, 8, 6), inkM, x, -0.035, 0.44)));
  g.userData.head = head;
  g.userData.len = L + 0.34;
  g.userData.grips = [new THREE.Vector3(0, 0, 0.08), new THREE.Vector3(0, 0, 0.3)];
  return g;
}

/** One Twin Dualie pistol. Hand-held. */
export function makeDualieModel(color, mirror = false) {
  const w = new THREE.Group();
  const body = charMat('#7fd3ff', { roughness: 0.4 });
  const dark = charMat(DARK, { roughness: 0.5 });
  const inkM = inkMat(color);
  w.add(mesh(rbox(0.07, 0.09, 0.22, 0.02), body, 0, 0.025, 0.07));
  w.add(mesh(cylZ(0.022, 0.026, 0.09, 12), dark, 0, 0.04, 0.22));
  w.add(ink(mesh(new THREE.TorusGeometry(0.025, 0.009, 6, 14), inkM, 0, 0.04, 0.27)));
  const can = ink(mesh(cylZ(0.03, 0.03, 0.1, 12), inkM, (mirror ? -1 : 1) * 0.05, 0.03, 0.06));
  w.add(can);
  w.add(mesh(rbox(0.075, 0.02, 0.1, 0.006), dark, 0, 0.075, 0.07));
  const grip = mesh(rbox(0.05, 0.11, 0.055, 0.015), dark, 0, -0.05, 0.0);
  grip.rotation.x = 0.22;
  w.add(grip);
  const g = handHeld(w, 1.12);
  g.userData.muzzle = marker(w, 'muzzle', 0, 0.04, 0.28);
  return g;
}

// ---------------------------------------------------------------------------------------------
// SUBS / SPECIALS

/** Sprinkler: squat base, spinning three-arm head. +Y = surface normal. userData.head. */
export function makeSprinklerModel(color) {
  const g = new THREE.Group();
  const dark = charMat(DARK, { roughness: 0.5 });
  const body = charMat('#e9edf2', { roughness: 0.4 });
  const inkM = inkMat(color);
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 18), dark, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 18), body, 0, 0.09, 0));
  g.add(ink(mesh(new THREE.TorusGeometry(0.115, 0.014, 6, 20).rotateX(Math.PI / 2), inkM, 0, 0.13, 0)));
  const head = new THREE.Group();
  head.position.y = 0.16;
  g.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 10), dark, 0, 0.03, 0));
  head.add(ink(mesh(new THREE.SphereGeometry(0.045, 12, 8), inkM, 0, 0.09, 0)));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8).rotateZ(Math.PI / 2), body, Math.cos(a) * 0.065, 0.07, Math.sin(a) * 0.065);
    arm.rotation.y = -a;
    head.add(arm);
    const tip = ink(mesh(new THREE.SphereGeometry(0.022, 8, 6), inkM, Math.cos(a) * 0.13, 0.07, Math.sin(a) * 0.13));
    head.add(tip);
  }
  g.userData.head = head;
  g.scale.setScalar(1.35);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const outer = new THREE.Group();       // callers scale/pop the outer group freely
  outer.add(g);
  outer.userData.head = head;
  return outer;
}

/** Ink Mine: low disc with a glowing ring. userData: ring, light. */
export function makeMineModel(color) {
  const g = new THREE.Group();
  const dark = charMat('#3a3d49', { roughness: 0.55, transparent: true, opacity: 0.85 });
  const inkM = inkMat(color);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 22), dark, 0, 0.03, 0));
  const top = ink(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.035, 22), inkM, 0, 0.075, 0));
  g.add(top);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), dark, Math.cos(a) * 0.2, 0.07, Math.sin(a) * 0.2));
  }
  const light = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4b0', toneMapped: false }), 0, 0.1, 0);
  g.add(light);
  const ring = mesh(new THREE.RingGeometry(0.26, 0.31, 32).rotateX(-Math.PI / 2), glowMat(color, 0.5), 0, 0.012, 0);
  ring.castShadow = false;
  ring.userData.inkPart = true;
  g.add(ring);
  g.userData.ring = ring;
  g.userData.light = light;
  g.userData.top = top;
  return g;
}

/** Ink missile: +Z forward. userData.flame. */
export function makeMissileModel(color) {
  const g = new THREE.Group();
  const inkM = inkMat(color);
  const white = charMat('#f6f6f2', { roughness: 0.4 });
  const dark = charMat(DARK, { roughness: 0.5 });
  g.add(ink(mesh(cylZ(0.065, 0.065, 0.36, 14), inkM, 0, 0, 0)));
  g.add(mesh(new THREE.ConeGeometry(0.065, 0.16, 14).rotateX(Math.PI / 2), white, 0, 0, 0.26));
  g.add(mesh(cylZ(0.068, 0.068, 0.04, 14), white, 0, 0, 0.1));
  for (let i = 0; i < 4; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.012, 0.09, 0.1), dark, 0, 0, -0.14);
    fin.rotation.z = (i / 4) * Math.PI * 2;
    fin.translateY(0.08);
    g.add(fin);
  }
  const flame = mesh(new THREE.ConeGeometry(0.06, 0.3, 10, 1, true).rotateX(-Math.PI / 2), glowMat('#fff1b8', 0.95), 0, 0, -0.33);
  flame.castShadow = false;
  const flame2 = mesh(new THREE.ConeGeometry(0.085, 0.42, 10, 1, true).rotateX(-Math.PI / 2), glowMat(color, 0.7), 0, 0, -0.38);
  flame2.castShadow = false;
  flame2.userData.inkPart = true;
  g.add(flame, flame2);
  g.userData.flame = [flame, flame2];
  return g;
}

/** Missile pod worn on the back during Missile Barrage (+Z = up out of the pod). */
export function makeMissilePodModel(color) {
  const g = new THREE.Group();
  const dark = charMat(DARK, { roughness: 0.5 });
  const body = charMat('#eef1f5', { roughness: 0.4 });
  const inkM = inkMat(color);
  g.add(mesh(rbox(0.34, 0.3, 0.2, 0.04), body, 0, 0, 0));
  g.add(mesh(rbox(0.36, 0.06, 0.22, 0.02), charMat('#ffd23f', { roughness: 0.5 }), 0, -0.1, 0));
  const tubes = [];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 ? 1 : -1) * 0.075, y = (i < 2 ? 1 : -1) * 0.06 + 0.03;
    const t = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14, 1, true), dark, x, 0.17, y);
    t.material = charMat(DARK, { roughness: 0.5, side: THREE.DoubleSide });
    g.add(t);
    g.add(ink(mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14).rotateX(Math.PI / 2), inkM, x, 0.22, y)));
    tubes.push(new THREE.Vector3(x, 0.2, y));
  }
  g.userData.tubes = tubes;
  return g;
}

/** Ink Jet pack: twin thrusters with flames. userData.flames: [{core, outer, nozzle}], tubes. */
export function makeJetpackModel(color) {
  const g = new THREE.Group();
  const dark = charMat(DARK, { roughness: 0.45, metalness: 0.2 });
  const body = charMat('#eef1f5', { roughness: 0.38 });
  const inkM = inkMat(color);
  g.add(mesh(rbox(0.22, 0.26, 0.12, 0.03), body, 0, 0.02, 0));
  g.add(ink(mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 12), inkM, 0, 0.04, -0.07)));
  const flames = [];
  for (const s of [-1, 1]) {
    const x = s * 0.15;
    g.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 16), body, x, 0.02, -0.02));
    g.add(ink(mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 16), inkM, x, 0.09, -0.02)));
    g.add(mesh(new THREE.ConeGeometry(0.066, 0.08, 16, 1, true).rotateX(Math.PI), dark, x, -0.16, -0.02));
    g.add(mesh(new THREE.SphereGeometry(0.066, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark, x, 0.16, -0.02));
    // flame cones hang from the nozzle (geometry pivots at the nozzle so scale.y stretches them down)
    const core = mesh(new THREE.ConeGeometry(0.06, 0.5, 10, 1, true).rotateX(Math.PI).translate(0, -0.25, 0), glowMat('#fff3c4', 0.95), x, -0.2, -0.02);
    const outer = mesh(new THREE.ConeGeometry(0.1, 0.85, 12, 1, true).rotateX(Math.PI).translate(0, -0.42, 0), glowMat(color, 0.7), x, -0.2, -0.02);
    outer.userData.inkPart = true;
    core.castShadow = outer.castShadow = false;
    g.add(core, outer);
    flames.push({ core, outer, nozzle: new THREE.Vector3(x, -0.2, -0.02) });
  }
  // shoulder cannon rails
  g.userData.flames = flames;
  return g;
}

/** A soft, puffy ink raincloud. userData.puffs (meshes), under (dark underside). */
export function makeCloudModel(color) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  // opaque: 17 overlapping puffs as a transparent pass cost a lot of overdraw for an invisible 3 %
  const top = new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.3), roughness: 0.95, emissive: c, emissiveIntensity: 0.22 });
  const under = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.5), roughness: 0.9, emissive: c, emissiveIntensity: 0.3 });
  top.userData.inkTint = 0.45; under.userData.inkTint = -0.45;
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const puffs = [];
  const layout = [
    [0, 0.35, 0, 1.25], [1.1, 0.15, 0.3, 0.95], [-1.1, 0.2, -0.2, 1.0], [0.4, 0.2, 1.0, 0.85], [-0.5, 0.15, 0.95, 0.8],
    [0.5, 0.1, -1.0, 0.9], [-0.6, 0.1, -1.0, 0.85], [1.9, -0.05, -0.2, 0.7], [-1.9, 0, 0.3, 0.72], [0, 0.95, 0.1, 0.8],
    [0.9, 0.7, -0.4, 0.62], [-0.8, 0.75, 0.4, 0.6],
  ];
  for (const [x, y, z, r] of layout) {
    const m = new THREE.Mesh(geo, top);
    m.position.set(x, y, z);
    m.scale.set(r, r * 0.78, r);
    m.userData.base = m.position.clone();
    m.userData.r = r;
    g.add(m);
    puffs.push(m);
  }
  for (const [x, z, r] of [[0, 0, 1.5], [1.1, 0.2, 1.0], [-1.1, -0.1, 1.05], [0.2, 0.9, 0.9], [-0.3, -0.9, 0.95]]) {
    const m = new THREE.Mesh(geo, under);
    m.position.set(x, -0.25, z);
    m.scale.set(r, r * 0.42, r);
    m.userData.base = m.position.clone();
    m.userData.r = r;
    g.add(m);
    puffs.push(m);
  }
  g.userData.puffs = puffs;
  g.userData.mats = [top, under];
  return g;
}

let _reticleTex = null;
/** Lock-on reticle texture: white strokes on a dark outline (tint with SpriteMaterial.color — the
 *  outline stays dark, so the reticle reads on bright walls and on the team's own ink alike). */
export function reticleTexture() {
  if (_reticleTex) return _reticleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.translate(64, 64);
  x.lineCap = 'round';
  const shape = (col, grow) => {
    x.strokeStyle = col; x.fillStyle = col;
    x.lineWidth = 7 + grow;
    x.beginPath(); x.arc(0, 0, 38, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 9 + grow;
    for (let i = 0; i < 4; i++) {
      x.save();
      x.rotate((i * Math.PI) / 2 + Math.PI / 4);
      x.beginPath(); x.moveTo(0, -55); x.lineTo(0, -45); x.stroke();
      x.restore();
    }
    x.beginPath(); x.arc(0, 0, 7 + grow / 2, 0, Math.PI * 2); x.fill();
  };
  shape('rgba(18,20,34,0.85)', 6);
  shape('#ffffff', 0);
  _reticleTex = new THREE.CanvasTexture(c);
  _reticleTex.colorSpace = THREE.SRGBColorSpace;
  _reticleTex.userData.cached = true;      // module-wide: disposeTree() must not free it
  return _reticleTex;
}

let _glowTex = null;
/** Soft round glow sprite texture (white). */
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  _glowTex.userData.cached = true;
  return _glowTex;
}

/** Recolour every ink part in a subtree (userData.inkPart). */
export function tintInk(root, color) {
  root.traverse((o) => {
    if (!o.userData.inkPart || !o.material) return;
    o.material.color.set(color);
    if (o.material.emissive && o.material.emissiveIntensity > 0) o.material.emissive.set(color);
  });
}

// ---------------------------------------------------------------------------------------------
// RIG: per-frame pose hooks, anchoring and arm reach on a SquidkinModel

/**
 * Register fn(dt, s, model) to run right after model.update() every rendered frame (after the
 * built-in animation, so it can override arm poses). Returns an unsubscribe function.
 */
export function addPoseHook(model, fn) {
  if (!model || typeof model.update !== 'function') return () => {};
  if (!model.__poseHooks) {
    model.__poseHooks = [];
    const orig = model.update;
    model.update = function (dt, s) {
      orig.call(this, dt, s);
      const hooks = this.__poseHooks;
      for (let i = 0; i < hooks.length; i++) hooks[i](dt, s, this);
    };
  }
  model.__poseHooks.push(fn);
  return () => {
    const i = model.__poseHooks.indexOf(fn);
    if (i >= 0) model.__poseHooks.splice(i, 1);
  };
}

/**
 * Place `obj` (a child of some bone, e.g. the weapon socket) so that it appears at `local` — a
 * Matrix4 in the character root's space — regardless of the bone's current pose.
 */
export function anchorToRoot(obj, model, local) {
  if (!obj.parent) return;
  model.root.updateMatrixWorld(true);
  _mA.multiplyMatrices(model.root.matrixWorld, local);
  _mB.copy(obj.parent.matrixWorld).invert();
  _mA.premultiply(_mB);
  _mA.decompose(obj.position, obj.quaternion, obj.scale);
  obj.updateMatrixWorld(true);
}

/**
 * Two-bone reach: point arm A ({sh, elbow}) of the model at a world-space target, bending the
 * elbow when the target is closer than the arm length. Call after model.root.updateMatrixWorld().
 */
export function reachArm(A, target, minBend = 0.12) {
  const sh = A.sh;
  sh.parent.updateWorldMatrix(true, false);
  const shW = _v.setFromMatrixPosition(sh.matrixWorld);
  const d = Math.max(0.08, _v2.subVectors(target, shW).length());
  _v2.divideScalar(d);
  sh.parent.getWorldQuaternion(_q).invert();
  _v2.applyQuaternion(_q);
  sh.quaternion.setFromUnitVectors(DOWN, _v2);
  const a = 0.17, b = 0.17;
  let e = minBend, alpha = 0;
  if (d < a + b - 0.005) {
    const c = THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
    e = Math.max(minBend, Math.PI - Math.acos(c));
    alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  } else {
    alpha = minBend * 0.5;
  }
  sh.rotateX(alpha);
  A.elbow.rotation.set(-e, 0, 0);
}

const _mC = new THREE.Matrix4();
const _g1 = new THREE.Vector3();
const _g2 = new THREE.Vector3();
/**
 * Two-handed hold: `local` is the weapon's root-space matrix, `grips` two points in weapon space
 * (gun hand, off hand). Arms reach first, then the weapon is anchored (its socket moved with the
 * gun arm, so the order matters).
 */
export function holdTwoHanded(obj, m, local, grips, bend = 0.3) {
  m.root.updateMatrixWorld(true);
  _mC.multiplyMatrices(m.root.matrixWorld, local);
  const off = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
  reachArm(m.gunArm, _g1.copy(grips[0]).applyMatrix4(_mC), bend);
  reachArm(off, _g2.copy(grips[1]).applyMatrix4(_mC), bend);
  anchorToRoot(obj, m, local);
}

const _e = new THREE.Euler(0, 0, 0, 'YXZ');
/** Root-space Matrix4 from position + Euler (order YXZ: yaw, then pitch). */
export function rootMatrix(out, x, y, z, pitch = 0, yaw = 0, roll = 0) {
  _e.set(pitch, yaw, roll, 'YXZ');
  return out.compose(_v.set(x, y, z), _q.setFromEuler(_e), _v2.set(1, 1, 1));
}
