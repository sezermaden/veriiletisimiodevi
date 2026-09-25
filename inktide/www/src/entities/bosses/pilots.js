// Boss pilots seen through cockpit glass: Foreman Dredge (a tar-blob foreman in a hardhat and
// hi-vis vest) and Baron Murkwell (an anglerfish tycoon with top hat, monocle and glowing lure).
// If the NPC module exports makeNpcModel(who) it is preferred (loaded lazily; the procedural
// fallback shows until then). Pilots expose update(dt, mood) for idle/talk/panic animation.
import * as THREE from 'three';
import { G } from './common.js';

/** Try entities/npc makeNpcModel(who) → { obj, handle } or null. */
export async function tryNpcModel(who, session = null) {
  try {
    const m = await import('../npc/index.js');
    const f = m.makeNpcModel || m.default?.makeNpcModel;
    if (typeof f !== 'function') return null;
    const r = f(who, { session });
    const obj = r?.isObject3D ? r : (r?.root || r?.group || r?.object || r?.model || null);
    if (!obj?.isObject3D) return null;
    return { obj, handle: r };
  } catch { return null; }
}

/**
 * Pilot wrapper: builds the fallback model immediately, then swaps in the NPC model if one exists.
 * `height` = target visible height of the pilot in metres.
 */
export class Pilot {
  constructor(boss, who, parent, height = 1) {
    this.boss = boss;
    this.who = who;
    this.root = new THREE.Group();
    this.root.name = 'pilot:' + who;
    parent.add(this.root);
    this.height = height;
    this.t = Math.random() * 10;
    this.mood = 'idle';
    this.fallback = who === 'murkwell' ? buildMurkwell(boss) : buildDredge(boss);
    this.root.add(this.fallback.root);
    this.fallback.root.scale.setScalar(height / this.fallback.h);
    this.npc = null;
    this._npcUpdateOk = true;
    tryNpcModel(who, boss.session).then((r) => {
      if (!r) return;
      if (this.disposed) { r.handle?.dispose?.(); return; }
      const box = new THREE.Box3().setFromObject(r.obj);
      const h = Math.max(0.01, box.max.y - box.min.y);
      // the cockpit shows head + shoulders: scale so the whole model is ~1.6× the fallback bust
      const s = (this.height * 1.6) / h;
      r.obj.scale.multiplyScalar(s);
      r.obj.position.y = -box.min.y * s - this.height * 0.62;
      r.obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
      this.root.add(r.obj);
      this.fallback.root.visible = false;
      this.npc = r;
    });
  }

  update(dt, mood = 'idle') {
    this.t += dt;
    this.mood = mood;
    if (this.npc) {
      const h = this.npc.handle;
      if (mood !== this._npcMood) {
        this._npcMood = mood;
        try { h?.setMood?.(mood === 'panic' ? 'shock' : mood === 'idle' ? null : mood); } catch { /* optional */ }
      }
      if (this._npcUpdateOk && typeof h?.update === 'function') {
        try { h.update(dt, { talking: mood === 'angry' || mood === 'panic', mood }); } catch { this._npcUpdateOk = false; }
      }
      const r = this.npc.obj;
      r.rotation.z = mood === 'panic' ? Math.sin(this.t * 22) * 0.12 : Math.sin(this.t * 1.3) * 0.03;
      return;
    }
    this.fallback.update(this.t, dt, mood);
  }

  dispose() {
    this.disposed = true;
    try { this.npc?.handle?.dispose?.(); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------------------------
function buildDredge(boss) {
  const tar = boss.mat('dredge-tar', '#1e1630', { roughness: 0.3, rim: 0.55, rimColor: '#8f7bd6' });
  const vest = boss.mat('dredge-vest', '#ff7a1a', { roughness: 0.7 });
  const strip = boss.mat('dredge-strip', '#e8f0ff', { roughness: 0.4, emissive: '#b0c0d0', emissiveIntensity: 0.3 });
  const hat = boss.mat('dredge-hat', '#ffc53a', { roughness: 0.35 });
  const white = boss.mat('dredge-eye', '#e9ffb8', { roughness: 0.2, rim: 0 });
  const iris = boss.mat('dredge-iris', '#9ee02a', { roughness: 0.2, rim: 0, emissive: '#6fae10', emissiveIntensity: 0.4 });
  const black = boss.mat('pilot-black', '#0b0714', { roughness: 0.3, rim: 0 });
  const lamp = boss.glowMat('dredge-lamp', '#fffbe0', 2.2);
  const root = new THREE.Group();
  const body = boss.mesh(G.sphere(0.42, 28, 20), tar, root, [0, 0.42, 0], null, [1.05, 1.08, 0.95]);
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.02); root.add(head);
  // eyes + brows
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = boss.mesh(G.sphere(0.1, 16, 12), white, head, [s * 0.14, 0.02, 0.33]);
    boss.mesh(G.sphere(0.06, 12, 10), iris, e, [0, -0.01, 0.06]);
    boss.mesh(G.sphere(0.032, 10, 8), black, e, [0, -0.01, 0.1]);
    const brow = boss.mesh(G.box(0.17, 0.04, 0.04), black, head, [s * 0.14, 0.14, 0.37], [0, 0, s * -0.35]);
    eyes.push(e, brow);
  }
  // grumpy mouth
  boss.mesh(G.torus(0.09, 0.018, 6, 16, Math.PI), black, head, [0, -0.16, 0.37], [0, 0, 0]);
  // hi-vis vest
  boss.mesh(G.cyl(0.43, 0.46, 0.34, 24, true), vest, root, [0, 0.2, 0]);
  boss.mesh(G.cyl(0.445, 0.455, 0.05, 24, true), strip, root, [0, 0.26, 0]);
  boss.mesh(G.cyl(0.455, 0.465, 0.05, 24, true), strip, root, [0, 0.13, 0]);
  // hardhat with a lamp
  const hh = new THREE.Group(); hh.position.set(0, 0.78, 0); hh.rotation.x = -0.12; root.add(hh);
  boss.mesh(G.hemi(0.36, 24, 10), hat, hh, [0, 0, 0], null, [1, 0.85, 1]);
  boss.mesh(G.cyl(0.48, 0.48, 0.035, 28), hat, hh, [0, 0.01, 0.04]);
  boss.mesh(G.box(0.05, 0.3, 0.72), hat, hh, [0, 0.15, 0], null, [1, 1, 1]);
  const l = boss.mesh(G.cylZ(0.07, 0.07, 0.08, 14), lamp, hh, [0, 0.16, 0.33]);
  void l;
  // stubby arms on levers
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.4, 0.34, 0.05); root.add(a);
    boss.mesh(G.capsule(0.08, 0.22), tar, a, [0, -0.1, 0.12], [1.1, 0, 0]);
    arms.push(a);
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return {
    root, h: 1.0,
    update(t, dt, mood) {
      const panic = mood === 'panic', angry = mood === 'angry';
      body.scale.y = 1.08 + Math.sin(t * (panic ? 14 : 2.2)) * (panic ? 0.05 : 0.02);
      head.position.y = 0.62 + Math.sin(t * 2.2) * 0.015;
      head.rotation.z = panic ? Math.sin(t * 18) * 0.15 : angry ? Math.sin(t * 9) * 0.05 : Math.sin(t * 0.8) * 0.04;
      hh.rotation.z = head.rotation.z * 0.8;
      arms[0].rotation.x = Math.sin(t * (angry || panic ? 16 : 3)) * (angry || panic ? 0.5 : 0.12);
      arms[1].rotation.x = Math.sin(t * (angry || panic ? 16 : 3) + 1.7) * (angry || panic ? 0.5 : 0.12);
      void dt;
    },
  };
}

function buildMurkwell(boss) {
  const skin = boss.mat('mw-skin', '#4b3f6e', { roughness: 0.45, rim: 0.5, rimColor: '#b9a8ff' });
  const skinD = boss.mat('mw-skinD', '#2c2447', { roughness: 0.5 });
  const spot = boss.mat('mw-spot', '#6e5f9a', { roughness: 0.5 });
  const mouth = boss.mat('mw-mouth', '#1c0f24', { roughness: 0.6, rim: 0 });
  const tooth = boss.mat('mw-tooth', '#f4efe0', { roughness: 0.3, rim: 0.1 });
  const white = boss.mat('mw-eye', '#fff8d8', { roughness: 0.2, rim: 0 });
  const iris = boss.mat('mw-iris', '#e8c22a', { roughness: 0.2, rim: 0, emissive: '#a07a10', emissiveIntensity: 0.4 });
  const black = boss.mat('pilot-black', '#0b0714', { roughness: 0.3, rim: 0 });
  const gold = boss.mat('mw-gold', '#f5c542', { roughness: 0.25, metalness: 0.8 });
  const hatM = boss.mat('mw-hat', '#15121f', { roughness: 0.4, rim: 0.4 });
  const band = boss.mat('mw-band', '#7b3be0', { roughness: 0.5 });
  const suit = boss.mat('mw-suit', '#26223a', { roughness: 0.7 });
  const shirt = boss.mat('mw-shirt', '#f2efe8', { roughness: 0.7 });
  const lureM = boss.glowMat('mw-lure', '#ffe98a', 3);
  const root = new THREE.Group();
  // suit torso
  boss.mesh(G.cyl(0.36, 0.5, 0.5, 24), suit, root, [0, 0.25, 0]);
  boss.mesh(G.box(0.22, 0.3, 0.05), shirt, root, [0, 0.36, 0.38], [-0.25, 0, 0]);
  boss.mesh(G.box(0.07, 0.24, 0.04), band, root, [0, 0.33, 0.41], [-0.25, 0, 0]);
  // head
  const head = new THREE.Group(); head.position.set(0, 0.86, 0); root.add(head);
  boss.mesh(G.sphere(0.52, 32, 22), skin, head, [0, 0, 0], null, [1.12, 0.86, 1]);
  for (const [x, y, z] of [[-0.3, 0.25, 0.3], [0.32, 0.28, 0.26], [0.45, 0.02, 0.28], [-0.46, 0.02, 0.26], [0.1, 0.38, 0.2]]) boss.mesh(G.sphere(0.035, 8, 6), spot, head, [x, y, z]);
  // jaw (hinged) + teeth
  const jaw = new THREE.Group(); jaw.position.set(0, -0.14, 0.05); head.add(jaw);
  boss.mesh(G.hemiDown(0.5, 28, 12), skinD, jaw, [0, 0.02, 0.06], null, [1.08, 0.55, 0.98]);
  boss.mesh(G.box(0.8, 0.08, 0.2), mouth, head, [0, -0.1, 0.42]);
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + i * 0.12;
    boss.mesh(G.cone(0.035, 0.11, 6), tooth, head, [x, -0.1, 0.46 - Math.abs(x) * 0.25], [Math.PI, 0, 0]);
  }
  for (let i = 0; i < 7; i++) {
    const x = -0.36 + i * 0.12;
    boss.mesh(G.cone(0.04, 0.13, 6), tooth, jaw, [x, 0.05, 0.47 - Math.abs(x) * 0.28]);
  }
  // eyes + monocle
  for (const s of [-1, 1]) {
    const e = boss.mesh(G.sphere(0.11, 16, 12), white, head, [s * 0.24, 0.2, 0.36]);
    boss.mesh(G.sphere(0.068, 12, 10), iris, e, [0.01 * s, 0, 0.06]);
    boss.mesh(G.sphere(0.03, 10, 8), black, e, [0.01 * s, 0, 0.11]);
    boss.mesh(G.box(0.2, 0.035, 0.04), skinD, head, [s * 0.24, 0.35, 0.38], [0, 0, s * -0.3]);
  }
  boss.mesh(G.torus(0.14, 0.018, 6, 22), gold, head, [0.24, 0.2, 0.46]);
  // top hat
  const hat = new THREE.Group(); hat.position.set(0, 0.42, -0.02); hat.rotation.z = -0.12; head.add(hat);
  boss.mesh(G.cyl(0.46, 0.46, 0.035, 28), hatM, hat, [0, 0, 0]);
  boss.mesh(G.cyl(0.28, 0.3, 0.46, 24), hatM, hat, [0, 0.24, 0]);
  boss.mesh(G.cyl(0.305, 0.305, 0.09, 24), band, hat, [0, 0.07, 0]);
  // lure on a curved stalk
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.36, 0.2), new THREE.Vector3(0.05, 0.95, 0.45), new THREE.Vector3(0.08, 0.72, 0.95));
  const stalkG = new THREE.TubeGeometry(curve, 16, 0.025, 6, false);
  boss.own(stalkG);
  boss.mesh(stalkG, skinD, head);
  const bulb = boss.mesh(G.sphere(0.09, 14, 10), lureM, head, [0.08, 0.68, 0.98]);
  const lureGlow = boss.sprite('#ffe98a', 0.6, 0.7, head, [0.08, 0.68, 0.98]);
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return {
    root, h: 1.45, bulb, lureGlow,
    update(t, dt, mood) {
      const angry = mood === 'angry', panic = mood === 'panic';
      jaw.rotation.x = angry ? 0.25 + Math.sin(t * 14) * 0.15 : panic ? 0.4 + Math.sin(t * 20) * 0.1 : 0.05 + Math.sin(t * 1.4) * 0.03;
      head.rotation.y = Math.sin(t * 0.6) * 0.15;
      head.rotation.z = panic ? Math.sin(t * 17) * 0.12 : 0;
      hat.rotation.z = -0.12 + (panic ? Math.sin(t * 17) * 0.2 : 0);
      const glow = angry ? 1.25 : 0.8 + Math.sin(t * 3) * 0.2;
      lureGlow.scale.setScalar(0.6 * glow);
      lureM.emissiveIntensity = 2 + glow * 1.5;
      lureM.emissive.set(angry ? '#ff5a2a' : '#ffe98a');
      lureGlow.material.color.set(angry ? '#ff5a2a' : '#ffe98a');
      void dt;
    },
  };
}
