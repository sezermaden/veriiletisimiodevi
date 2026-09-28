/* Prop catalogue. Every spawnable physics object is described here: how it looks (parts),
   how it collides (shapes), what it is made of, and any special behaviour.

   part:  [geometry, material, [x,y,z]?, [rx,ry,rz]?]
   shape: { box:[hx,hy,hz] | cyl:[halfH,r] | ball:r | capsule:[halfH,r] | cone:[halfH,r] | hull:geometry, p?, r? } */
import * as THREE from 'three';
import { boxGeo, roundBox, cyl, sphere, wedgeGeo } from './geometry.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';

const PI = Math.PI;
const c = (hex, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
const glowMat = (hex, i = 2) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.4 });

// Shared plain materials (created lazily so textures exist first).
let M = null;
function mats() {
  if (M) return M;
  M = {
    fabricRed: c('#8f2f2a', 0.95), fabricBlue: c('#2f4f7f', 0.95), fabricGreen: c('#3d6b45', 0.95),
    white: c('#ecebe6', 0.35), black: c('#1b1b1d', 0.5), plasticOrange: c('#ff6a1a', 0.45), stripe: c('#f5f5f5', 0.45),
    chrome: c('#ffffff', 0.08, 1), steel: c('#9aa1a8', 0.35, 0.9), brass: c('#c9a24a', 0.3, 1),
    green: c('#2e7d32', 0.6, 0.3), melon: c('#3f8f2e', 0.55), melonStripe: c('#255a1b', 0.55),
    yellow: c('#ffd21f', 0.4), beak: c('#ff8a00', 0.4), screen: glowMat('#6fb6ff', 0.6), shade: glowMat('#fff2c8', 1.6),
    paperBooks: [c('#7a2e2e', 0.8), c('#2e4f7a', 0.8), c('#2e7a4a', 0.8), c('#7a6a2e', 0.8), c('#4a2e7a', 0.8)],
    errorRed: glowMat('#ff2222', 1.1), mattress: c('#dfe4ec', 0.95), pillow: c('#f7f7f2', 0.95),
    containerRed: c('#a3342a', 0.7, 0.4), containerBlue: c('#2a5aa3', 0.7, 0.4),
  };
  return M;
}

/* -------------------------------------------------------------- builders */
const plate = (w, d, mat = 'diamond') => () => ({ parts: [[boxGeo(w, 0.05, d, 1), mat]], shapes: [{ box: [w / 2, 0.025, d / 2] }] });
const block = (w, h, d, mat = 'devGrey') => () => ({ parts: [[boxGeo(w, h, d, 1), mat]], shapes: [{ box: [w / 2, h / 2, d / 2] }] });

function crate(s) {
  return () => ({ parts: [[roundBox(s, s, s, s * 0.02), 'crate']], shapes: [{ box: [s / 2, s / 2, s / 2] }] });
}

function barrel(mat) {
  return () => {
    const m = mats();
    return {
      parts: [
        [cyl(0.3, 0.9, 28), mat],
        [new THREE.TorusGeometry(0.302, 0.018, 6, 28).rotateX(PI / 2), m.steel, [0, 0.3, 0]],
        [new THREE.TorusGeometry(0.302, 0.018, 6, 28).rotateX(PI / 2), m.steel, [0, -0.3, 0]],
        [cyl(0.28, 0.02, 28), m.steel, [0, 0.45, 0]],
        [cyl(0.04, 0.03, 10), m.steel, [0.15, 0.465, 0]],
      ],
      shapes: [{ cyl: [0.45, 0.3] }],
    };
  };
}

function chair() {
  const legs = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
  return {
    parts: [
      [boxGeo(0.46, 0.05, 0.46, 0.5), 'wood', [0, 0.02, 0]],
      [boxGeo(0.46, 0.5, 0.05, 0.5), 'wood', [0, 0.3, -0.21]],
      ...legs.map(([x, z]) => [boxGeo(0.05, 0.45, 0.05), 'woodDark', [x, -0.24, z]]),
    ],
    shapes: [{ box: [0.23, 0.25, 0.23], p: [0, -0.22, 0] }, { box: [0.23, 0.25, 0.025], p: [0, 0.3, -0.21] }],
  };
}

function table() {
  const legs = [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]];
  return {
    parts: [[boxGeo(1.6, 0.06, 0.95, 0.8), 'wood', [0, 0.36, 0]], ...legs.map(([x, z]) => [boxGeo(0.07, 0.72, 0.07), 'woodDark', [x, 0, z]])],
    shapes: [{ box: [0.8, 0.03, 0.475], p: [0, 0.36, 0] }, ...legs.map(([x, z]) => ({ box: [0.035, 0.33, 0.035], p: [x, -0.03, z] }))],
  };
}

function desk() {
  return {
    parts: [
      [boxGeo(1.4, 0.05, 0.7, 0.8), 'woodDark', [0, 0.37, 0]],
      [boxGeo(0.05, 0.72, 0.68), 'woodDark', [-0.67, 0, 0]],
      [boxGeo(0.45, 0.72, 0.68), 'woodDark', [0.45, 0, 0]],
      [boxGeo(0.4, 0.2, 0.02), 'wood', [0.45, 0.2, 0.345]],
      [boxGeo(0.4, 0.2, 0.02), 'wood', [0.45, -0.05, 0.345]],
      [boxGeo(0.12, 0.02, 0.02), mats().brass, [0.45, 0.2, 0.36]],
      [boxGeo(0.12, 0.02, 0.02), mats().brass, [0.45, -0.05, 0.36]],
    ],
    shapes: [{ box: [0.7, 0.025, 0.35], p: [0, 0.37, 0] }, { box: [0.025, 0.36, 0.34], p: [-0.67, 0, 0] }, { box: [0.225, 0.36, 0.34], p: [0.45, 0, 0] }],
  };
}

function sofa(fab) {
  return () => {
    const m = mats()[fab];
    return {
      parts: [
        [roundBox(1.9, 0.4, 0.85, 0.08), m, [0, -0.15, 0]],
        [roundBox(1.9, 0.55, 0.22, 0.08), m, [0, 0.3, -0.32]],
        [roundBox(0.22, 0.35, 0.85, 0.08), m, [-0.84, 0.18, 0]],
        [roundBox(0.22, 0.35, 0.85, 0.08), m, [0.84, 0.18, 0]],
        [roundBox(0.72, 0.14, 0.6, 0.06), m, [-0.37, 0.12, 0.08]],
        [roundBox(0.72, 0.14, 0.6, 0.06), m, [0.37, 0.12, 0.08]],
      ],
      shapes: [{ box: [0.95, 0.2, 0.425], p: [0, -0.15, 0] }, { box: [0.95, 0.28, 0.11], p: [0, 0.3, -0.32] }, { box: [0.11, 0.18, 0.425], p: [-0.84, 0.18, 0] }, { box: [0.11, 0.18, 0.425], p: [0.84, 0.18, 0] }],
    };
  };
}

function bookshelf() {
  const m = mats();
  const parts = [
    [boxGeo(1, 2, 0.04), 'woodDark', [0, 0, -0.16]],
    [boxGeo(0.04, 2, 0.36), 'woodDark', [-0.48, 0, 0]],
    [boxGeo(0.04, 2, 0.36), 'woodDark', [0.48, 0, 0]],
  ];
  for (let i = 0; i < 5; i++) parts.push([boxGeo(0.92, 0.04, 0.34), 'wood', [0, -0.98 + i * 0.49, 0]]);
  let seed = 3;
  for (let s = 0; s < 4; s++) {
    let x = -0.43;
    while (x < 0.38) {
      seed = (seed * 16807) % 2147483647;
      const w = 0.035 + (seed % 5) * 0.012, h = 0.26 + (seed % 7) * 0.025;
      parts.push([boxGeo(w, h, 0.24), m.paperBooks[seed % 5], [x + w / 2, -0.96 + s * 0.49 + h / 2, 0.02]]);
      x += w + 0.004;
    }
  }
  return { parts, shapes: [{ box: [0.5, 1, 0.18] }] };
}

function bathtub() {
  const m = mats();
  return {
    parts: [
      [boxGeo(1.7, 0.08, 0.8), m.white, [0, -0.26, 0]],
      [boxGeo(1.7, 0.55, 0.08), m.white, [0, 0, -0.36]],
      [boxGeo(1.7, 0.55, 0.08), m.white, [0, 0, 0.36]],
      [boxGeo(0.08, 0.55, 0.8), m.white, [-0.81, 0, 0]],
      [boxGeo(0.08, 0.55, 0.8), m.white, [0.81, 0, 0]],
      [cyl(0.025, 0.2, 10), m.chrome, [0.7, 0.35, 0], [0, 0, PI / 2]],
    ],
    shapes: [{ box: [0.85, 0.04, 0.4], p: [0, -0.26, 0] }, { box: [0.85, 0.275, 0.04], p: [0, 0, -0.36] }, { box: [0.85, 0.275, 0.04], p: [0, 0, 0.36] }, { box: [0.04, 0.275, 0.4], p: [-0.81, 0, 0] }, { box: [0.04, 0.275, 0.4], p: [0.81, 0, 0] }],
  };
}

function ladder() {
  const parts = [[boxGeo(0.06, 3, 0.06), 'metal', [-0.25, 0, 0]], [boxGeo(0.06, 3, 0.06), 'metal', [0.25, 0, 0]]];
  for (let i = 0; i < 10; i++) parts.push([cyl(0.02, 0.5, 8), 'metal', [0, -1.35 + i * 0.3, 0], [0, 0, PI / 2]]);
  return { parts, shapes: [{ box: [0.28, 1.5, 0.04] }] };
}

function pallet() {
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push([boxGeo(1.2, 0.025, 0.14, 0.6), 'wood', [0, 0.06, -0.4 + i * 0.2]]);
  for (const x of [-0.55, 0, 0.55]) parts.push([boxGeo(0.1, 0.1, 1), 'woodDark', [x, -0.02, 0]]);
  return { parts, shapes: [{ box: [0.6, 0.07, 0.5] }] };
}

function cone() {
  const m = mats();
  return {
    parts: [[boxGeo(0.4, 0.03, 0.4), m.plasticOrange, [0, -0.35, 0]], [cyl(0.15, 0.68, 20, 0.03), m.plasticOrange, [0, 0, 0]], [cyl(0.105, 0.12, 20, 0.078), m.stripe, [0, 0.02, 0]]],
    shapes: [{ cone: [0.35, 0.16] }],
  };
}

function duck() {
  const m = mats();
  const body = sphere(0.22, 20, 14); body.scale(1.25, 0.85, 1);
  return {
    parts: [[body, m.yellow], [sphere(0.13, 18, 12), m.yellow, [0.18, 0.2, 0]], [cyl(0.05, 0.12, 10, 0.02), m.beak, [0.33, 0.18, 0], [0, 0, -PI / 2]], [sphere(0.02, 8, 6), m.black, [0.27, 0.25, 0.07]], [sphere(0.02, 8, 6), m.black, [0.27, 0.25, -0.07]]],
    shapes: [{ ball: 0.22 }, { ball: 0.13, p: [0.18, 0.2, 0] }],
  };
}

function melon() {
  const m = mats();
  const g = sphere(0.22, 24, 16); g.scale(1, 0.92, 1.18);
  // stripes through vertex colours
  const colors = [];
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getX(i), pos.getY(i));
    const s = Math.sin(a * 8) > 0.35;
    const col = new THREE.Color(s ? '#2a6b1f' : '#4f9e33');
    colors.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  void m;
  return { parts: [[g, mat]], shapes: [{ ball: 0.22 }] };
}

function beachball() {
  const g = sphere(0.35, 24, 16);
  const colors = [];
  const pal = ['#e53935', '#ffffff', '#1e88e5', '#ffffff', '#fdd835', '#ffffff'].map((h) => new THREE.Color(h));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = (Math.atan2(pos.getZ(i), pos.getX(i)) + PI) / (2 * PI);
    const col = Math.abs(pos.getY(i)) > 0.33 ? new THREE.Color('#ffffff') : pal[Math.floor(a * 6) % 6];
    colors.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return { parts: [[g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 })]], shapes: [{ ball: 0.35 }] };
}

function dice() {
  const m = mats();
  const parts = [[roundBox(0.6, 0.6, 0.6, 0.07, 3), m.white]];
  const pip = sphere(0.045, 10, 8);
  const faces = [
    [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  ];
  const axes = [[0, 0.3, 0, 'y'], [0, -0.3, 0, 'y'], [0.3, 0, 0, 'x'], [-0.3, 0, 0, 'x'], [0, 0, 0.3, 'z'], [0, 0, -0.3, 'z']];
  faces.forEach((f, i) => {
    const [ax, ay, az, k] = axes[i];
    for (const [u, v] of f) {
      const o = [ax, ay, az];
      if (k === 'y') { o[0] += u * 0.15; o[2] += v * 0.15; } else if (k === 'x') { o[1] += u * 0.15; o[2] += v * 0.15; } else { o[0] += u * 0.15; o[1] += v * 0.15; }
      parts.push([pip, m.black, o]);
    }
  });
  return { parts, shapes: [{ box: [0.3, 0.3, 0.3] }] };
}

/** Block letters "ERROR" — the corruption's calling card, built from voxels. */
function errorSign() {
  const glyphs = {
    E: ['111', '100', '110', '100', '111'],
    R: ['110', '101', '110', '101', '101'],
    O: ['111', '101', '101', '101', '111'],
  };
  const m = mats();
  const parts = [];
  const vox = boxGeo(0.12, 0.12, 0.12);
  let x = -1.05;
  for (const ch of 'ERROR') {
    const g = glyphs[ch];
    g.forEach((row, r) => [...row].forEach((bit, col) => { if (bit === '1') parts.push([vox, m.errorRed, [x + col * 0.12, 0.24 - r * 0.12, 0]]); }));
    x += 0.48;
  }
  return { parts, shapes: [{ box: [1.2, 0.33, 0.06], p: [0.03, 0, 0] }] };
}

function teapot() {
  const g = new TeapotGeometry(0.2, 8);
  return { parts: [[g, mats().white]], shapes: [{ hull: g }] };
}

function tv() {
  const m = mats();
  return {
    parts: [[roundBox(0.9, 0.55, 0.12, 0.02), m.black], [boxGeo(0.82, 0.47, 0.01), m.screen, [0, 0, 0.061]], [boxGeo(0.3, 0.04, 0.2), m.black, [0, -0.3, 0]]],
    shapes: [{ box: [0.45, 0.275, 0.06] }, { box: [0.15, 0.02, 0.1], p: [0, -0.3, 0] }],
  };
}

function lamp() {
  const m = mats();
  return {
    parts: [[cyl(0.18, 0.04, 20), m.black, [0, -0.78, 0]], [cyl(0.02, 1.5, 8), m.steel, [0, -0.02, 0]], [cyl(0.2, 0.3, 20, 0.12), m.shade, [0, 0.72, 0]]],
    shapes: [{ cyl: [0.02, 0.18], p: [0, -0.78, 0] }, { cyl: [0.75, 0.04] }, { cyl: [0.15, 0.2], p: [0, 0.72, 0] }],
    light: { color: 0xffe2b0, intensity: 6, distance: 8, pos: [0, 0.72, 0] },
  };
}

function fridge() {
  const m = mats();
  return {
    parts: [[roundBox(0.75, 1.8, 0.7, 0.04), m.white], [boxGeo(0.73, 0.01, 0.01), m.black, [0, 0.35, 0.351]], [boxGeo(0.03, 0.4, 0.04), m.steel, [0.3, 0.6, 0.37]], [boxGeo(0.03, 0.5, 0.04), m.steel, [0.3, -0.1, 0.37]]],
    shapes: [{ box: [0.375, 0.9, 0.35] }],
  };
}

function cabinet() {
  const parts = [[boxGeo(0.5, 1.3, 0.6), 'metalDark']];
  for (let i = 0; i < 4; i++) { parts.push([boxGeo(0.46, 0.005, 0.01), mats().black, [0, -0.33 + i * 0.32, 0.301]]); parts.push([boxGeo(0.14, 0.03, 0.03), mats().steel, [0, -0.5 + i * 0.32, 0.31]]); }
  return { parts, shapes: [{ box: [0.25, 0.65, 0.3] }] };
}

function door() {
  return { parts: [[boxGeo(0.9, 2.05, 0.05, 0), 'woodDark'], [sphere(0.035, 10, 8), mats().brass, [0.35, 0, 0.05]], [sphere(0.035, 10, 8), mats().brass, [0.35, 0, -0.05]]], shapes: [{ box: [0.45, 1.025, 0.025] }] };
}

function bed() {
  const m = mats();
  return {
    parts: [[boxGeo(1.1, 0.3, 2.05), 'woodDark', [0, -0.15, 0]], [boxGeo(1.1, 0.7, 0.06), 'woodDark', [0, 0.2, -1.0]], [roundBox(1, 0.2, 1.95, 0.06), m.mattress, [0, 0.1, 0.02]], [roundBox(0.6, 0.1, 0.35, 0.05), m.pillow, [0, 0.25, -0.75]]],
    shapes: [{ box: [0.55, 0.25, 1.025], p: [0, -0.05, 0] }, { box: [0.55, 0.35, 0.03], p: [0, 0.2, -1.0] }],
  };
}

function spool() {
  return { parts: [[cyl(0.55, 0.06, 24), 'wood', [0, 0.37, 0]], [cyl(0.55, 0.06, 24), 'wood', [0, -0.37, 0]], [cyl(0.3, 0.7, 20), 'woodDark']], shapes: [{ cyl: [0.4, 0.55] }] };
}

function sawblade() {
  const m = mats();
  const s = new THREE.Shape();
  const teeth = 28;
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * PI * 2, r = i % 2 ? 0.44 : 0.4;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.05, 0, PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false }).translate(0, 0, -0.0075).rotateX(PI / 2);
  return { parts: [[g, m.chrome]], shapes: [{ cyl: [0.0075, 0.43] }], sharp: true };
}

function container(matName) {
  return () => {
    const m = mats()[matName];
    const parts = [[boxGeo(6, 2.6, 2.4), m]];
    for (let i = 0; i < 24; i++) { parts.push([boxGeo(0.06, 2.4, 0.04), m, [-2.88 + i * 0.25, 0, 1.22]]); parts.push([boxGeo(0.06, 2.4, 0.04), m, [-2.88 + i * 0.25, 0, -1.22]]); }
    return { parts, shapes: [{ box: [3, 1.3, 1.2] }] };
  };
}

function dumpster() {
  const m = mats();
  return {
    parts: [[boxGeo(1.9, 1.2, 1.1), m.green], [boxGeo(1.95, 0.06, 1.15), m.black, [0, 0.63, 0], [-0.1, 0, 0]], [boxGeo(1.96, 0.1, 0.06), m.steel, [0, 0.3, 0.57]]],
    shapes: [{ box: [0.95, 0.6, 0.55] }],
  };
}

function gascan() {
  return {
    parts: [[roundBox(0.3, 0.38, 0.16, 0.03), 'barrel'], [boxGeo(0.18, 0.04, 0.04), mats().black, [0, 0.22, 0]], [cyl(0.025, 0.08, 8), mats().black, [0.11, 0.23, 0], [0, 0, -0.5]]],
    shapes: [{ box: [0.15, 0.19, 0.08] }],
  };
}

function propane() {
  const m = mats();
  const tank = new THREE.CapsuleGeometry(0.17, 0.45, 8, 20);
  return { parts: [[tank, c('#d9d9d4', 0.4, 0.4)], [cyl(0.05, 0.12, 10), m.brass, [0, 0.43, 0]]], shapes: [{ capsule: [0.225, 0.17] }] };
}

function cinder() {
  return { parts: [[boxGeo(0.4, 0.2, 0.2, 0.5), 'concreteDark']], shapes: [{ box: [0.2, 0.1, 0.1] }] };
}

function mattressProp() {
  return { parts: [[roundBox(1, 0.2, 1.95, 0.08), mats().mattress]], shapes: [{ box: [0.5, 0.1, 0.975] }] };
}

function clock() {
  const m = mats();
  return {
    parts: [[cyl(0.25, 0.05, 32), m.white, [0, 0, 0], [PI / 2, 0, 0]], [new THREE.TorusGeometry(0.25, 0.02, 8, 32), m.black], [boxGeo(0.015, 0.16, 0.01), m.black, [0, 0.07, 0.03]], [boxGeo(0.12, 0.015, 0.01), m.black, [0.05, 0, 0.03]]],
    shapes: [{ cyl: [0.025, 0.25], r: [PI / 2, 0, 0] }],
  };
}

function windowPane() {
  return { parts: [[boxGeo(1.2, 1.2, 0.03), 'glass']], shapes: [{ box: [0.6, 0.6, 0.015] }] };
}

function wheelDisc(r, t) {
  return () => ({ parts: [[cyl(r, t, 32), 'rubber'], [cyl(r * 0.55, t + 0.01, 24), 'chrome']], shapes: [{ cyl: [t / 2, r] }] });
}

function pipe(len) {
  return () => {
    const g = new THREE.CylinderGeometry(0.15, 0.15, len, 20, 1, true);
    const inner = new THREE.CylinderGeometry(0.12, 0.12, len, 20, 1, true);
    return { parts: [[g, 'metal'], [inner, c('#2c2f33', 0.7, 0.6)], [new THREE.RingGeometry(0.12, 0.15, 20).rotateX(-PI / 2).translate(0, len / 2, 0), 'metal'], [new THREE.RingGeometry(0.12, 0.15, 20).rotateX(PI / 2).translate(0, -len / 2, 0), 'metal']], shapes: [{ cyl: [len / 2, 0.15] }] };
  };
}

/* -------------------------------------------------------------- catalogue */
export const PROP_CATEGORIES = ['Construction', 'Industrial', 'Furniture', 'Fun'];

export const PROPS = {
  // Construction — clean building parts, the sandbox's bricks
  plate_05: { name: 'Plate 0.5×0.5', cat: 'Construction', surface: 'metal', density: 3, build: plate(0.5, 0.5) },
  plate_1: { name: 'Plate 1×1', cat: 'Construction', surface: 'metal', density: 3, build: plate(1, 1) },
  plate_1x2: { name: 'Plate 1×2', cat: 'Construction', surface: 'metal', density: 3, build: plate(1, 2) },
  plate_2: { name: 'Plate 2×2', cat: 'Construction', surface: 'metal', density: 3, build: plate(2, 2) },
  plate_1x4: { name: 'Plate 1×4', cat: 'Construction', surface: 'metal', density: 3, build: plate(1, 4) },
  plate_2x4: { name: 'Plate 2×4', cat: 'Construction', surface: 'metal', density: 3, build: plate(2, 4) },
  plate_4: { name: 'Plate 4×4', cat: 'Construction', surface: 'metal', density: 3, build: plate(4, 4) },
  block_05: { name: 'Block 0.5', cat: 'Construction', surface: 'concrete', density: 0.8, build: block(0.5, 0.5, 0.5, 'devOrange') },
  block_1: { name: 'Block 1', cat: 'Construction', surface: 'concrete', density: 0.6, build: block(1, 1, 1, 'devOrange') },
  block_1x2: { name: 'Block 1×2', cat: 'Construction', surface: 'concrete', density: 0.6, build: block(1, 1, 2, 'devGrey') },
  block_1x4: { name: 'Block 1×4', cat: 'Construction', surface: 'concrete', density: 0.6, build: block(1, 0.5, 4, 'devGrey') },
  beam_2: { name: 'Beam 2m', cat: 'Construction', surface: 'metal', density: 2.5, build: block(0.2, 0.2, 2, 'metal') },
  beam_4: { name: 'Beam 4m', cat: 'Construction', surface: 'metal', density: 2.5, build: block(0.2, 0.2, 4, 'metal') },
  tube_1: { name: 'Tube 1m', cat: 'Construction', surface: 'metal', density: 1.5, build: () => ({ parts: [[cyl(0.25, 1, 24), 'metal']], shapes: [{ cyl: [0.5, 0.25] }] }) },
  tube_2: { name: 'Tube 2m', cat: 'Construction', surface: 'metal', density: 1.5, build: () => ({ parts: [[cyl(0.25, 2, 24), 'metal']], shapes: [{ cyl: [1, 0.25] }] }) },
  ramp: { name: 'Ramp', cat: 'Construction', surface: 'concrete', density: 0.6, build: () => { const g = wedgeGeo(1, 0.6, 1.8); return { parts: [[g, 'devBlue']], shapes: [{ hull: g }] }; } },
  ball: { name: 'Steel Ball', cat: 'Construction', surface: 'metal', density: 2, build: () => ({ parts: [[sphere(0.5, 32, 20), 'chrome']], shapes: [{ ball: 0.5 }] }) },
  disc_05: { name: 'Wheel Disc 0.5', cat: 'Construction', surface: 'rubber', density: 1, build: wheelDisc(0.5, 0.15) },
  disc_1: { name: 'Wheel Disc 1', cat: 'Construction', surface: 'rubber', density: 1, build: wheelDisc(1, 0.25) },
  window: { name: 'Glass Pane', cat: 'Construction', surface: 'glass', density: 2.4, health: 12, breakable: 'glass', build: windowPane },

  // Industrial
  crate_small: { name: 'Crate (small)', cat: 'Industrial', surface: 'wood', density: 0.5, health: 40, breakable: 'wood', build: crate(0.5) },
  crate: { name: 'Crate', cat: 'Industrial', surface: 'wood', density: 0.45, health: 70, breakable: 'wood', build: crate(0.9) },
  crate_big: { name: 'Crate (large)', cat: 'Industrial', surface: 'wood', density: 0.4, health: 120, breakable: 'wood', build: crate(1.4) },
  barrel_red: { name: 'Explosive Barrel', cat: 'Industrial', surface: 'metal', density: 0.5, health: 25, explode: { radius: 7, damage: 140, force: 60 }, build: barrel('barrel') },
  barrel_blue: { name: 'Coolant Barrel', cat: 'Industrial', surface: 'metal', density: 0.55, build: barrel('barrelBlue') },
  barrel_grey: { name: 'Waste Barrel', cat: 'Industrial', surface: 'metal', density: 0.6, build: barrel('barrelGrey') },
  gascan: { name: 'Gas Can', cat: 'Industrial', surface: 'metal', density: 0.5, health: 10, explode: { radius: 4.5, damage: 80, force: 30 }, build: gascan },
  propane: { name: 'Propane Tank', cat: 'Industrial', surface: 'metal', density: 0.6, health: 20, explode: { radius: 6, damage: 110, force: 45 }, build: propane },
  pallet: { name: 'Pallet', cat: 'Industrial', surface: 'wood', density: 0.35, health: 50, breakable: 'wood', build: pallet },
  cinder: { name: 'Cinder Block', cat: 'Industrial', surface: 'concrete', density: 1.4, build: cinder },
  pipe: { name: 'Pipe', cat: 'Industrial', surface: 'metal', density: 1.2, build: pipe(3) },
  cone: { name: 'Traffic Cone', cat: 'Industrial', surface: 'plastic', density: 0.25, build: cone },
  spool: { name: 'Cable Spool', cat: 'Industrial', surface: 'wood', density: 0.4, build: spool },
  sawblade: { name: 'Saw Blade', cat: 'Industrial', surface: 'metal', density: 4, build: sawblade },
  dumpster: { name: 'Dumpster', cat: 'Industrial', surface: 'metal', density: 0.3, build: dumpster },
  container_red: { name: 'Shipping Container', cat: 'Industrial', surface: 'metal', density: 0.12, build: container('containerRed') },
  container_blue: { name: 'Shipping Container (blue)', cat: 'Industrial', surface: 'metal', density: 0.12, build: container('containerBlue') },
  ladder: { name: 'Ladder', cat: 'Industrial', surface: 'metal', density: 0.8, build: ladder },

  // Furniture
  chair: { name: 'Chair', cat: 'Furniture', surface: 'wood', density: 0.35, health: 35, breakable: 'wood', build: chair },
  table: { name: 'Table', cat: 'Furniture', surface: 'wood', density: 0.35, health: 60, breakable: 'wood', build: table },
  desk: { name: 'Desk', cat: 'Furniture', surface: 'wood', density: 0.3, build: desk },
  sofa: { name: 'Sofa', cat: 'Furniture', surface: 'flesh', density: 0.2, build: sofa('fabricRed') },
  sofa_blue: { name: 'Sofa (blue)', cat: 'Furniture', surface: 'flesh', density: 0.2, build: sofa('fabricBlue') },
  bookshelf: { name: 'Bookshelf', cat: 'Furniture', surface: 'wood', density: 0.3, build: bookshelf },
  bed: { name: 'Bed', cat: 'Furniture', surface: 'wood', density: 0.2, build: bed },
  mattress: { name: 'Mattress', cat: 'Furniture', surface: 'flesh', density: 0.15, build: mattressProp },
  bathtub: { name: 'Bathtub', cat: 'Furniture', surface: 'metal', density: 0.5, build: bathtub },
  fridge: { name: 'Fridge', cat: 'Furniture', surface: 'metal', density: 0.25, build: fridge },
  cabinet: { name: 'Filing Cabinet', cat: 'Furniture', surface: 'metal', density: 0.35, build: cabinet },
  tv: { name: 'Television', cat: 'Furniture', surface: 'plastic', density: 0.5, health: 15, breakable: 'glass', build: tv },
  lamp: { name: 'Floor Lamp', cat: 'Furniture', surface: 'metal', density: 0.4, build: lamp },
  door: { name: 'Door', cat: 'Furniture', surface: 'wood', density: 0.45, build: door },
  clock: { name: 'Wall Clock', cat: 'Furniture', surface: 'plastic', density: 0.5, build: clock },

  // Fun
  melon: { name: 'Melon', cat: 'Fun', surface: 'flesh', density: 0.9, health: 8, breakable: 'melon', build: melon },
  beachball: { name: 'Beach Ball', cat: 'Fun', surface: 'rubber', density: 0.02, restitution: 0.85, build: beachball },
  duck: { name: 'Rubber Duck', cat: 'Fun', surface: 'rubber', density: 0.12, restitution: 0.6, build: duck },
  dice: { name: 'Foam Die', cat: 'Fun', surface: 'plastic', density: 0.15, build: dice },
  teapot: { name: 'Teapot', cat: 'Fun', surface: 'plastic', density: 0.8, build: teapot },
  bowling: { name: 'Bowling Ball', cat: 'Fun', surface: 'metal', density: 1.5, build: () => ({ parts: [[sphere(0.22, 24, 16), c('#161a3a', 0.15, 0.2)]], shapes: [{ ball: 0.22 }] }) },
  error_sign: { name: 'ERROR', cat: 'Fun', surface: 'plastic', density: 0.4, build: errorSign },
};

/* -------------------------------------------------------------- build cache */
const cache = new Map();

/** Returns the (cached) template: { parts, shapes, light?, halfHeight, volume }. */
export function propTemplate(key) {
  if (cache.has(key)) return cache.get(key);
  const def = PROPS[key];
  if (!def) throw new Error('Unknown prop ' + key);
  const t = def.build();
  // bounding info for buoyancy, spawn placement and icons
  const box = new THREE.Box3();
  for (const [g, , p = [0, 0, 0], r] of t.parts) {
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox.clone();
    if (r) b.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r)));
    b.translate(new THREE.Vector3(...p));
    box.union(b);
  }
  t.bounds = box;
  t.halfHeight = (box.max.y - box.min.y) / 2;
  const s = box.getSize(new THREE.Vector3());
  t.size = s;
  t.volume = s.x * s.y * s.z;
  cache.set(key, t);
  return t;
}
