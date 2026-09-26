// SLUDGE SERPENT — a segmented eel mech that lives in the refinery's sludge vats (World 3).
//
// The head surfaces from a vat (bubbles + ring warn first), rears up like a cobra and fires a
// sludge beam (red aiming laser → a sweeping jet that paints a line of Murk), then arcs through
// the air into another vat. Its segments follow the head's exact path; touching them hurts and
// they drip Murk. Glowing kelp-green cells on three segments per phase are the weak points and
// are only exposed while the body is out of the sludge. Phase 2 arcs faster and fires beams in
// mid-air. Phase 3: it swims circles around the central platform, rearing to beam the player —
// use the launchpads and islands. Nine cells in total.
//
//   { type: 'boss-serpent', pos (arena centre), vats: [[x,y,z]…], vatR, sludgeY, seaY, ring }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { Boss, Beam, G, UP, DOWN, TEAM_MURK, clamp, lerp, smooth, easeOut, hash01, mergeStatic, EYE_RED, EYE_AMBER } from './common.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _hc = new THREE.Vector3();

const SEGS = 14;
const SPACING = 1.55;
const CAP = 1024;
const CELL_HP = [0, 140, 175, 210];
const WEAK = [null, [3, 7, 11], [5, 9, 13], [2, 6, 10]];
const PH = [null,
  { arc: 11, rise: 1.0, beams: 1, aim: 0.95, sweep: 0.85, rest: 1.3 },
  { arc: 13.5, rise: 0.7, beams: 2, aim: 0.8, sweep: 0.75, rest: 0.9 },
  { arc: 14, rise: 0.7, beams: 1, rest: 0.8, swim: 9, aim: 0.8, sweep: 0.8, beamEvery: 3.6 },
];

/** Head position history the body follows (ring buffer of samples ≥ 0.2 m apart). */
class Trail {
  constructor() {
    this.x = new Float32Array(CAP); this.y = new Float32Array(CAP); this.z = new Float32Array(CAP); this.d = new Float64Array(CAP);
    this.n = 0; this.head = -1;
  }
  reset() { this.n = 0; this.head = -1; }
  push(x, y, z, force = false) {
    if (this.n > 0) {
      const i = this.head;
      const dx = x - this.x[i], dy = y - this.y[i], dz = z - this.z[i];
      const dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dd < 0.2 && !force) return;
      const j = (i + 1) % CAP;
      this.x[j] = x; this.y[j] = y; this.z[j] = z; this.d[j] = this.d[i] + dd;
      this.head = j; this.n = Math.min(CAP, this.n + 1);
    } else {
      this.head = 0; this.n = 1;
      this.x[0] = x; this.y[0] = y; this.z[0] = z; this.d[0] = 0;
    }
  }
  /**
   * Sample points at arc distances s[k] behind (headX, headY, headZ) — the live head position is
   * the implicit newest point. `out` is an array of Vector3. s must be ascending.
   */
  sample(hx, hy, hz, s, out) {
    if (this.n === 0) { for (let k = 0; k < s.length; k++) out[k].set(hx, hy, hz); return; }
    const i0 = this.head;
    const ddh = Math.hypot(hx - this.x[i0], hy - this.y[i0], hz - this.z[i0]);
    const dHead = this.d[i0] + ddh;
    let i = i0, c = 0;
    for (let k = 0; k < s.length; k++) {
      const target = dHead - s[k];
      if (target >= this.d[i0]) {
        const f = ddh > 1e-6 ? (dHead - target) / ddh : 0;
        out[k].set(hx + (this.x[i0] - hx) * f, hy + (this.y[i0] - hy) * f, hz + (this.z[i0] - hz) * f);
        continue;
      }
      while (c < this.n - 1) {
        const p = (i - 1 + CAP) % CAP;
        if (this.d[p] <= target) break;
        i = p; c++;
      }
      if (c >= this.n - 1) { out[k].set(this.x[i], this.y[i], this.z[i]); continue; }
      const p = (i - 1 + CAP) % CAP;
      const span = this.d[i] - this.d[p];
      const f = span > 1e-6 ? (target - this.d[p]) / span : 0;
      out[k].set(this.x[p] + (this.x[i] - this.x[p]) * f, this.y[p] + (this.y[i] - this.y[p]) * f, this.z[p] + (this.z[i] - this.z[p]) * f);
    }
  }
}

export class Serpent extends Boss {
  constructor(session, def) {
    super(session, def, { name: 'Sludge Serpent', coreColor: '#5fe08a', phases: 3 });
    this.center = this.position.clone();
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.vats = (def.vats || [[0, 0, -19], [19, 0, 0], [0, 0, 19], [-19, 0, 0]]).map((p) => new THREE.Vector3().fromArray(p));
    this.vatR = def.vatR ?? 4.3;
    this.sludgeY = def.sludgeY ?? (this.floorY + 3);
    this.seaY = def.seaY ?? (this.floorY - 1.5);
    this.ringR = def.ring ?? 12;
    this.trail = new Trail();
    this.head = new THREE.Vector3();
    this.headDir = new THREE.Vector3(0, 0, 1);
    this.lookYaw = 0; this.lookPitch = 0;
    this.jaw = 0;
    this.vatA = 0; this.vatB = 2;
    this.u = 0;
    this.arcS = new THREE.Vector3(); this.arcC = new THREE.Vector3(); this.arcE = new THREE.Vector3();
    this.beamsLeft = 0;
    this.beamFrom = new THREE.Vector3(); this.beamTo = new THREE.Vector3(); this.beamA = new THREE.Vector3(); this.beamB = new THREE.Vector3();
    this.beamPaint = new THREE.Vector3(); this.beamOn = false;
    this.dripT = 0;
    this.cellsBroken = 0;
    this.circleAng = 0; this.circleBeamT = 0; this.rearK = 0;
    this.defeatDuration = 5.0;
    this.defeatCamDist = 17; this.defeatCamHeight = 4;
    this.defeatBooms = 3.8;
    this.armorHint = 'Its armour is too thick! Shoot the glowing green cells on its back.';
    this.segPos = []; this.sArr = [];
    for (let i = 0; i <= SEGS; i++) { this.segPos.push(new THREE.Vector3()); this.sArr.push(1.2 + i * SPACING); }
    this.segRight = [];
    for (let i = 0; i <= SEGS; i++) this.segRight.push(new THREE.Vector3(1, 0, 0));
    this.bodyLen = this.sArr[SEGS] + 1;
    this._build();
    this.beam = new Beam(this, this.pal.ink.clone().lerp(new THREE.Color('#9dff6a'), 0.15), 0.55);
    this.beams = [this.beam];
    this._seedRear(this.dormant ? null : 0);
    this.setState(this.dormant ? 'idle' : 'intro');
    this._updateBody();
    this.headG.position.copy(this.head);
  }

  // ---------------------------------------------------------------------------------------------
  _build() {
    const P = this.pal;
    const armor = this.mat('armor', new THREE.Color('#2b2638').lerp(P.ink, 0.1), { roughness: 0.35, metalness: 0.5 });
    const plate = this.mat('plate', new THREE.Color('#4e4764').lerp(P.ink, 0.12), { roughness: 0.35, metalness: 0.55 });
    const belly = this.mat('belly', '#8d86a3', { roughness: 0.5, metalness: 0.3 });
    const steel = this.mat('steel', P.steel, { roughness: 0.3, metalness: 0.7 });
    const seam = this.glowMat('seam', P.ink.clone().lerp(new THREE.Color('#ffffff'), 0.15), 1.4);
    const tooth = this.mat('tooth', '#e9e4d8', { roughness: 0.3, metalness: 0.2 });
    const eye = this.glowMat('eye', '#ffd23a', 3);
    const mouthGlow = this.glowMat('mouth', P.ink.clone().lerp(new THREE.Color('#9dff6a'), 0.3), 2.5);
    const yellow = this.mat('yellow', P.hazard, { roughness: 0.4 });
    this.eyeMat = eye; this.mouthMat = mouthGlow; this.seamMat = seam;
    const root = this.model;

    // ---- head ----
    const head = this.headG = this.node(root);
    const skull = this.node(head, [0, 0, 0]);
    this.mesh(G.sphere(1.0, 28, 20), armor, skull, [0, 0.1, -0.2], null, [1.15, 0.95, 1.5]);
    this.mesh(G.rbox(1.7, 0.55, 1.9, 0.2), plate, skull, [0, 0.45, 0.75], [-0.08, 0, 0]);
    this.mesh(G.box(0.12, 0.5, 2.4), yellow, skull, [0, 0.8, -0.3]);
    // crest fin
    for (let i = 0; i < 4; i++) this.mesh(G.cone(0.22, 0.9 - i * 0.12, 4), plate, skull, [0, 0.95 - i * 0.05, -0.2 - i * 0.55], [-1.1, 0, 0]);
    // eyes (angry slits under brow plates)
    for (const s of [-1, 1]) {
      this.mesh(G.sphere(0.2, 14, 10), eye, skull, [s * 0.72, 0.38, 0.75], null, [1, 0.6, 1]);
      this.mesh(G.box(0.55, 0.14, 0.5), plate, skull, [s * 0.68, 0.56, 0.78], [0.25, 0, s * -0.35]);
      this.eyeGlow = this.sprite('#ffd23a', 1.1, 0.5, skull, [s * 0.76, 0.38, 0.9]);
    }
    // upper jaw teeth + mouth glow + cannon
    for (let i = 0; i < 6; i++) {
      const x = -0.55 + i * 0.22;
      this.mesh(G.cone(0.08, 0.3, 6), tooth, skull, [x, -0.18, 1.35 - Math.abs(x) * 0.5], [Math.PI, 0, 0]);
    }
    this.mesh(G.cylZ(0.26, 0.34, 0.8, 16), steel, skull, [0, -0.1, 1.05]);
    this.mesh(G.sphere(0.24, 14, 10), mouthGlow, skull, [0, -0.1, 1.45]);
    this.muzzle = this.node(skull, [0, -0.15, 1.7]);
    this.mouthGlow = this.sprite('#b58cff', 1.6, 0.4, skull, [0, -0.15, 1.6]);
    // lower jaw (hinged)
    const jaw = this.jawG = this.node(head, [0, -0.35, -0.2]);
    this.mesh(G.rbox(1.35, 0.35, 1.8, 0.15), plate, jaw, [0, -0.1, 0.8]);
    this.mesh(G.rbox(1.1, 0.14, 1.5, 0.06), belly, jaw, [0, 0.08, 0.8]);
    for (let i = 0; i < 5; i++) {
      const x = -0.44 + i * 0.22;
      this.mesh(G.cone(0.08, 0.28, 6), tooth, jaw, [x, 0.18, 1.45 - Math.abs(x) * 0.5]);
    }
    // gill vents
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) this.mesh(G.box(0.06, 0.45, 0.12), seam, skull, [s * 1.1, 0.0, -0.4 - i * 0.28], [0, s * 0.2, 0]);
    head.scale.setScalar(1.3);
    this.headR = 1.6;
    this.headPart = this.part({ kind: 'armor', anchor: skull, offset: [0, 0.1, 0.2], radius: 1.25 });
    // neck: a tapered armoured tube re-aimed every frame from the back of the skull to segment 1
    const neck = this.neck = this.node(root);
    this.mesh(G.cyl(0.8, 1.0, 1, 18), armor, neck, [0, 0.5, 0]);
    this.mesh(G.torus(0.86, 0.06, 6, 24), seam, neck, [0, 0.35, 0], [Math.PI / 2, 0, 0]);
    this.mesh(G.torus(0.93, 0.06, 6, 24), seam, neck, [0, 0.7, 0], [Math.PI / 2, 0, 0]);
    this.neckBack = this.node(skull, [0, -0.35, -1.0]);

    // ---- segments ----
    this.segs = [];
    for (let i = 1; i <= SEGS; i++) {
      const k = i / SEGS;
      const r = 1.0 - k * 0.5;
      const g = this.node(root);
      this.mesh(G.sphere(1, 22, 14), armor, g, [0, 0, 0], null, [r, r * 0.92, SPACING * 0.62]);
      this.mesh(G.torus(r * 0.93, 0.06, 6, 24), seam, g, [0, 0, SPACING * 0.3], null);
      this.mesh(G.rbox(r * 1.2, r * 0.35, SPACING * 0.8, 0.1), plate, g, [0, r * 0.72, 0]);
      this.mesh(G.rbox(r * 1.1, r * 0.25, SPACING * 0.7, 0.08), belly, g, [0, -r * 0.72, 0]);
      const fin = this.mesh(G.cone(r * 0.32, r * 0.95, 4), plate, g, [0, r * 1.05, -0.1], [-0.6, 0, 0]);
      void fin;
      for (const s of [-1, 1]) this.mesh(G.sphere(r * 0.13, 8, 6), seam, g, [s * r * 0.95, 0.05, 0]);
      const seg = { g, r, i, weakPhase: 0, part: null, cell: null };
      // weak cells: glowing kelp-green sacs on the back
      for (let ph = 1; ph <= 3; ph++) {
        if (!WEAK[ph].includes(i)) continue;
        seg.weakPhase = ph;
        const cellMat = this.mat('cell' + i, this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.2, roughness: 0.12, rim: 0.7, rimColor: '#ffffff' });
        const cell = this.node(g, [0, r * 0.95, 0]);
        this.mesh(G.sphere(r * 0.42, 16, 12), cellMat, cell, [0, 0.05, 0]);
        this.mesh(G.sphere(r * 0.3, 14, 10), cellMat, cell, [r * 0.42, -0.1, 0.1]);
        this.mesh(G.sphere(r * 0.3, 14, 10), cellMat, cell, [-r * 0.42, -0.1, -0.1]);
        this.mesh(G.torus(r * 0.93, 0.1, 6, 24), cellMat, g, [0, 0, -SPACING * 0.28]);
        const glow = this.sprite(this.coreColor, r * 3, 0.5, cell, [0, 0.2, 0]);
        seg.cell = cell;
        seg.part = this.part({ kind: 'weak', name: 'cell' + i, anchor: g, offset: [0, r * 0.35, 0], radius: r + 0.45, hp: Math.round(CELL_HP[ph] * this.hpMul), mats: [cellMat], glow, glowSize: r * 3.2, color: this.coreColor });
        this.anchors.push(cell);
      }
      if (!seg.part) seg.armor = this.part({ kind: 'armor', anchor: g, radius: r });
      if (i === SEGS) {
        // tail fin
        this.mesh(G.cone(0.55, 1.6, 4), plate, g, [0, 0.2, -1.2], [-Math.PI / 2 - 0.3, 0, 0], [0.25, 1, 1.4]);
        this.mesh(G.cone(0.45, 1.3, 4), plate, g, [0, -0.25, -1.1], [-Math.PI / 2 + 0.4, 0, 0], [0.25, 1, 1.2]);
      }
      this.segs.push(seg);
      if (i % 4 === 0) this.anchors.push(g);
    }
    this.anchors.push(head);
    mergeStatic(this, root);

    // ---- per-vat sludge surfaces (animated, bubble when the serpent is about to surface) ----
    const sludge = this.sludgeMat = this.own(new THREE.MeshStandardMaterial({ color: P.ink.clone().multiplyScalar(0.55), emissive: P.ink, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1 }));
    this.vatFx = [];
    for (const v of (this.def.vats && !this.dormant ? this.vats : [])) {
      const d = new THREE.Mesh(G.disc(this.vatR - 0.08, 40), sludge);
      d.position.set(v.x, this.sludgeY + 0.03, v.z);
      d.receiveShadow = true;
      this.S.scene.add(d);
      const glow = this.sprite(P.ink, this.vatR * 2.4, 0.18, this.S.scene, [v.x, this.sludgeY + 0.4, v.z]);
      this.vatFx.push({ d, glow, boil: 0 });
    }
  }

  // ---------------------------------------------------------------------------------------------
  /** Pose the body as a rearing column above vat `vi` (or a showcase S-curve when vi == null). */
  _seedRear(vi) {
    const T = this.trail;
    T.reset();
    if (vi == null) {
      // showcase: coiled S-curve rising from the floor
      const c = this.center;
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        const a = u * Math.PI * 1.6;
        T.push(c.x + Math.cos(a) * 3.2 * (1 - u * 0.6), this.floorY + 0.8 + u * u * 6.5, c.z + Math.sin(a) * 3.2 * (1 - u * 0.6) - 1, true);
      }
      this.head.set(T.x[T.head], T.y[T.head] + 0.4, T.z[T.head]);
      return;
    }
    const v = this.vats[vi];
    for (let y = this.sludgeY - 30; y <= this.sludgeY + 6; y += 0.5) T.push(v.x, y, v.z, true);
    this.head.set(v.x, this.sludgeY + 6.2, v.z);
  }

  /** Put the head (and its trail) deep under vat vi, ready to surface. */
  _seedUnder(vi) {
    const T = this.trail, v = this.vats[vi];
    T.reset();
    for (let y = this.sludgeY - 35; y <= this.sludgeY - 6; y += 0.5) T.push(v.x, y, v.z, true);
    this.head.set(v.x, this.sludgeY - 5.8, v.z);
  }

  hideY(x, z) {
    for (const v of this.vats) {
      const dx = x - v.x, dz = z - v.z;
      if (dx * dx + dz * dz < this.vatR * this.vatR) return this.sludgeY;
    }
    return this.seaY;
  }

  barFrac() {
    let cur = 0, tot = 0;
    for (const s of this.segs) if (s.part) { tot += s.part.maxHp; if (!s.part.broken) cur += s.part.hp; }
    return tot ? cur / tot : 0;
  }

  hitCenter(out) { return out.copy(this.head); }

  onStart() {
    this.S.audio?.sfx('boss_roar', { pos: this.head, volume: 1, pitch: 0.85 });
    this.S.shake(this.head, 0.5);
  }

  _setCells(open) {
    for (const s of this.segs) if (s.part && s.weakPhase === this.phase) s.part.setOpen(open && !s.part.broken && s.visible !== false);
  }

  // ---------------------------------------------------------------------------------------------
  think(dt) {
    const S = this.S, Pl = this.player, C = PH[this.phase];
    const enter = this.entered();
    const H = this.head;
    this.beamOn = false;
    switch (this.state) {
      case 'intro': {
        this._lookAtPlayer(dt, 2);
        this.jaw = 0.5 + Math.sin(this.stateT * 12) * 0.3;
        if (this.stateT > 2.2) { this.beamsLeft = PH[1].beams; this.setState('beam-aim'); }
        break;
      }
      case 'submerged': {
        if (this.stateT > (C.rest ?? 1)) {
          if (this.phase === 3) { this._startCircle(); break; }
          this.vatA = this._pickVat();
          this._seedUnder(this.vatA);
          this.setState('surface');
        }
        break;
      }
      case 'surface': {
        const v = this.vats[this.vatA];
        const fx = this.vatFx[this.vatA];
        if (enter) {
          this._vatWarn(v, 1.1);
          S.audio?.sfx('rumble', { pos: v, volume: 0.9 });
        }
        fx.boil = 1;
        if (Math.random() < 0.5) S.fx.burst(_p.set(v.x + (Math.random() - 0.5) * this.vatR * 1.4, this.sludgeY + 0.1, v.z + (Math.random() - 0.5) * this.vatR * 1.4), UP, this.pal.ink, 3, 3, { size: 0.12 });
        // geyser spray that clears the vat rim, so the tell reads from the platform too
        if (this.stateT < 1.1 && Math.random() < 0.7) S.fx.spray(_p.set(v.x + (Math.random() - 0.5) * this.vatR, this.sludgeY + 0.2, v.z + (Math.random() - 0.5) * this.vatR), _w.set(0, 6 + Math.random() * 4, 0), this.pal.inkBright, 2, 1.6, { size: 0.16, life: 0.9, gravity: 12 });
        if (this.stateT > 1.1) {
          // burst out
          const k = smooth((this.stateT - 1.1) / C.rise);
          H.set(v.x, lerp(this.sludgeY - 5.8, this.sludgeY + 6.2, k), v.z);
          if (!this._splashed) {
            this._splashed = true;
            S.audio?.sfx('boss_splash', { pos: v, volume: 1 });
            S.fx.explosion(_p.set(v.x, this.sludgeY + 0.5, v.z), UP, this.pal.ink, 3.5);
            S.shake(v, 0.5);
            for (let i = 0; i < 6; i++) {
              const a = Math.random() * Math.PI * 2, r = this.vatR + 2 + Math.random() * 5;
              _t.set(v.x + Math.cos(a) * r, this.floorY, v.z + Math.sin(a) * r);
              this.lob(_p.set(v.x, this.sludgeY + 1, v.z), this.ground(_t, _w), 0.9, { damage: 18, splash: { radius: 1.3, damage: 16 }, paint: 1.4, size: 0.3 });
            }
          }
          if (k >= 1) { this._splashed = false; fx.boil = 0; this.beamsLeft = C.beams; this.setState('rear'); }
        }
        this._lookAtPlayer(dt, 3);
        break;
      }
      case 'rear': {
        this._sway(dt);
        this._lookAtPlayer(dt, 2.5);
        if (this.stateT > 0.5 && this.grace <= 0) {
          if (this.beamsLeft > 0) this.setState('beam-aim');
          else this._startArc();
        }
        break;
      }
      case 'beam-aim': {
        if (enter) {
          S.audio?.sfx('boss_charge', { pos: H, volume: 1, dur: C.aim });
          this._lockT = 0;
        }
        if (this._onCircle) this._circleMove(dt); else this._sway(dt * 0.4);
        if (this.stateT < C.aim - 0.25) this._lookAtPlayer(dt, 4);
        this.jaw = lerp(this.jaw, 0.6, Math.min(1, dt * 6));
        this.muzzle.getWorldPosition(this.beamFrom);
        if (this.stateT < C.aim - 0.25) this.beamTo.copy(Pl.position);
        this._planSweep();
        if (this.stateT > C.aim) this.setState('beam-fire');
        break;
      }
      case 'beam-fire': {
        if (enter) { S.audio?.sfx('boss_beam', { pos: H, volume: 1, dur: C.sweep }); this.beamPaint.set(1e9, 0, 0); }
        const k = clamp(this.stateT / C.sweep, 0, 1);
        if (this._onCircle) this._circleMove(dt);
        this._fireBeam(dt, k);
        if (k >= 1) {
          this.beam.hide();
          this.beamsLeft--;
          this.setState(this.phase === 3 ? 'circle' : 'rear');
        }
        break;
      }
      case 'arc': {
        const speed = C.arc;
        this._arcStep(dt, speed);
        // phase 2 spits a beam in mid-air
        if (this.phase === 2) {
          if (this.u > 0.22 && this.u < 0.36) {
            this.muzzle.getWorldPosition(this.beamFrom);
            this.beamTo.copy(Pl.position);
            this._planSweep();
            this.beam.aim(this.beamFrom, this.beamA);
            if (!this._midAim) { this._midAim = true; S.audio?.sfx('boss_charge', { pos: H, volume: 0.8, dur: 0.5 }); }
          } else if (this.u >= 0.36 && this.u < 0.56) {
            if (!this._midFire) { this._midFire = true; S.audio?.sfx('boss_beam', { pos: H, volume: 1, dur: 0.6 }); this.beamPaint.set(1e9, 0, 0); }
            this.muzzle.getWorldPosition(this.beamFrom);
            this._fireBeam(dt, (this.u - 0.36) / 0.2);
          } else if (this.u >= 0.56) this.beam.hide();
        }
        this._drips(dt);
        if (this.u >= 1) {
          this.beam.hide();
          this._midAim = this._midFire = false;
          S.audio?.sfx('boss_splash', { pos: H, volume: 0.9 });
          S.fx.explosion(_p.set(this.arcE.x, this.sludgeY + 0.5, this.arcE.z), UP, this.pal.ink, 3);
          this.setState('dive');
        }
        break;
      }
      case 'dive': {
        // keep swimming straight down until the tail is under
        H.y -= C.arc * dt;
        this._drips(dt);
        const tail = this.segPos[SEGS];
        if (tail.y < this.sludgeY - 1.5 || this.stateT > 6) {
          // phase 2: chain straight into a second arc from the same vat
          if (this.phase === 2 && !this._chained && Math.random() < 0.6) {
            this._chained = true;
            this.vatA = this.vatB;
            this._seedUnder(this.vatA);
            this.setState('surface');
          } else {
            this._chained = false;
            this.setState('submerged');
          }
        }
        break;
      }
      case 'circle': this._circle(dt, enter); break;
      case 'break': {
        this._sway(dt);
        this.jaw = 0.8 + Math.sin(this.stateT * 20) * 0.2;
        if (this.stateT > 1.6) {
          if (this.phase === 3 && this._onCircle) this.setState('circle');
          else this._startArc();
        }
        break;
      }
      default: break;
    }
    // body + contact damage + which cells are exposed (only out of the sludge, in flight)
    this._updateBody();
    this._contact();
    const st = this.state;
    if (st === 'surface' || st === 'circle') this._cellLock = false;
    const expose = !this._cellLock && (st === 'arc' || st === 'dive' || (this._onCircle && (st === 'circle' || st === 'beam-aim' || st === 'beam-fire')));
    for (const sg of this.segs) if (sg.part && sg.weakPhase === this.phase) sg.part.setOpen(expose && sg.visible && !sg.part.broken);
  }

  _pickVat() {
    // prefer a vat the player is not standing right next to, never the same twice
    const Pl = this.player;
    let best = -1, bestScore = -1e9;
    for (let i = 0; i < this.vats.length; i++) {
      if (i === this.vatA && this.vats.length > 1) continue;
      const d = Math.hypot(Pl.position.x - this.vats[i].x, Pl.position.z - this.vats[i].z);
      const score = -Math.abs(d - 16) + Math.random() * 6;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best < 0 ? 0 : best;
  }

  _startArc() {
    const H = this.head;
    // target vat: the opposite one (over the centre) or a neighbour
    const n = this.vats.length;
    const opp = (this.vatA + Math.floor(n / 2)) % n;
    const nb = (this.vatA + (Math.random() < 0.5 ? 1 : n - 1)) % n;
    this.vatB = Math.random() < 0.6 ? opp : nb;
    // Usually fly the arc that passes closest to the player: the cells are only open in flight
    // and the vats sit ~19 m out, beyond a shooter's reach from most of the platform.
    if (n > 2 && Math.random() < 0.65) {
      const Pl = this.player.position, A = this.vats[this.vatA];
      let best = this.vatB, bestD = 1e9;
      for (let i = 0; i < n; i++) {
        if (i === this.vatA) continue;
        const E = this.vats[i];
        const ex = E.x - A.x, ez = E.z - A.z, l2 = ex * ex + ez * ez || 1;
        const k = clamp(((Pl.x - A.x) * ex + (Pl.z - A.z) * ez) / l2, 0.15, 0.85);
        const d = Math.hypot(A.x + ex * k - Pl.x, A.z + ez * k - Pl.z);
        if (d < bestD) { bestD = d; best = i; }
      }
      this.vatB = best;
    }
    const E = this.vats[this.vatB];
    this.arcS.copy(H);
    this.arcE.set(E.x, this.sludgeY - 6, E.z);
    const apex = this.sludgeY + 4.6;
    this.arcC.set((this.arcS.x + this.arcE.x) / 2, (apex - 0.25 * this.arcS.y - 0.25 * this.arcE.y) / 0.5, (this.arcS.z + this.arcE.z) / 2);
    this.u = 0;
    this.S.audio?.sfx('boss_roar', { pos: H, volume: 0.8, pitch: 1.1 });
    this.S.audio?.sfx('whoosh', { pos: H, volume: 0.8, pitch: 0.5 });
    this.setState('arc');
  }

  _arcStep(dt, speed) {
    const S0 = this.arcS, C = this.arcC, E = this.arcE, u = this.u;
    // derivative of the quadratic Bézier → constant-speed parameter advance
    _d.set(
      2 * (1 - u) * (C.x - S0.x) + 2 * u * (E.x - C.x),
      2 * (1 - u) * (C.y - S0.y) + 2 * u * (E.y - C.y),
      2 * (1 - u) * (C.z - S0.z) + 2 * u * (E.z - C.z),
    );
    const L = Math.max(0.5, _d.length());
    this.u = Math.min(1, u + (speed * dt) / L);
    const w = this.u, a = (1 - w) * (1 - w), b = 2 * (1 - w) * w, c = w * w;
    this.head.set(a * S0.x + b * C.x + c * E.x, a * S0.y + b * C.y + c * E.y, a * S0.z + b * C.z + c * E.z);
    this.jaw = lerp(this.jaw, 0.25, Math.min(1, dt * 4));
  }

  _startCircle() {
    // surface from the vat nearest the ring start and swim out onto the circle
    this.vatA = this._pickVat();
    this._seedUnder(this.vatA);
    const v = this.vats[this.vatA];
    this.circleAng = Math.atan2(v.z - this.center.z, v.x - this.center.x);
    this._circleIn = 0;
    this._onCircle = true;
    this.circleBeamT = 2.5;
    this.setState('circle');
    this.S.audio?.sfx('boss_splash', { pos: v, volume: 1 });
    this._vatWarn(v, 0.9);
  }

  /** Warning ring on a vat's sludge surface (the sludge disc is not level geometry: lift it above). */
  _vatWarn(v, time) {
    const it = this.warn(_p.set(v.x, this.sludgeY, v.z), this.vatR, time, '#ff3b2a');
    it.g.position.y = Math.max(it.g.position.y, this.sludgeY + 0.12);
    it.g.quaternion.identity();
    return it;
  }

  /** Move the head along the circling swim path (slower while reared up). */
  _circleMove(dt) {
    const C = PH[3], H = this.head, c = this.center;
    this._circleIn = Math.min(1, (this._circleIn ?? 1) + dt / 1.6);
    this.circleAng += (C.swim * (this.rearK > 0.5 ? 0.35 : 1) * dt) / this.ringR;
    const a = this.circleAng;
    const y = this.floorY + 3.2 + Math.sin(a * 3 + this.t * 1.4) * 1.1 + this.rearK * 4.2;
    _t.set(c.x + Math.cos(a) * this.ringR, y, c.z + Math.sin(a) * this.ringR);
    if (this._circleIn < 1) {
      const v = this.vats[this.vatA];
      _w.set(v.x, this.sludgeY + 2, v.z);
      H.lerpVectors(_w, _t, smooth(this._circleIn));
      if (this._circleIn < 0.3) H.y = lerp(this.sludgeY - 5, _w.y, this._circleIn / 0.3);
    } else H.copy(_t);
  }

  _circle(dt, enter) {
    const C = PH[3];
    const a0 = this.circleAng;
    void enter;
    this._circleMove(dt);
    const a = this.circleAng;
    void a0;
    this._drips(dt);
    // periodically rear up and beam the player
    this.circleBeamT -= dt;
    if (this.circleBeamT <= 0 && this.grace <= 0 && this._circleIn >= 1) {
      this.rearK = Math.min(1, this.rearK + dt * 2);
      if (this.rearK >= 1) { this.circleBeamT = C.beamEvery; this.beamsLeft = 1; this.setState('beam-aim'); }
    } else if (this.state === 'circle') this.rearK = Math.max(0, this.rearK - dt * 1.2);
    if (this.rearK < 0.5) {
      // face along the swim direction
      this.lookYaw = Math.atan2(-Math.sin(a), Math.cos(a));
    } else this._lookAtPlayer(dt, 3);
  }

  _sway(dt) {
    this._swayT = (this._swayT || 0) + dt;
    const v = this.vats[this.vatA];
    if (this.phase === 3 && this._onCircle) return;
    this.head.x = v.x + Math.sin(this._swayT * 1.3) * 0.5;
    this.head.z = v.z + Math.cos(this._swayT * 1.1) * 0.5;
    this.head.y = this.sludgeY + 6.2 + Math.sin(this._swayT * 2) * 0.25;
  }

  _lookAtPlayer(dt, rate) {
    const Pl = this.player;
    _d.subVectors(Pl.position, this.head);
    const want = Math.atan2(_d.x, _d.z);
    let dy = want - this.lookYaw;
    dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.lookYaw += dy * Math.min(1, dt * rate);
    const pitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z));
    this.lookPitch += (clamp(pitch, -1.1, 0.4) - this.lookPitch) * Math.min(1, dt * rate);
  }

  /** Sweep line through the locked target, along the head → target direction. */
  _planSweep() {
    _d.subVectors(this.beamTo, this.beamFrom).setY(0);
    if (_d.lengthSq() < 1e-4) _d.set(0, 0, 1);
    _d.normalize();
    this.beamA.copy(this.beamTo).addScaledVector(_d, -4.5).setY(this.beamTo.y);
    this.beamB.copy(this.beamTo).addScaledVector(_d, 3.5).setY(this.beamTo.y);
    if (this.state === 'beam-aim') this.beam.aim(this.beamFrom, this.beamTo);
  }

  _fireBeam(dt, k) {
    const S = this.S, Pl = this.player;
    this.muzzle.getWorldPosition(this.beamFrom);
    _p.lerpVectors(this.beamA, this.beamB, k);
    // the jet stops at the first wall/floor along the way
    _d.subVectors(_p, this.beamFrom);
    const len = _d.length();
    _d.divideScalar(Math.max(1e-4, len));
    const hit = S.level.raycast(this.beamFrom, _d, len + 3, { staticOnly: true });
    const end = hit ? hit.point : _t.copy(this.beamFrom).addScaledVector(_d, len);
    this.beam.fire(this.beamFrom, end, this.t);
    this.beamOn = true;
    this.jaw = 0.8;
    if (end.distanceTo(this.beamPaint) > 0.35) {
      this.beamPaint.copy(end);
      S.ink.paint(end, 1.05, TEAM_MURK, hit ? hit.normal : UP, { source: this });
      if (Math.random() < 0.5) S.fx.burst(end, hit ? hit.normal : UP, this.pal.ink, 4, 4, { size: 0.08 });
    }
    if (Pl.alive && this.beam.distanceTo(Pl.hitCenter(_hc)) < 1.05) this.hurt('beam', 40, this._shoveFrom(), 3.5, 3.5, 0.7);
    void dt;
  }

  _drips(dt) {
    this.dripT -= dt;
    if (this.dripT > 0) return;
    this.dripT = this.phase === 1 ? 0.42 : 0.3;
    const seg = this.segs[Math.floor(Math.random() * this.segs.length)];
    if (!seg.visible) return;
    const p = seg.g.position;
    const g = this.S.level.raycast(_t.copy(p).setY(p.y - seg.r), DOWN, 40, { staticOnly: true });
    if (!g) return;
    const h = Math.max(0.5, p.y - g.point.y);
    const T = Math.sqrt((2 * h) / 20);
    this.lob(_w.copy(p).setY(p.y - seg.r), g.point, T, { gravity: 20, damage: 22, splash: { radius: 1.3, damage: 20 }, paint: 1.25, size: 0.3 });
  }

  /** Sample the trail for every segment, orient them and handle sludge visibility. */
  _updateBody() {
    const H = this.head;
    if (this.state !== 'idle') this.trail.push(H.x, H.y, H.z);
    this.trail.sample(H.x, H.y, H.z, this.sArr, this.segPos);
    const sp = this.segPos;
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i];
      const p = sp[i + 1];
      const prev = sp[i];
      _f.subVectors(prev, p);
      if (_f.lengthSq() < 1e-6) _f.set(0, 1, 0); else _f.normalize();
      this._orient(seg.g.quaternion, _f, this.segRight[i + 1]);
      seg.g.position.copy(p);
      const vis = p.y + seg.r * 0.9 > this.hideY(p.x, p.z);
      seg.visible = vis;
      seg.g.visible = vis;
      if (seg.armor) seg.armor.untargetable = !vis;
    }
  }

  /** Quaternion with +Z along f, +Y as close to world-up as possible (continuous right vector). */
  _orient(q, f, rightMem) {
    _r.crossVectors(UP, f);
    if (_r.lengthSq() < 0.02) _r.copy(rightMem); else { _r.normalize(); rightMem.copy(_r); }
    _u.crossVectors(f, _r).normalize();
    _r.crossVectors(_u, f).normalize();
    _m.makeBasis(_r, _u, f);
    q.setFromRotationMatrix(_m);
  }

  _contact() {
    const Pl = this.player;
    if (!Pl.alive || this.state === 'submerged') return;
    Pl.hitCenter(_hc);
    const hy = this.hideY(this.head.x, this.head.z);
    if (this.head.y > hy && _hc.distanceTo(this.head) < this.headR + 0.5) { this.hurt('touch', 35, this._shoveFrom(), 6, 5.5, 1.0); return; }
    for (const seg of this.segs) {
      if (!seg.visible) continue;
      const d = _hc.distanceTo(seg.g.position);
      if (d < seg.r + 0.5) { this.hurt('touch', 30, this._shoveFrom(), 6, 5.5, 1.0); return; }
    }
  }

  /**
   * Contact shoves push the player toward the arena centre (never sideways off a 3 m grate ramp or
   * the platform edge into the sludge sea, which would be an instant splat on top of the damage).
   */
  _shoveFrom() {
    const P = this.player.position, c = this.center;
    _t.set(P.x - c.x, 0, P.z - c.z);
    if (_t.lengthSq() < 1e-4) _t.set(0, 0, 1);
    return _t.setLength(1).add(P);
  }

  onWeakBroken(part) {
    const S = this.S;
    const seg = this.segs.find((s) => s.part === part);
    if (seg) {
      seg.g.getWorldPosition(_t);
      for (let i = 0; i < 5; i++) {
        _p.set(_t.x + (Math.random() - 0.5) * 6, this.floorY, _t.z + (Math.random() - 0.5) * 6);
        this.lob(_t, this.ground(_p, _w), 0.8 + Math.random() * 0.3, { damage: 10, splash: null, paint: 1.4, size: 0.26 });
      }
    }
    S.audio?.sfx('boss_roar', { pos: this.head, volume: 0.9, pitch: 1.25 });
    let left = 0;
    for (const s of this.segs) if (s.part && s.weakPhase === this.phase && !s.part.broken) left++;
    if (left > 0) {
      if (this.cellsBroken++ === 0) this.say([{ who: 'pix', text: 'Direct hit! Its glowing cells are its weak spots!' }]);
      return;
    }
    // phase cleared
    if (this.phase >= 3) { this.startDefeat(); return; }
    this.phase++;
    this.later(0.3, () => {
      if (this.phase === 2) this.phaseBanter([{ who: 'murkwell', text: 'Do you have ANY idea how much that armour cost?', mood: 'angry' }]);
      else this.phaseBanter([{ who: 'murkwell', text: 'Fine. FINE. Serpent: maximum sludge!', mood: 'angry' }, { who: 'brine', text: 'It\'s circling! Use the launch pads and keep to high ground!' }]);
    });
    // the current flight carries on; the new cells open on the next surfacing (or circling)
    this._chained = true;
    this._cellLock = true;
  }

  // ---------------------------------------------------------------------------------------------
  idle(dt) {
    this.jaw = 0.35 + Math.sin(this.t * 2) * 0.2;
    this.lookYaw = 0.4; this.lookPitch = -0.2;
    this._updateBody();
    void dt;
  }

  animate(dt) {
    const t = this.rt, H = this.head;
    // head: position + orientation (path tangent while travelling, look-at when rearing)
    const hg = this.headG;
    hg.position.copy(H);
    const travelling = this.state === 'arc' || this.state === 'dive' || (this.state === 'circle' && this.rearK < 0.5) || this.state === 'surface';
    if (travelling && !this.dormant) {
      _f.subVectors(H, this.segPos[1]);
      if (_f.lengthSq() > 1e-6) {
        _f.normalize();
        this._orient(_q, _f, this.segRight[0]);
        hg.quaternion.slerp(_q, Math.min(1, dt * 10));
      }
    } else {
      _q.setFromEuler(_e.set(-this.lookPitch, this.lookYaw, 0, 'YXZ'));
      hg.quaternion.slerp(_q, Math.min(1, dt * 8));
    }
    hg.visible = this.dormant || H.y + 0.8 > this.hideY(H.x, H.z);
    // neck from the back of the skull down to the first body segment
    hg.updateMatrixWorld(true);
    this.neckBack.getWorldPosition(_v);
    _w.copy(this.segPos[1]);
    _d.subVectors(_v, _w);
    const nl = Math.max(0.1, _d.length());
    this.neck.position.copy(_w);
    this.neck.quaternion.setFromUnitVectors(UP, _d.divideScalar(nl));
    this.neck.scale.set(1, nl, 1);
    this.neck.visible = hg.visible || this.segs[0].visible;
    this.headPart.untargetable = !hg.visible;
    this.jawG.rotation.x = this.jaw * 0.7;
    // glows
    const aiming = this.state === 'beam-aim' || (this.phase === 2 && this.state === 'arc' && this.u > 0.22 && this.u < 0.36);
    this.mouthMat.emissiveIntensity = aiming ? 2 + Math.sin(t * 40) * 1.5 + 2 : this.beamOn ? 6 : 2;
    this.mouthGlow.material.opacity = aiming || this.beamOn ? 0.9 : 0.35;
    this.mouthGlow.scale.setScalar(aiming ? 1.6 + Math.sin(t * 30) * 0.4 : this.beamOn ? 2.4 : 1.4);
    this.eyeMat.emissive.copy(aiming || this.beamOn ? EYE_RED : EYE_AMBER);
    this.seamMat.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.4;
    // sludge surfaces: slow swirl + boil
    for (const f of this.vatFx) {
      f.d.rotation.y += dt * 0.15;
      f.d.position.y = this.sludgeY + 0.03 + (f.boil ? Math.sin(t * 20) * 0.05 : 0);
      f.glow.material.opacity = 0.14 + f.boil * (0.25 + Math.sin(t * 18) * 0.1);
      if (f.boil && Math.random() < 0.3) this.S.fx.puff(_p.set(f.d.position.x + (Math.random() - 0.5) * 4, this.sludgeY + 0.3, f.d.position.z + (Math.random() - 0.5) * 4), this.pal.inkBright, 0.9, 0.5, null, 1.8, 0.5);
    }
    if (this.beamOn && Math.random() < 0.5) this.S.fx.spray(this.beam.to, _d.set(0, 3, 0), this.pal.ink, 2, 3, { size: 0.08 });
    if (this.state !== 'beam-aim' && this.state !== 'beam-fire' && !(this.phase === 2 && this.state === 'arc')) { if (!this.beamOn && this.beam.mode === 'aim') this.beam.hide(); }
  }

  // ---------------------------------------------------------------------------------------------
  onDefeatStart() {
    this.beam.hide();
    this.deathFrom = this.head.clone();
    this.say([{ who: 'murkwell', text: 'My Serpent! Do you know what the warranty on this thing costs?!', mood: 'angry' }]);
  }

  defeatStep(dt, t) {
    // writhe in place, then collapse toward the nearest sludge and sink
    const H = this.head;
    if (t < 3.0) {
      H.x += Math.sin(t * 9) * dt * 3;
      H.z += Math.cos(t * 7) * dt * 3;
      H.y += (Math.sin(t * 5) * 1.2) * dt;
      this.jaw = 0.9 + Math.sin(t * 25) * 0.1;
    } else {
      H.y -= dt * (4 + (t - 3) * 6);
      this.jaw = 1;
    }
    this._updateBody();
    this.segs.forEach((s, i) => { if (s.g.visible) s.g.rotation.z += Math.sin(t * 12 + i) * dt * 0.8; });
  }

  finalBlastAt(out) { return out.copy(this.deathFrom || this.head); }

  onDispose() {
    for (const f of this.vatFx) { f.d.parent?.remove(f.d); f.glow.parent?.remove(f.glow); }
  }
}

const _e = new THREE.Euler();
void easeOut; void hash01;

registerEntity('boss-serpent', (s, d) => new Serpent(s, d));
