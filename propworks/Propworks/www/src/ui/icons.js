/* Spawn icons: each prop is rendered once into a small render target with a studio
   light rig, read back and cached as a data URL — the spawn menu's grid of thumbnails. */
import * as THREE from 'three';
import { propTemplate } from '../world/props.js';
import { material } from '../render/materials.js';
import { buildHumanoid } from '../world/npc.js';

const cache = new Map();
let rig = null;

function setup(renderer) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  const size = 128;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  rig = { scene, cam, rt, size, canvas, ctx: canvas.getContext('2d'), renderer };
}

function snapshot(obj) {
  const { scene, cam, rt, size, canvas, ctx, renderer } = rig;
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z) * 0.62 + 0.01;
  const dist = r / Math.sin(THREE.MathUtils.degToRad(15));
  cam.position.copy(c).add(new THREE.Vector3(0.9, 0.62, 1).normalize().multiplyScalar(dist));
  cam.lookAt(c);
  const prevTarget = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevTone;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  ctx.putImageData(img, 0, 0);
  scene.remove(obj);
  return canvas.toDataURL('image/png');
}

export function propIcon(renderer, key) {
  if (cache.has(key)) return cache.get(key);
  if (!rig) setup(renderer);
  const t = propTemplate(key);
  const g = new THREE.Group();
  for (const [geo, m, p, r] of t.parts) {
    const mesh = new THREE.Mesh(geo, typeof m === 'string' ? material(m) : m);
    if (p) mesh.position.set(...p);
    if (r) mesh.rotation.set(...r);
    g.add(mesh);
  }
  const url = snapshot(g);
  cache.set(key, url);
  return url;
}

export function objectIcon(renderer, id, build) {
  if (cache.has(id)) return cache.get(id);
  if (!rig) setup(renderer);
  const obj = build();
  const url = snapshot(obj);
  cache.set(id, url);
  return url;
}

export function humanoidIcon(renderer, id, look, kind) {
  return objectIcon(renderer, id, () => { const hmd = buildHumanoid(look, 1, kind); hmd.joints.armL.rotation.z = 0.3; hmd.joints.armR.rotation.z = -0.3; return hmd.root; });
}
