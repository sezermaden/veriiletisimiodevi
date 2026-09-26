// The two sea-otter judges (Otto & Tilly) in their booth beside the arena. They watch the match,
// then at the end do a drumroll and raise flags in the winning team's colour.
// Uses makeNpcModel('otto' | 'tilly') from entities/npc when it exists; otherwise builds simple
// procedural otters so the ceremony always works.
import * as THREE from 'three';
import { charMat } from '../actors/materials.js';
import { disposeTree } from '../engine/dispose.js';

async function loadNpcMaker() {
  try {
    const m = await import('../entities/npc/index.js');
    return typeof m.makeNpcModel === 'function' ? m.makeNpcModel : null;
  } catch { return null; }
}

/** Minimal fallback otter: body, head, ears, snout, arms (arms[i].sh), tail. */
function simpleOtter(who) {
  const root = new THREE.Group();
  const fur = charMat(who === 'tilly' ? '#b07c52' : '#8a5a3c', { roughness: 0.85, rim: 0.4 });
  const cream = charMat('#ecd2ad', { roughness: 0.85 });
  const dark = charMat('#16141f', { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.32, 6, 14), fur);
  body.position.y = 0.45;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), cream);
  belly.position.set(0, 0.45, 0.07); belly.scale.set(1, 1.3, 0.7);
  const head = new THREE.Group(); head.position.y = 0.92;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), fur);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), cream); snout.position.set(0, -0.06, 0.19); snout.scale.set(1.3, 0.8, 0.9);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), dark); nose.position.set(0, -0.02, 0.28);
  head.add(skull, snout, nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), dark); eye.position.set(s * 0.08, 0.05, 0.2);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), fur); ear.position.set(s * 0.18, 0.15, -0.02);
    head.add(eye, ear);
  }
  root.add(body, belly, head);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.22, 0.68, 0.02); sh.rotation.z = s * 0.35;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), fur); arm.position.y = -0.14;
    sh.add(arm); root.add(sh);
    arms.push({ sh, s });
  }
  const t0 = Math.random() * 5;
  return {
    root, arms, head,
    update(dt) { this._t = (this._t ?? t0) + dt; root.position.y = Math.abs(Math.sin(this._t * 2)) * 0.01; },
    emote() {},
    dispose() { disposeTree(root); },
  };
}

function makeFlag(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.95, 8), charMat('#e8e2d6', { roughness: 0.5 }));
  pole.position.y = 0.3;
  const clothMat = charMat(color, { roughness: 0.6, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.25 });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36, 6, 2), clothMat);
  cloth.position.set(0.29, 0.6, 0);
  g.add(pole, cloth);
  g.userData.cloth = cloth;
  g.userData.clothMat = clothMat;
  return g;
}

export class JudgeBooth {
  /**
   * @param {Session} session
   * @param {object} judge  { pos:[x,y,z], yaw } booth position (otters' feet) and facing
   */
  constructor(session, judge) {
    this.S = session;
    this.group = new THREE.Group();
    this.group.name = 'turf-judges';
    const pos = judge?.pos || [0, 3, -28];
    this.group.position.fromArray(pos);
    this.group.rotation.y = judge?.yaw || 0;
    session.scene.add(this.group);
    this.otters = [];
    this.flags = [];
    this.state = 'watch';
    this.t = 0;
    this._buildBooth(pos[1]);
    this.ready = this._spawnOtters();
  }

  _buildBooth(height) {
    const G = this.group;
    const wood = charMat('#b98a5a', { roughness: 0.8, rim: 0.1 });
    const white = charMat('#f4f1ea', { roughness: 0.7, rim: 0.1 });
    const red = charMat('#e24a4a', { roughness: 0.6, rim: 0.1 });
    const dark = charMat('#2b2f3e', { roughness: 0.6, rim: 0.1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 2.6), wood);
    deck.position.y = -0.125;
    G.add(deck);
    // stilts down into the water
    const legH = height + 4;
    for (const [x, z] of [[-2, -1.1], [2, -1.1], [-2, 1.1], [2, 1.1]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, legH, 8), dark);
      l.position.set(x, -legH / 2, z);
      G.add(l);
    }
    // desk with a striped front
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.35), white);
    desk.position.set(0, 0.25, 1.05);
    G.add(desk);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.12, 0.37), red);
    stripe.position.set(0, 0.36, 1.05);
    G.add(stripe);
    // riser the judges stand on
    const riser = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 1.1), wood);
    riser.position.set(0, 0.15, 0.2);
    G.add(riser);
    // striped canopy (a beach umbrella: 12 red / white gores)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), dark);
    pole.position.set(0, 1.7, -0.9);
    G.add(pole);
    const c = document.createElement('canvas');
    c.width = 96; c.height = 4;
    const x = c.getContext('2d');
    for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#f4f1ea' : '#e24a4a'; x.fillRect(i * 8, 0, 8, 4); }
    const stripes = new THREE.CanvasTexture(c);
    stripes.colorSpace = THREE.SRGBColorSpace;
    const canopyMat = charMat('#ffffff', { roughness: 0.6, rim: 0.1, side: THREE.DoubleSide });
    canopyMat.map = stripes;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.75, 12, 1, true), canopyMat);
    canopy.position.set(0, 3.6, -0.6);
    G.add(canopy);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), white);
    tip.position.set(0, 4.03, -0.6);
    G.add(tip);
    G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  async _spawnOtters() {
    const make = await loadNpcMaker();
    if (!this.group.parent) return;          // disposed while loading
    for (const [who, x] of [['otto', -0.85], ['tilly', 0.85]]) {
      let m = null;
      try { m = make ? make(who, { session: this.S }) : null; } catch (e) { console.warn('[turf] judge model', e); }
      if (!m || !m.root) m = simpleOtter(who);
      m.root.position.set(x, 0.3, 0.3);
      m.root.rotation.y = x < 0 ? 0.18 : -0.18;
      this.group.add(m.root);
      // flag for the free paw (raised at the verdict)
      const arm = m.arms?.[0]?.sh || null;
      const flag = makeFlag('#ffffff');
      flag.visible = false;
      // in the paw, pole running out along the arm (flipped): raised arm → flag above the head
      if (arm) { flag.position.set(0, -0.27, 0.04); flag.rotation.z = Math.PI; flag.scale.setScalar(1.25); arm.add(flag); } else { flag.position.set(x - 0.3, 0.9, 0.5); this.group.add(flag); }
      this.otters.push({ m, arm, x, rest: arm ? arm.sh?.rotation?.x ?? 0 : 0 });
      this.flags.push(flag);
    }
    // the verdict came before the models finished loading: show it now
    if (this.state === 'reveal' && this.revealColor) this.reveal(this.revealColor, true);
    else if (this.state === 'drum') for (const o of this.otters) o.m.emote?.('nod', 3);
  }

  /** World point to frame the close-up on. */
  focus(out) { return this.group.localToWorld(out.set(0, 1.25, 0.3)); }

  /** Camera position for the close-up (in front of the desk, a little to the side). */
  cameraPos(out) { return this.group.localToWorld(out.set(0.9, 1.75, 3.6)); }

  drumroll() { this.state = 'drum'; this.t = 0; for (const o of this.otters) o.m.emote?.('nod', 3); }

  reveal(color, late = false) {
    this.state = 'reveal';
    this.revealColor = color;
    if (!late) this.t = 0;
    for (const f of this.flags) {
      f.visible = true;
      f.userData.clothMat.color.set(color);
      f.userData.clothMat.emissive.set(color);
    }
    for (const o of this.otters) {
      o.m.emote?.('cheer', 4);
      // Otto's own little prop flag would dangle upside down next to the verdict flag: put it away
      if (o.m.flag?.parent && o.m.flag.parent !== o.m.root) o.m.flag.parent.visible = false;
      else if (o.m.flag?.material) o.m.flag.material.color.set(color);
    }
  }

  update(dt) {
    this.t += dt;
    const st = this._st || (this._st = { talking: false });
    st.talking = this.state === 'drum';
    for (const o of this.otters) {
      o.m.update?.(dt, st);
      if (!o.arm) continue;
      if (this.state === 'drum') {
        // tapping the desk
        o.arm.rotation.x = -0.9 + Math.sin(this.t * 26 + o.x * 3) * 0.25;
      } else if (this.state === 'reveal') {
        const k = Math.min(1, this.t / 0.25);
        o.arm.rotation.x = -0.4 - k * 2.5 + Math.sin(this.t * 9 + o.x) * 0.08;
        o.arm.rotation.z = o.x < 0 ? -0.2 : 0.2;
      }
    }
    for (const f of this.flags) if (f.visible) f.userData.cloth.rotation.y = Math.sin(this.t * 7) * 0.35;
  }

  dispose() {
    this.S.scene.remove(this.group);
    for (const f of this.flags) { f.parent?.remove(f); disposeTree(f); }
    for (const o of this.otters) { this.group.remove(o.m.root); o.m.dispose?.(); }
    disposeTree(this.group);
  }
}
