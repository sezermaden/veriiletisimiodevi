/* Procedural viewmodels. Each returns { root, muzzle (Object3D at the barrel tip), parts{} }.
   Coordinates are in the viewmodel camera's space: +X right, +Y up, -Z forward. */
import * as THREE from 'three';
import { roundBox, cyl, boxGeo } from '../world/geometry.js';
import { textTexture } from '../render/textures.js';

const std = (color, rough = 0.5, metal = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const glow = (color, i = 3) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.3 });

function mesh(g, m, p = [0, 0, 0], r = [0, 0, 0]) {
  const o = new THREE.Mesh(g, m);
  o.position.set(...p); o.rotation.set(...r);
  return o;
}

/** Gloved hand + sleeve holding a grip at the origin. */
function hand(side = 1) {
  const g = new THREE.Group();
  const sleeve = std('#3b4148', 0.9, 0);
  const glove = std('#1f2226', 0.7, 0.05);
  const skin = std('#c99a78', 0.7, 0);
  g.add(mesh(new THREE.CapsuleGeometry(0.045, 0.28, 6, 12), sleeve, [0.02 * side, -0.06, 0.2], [Math.PI / 2 - 0.25, 0, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.04, 12), skin, [0.02 * side, -0.035, 0.07], [Math.PI / 2 - 0.25, 0, 0]));
  g.add(mesh(roundBox(0.07, 0.06, 0.1, 0.02), glove, [0, 0, 0]));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 6), glove, [-0.03 * side + i * 0.018 * side, 0.02, -0.05], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.03, 4, 6), glove, [0.04 * side, 0.03, -0.02], [0.8, 0, -0.6 * side]));
  return g;
}

export function physgunModel() {
  const root = new THREE.Group();
  const body = std('#8a8f96', 0.42, 0.55);
  const dark = std('#2a2e33', 0.55, 0.5);
  const coilMat = glow('#4fb3ff', 1.2);
  root.add(mesh(roundBox(0.09, 0.1, 0.42, 0.025), body, [0, 0.02, -0.12]));
  root.add(mesh(roundBox(0.07, 0.05, 0.3, 0.02), dark, [0, 0.085, -0.1]));
  root.add(mesh(cyl(0.035, 0.18, 16), dark, [0, 0.02, -0.4], [Math.PI / 2, 0, 0]));
  const coils = [];
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.TorusGeometry(0.052, 0.011, 8, 24), coilMat, [0, 0.02, -0.2 - i * 0.055]);
    root.add(c); coils.push(c);
  }
  // front prongs that spread when the beam is on
  const prongs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = new THREE.Group();
    p.position.set(Math.cos(a) * 0.045, 0.02 + Math.sin(a) * 0.045, -0.48);
    p.add(mesh(boxGeo(0.014, 0.014, 0.11), body, [0, 0, -0.04]));
    p.add(mesh(boxGeo(0.018, 0.018, 0.02), coilMat, [0, 0, -0.1]));
    p.userData.dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
    root.add(p); prongs.push(p);
  }
  const core = mesh(new THREE.SphereGeometry(0.03, 16, 12), glow('#bfe6ff', 4), [0, 0.02, -0.5]);
  root.add(core);
  root.add(mesh(roundBox(0.05, 0.12, 0.07, 0.015), dark, [0, -0.07, 0.02], [0.25, 0, 0]));
  const h = hand(1); h.position.set(0.0, -0.1, 0.03); root.add(h);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.56); root.add(muzzle);
  return { root, muzzle, parts: { coils, prongs, core, coilMat } };
}

export function toolgunModel() {
  const root = new THREE.Group();
  const body = std('#d7dbe0', 0.4, 0.3);
  const dark = std('#32363c', 0.5, 0.5);
  const accent = std('#3fa9ff', 0.35, 0.3);
  root.add(mesh(roundBox(0.1, 0.12, 0.34, 0.02), body, [0, 0.02, -0.1]));
  root.add(mesh(roundBox(0.06, 0.06, 0.2, 0.015), dark, [0, 0.0, -0.33]));
  root.add(mesh(cyl(0.015, 0.1, 10), dark, [0, 0.0, -0.46], [Math.PI / 2, 0, 0]));
  root.add(mesh(boxGeo(0.104, 0.015, 0.3), accent, [0, 0.08, -0.1]));
  // screen on the back (faces the player)
  const screenTex = textTexture('Weld', { w: 256, h: 128, bg: '#0b1a2a', fg: '#9fdcff', font: 'bold 44px Tahoma, sans-serif', glow: '#3fa9ff' });
  const screen = mesh(new THREE.PlaneGeometry(0.085, 0.045), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), [0, 0.055, 0.071], [-0.35, 0, 0]);
  root.add(mesh(roundBox(0.095, 0.055, 0.02, 0.008), dark, [0, 0.055, 0.062], [-0.35, 0, 0]));
  root.add(screen);
  root.add(mesh(roundBox(0.05, 0.12, 0.07, 0.015), dark, [0, -0.08, 0.02], [0.25, 0, 0]));
  const h = hand(1); h.position.set(0, -0.11, 0.03); root.add(h);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.0, -0.52); root.add(muzzle);
  return { root, muzzle, parts: { screen, screenTex } };
}

export function gravgunModel() {
  const root = new THREE.Group();
  const orange = std('#e0762b', 0.45, 0.4);
  const dark = std('#26292d', 0.5, 0.7);
  const coreMat = glow('#ffcf7a', 3);
  root.add(mesh(roundBox(0.14, 0.13, 0.36, 0.03), orange, [0, 0.01, -0.1]));
  root.add(mesh(roundBox(0.1, 0.09, 0.2, 0.02), dark, [0, 0.01, -0.3]));
  const claws = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const cg = new THREE.Group();
    cg.position.set(Math.cos(a) * 0.06, 0.01 + Math.sin(a) * 0.06, -0.38);
    cg.add(mesh(boxGeo(0.022, 0.022, 0.16), dark, [0, 0, -0.07]));
    cg.add(mesh(boxGeo(0.02, 0.02, 0.05), orange, [-Math.cos(a) * 0.012, -Math.sin(a) * 0.012, -0.15]));
    cg.userData.a = a;
    root.add(cg); claws.push(cg);
  }
  const core = mesh(new THREE.SphereGeometry(0.028, 12, 10), coreMat, [0, 0.01, -0.42]);
  root.add(core);
  root.add(mesh(roundBox(0.06, 0.13, 0.08, 0.015), dark, [0, -0.08, 0.03], [0.25, 0, 0]));
  const h = hand(1); h.position.set(0, -0.12, 0.04); root.add(h);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.01, -0.5); root.add(muzzle);
  return { root, muzzle, parts: { claws, core, coreMat } };
}

export function crowbarModel() {
  const root = new THREE.Group();
  const red = std('#a8261e', 0.45, 0.6);
  const steel = std('#8e949b', 0.3, 0.9);
  const shaft = new THREE.Group();
  shaft.add(mesh(cyl(0.012, 0.62, 10), red, [0, 0.22, 0]));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI * 1.1), red);
  hook.position.set(0.05, 0.53, 0); shaft.add(hook);
  shaft.add(mesh(boxGeo(0.02, 0.05, 0.03), steel, [-0.005, -0.1, 0]));
  shaft.rotation.set(-1.15, 0.15, 0.2);
  root.add(shaft);
  const h = hand(1); h.position.set(0, -0.03, 0.02); root.add(h);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.2, -0.45); root.add(muzzle);
  return { root, muzzle, parts: { shaft } };
}

function gunBase({ len = 0.24, h = 0.09, w = 0.05, color = '#2d3035', barrel = 0.12, mag = 0.1, stock = false }) {
  const root = new THREE.Group();
  const body = std(color, 0.45, 0.7);
  const steel = std('#50555c', 0.35, 0.9);
  root.add(mesh(roundBox(w, h * 0.55, len, 0.012), body, [0, 0.03, -len / 2 + 0.05]));
  root.add(mesh(roundBox(w * 0.9, h * 0.35, len * 0.9, 0.01), steel, [0, 0.075, -len / 2 + 0.05]));
  root.add(mesh(cyl(0.013, barrel, 10), steel, [0, 0.04, -len + 0.05 - barrel / 2 + 0.02], [Math.PI / 2, 0, 0]));
  root.add(mesh(roundBox(w * 0.85, 0.11, 0.05, 0.012), body, [0, -0.05, 0.02], [0.25, 0, 0]));
  const magMesh = mesh(roundBox(w * 0.7, mag, 0.04, 0.008), steel, [0, -0.05 - mag / 4, -0.06]);
  root.add(magMesh);
  if (stock) root.add(mesh(roundBox(w * 0.8, 0.07, 0.18, 0.02), body, [0, 0.0, 0.15]));
  const hnd = hand(1); hnd.position.set(0, -0.07, 0.03); root.add(hnd);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, -len + 0.05 - barrel); root.add(muzzle);
  return { root, muzzle, parts: { mag: magMesh } };
}

export const pistolModel = () => gunBase({ len: 0.2, h: 0.1, w: 0.04, color: '#1f2226', barrel: 0.02, mag: 0.1 });
export const smgModel = () => {
  const m = gunBase({ len: 0.3, h: 0.1, w: 0.05, color: '#343a40', barrel: 0.1, mag: 0.18, stock: true });
  const lh = hand(-1); lh.position.set(-0.02, -0.02, -0.22); lh.rotation.set(0, 0, 0.4); m.root.add(lh);
  return m;
};
export const shotgunModel = () => {
  const m = gunBase({ len: 0.46, h: 0.1, w: 0.055, color: '#4a3524', barrel: 0.25, mag: 0.02, stock: true });
  const pump = mesh(roundBox(0.06, 0.05, 0.14, 0.015), std('#2b2b2b', 0.6, 0.3), [0, 0.0, -0.38]);
  m.root.add(pump); m.parts.pump = pump;
  const lh = hand(-1); lh.position.set(-0.01, -0.04, -0.38); m.root.add(lh); m.parts.leftHand = lh;
  return m;
};

export function grenadeModel() {
  const root = new THREE.Group();
  const g = mesh(new THREE.SphereGeometry(0.045, 14, 10), std('#3c4a2e', 0.6, 0.3), [0, 0.03, -0.06]);
  g.scale.set(1, 1.2, 1);
  root.add(g);
  root.add(mesh(cyl(0.02, 0.03, 10), std('#777', 0.3, 0.9), [0, 0.09, -0.06]));
  root.add(mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), std('#aaa', 0.3, 0.9), [0.025, 0.1, -0.06]));
  const h = hand(1); h.position.set(0, -0.01, 0.0); root.add(h);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.05, -0.2); root.add(muzzle);
  return { root, muzzle, parts: { ball: g } };
}

/** World model for grenades and thrown objects. */
export function grenadeWorldMesh() {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.09, 14, 10), std('#3c4a2e', 0.6, 0.3));
  b.scale.set(1, 1.2, 1); b.castShadow = true;
  g.add(b);
  g.add(mesh(cyl(0.04, 0.06, 10), std('#777', 0.3, 0.9), [0, 0.12, 0]));
  const light = mesh(new THREE.SphereGeometry(0.02, 8, 6), glow('#ff3030', 4), [0.05, 0.12, 0]);
  g.add(light);
  g.userData.light = light;
  return g;
}
