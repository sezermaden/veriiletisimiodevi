// Squidkin: the procedural hero model (also used for Turf Clash teammates/rivals and NPC kids).
// Two forms share one root: a chibi kid with a squid-mantle cap and tentacle hair, and a squid.
// All animation is procedural (springs + cycles); no skinning is needed.
import * as THREE from 'three';
import { charMat, inkMat, setMatColor } from './materials.js';
import { disposeTree } from '../engine/dispose.js';

const G = {};   // shared geometry cache
function geo(key, make) {
  if (!G[key]) { G[key] = make(); G[key].userData.cached = true; }
  return G[key];
}

function capsuleDown(r, len) {
  // capsule whose top cap centre sits at the origin, extending down -Y
  return geo(`capd:${r}:${len}`, () => {
    const g = new THREE.CapsuleGeometry(r, len, 6, 14);
    g.translate(0, -len / 2, 0);
    return g;
  });
}

function sphere(r, ws = 20, hs = 14) { return geo(`sph:${r}:${ws}`, () => new THREE.SphereGeometry(r, ws, hs)); }

function roundedBox(w, h, d, r) {
  return geo(`rb:${w}:${h}:${d}:${r}`, () => {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -d / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + d - r); shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    shape.lineTo(x + r, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

function finGeometry(w, h, t) {
  return geo(`fin:${w}:${h}:${t}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w * 0.55, h * 0.15, w, h);
    s.quadraticCurveTo(w * 0.2, h * 0.75, 0, h * 0.55);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.5, bevelSize: t * 0.5, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -t / 2);
    g.computeVertexNormals();
    return g;
  });
}

/** Spring-driven tentacle made of tapered capsule segments. */
class Strand {
  constructor(parent, { segs = 4, len = 0.08, r0 = 0.045, r1 = 0.02, mat, rest = [0, 0, 0], stiff = 60, damp = 7, suckers = null }) {
    this.root = new THREE.Group();
    this.root.rotation.set(rest[0], rest[1], rest[2]);
    parent.add(this.root);
    this.joints = [];
    let p = this.root;
    for (let i = 0; i < segs; i++) {
      const t = i / Math.max(1, segs - 1);
      const r = r0 + (r1 - r0) * t;
      const j = new THREE.Group();
      if (i > 0) j.position.y = -len;
      const m = new THREE.Mesh(capsuleDown(Math.round(r * 1000) / 1000, len), mat);
      m.castShadow = true;
      j.add(m);
      if (suckers && i > 0) {
        const s = new THREE.Mesh(sphere(r * 0.42, 8, 6), suckers);
        s.position.set(0, -len * 0.5, r * 0.82);
        j.add(s);
      }
      p.add(j);
      this.joints.push({ g: j, ax: 0, az: 0, vx: 0, vz: 0, k: stiff * (1 - t * 0.5), d: damp });
      p = j;
    }
  }

  update(dt, lx, lz, wave, phase) {
    for (let i = 0; i < this.joints.length; i++) {
      const J = this.joints[i];
      const f = (i + 1) / this.joints.length;
      const tx = lx * f * 0.9 + Math.sin(wave + phase + i * 0.8) * 0.12 * f;
      const tz = lz * f * 0.9 + Math.cos(wave * 0.8 + phase + i * 0.7) * 0.08 * f;
      J.vx += ((tx - J.ax) * J.k - J.vx * J.d) * dt;
      J.vz += ((tz - J.az) * J.k - J.vz * J.d) * dt;
      J.ax += J.vx * dt; J.az += J.vz * dt;
      J.g.rotation.x = J.ax;
      J.g.rotation.z = J.az;
    }
  }
}

export const DEFAULT_LOOK = {
  skin: '#f4c29b',
  top: '#27325e',
  topAccent: '#ffffff',
  bottom: '#2a2a38',
  shoes: '#f2f2f2',
  shoeAccent: '#ff8a1f',
  eye: '#2b1d14',
  hair: 'tails',     // 'tails' | 'bob' | 'spikes'
};

export class SquidkinModel {
  constructor(opts = {}) {
    this.look = { ...DEFAULT_LOOK, ...(opts.look || {}) };
    this.inkColor = new THREE.Color(opts.inkColor || '#ff8a1f');
    this.root = new THREE.Group();
    this.root.name = 'squidkin';
    this.kid = new THREE.Group();
    this.squid = new THREE.Group();
    this.root.add(this.kid, this.squid);
    this.form = 'kid';
    this.morph = 0;           // 0 = kid, 1 = squid
    this.t = Math.random() * 10;
    this.runPhase = 0;
    this._prevPos = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._lvel = new THREE.Vector3();
    this.land = 0;
    this.blink = 2 + Math.random() * 3;
    this.emoteName = null; this.emoteT = 0;

    this.mInk = inkMat(this.inkColor);
    this.mSkin = charMat(this.look.skin, { roughness: 0.55, rim: 0.3, rimColor: '#ffe0c8' });
    this.mTop = charMat(this.look.top, { roughness: 0.8 });
    this.mTopAccent = charMat(this.look.topAccent, { roughness: 0.8 });
    this.mBottom = charMat(this.look.bottom, { roughness: 0.85 });
    this.mShoe = charMat(this.look.shoes, { roughness: 0.6 });
    this.mShoeAccent = charMat(this.look.shoeAccent, { roughness: 0.5 });
    this.mSole = charMat('#e8e2d6', { roughness: 0.9, rim: 0.1 });
    this.mEyeWhite = charMat('#ffffff', { roughness: 0.25, rim: 0.05 });
    this.mIris = charMat(this.look.eye, { roughness: 0.2, rim: 0.0 });
    this.mPupil = charMat('#0a0a10', { roughness: 0.1, rim: 0.0 });
    this.mShine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.mDark = charMat('#2b1d20', { roughness: 0.7, rim: 0 });
    this.mGlass = charMat('#dff4ff', { roughness: 0.05, transparent: true, opacity: 0.35, rim: 0.6 });
    this.mSucker = charMat('#ffffff', { roughness: 0.4, rim: 0.1 });
    this.mSucker.color.copy(this.inkColor).lerp(new THREE.Color('#ffffff'), 0.55);

    this._buildKid();
    this._buildSquid();
    this.squid.visible = false;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }

  // -------------------------------------------------------------------------------------------
  _buildKid() {
    const K = this.kid;
    // hips pivot
    this.hips = new THREE.Group();
    this.hips.position.y = 0.62;
    K.add(this.hips);

    const shorts = new THREE.Mesh(sphere(0.15), this.mBottom);
    shorts.scale.set(1.05, 0.72, 0.8);
    shorts.position.y = 0.02;
    this.hips.add(shorts);

    this.legs = [];
    for (const side of [-1, 1]) {
      const thigh = new THREE.Group();
      thigh.position.set(0.085 * side, 0, 0);
      this.hips.add(thigh);
      const tm = new THREE.Mesh(capsuleDown(0.066, 0.2), this.mBottom);
      thigh.add(tm);
      const knee = new THREE.Group();
      knee.position.y = -0.27;
      thigh.add(knee);
      const shin = new THREE.Mesh(capsuleDown(0.056, 0.2), this.mSkin);
      knee.add(shin);
      const sock = new THREE.Mesh(capsuleDown(0.058, 0.04), this.mTopAccent);
      sock.position.y = -0.18;
      knee.add(sock);
      const foot = new THREE.Group();
      foot.position.y = -0.27;
      knee.add(foot);
      const shoe = new THREE.Mesh(roundedBox(0.13, 0.08, 0.25, 0.035), this.mShoe);
      shoe.position.set(0, -0.055, 0.04);
      foot.add(shoe);
      const sole = new THREE.Mesh(roundedBox(0.135, 0.03, 0.26, 0.012), this.mSole);
      sole.position.set(0, -0.07, 0.04);
      foot.add(sole);
      const stripe = new THREE.Mesh(roundedBox(0.14, 0.022, 0.12, 0.01), this.mShoeAccent);
      stripe.position.set(0, -0.02, 0.06);
      stripe.rotation.x = -0.35;
      foot.add(stripe);
      this.legs.push({ thigh, knee, foot, side });
    }

    // torso pivot (at waist)
    this.torso = new THREE.Group();
    this.torso.position.y = 0.08;
    this.hips.add(this.torso);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.14, 6, 16), this.mTop);
    body.scale.set(1.12, 1, 0.82);
    body.position.y = 0.16;
    this.torso.add(body);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 20), this.mTopAccent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.33;
    this.torso.add(collar);
    const stripeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.17, 0.045, 20, 1, true), this.mTopAccent);
    stripeBand.scale.set(1.1, 1, 0.84);
    stripeBand.position.y = 0.1;
    this.torso.add(stripeBand);

    // ink pack on the back: glass tube shows the tank level in the ink colour
    this.pack = new THREE.Group();
    this.pack.position.set(0, 0.17, -0.16);
    this.torso.add(this.pack);
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.035, 16), this.mDark);
    cap1.position.y = 0.14;
    const cap2 = cap1.clone(); cap2.position.y = -0.14;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.25, 16, 1, true), this.mGlass);
    this.packInk = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 1, 16), this.mInk);
    this.packInk.position.y = -0.125;
    this.packInk.geometry.translate(0, 0.5, 0);
    this.pack.add(cap1, cap2, glass, this.packInk);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 24, Math.PI), this.mDark);
    strap.position.set(0, 0.2, 0);
    strap.rotation.set(0, Math.PI / 2, 0);
    strap.scale.set(1, 1, 0.9);
    this.torso.add(strap);

    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.19 * side, 0.28, 0);
      this.torso.add(sh);
      const sleeve = new THREE.Mesh(sphere(0.062), this.mTop);
      sleeve.scale.set(1, 1.1, 1);
      sh.add(sleeve);
      const upper = new THREE.Mesh(capsuleDown(0.043, 0.13), this.mSkin);
      sh.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.17;
      sh.add(elbow);
      const fore = new THREE.Mesh(capsuleDown(0.04, 0.12), this.mSkin);
      elbow.add(fore);
      const hand = new THREE.Group();
      hand.position.y = -0.17;
      elbow.add(hand);
      const palm = new THREE.Mesh(sphere(0.052), this.mSkin);
      palm.scale.set(0.9, 1, 1);
      hand.add(palm);
      this.arms.push({ sh, elbow, hand, side });
    }
    this.weaponSocket = new THREE.Group();
    this.weaponSocket.position.set(0, -0.02, 0.02);
    this.gunArm = this.arms[0];          // side -1 = the character's RIGHT (model faces +Z)
    this.gunArm.hand.add(this.weaponSocket);

    // head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.36;
    this.torso.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.19;
    this.head.scale.setScalar(1.16);     // chibi proportions: big head, big eyes
    this.neck.add(this.head);
    const skull = new THREE.Mesh(sphere(0.205, 28, 20), this.mSkin);
    skull.scale.set(1.0, 0.96, 0.95);
    this.head.add(skull);
    const earL = new THREE.Mesh(sphere(0.04), this.mSkin); earL.scale.set(0.6, 1, 0.8); earL.position.set(-0.2, -0.01, -0.01);
    const earR = earL.clone(); earR.position.x = 0.2;
    this.head.add(earL, earR);

    // eyes (big, glossy)
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(0.082 * side, 0.005, 0.168);
      e.rotation.y = 0.28 * side;
      const white = new THREE.Mesh(sphere(0.06, 20, 14), this.mEyeWhite);
      white.scale.set(0.82, 1.12, 0.42);
      const iris = new THREE.Mesh(sphere(0.042, 18, 12), this.mIris);
      iris.scale.set(0.8, 1.05, 0.35);
      iris.position.z = 0.018;
      const pupil = new THREE.Mesh(sphere(0.022, 12, 8), this.mPupil);
      pupil.scale.set(0.9, 1.1, 0.35);
      pupil.position.z = 0.03;
      const shine = new THREE.Mesh(sphere(0.011, 8, 6), this.mShine);
      shine.position.set(0.012 * side, 0.02, 0.036);
      e.add(white, iris, pupil, shine);
      this.head.add(e);
      this.eyes.push(e);
    }
    // brows + mouth
    this.brows = [];
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(capsuleDown(0.012, 0.05), this.mDark);
      b.rotation.z = Math.PI / 2 + 0.25 * side;
      b.position.set(0.105 * side - 0.025 * side, 0.1, 0.168);
      b.rotation.y = 0.3 * side;
      this.head.add(b);
      this.brows.push(b);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 14, Math.PI), this.mDark);
    this.mouth.rotation.set(0, 0, Math.PI);
    this.mouth.position.set(0, -0.085, 0.186);
    this.head.add(this.mouth);
    const cheekMat = charMat('#ff8f8f', { transparent: true, opacity: 0.35, rim: 0 });
    for (const side of [-1, 1]) {
      const ch = new THREE.Mesh(sphere(0.03, 10, 8), cheekMat);
      ch.scale.set(1, 0.6, 0.3);
      ch.position.set(0.12 * side, -0.06, 0.155);
      this.head.add(ch);
    }

    // squid-mantle cap + fins (ink coloured)
    this.cap = new THREE.Group();
    this.head.add(this.cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.222, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), this.mInk);
    dome.position.y = 0.012;
    dome.rotation.x = -0.18;
    dome.scale.set(1.02, 1.0, 1.03);
    this.cap.add(dome);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 18), this.mInk);
    peak.position.set(0, 0.24, -0.04);
    peak.rotation.x = -0.35;
    this.cap.add(peak);
    this.fins = [];
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeometry(0.18, 0.2, 0.03), this.mInk);
      fin.position.set(0.1 * side, 0.18, -0.05);
      fin.rotation.set(0, side > 0 ? 0 : Math.PI, -0.35);
      fin.rotation.y += side * 0.2;
      this.cap.add(fin);
      this.fins.push(fin);
    }
    // bangs: little front tentacle tips curling over the forehead
    for (const side of [-1, 0, 1]) {
      const bang = new THREE.Mesh(sphere(0.05, 12, 8), this.mInk);
      bang.scale.set(1.1, 0.7, 0.7);
      bang.position.set(0.07 * side, 0.13, 0.16 - Math.abs(side) * 0.02);
      this.cap.add(bang);
    }

    // tentacle hair
    this.strands = [];
    const style = this.look.hair;
    const back = style === 'bob'
      ? [[-0.11, 0.02, -0.14, 0.1, 0.25], [0.11, 0.02, -0.14, 0.1, -0.25], [0, 0.05, -0.18, 0.2, 0]]
      : style === 'spikes'
        ? [[-0.09, 0.14, -0.17, 1.1, 0.4], [0.09, 0.14, -0.17, 1.1, -0.4], [0, 0.16, -0.18, 1.3, 0]]
        : [[-0.13, 0.03, -0.12, 0.25, 0.2], [0.13, 0.03, -0.12, 0.25, -0.2], [-0.06, 0.06, -0.18, 0.35, 0.1], [0.06, 0.06, -0.18, 0.35, -0.1]];
    for (const [x, y, z, rx, rz] of back) {
      const anchor = new THREE.Group();
      anchor.position.set(x, y, z);
      this.head.add(anchor);
      const s = new Strand(anchor, { segs: style === 'bob' ? 3 : 4, len: style === 'spikes' ? 0.06 : 0.075, r0: 0.05, r1: 0.022, mat: this.mInk, rest: [rx, 0, rz], stiff: 70, damp: 8 });
      this.strands.push(s);
    }
    // two long side tentacles with suckers
    for (const side of [-1, 1]) {
      const anchor = new THREE.Group();
      anchor.position.set(0.18 * side, 0.02, 0.02);
      this.head.add(anchor);
      const s = new Strand(anchor, { segs: 5, len: 0.07, r0: 0.045, r1: 0.024, mat: this.mInk, rest: [0.1, 0, 0.15 * side], stiff: 55, damp: 7, suckers: this.mSucker });
      this.strands.push(s);
    }
  }

  _buildSquid() {
    const S = this.squid;
    this.squidBody = new THREE.Group();
    S.add(this.squidBody);
    // mantle: lathe profile, tip forward (+Z)
    const prof = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = 0.15 * Math.sin(Math.min(1, t * 5) * Math.PI * 0.5) * Math.pow(1 - t, 0.8) + 0.0005;
      prof.push(new THREE.Vector2(r, t * 0.45));
    }
    const lathe = new THREE.LatheGeometry(prof, 20);
    lathe.rotateX(Math.PI / 2);
    lathe.translate(0, 0, -0.08);
    const mantle = new THREE.Mesh(lathe, this.mInk);
    mantle.scale.set(1, 0.72, 1);
    this.squidBody.add(mantle);
    // arrow-head fins near the tip
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeometry(0.2, 0.18, 0.028), this.mInk);
      fin.rotation.set(-Math.PI / 2, 0, side > 0 ? -0.6 : Math.PI + 0.6);
      fin.position.set(0.04 * side, 0.0, 0.24);
      this.squidBody.add(fin);
    }
    // head + eyes
    const headS = new THREE.Mesh(sphere(0.12, 20, 14), this.mInk);
    headS.scale.set(1.05, 0.75, 1.0);
    headS.position.set(0, 0, -0.13);
    this.squidBody.add(headS);
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(0.1 * side, 0.03, -0.14);
      e.rotation.y = 1.1 * side;
      const w = new THREE.Mesh(sphere(0.045, 14, 10), this.mEyeWhite);
      w.scale.set(0.8, 1, 0.5);
      const p = new THREE.Mesh(sphere(0.026, 10, 8), this.mPupil);
      p.scale.set(0.8, 1, 0.4); p.position.z = 0.022;
      const sh = new THREE.Mesh(sphere(0.008, 6, 4), this.mShine);
      sh.position.set(0.008, 0.012, 0.032);
      e.add(w, p, sh);
      this.squidBody.add(e);
    }
    // tentacles trailing back (-Z)
    this.squidStrands = [];
    const tAnchor = new THREE.Group();
    tAnchor.position.set(0, -0.01, -0.2);
    tAnchor.rotation.x = Math.PI / 2;      // strands hang along -Y → point along -Z
    this.squidBody.add(tAnchor);
    const spots = [[-0.07, 0.02], [-0.025, 0.04], [0.025, 0.04], [0.07, 0.02], [-0.05, -0.03], [0.05, -0.03]];
    for (let i = 0; i < spots.length; i++) {
      const a = new THREE.Group();
      a.position.set(spots[i][0], 0, spots[i][1]);
      tAnchor.add(a);
      this.squidStrands.push(new Strand(a, { segs: 3, len: 0.055, r0: 0.03, r1: 0.014, mat: this.mInk, rest: [0, 0, spots[i][0] * 2], stiff: 80, damp: 8 }));
    }
    for (const side of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(0.035 * side, 0, 0);
      tAnchor.add(a);
      this.squidStrands.push(new Strand(a, { segs: 5, len: 0.06, r0: 0.026, r1: 0.016, mat: this.mInk, rest: [0, 0, 0.12 * side], stiff: 60, damp: 7, suckers: this.mSucker }));
    }
    this.squidBody.position.y = 0.12;
  }

  setInkColor(c) {
    this.inkColor.set(c);
    setMatColor(this.mInk, this.inkColor);
    this.mSucker.color.copy(this.inkColor).lerp(new THREE.Color('#ffffff'), 0.55);
  }

  setForm(form, instant = false) {
    this.form = form;
    if (instant) this.morph = form === 'squid' ? 1 : 0;
  }

  emote(name, time = 2.5) { this.emoteName = name; this.emoteT = time; }

  /**
   * @param {number} dt
   * @param {object} s  animation state: speed (m/s horizontal), grounded, vy, aiming, aimPitch,
   *   firing, submerged, climbing, inkLevel (0..1), moving, landed (impact 0..1), hidden
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    // world-space velocity of the root → local space, drives hair lag
    this.root.updateMatrixWorld();
    const wp = this.root.getWorldPosition(new THREE.Vector3());
    if (dt > 0) this._vel.subVectors(wp, this._prevPos).divideScalar(dt);
    if (this._vel.lengthSq() > 900) this._vel.set(0, 0, 0);   // teleport
    this._prevPos.copy(wp);
    this._lvel.copy(this._vel).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()).invert());

    // morph between forms (elastic)
    const target = this.form === 'squid' ? 1 : 0;
    this.morph += (target - this.morph) * Math.min(1, dt * 16);
    if (Math.abs(target - this.morph) < 0.01) this.morph = target;
    const m = this.morph;
    const kidScale = Math.max(0.001, 1 - m * 1.25);
    const squidScale = Math.max(0.001, (m - 0.2) / 0.8);
    this.kid.visible = kidScale > 0.02 && !s.hidden;
    this.squid.visible = squidScale > 0.02 && !s.hidden && !s.submerged;
    this.kid.scale.setScalar(kidScale);
    const pop = m > 0 && m < 1 ? 1 + Math.sin(m * Math.PI) * 0.25 : 1;
    this.squid.scale.setScalar(squidScale * pop);

    if (this.kid.visible) this._animateKid(dt, s, t);
    if (this.squid.visible || s.submerged) this._animateSquid(dt, s, t);
    if (this.packInk) this.packInk.scale.y = Math.max(0.001, 0.25 * (s.inkLevel ?? 1));
  }

  _animateKid(dt, s, t) {
    const speed = s.speed || 0;
    const run = Math.min(1, speed / 5.5);
    const air = !s.grounded;
    this.runPhase += dt * (4 + speed * 1.55) * (air ? 0.3 : 1);
    const ph = this.runPhase;
    this.land = Math.max(0, this.land - dt * 5);
    if (s.landed) this.land = Math.min(1, this.land + s.landed);

    // hips bob + squash on landing
    const bob = air ? 0 : Math.abs(Math.sin(ph)) * 0.05 * run;
    this.hips.position.y = 0.62 + bob - this.land * 0.1 + (air ? 0.02 : 0);
    this.kid.scale.y *= 1 - this.land * 0.12;
    this.torso.rotation.x = run * 0.18 + (air ? -0.1 : 0) - this.land * 0.15;
    this.torso.rotation.y = Math.sin(ph) * 0.12 * run;
    this.torso.rotation.z = 0;

    // legs
    for (const L of this.legs) {
      const p = ph + (L.side > 0 ? Math.PI : 0);
      if (air) {
        const tuck = s.vy > 0 ? 0.9 : 0.5;
        L.thigh.rotation.x = -tuck * (L.side > 0 ? 1 : 0.6);
        L.knee.rotation.x = tuck * 1.4;
        L.foot.rotation.x = -0.2;
      } else {
        L.thigh.rotation.x = Math.sin(p) * 0.85 * run + this.land * -0.4;
        L.knee.rotation.x = Math.max(0, -Math.cos(p)) * 1.2 * run + this.land * 0.8 + 0.05;
        L.foot.rotation.x = -Math.sin(p) * 0.3 * run;
      }
      L.thigh.rotation.z = L.side * 0.03;
    }

    // arms: swing, or aim with the weapon arm
    const aim = s.aiming;
    const pitch = s.aimPitch || 0;
    for (const A of this.arms) {
      const p = ph + (A.side > 0 ? 0 : Math.PI);
      if (A === this.gunArm && aim) {
        A.sh.rotation.set(-Math.PI / 2 - pitch + (s.recoil || 0) * 0.3, 0, 0.1);
        A.elbow.rotation.x = -0.15;
      } else if (A !== this.gunArm && aim) {
        A.sh.rotation.set(-1.2 - pitch * 0.6, 0.4, -0.25);
        A.elbow.rotation.x = -0.9;
      } else if (air) {
        A.sh.rotation.set(-0.6, 0, A.side * 0.9);
        A.elbow.rotation.x = -0.5;
      } else if (A === this.gunArm) {
        // ready stance: weapon held forward at the hip, bobbing with the run
        A.sh.rotation.set(-0.3 + Math.sin(p) * 0.25 * run, 0, -0.1);
        A.elbow.rotation.x = -1.15 + Math.sin(p) * 0.15 * run;
      } else {
        A.sh.rotation.set(Math.sin(p) * 0.9 * run, 0, A.side * (0.12 + run * 0.1));
        A.elbow.rotation.x = -0.25 - run * 0.7;
      }
    }

    // head: look where aiming, breathe, blink
    this.neck.rotation.x = aim ? -pitch * 0.45 : Math.sin(t * 1.6) * 0.03;
    this.head.rotation.z = Math.sin(t * 0.9) * 0.03 * (1 - run);
    this.blink -= dt;
    const blinkAmt = this.blink < 0.12 ? 0.1 : 1;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3.5;
    for (const e of this.eyes) e.scale.y = blinkAmt;
    for (const f of this.fins) f.rotation.z = -0.35 + Math.sin(t * 3 + f.position.x) * 0.05 - run * 0.1;

    // emotes
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const e = this.emoteName;
      if (e === 'cheer' || e === 'win') {
        for (const A of this.arms) { A.sh.rotation.set(-2.6 + Math.sin(t * 10 + A.side) * 0.3, 0, A.side * 0.4); A.elbow.rotation.x = -0.3; }
        this.hips.position.y += Math.abs(Math.sin(t * 8)) * 0.12;
      } else if (e === 'wave') {
        const A = this.arms[1];
        A.sh.rotation.set(-2.4, 0, 0.5 + Math.sin(t * 9) * 0.35);
        A.elbow.rotation.x = -0.6;
      } else if (e === 'sad' || e === 'lose') {
        this.torso.rotation.x = 0.45; this.neck.rotation.x = 0.5;
        for (const A of this.arms) { A.sh.rotation.set(0.2, 0, A.side * 0.05); A.elbow.rotation.x = -0.1; }
      }
    }

    // hair springs react to local velocity (lag behind motion)
    const lx = THREE.MathUtils.clamp(this._lvel.z * 0.09 + (air ? -s.vy * 0.03 : 0), -1.1, 1.1);
    const lz = THREE.MathUtils.clamp(-this._lvel.x * 0.07, -0.8, 0.8);
    for (let i = 0; i < this.strands.length; i++) this.strands[i].update(dt, lx, lz, t * (2 + run * 4), i * 1.3);
  }

  _animateSquid(dt, s, t) {
    const speed = s.speed || 0;
    const sw = Math.min(1, speed / 9);
    const b = this.squidBody;
    if (s.climbing) {
      b.rotation.set(-Math.PI / 2, 0, 0);
      b.position.set(0, 0.2, -0.1);
    } else {
      const hop = s.submerged ? 0 : Math.abs(Math.sin(t * 9)) * 0.1 * (speed > 0.5 ? 1 : 0.3);
      b.rotation.set(-0.15 - (s.vy || 0) * 0.03 + Math.sin(t * 8) * 0.04 * sw, 0, Math.sin(t * 5) * 0.08 * sw);
      b.position.set(0, 0.12 + hop, 0);
    }
    const stretch = 1 + sw * 0.25;
    b.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
    for (let i = 0; i < this.squidStrands.length; i++) this.squidStrands[i].update(dt, -0.2 - sw * 0.5, 0, t * (6 + sw * 10), i * 0.9);
  }

  dispose() {
    disposeTree(this.root);
  }
}
