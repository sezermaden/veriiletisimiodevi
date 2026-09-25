// BARON MURKWELL in the GRAYTIDE MECH — the final boss on the storm-lashed roof of Murkwell Tower.
//
// Phase 1: the mech raises a fist (red ring marks where it lands) and SLAMS: an expanding Murk
//   shockwave ring rolls across the roof (jump over it). The hand then opens flat on the roof with
//   its glowing palm core exposed for a few seconds. Break both palms.
// Phase 2: foot jets ignite and it hovers. Shoulder missile pods open (glowing, the weak points)
//   and lock-on rings appear under the player before a missile volley arcs in. Buzzdrones join.
// Phase 3: it lands and the roof floods with rising Murk: stay on the pontoon platforms. Flood
//   waves and a sweeping lure beam; after each attack the chest armour opens on the Sunburst Core.
// Defeat: slow-mo, hero-ink explosions, the mech topples off the tower and Murkwell escapes in
// his cockpit pod.
//
//   { type: 'boss-murkwell', pos, yaw, arena: { center:[x,y,z], half:[hx,hz] } }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { inkExplosion } from '../../weapons/base.js';
import { Boss, Beam, G, UP, DOWN, TEAM_MURK, TEAM_HERO, clamp, lerp, smooth, easeOut, easeIn, angleDiff, turnToward, emblemTexture, hazardTexture, mergeStatic, EYE_RED, EYE_AMBER } from './common.js';
import { Pilot } from './pilots.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _hc = new THREE.Vector3();
const DOWN_V = new THREE.Vector3(0, -1, 0);

const PALM_HP = 280;
const POD_HP = 175;
const MS = 1.2;                    // model scale (reach / heights below are multiplied by it)
const CORE_HP = 525;
const FLOOD_SAFE = 0.5;                // flood fraction (rises over 6 s) before it hurts (12 dps) and turns the roof Murk
const UPPER = 2.8, FORE = 2.7, HANDOFF = 0.55;
const ARM_LEN = UPPER + FORE + HANDOFF;
const SHOULDER = [2.35, 2.55];     // x, y above the upper-body pivot (hips)
const HIP_Y = 4.0;                 // standing hip height
const LEG_A = 1.6, LEG_B = 1.8;    // thigh, shin

export class MurkwellMech extends Boss {
  constructor(session, def) {
    super(session, def, { name: 'Baron Murkwell', coreColor: '#ffd23f', phases: 3 });
    this.yaw = def.yaw ?? 0;
    this.group.rotation.y = 0;
    const A = def.arena || {};
    this.aCenter = new THREE.Vector3().fromArray(A.center || def.pos || [0, 0, 0]);
    this.aHalf = A.half || [20, 18];
    this.home = this.position.clone();
    this.seqI = 0;
    this.pose = { bend: 0, lean: 0, hover: 0, twist: 0 };
    this.arm = [0, 1].map((i) => ({
      side: i ? 1 : -1, q: new THREE.Quaternion(), from: new THREE.Quaternion(), to: new THREE.Quaternion(),
      elbow: 0.3, wrist: 0, curl: 1, broken: false, target: new THREE.Vector3(), k: 0,
    }));
    this.slamArm = 0;
    this.walkPhase = 0; this.walkSpeed = 0;
    this.jet = 0;
    this.chestOpen = 0; this.podOpen = 0;
    this.hoverTarget = new THREE.Vector3();
    this.waves = [];
    this.missiles = [];
    this.flood = 0; this.floodTarget = 0;
    this.defeatDuration = 7.6;
    this.defeatBooms = 3.4;
    this.armorHint = 'The Graytide Mech is armoured! Wait for its weak spots to glow.';
    this._build();
    this.S.env && (this._prevLightning = this.S.env.onLightning, this.S.env.onLightning = () => { this._prevLightning?.(); this._lightning = 1; });
    this.applyPose();
    this.setState(this.dormant ? 'idle' : 'intro');
  }

  // ---------------------------------------------------------------------------------------------
  _build() {
    const P = this.pal;
    const gray = this.mat('gray', '#7b8094', { roughness: 0.35, metalness: 0.6 });
    const grayL = this.mat('grayL', '#a4a9ba', { roughness: 0.35, metalness: 0.55 });
    const dark = this.mat('dark', '#2b2f3b', { roughness: 0.45, metalness: 0.6 });
    const gold = this.mat('gold', P.gold, { roughness: 0.25, metalness: 0.85 });
    const violet = this.mat('violet', P.ink.clone().lerp(new THREE.Color('#ffffff'), 0.1), { roughness: 0.35, metalness: 0.2 });
    const seam = this.glowMat('seam', P.ink.clone().lerp(new THREE.Color('#ffffff'), 0.2), 1.6);
    const hazard = this.mat('hazard', '#ffffff', { roughness: 0.45 });
    hazard.map = hazardTexture(); hazard.needsUpdate = true;
    const glass = this.own(new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.25, roughness: 0.03, metalness: 0.25, envMapIntensity: 1.8, depthWrite: false }));
    const eye = this.glowMat('eye', '#ffd23a', 2.5);
    const jetM = this.glowMat('jet', '#9d7bff', 0.2);
    const emblem = this.own(new THREE.MeshStandardMaterial({ map: emblemTexture(), transparent: true, alphaTest: 0.05, roughness: 0.4, metalness: 0.2 }));
    this.jetMat = jetM; this.eyeMat = eye; this.seamMat = seam;
    const m = this.model;
    m.rotation.y = this.yaw;
    m.scale.setScalar(MS);

    // ---- legs ----
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = this.node(m, [s * 1.25, HIP_Y, 0]);
      const thigh = this.node(hip);
      this.mesh(G.rbox(1.15, LEG_A + 0.3, 1.25, 0.2), gray, thigh, [0, -LEG_A / 2, 0]);
      this.mesh(G.box(0.2, LEG_A, 1.3), violet, thigh, [s * 0.55, -LEG_A / 2, 0]);
      this.mesh(G.sphere(0.62, 18, 12), dark, thigh);
      const knee = this.node(thigh, [0, -LEG_A, 0]);
      this.mesh(G.sphere(0.58, 18, 12), dark, knee);
      this.mesh(G.rbox(0.9, 0.5, 0.5, 0.12), gold, knee, [0, 0, 0.5]);
      const shin = this.node(knee);
      this.mesh(G.rbox(1.05, LEG_B, 1.25, 0.2), grayL, shin, [0, -LEG_B / 2, 0.05]);
      this.mesh(G.cyl(0.18, 0.18, LEG_B * 0.8, 10), dark, shin, [0, -LEG_B / 2, -0.7]);
      this.mesh(G.box(1.1, 0.3, 0.1), hazard, shin, [0, -0.5, 0.7]);
      const ankle = this.node(shin, [0, -LEG_B, 0]);
      const foot = this.node(ankle);
      this.mesh(G.rbox(1.6, 0.62, 2.5, 0.2), gray, foot, [0, -0.3, 0.35]);
      this.mesh(G.box(1.5, 0.16, 0.5), gold, foot, [0, -0.08, 1.45]);
      const jet = this.mesh(G.cyl(0.36, 0.5, 0.4, 16), jetM, foot, [0, -0.62, 0.1]);
      jet.castShadow = false;
      const flame = this.sprite('#b58cff', 1.8, 0, foot, [0, -1.0, 0.1]);
      this.legs.push({ s, hip, thigh, knee, shin, ankle, foot, flame });
      this.collider(1.4, LEG_A + 0.4, 1.5, thigh, 0, -LEG_A / 2, 0);
      this.collider(1.3, LEG_B, 1.5, shin, 0, -LEG_B / 2, 0.05);
      this.collider(1.7, 0.7, 2.6, foot, 0, -0.3, 0.35);
    }

    // ---- upper body (pivots at the hips) ----
    const up = this.upper = this.node(m, [0, HIP_Y, 0]);
    this.mesh(G.rbox(3.1, 1.0, 1.9, 0.25), dark, up, [0, 0.3, 0]);
    this.mesh(G.cyl(1.25, 1.4, 1.0, 20), gray, up, [0, 1.1, 0]);
    this.mesh(G.torus(1.33, 0.08, 8, 28), seam, up, [0, 1.35, 0], [Math.PI / 2, 0, 0]);
    const chest = this.chest = this.node(up, [0, 2.6, 0]);
    this.mesh(G.rbox(3.8, 2.5, 2.3, 0.4), gray, chest);
    this.mesh(G.rbox(3.2, 0.3, 2.4, 0.1), gold, chest, [0, 1.2, 0]);
    this.mesh(G.rbox(0.6, 2.0, 0.3, 0.1), violet, chest, [0, 0, -1.12]);
    this.mesh(G.box(3.9, 0.35, 0.2), hazard, chest, [0, -1.05, 1.05]);
    for (const s of [-1, 1]) {
      const e = this.mesh(G.plane(1.3, 1.3), emblem, chest, [s * 1.92, 0.1, 0], [0, s * Math.PI / 2, 0]);
      e.castShadow = false;
      this.mesh(G.box(0.1, 1.8, 0.1), seam, chest, [s * 1.3, 0, 1.16]);
    }
    // chest core (the Sunburst Core) behind two armour doors
    const coreG = this.coreG = this.node(chest, [0, 0.05, 0.95]);
    this.coreMat = this.mat('core', this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.8, roughness: 0.08, rim: 0.8, rimColor: '#ffffff' });
    this.coreMat.flatShading = true;
    this.coreGem = this.mesh(new THREE.IcosahedronGeometry(0.72, 1), this.coreMat, coreG);
    this.coreGem.userData.noMerge = true;
    this.own(this.coreGem.geometry);
    this.mesh(G.torus(0.95, 0.12, 10, 30), gold, coreG, [0, 0, -0.05]);
    this.coreGlow = this.sprite(this.coreColor, 4, 0.5, coreG, [0, 0, 0.3]);
    this.doors = [];
    for (const s of [-1, 1]) {
      const piv = this.node(chest, [s * 1.55, 0.05, 1.2]);
      this.mesh(G.rbox(1.55, 1.9, 0.3, 0.12), grayL, piv, [-s * 0.78, 0, 0]);
      this.mesh(G.box(0.12, 1.6, 0.1), gold, piv, [-s * 1.45, 0, 0.16]);
      this.mesh(G.box(0.9, 0.12, 0.1), seam, piv, [-s * 0.78, 0.45, 0.16]);
      this.doors.push({ piv, s });
    }
    // missile pods on the shoulders
    this.pods = [];
    for (const s of [-1, 1]) {
      const pod = this.node(chest, [s * 1.9, 1.75, -0.2], [0.55, 0, s * -0.12]);
      this.mesh(G.rbox(1.5, 1.1, 1.7, 0.15), dark, pod);
      this.mesh(G.box(1.55, 0.2, 1.75), hazard, pod, [0, -0.45, 0]);
      const glowM = this.mat('pod' + s, this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.2, roughness: 0.2, rim: 0.4 });
      const tubes = this.node(pod, [0, 0.2, 0]);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        this.mesh(G.cyl(0.17, 0.17, 0.2, 12), glowM, tubes, [(c - 1) * 0.42, 0.42, (r - 0.5) * 0.6]);
      }
      const lid = this.node(pod, [0, 0.56, -0.85]);
      this.mesh(G.rbox(1.55, 0.14, 1.75, 0.06), gray, lid, [0, 0, 0.87]);
      this.mesh(G.box(0.2, 0.05, 1.6), gold, lid, [0, 0.08, 0.87]);
      const glow = this.sprite(this.coreColor, 2.2, 0.5, pod, [0, 0.9, 0]);
      const part = this.part({ kind: 'weak', name: 'pod' + s, anchor: pod, offset: [0, 0.55, 0], radius: 0.95 * MS, hp: Math.round(POD_HP * this.hpMul), mats: [glowM], glow, glowSize: 2.4, color: this.coreColor });
      this.pods.push({ pod, lid, s, part, muzzle: this.node(pod, [0, 0.7, 0]) });
      this.anchors.push(pod);
    }
    // ---- arms ----
    this.arms = [];
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const sh = this.node(up, [s * SHOULDER[0], SHOULDER[1], 0]);
      this.mesh(G.sphere(0.85, 20, 14), dark, sh);
      this.mesh(G.rbox(1.7, 0.7, 1.9, 0.2), gray, sh, [s * 0.2, 0.55, 0], [0, 0, s * -0.25]);
      this.mesh(G.box(1.6, 0.14, 0.3), gold, sh, [s * 0.2, 0.8, 0.8], [0, 0, s * -0.25]);
      const upperArm = this.node(sh);
      this.mesh(G.rbox(1.0, UPPER, 1.0, 0.2), grayL, upperArm, [0, -UPPER / 2, 0]);
      this.mesh(G.box(0.2, UPPER * 0.8, 1.05), violet, upperArm, [s * 0.46, -UPPER / 2, 0]);
      const elbow = this.node(upperArm, [0, -UPPER, 0]);
      this.mesh(G.sphere(0.6, 18, 12), dark, elbow);
      const fore = this.node(elbow);
      this.mesh(G.rbox(1.25, FORE, 1.25, 0.25), gray, fore, [0, -FORE / 2, 0]);
      this.mesh(G.box(1.3, 0.3, 1.3), hazard, fore, [0, -FORE * 0.2, 0]);
      const wrist = this.node(fore, [0, -FORE, 0]);
      const hand = this.node(wrist);
      this.mesh(G.rbox(1.5, 1.0, 0.8, 0.2), dark, hand, [0, -0.45, 0]);
      // palm core on +Z, fingers curl over it
      const palmM = this.mat('palm' + i, this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.2, roughness: 0.1, rim: 0.6, rimColor: '#ffffff' });
      const palm = this.node(hand, [0, -0.5, 0.42]);
      this.mesh(G.cylZ(0.42, 0.42, 0.12, 20), palmM, palm);
      this.mesh(G.torus(0.46, 0.07, 8, 22), gold, palm);
      const palmGlow = this.sprite(this.coreColor, 2.2, 0.5, palm, [0, 0, 0.2]);
      const fingers = [];
      for (let f = 0; f < 4; f++) {
        const fg = this.node(hand, [(f - 1.5) * 0.36, -0.95, 0.05]);
        this.mesh(G.rbox(0.3, 0.62, 0.34, 0.08), gray, fg, [0, -0.3, 0]);
        const tip = this.node(fg, [0, -0.62, 0]);
        this.mesh(G.rbox(0.28, 0.5, 0.3, 0.08), grayL, tip, [0, -0.24, 0]);
        fingers.push({ fg, tip });
      }
      const thumb = this.node(hand, [-s * 0.78, -0.35, 0.1], [0, 0, s * 0.6]);
      this.mesh(G.rbox(0.3, 0.7, 0.34, 0.08), gray, thumb, [0, -0.3, 0]);
      const fistTip = this.node(hand, [0, -0.55, 0]);
      const part = this.part({ kind: 'weak', name: 'palm' + i, anchor: palm, offset: [0, 0, 0.35], radius: 0.95 * MS, solid: true, hp: Math.round(PALM_HP * this.hpMul), mats: [palmM], glow: palmGlow, glowSize: 2.6, color: this.coreColor });
      const armor = this.part({ kind: 'armor', anchor: fore, offset: [0, -FORE * 0.55, 0], radius: 0.95 * MS });
      const fistArmor = this.part({ kind: 'armor', anchor: hand, offset: [0, -0.5, 0], radius: 0.95 * MS, solid: true });
      this.arms.push({ s, sh, upperArm, elbow, fore, wrist, hand, palm, fingers, thumb, part, armor, fistArmor, fistTip });
      this.anchors.push(hand, elbow);
    }
    // ---- head: glass cockpit dome with the Baron inside, lure on a stalk ----
    const head = this.head = this.node(chest, [0, 1.55, 0.1]);
    this.mesh(G.cyl(0.95, 1.15, 0.4, 24), dark, head, [0, 0.1, 0]);
    this.mesh(G.torus(1.05, 0.1, 10, 30), gold, head, [0, 0.32, 0], [Math.PI / 2, 0, 0]);
    this.pod = this.node(head, [0, 0.3, 0]);            // the escape pod (detaches on defeat)
    this.mesh(G.hemiDown(1.05, 24, 8), dark, this.pod, [0, 0.02, 0], null, [1, 0.35, 1]);
    this.pilot = new Pilot(this, 'murkwell', this.node(this.pod, [0, 0.05, 0.05]), 1.35);
    const dome = this.mesh(G.sphere(1.05, 26, 18), glass, this.pod, [0, 0.55, 0], null, [1, 0.95, 1]);
    dome.castShadow = false;
    for (const s of [-1, 1]) this.mesh(G.box(0.5, 0.14, 0.12), eye, head, [s * 0.5, 0.12, 1.0], [0, 0, s * -0.2]);
    const stalkC = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.4, -0.2), new THREE.Vector3(0, 3.0, 0.4), new THREE.Vector3(0, 2.5, 1.8));
    const stalkG = new THREE.TubeGeometry(stalkC, 18, 0.09, 8, false);
    this.own(stalkG);
    this.mesh(stalkG, dark, this.pod);
    const lureM = this.lureMat = this.glowMat('lure', '#ffe98a', 3);
    this.mesh(G.sphere(0.32, 16, 12), lureM, this.pod, [0, 2.45, 1.85]);
    this.lureGlow = this.sprite('#ffe98a', 2.8, 0.7, this.pod, [0, 2.45, 1.85]);
    this.lureTip = this.node(this.pod, [0, 2.45, 2.1]);
    // back: exhaust stacks
    for (const s of [-1, 1]) {
      this.mesh(G.cyl(0.3, 0.35, 1.6, 14), dark, chest, [s * 0.9, 1.3, -1.25]);
      this.mesh(G.torus(0.33, 0.07, 8, 16), gold, chest, [s * 0.9, 2.1, -1.25], [Math.PI / 2, 0, 0]);
    }
    this.stacks = [this.node(chest, [-0.9, 2.25, -1.25]), this.node(chest, [0.9, 2.25, -1.25])];
    // colliders + armour for the torso
    this.collider(3.9, 3.9, 2.5, up, 0, 1.9, 0);
    this.chestArmor = this.part({ kind: 'armor', anchor: chest, offset: [0, 0, 0.4], radius: 1.6 * MS });
    this.core = this.part({ kind: 'weak', name: 'core', anchor: coreG, offset: [0, 0, 0.35], radius: 1.05 * MS, hp: Math.round(CORE_HP * this.hpMul), mats: [this.coreMat], glow: this.coreGlow, glowSize: 4, color: this.coreColor });
    this.anchors.push(chest, up, this.stacks[0], this.stacks[1]);

    mergeStatic(this, m);

    // beam for phase 3 (fired from the lure)
    this.beam = new Beam(this, '#cfd2de', 0.5);
    this.beams = [this.beam];

    // flood plane (phase 3)
    const floodMat = this.floodMat = this.own(new THREE.MeshStandardMaterial({ color: P.ink.clone().multiplyScalar(0.6), emissive: P.ink, emissiveIntensity: 0.25, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.94 }));
    this.floodMesh = new THREE.Mesh(G.quad(), floodMat);
    this.floodMesh.scale.set(this.aHalf[0] * 2 + 6, 1, this.aHalf[1] * 2 + 16);
    this.floodMesh.position.set(this.aCenter.x, this.floorY - 1, this.aCenter.z + 2);
    this.floodMesh.visible = false;
    this.floodMesh.receiveShadow = true;
    this.S.scene.add(this.floodMesh);

    // missile meshes (pooled, reused by projectiles)
    const misM = this.mat('missile', '#e8e6ef', { roughness: 0.35, metalness: 0.3 });
    const misR = this.mat('missileR', '#e0312b', { roughness: 0.4 });
    const misF = this.glowMat('missileF', '#ffb35a', 3);
    this.missilePool = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(G.capsule(0.16, 0.7), misM); b.rotation.x = Math.PI / 2; g.add(b);
      const n = new THREE.Mesh(G.cone(0.16, 0.3, 10), misR); n.rotation.x = Math.PI / 2; n.position.z = 0.6; g.add(n);
      const f = new THREE.Mesh(G.sphere(0.13, 8, 6), misF); f.position.z = -0.55; g.add(f);
      g.userData.free = true;
      this.missilePool.push(g);
    }
    // shockwave ring meshes (pooled)
    const waveM = this.waveMat = this.own(new THREE.MeshStandardMaterial({ color: P.ink, emissive: P.ink, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.92 }));
    this.wavePool = [];
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(G.torus(1, 0.05, 8, 72), waveM);
      w.rotation.x = Math.PI / 2;
      w.visible = false;
      w.frustumCulled = false;
      this.S.scene.add(w);
      this.wavePool.push(w);
    }
  }

  // ---------------------------------------------------------------------------------------------
  fwd(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  barFrac() {
    let cur = 0, tot = 0;
    for (const p of this.parts) if (p.kind === 'weak') { tot += p.maxHp; if (!p.broken) cur += p.hp; }
    return tot ? cur / tot : 0;
  }

  hitCenter(out) { return this.chest.getWorldPosition(out); }

  onStart() {
    this.S.audio?.sfx('boss_roar', { pos: this.position, volume: 1, pitch: 0.7 });
    this.S.shake(this.position, 0.7);
  }

  // ---- pose -----------------------------------------------------------------------------------
  applyPose() {
    const P = this.pose;
    // legs: knee bend lowers the hips; hover lifts the whole mech
    const bend = P.bend;
    const hipY = 0.62 + (LEG_A + LEG_B) * Math.cos(bend);
    this.model.position.y = P.hover;
    this.upper.position.y = hipY;
    this.upper.rotation.set(P.lean, P.twist, 0);
    for (const L of this.legs) {
      const w = this.walkSpeed > 0.1 ? Math.sin(this.walkPhase + (L.s > 0 ? Math.PI : 0)) : 0;
      L.hip.position.y = this.upper.position.y;
      L.thigh.rotation.x = -bend + w * 0.35;
      L.shin.rotation.x = bend * 2 - Math.max(0, w) * 0.4;
      L.foot.rotation.x = -bend + (P.hover > 0.2 ? 0.35 : 0);
    }
    for (let i = 0; i < 2; i++) {
      const a = this.arm[i], A = this.arms[i];
      A.sh.quaternion.copy(a.q);
      A.elbow.rotation.x = -a.elbow;
      A.wrist.rotation.x = -a.wrist;
      for (const f of A.fingers) { f.fg.rotation.x = a.curl * 1.35; f.tip.rotation.x = a.curl * 1.5; }
      A.thumb.rotation.x = a.curl * 1.0;
    }
    this.model.rotation.y = this.yaw;
  }

  /** Rest pose for arm i (quaternion). */
  restQ(i, out) {
    const s = i ? 1 : -1;
    const sway = Math.sin(this.t * 1.3 + i) * 0.05;
    return out.setFromEuler(_e.set(-0.18 + sway, 0, s * 0.12));
  }
  raisedQ(i, out) {
    const s = i ? 1 : -1;
    return out.setFromEuler(_e.set(-2.75, 0, s * 0.25));
  }

  /** Shoulder quaternion that points arm i (straight) at world point T. */
  aimArmQ(i, T, out) {
    const A = this.arms[i];
    this.group.updateMatrixWorld(true);
    A.sh.getWorldPosition(_w);
    _d.subVectors(T, _w);
    // into the upper-body frame
    this.upper.getWorldQuaternion(_q2).invert();
    _d.applyQuaternion(_q2).normalize();
    return out.setFromUnitVectors(DOWN_V, _d);
  }

  /** World point the fist of arm i lands on when slamming toward `toward` (clamped to reach). */
  planSlam(i, toward) {
    const P = this.pose;
    const save = { bend: P.bend, lean: P.lean, hover: P.hover };
    P.bend = 0.55; P.lean = 0.42; P.hover = 0;
    this.applyPose();
    this.group.updateMatrixWorld(true);
    const A = this.arms[i];
    A.sh.getWorldPosition(_w);
    const L = ARM_LEN * MS;
    const h = _w.y - (this.floorY + 0.75 * MS);
    const reach = Math.sqrt(Math.max(0.5, L * L * 0.97 - h * h));
    this.fwd(_d);
    _t.subVectors(toward, _w).setY(0);
    let ang = Math.atan2(_t.x, _t.z) - this.yaw;
    ang = clamp(angleDiff(0, ang), -0.55, 0.55);
    const a = this.yaw + ang;
    const dist = Math.min(reach, Math.max(2.5, _t.length()));
    const target = this.arm[i].target.set(_w.x + Math.sin(a) * dist, this.floorY + 0.75 * MS, _w.z + Math.cos(a) * dist);
    // keep the reach exact: arm length from the shoulder
    _t.subVectors(target, _w);
    if (_t.length() > L) target.copy(_w).addScaledVector(_t.normalize(), L);
    P.bend = save.bend; P.lean = save.lean; P.hover = save.hover;
    this.applyPose();
    return target;
  }

  // ---------------------------------------------------------------------------------------------
  think(dt) {
    const S = this.S, Pl = this.player;
    const enter = this.entered();
    const st = this.state;
    const pos = this.position;
    // default arm targets relax toward rest unless a state drives them
    let armDriven = false;
    this.walkSpeed = 0;
    switch (st) {
      case 'intro': {
        this.pose.lean = lerp(this.pose.lean, -0.12, Math.min(1, dt * 2));
        for (let i = 0; i < 2; i++) { this.raisedQ(i, _q); this.arm[i].q.slerp(_q, Math.min(1, dt * 1.5)); this.arm[i].curl = 1; }
        armDriven = true;
        if (this.stateT > 1.0 && !this._roared) { this._roared = true; S.audio?.sfx('boss_roar', { pos, volume: 1, pitch: 0.65 }); S.shake(pos, 0.8); S.flash('#d9ccff', 0.4); }
        if (this.stateT > 2.6) this.setState('stalk');
        break;
      }
      case 'stalk': {           // phase 1/3: turn to the player, creep closer
        this._face(dt, 0.9);
        this.pose.lean = lerp(this.pose.lean, 0.05, Math.min(1, dt * 2));
        this.pose.bend = lerp(this.pose.bend, 0.08, Math.min(1, dt * 2));
        if (this.phase === 1) {
          _d.subVectors(Pl.position, pos).setY(0);
          if (_d.length() > 12) this._walk(dt, 1.3);
        }
        const rest = this.phase === 1 ? 1.4 : 1.2;
        if (this.stateT > rest && this.grace <= 0 && Pl.alive) this._next();
        break;
      }
      case 'slam-raise': this._slamRaise(dt, enter); armDriven = true; break;
      case 'slam-down': this._slamDown(dt, enter); armDriven = true; break;
      case 'palm': this._palm(dt, enter); armDriven = true; break;
      case 'hover-up': {
        if (enter) { S.audio?.sfx('boss_whir', { pos, volume: 1, dur: 1.6 }); }
        this.jet = lerp(this.jet, 1, Math.min(1, dt * 3));
        this.pose.hover = lerp(this.pose.hover, 1.6, Math.min(1, dt * 1.5));
        this.pose.bend = lerp(this.pose.bend, 0.25, Math.min(1, dt * 2));
        this._face(dt, 1);
        if (this.stateT > 1.8) { this._pickHover(); this.setState('hover'); }
        break;
      }
      case 'hover': {
        this._hoverMove(dt);
        if (this.stateT > 1.5 && this.grace <= 0 && Pl.alive) this._next();
        break;
      }
      case 'missiles': this._missiles(dt, enter); break;
      case 'drones': {
        this._hoverMove(dt);
        if (enter) {
          S.audio?.sfx('door', { pos, volume: 0.9 });
          const n = Math.min(2, 3 - this.addsAlive());
          for (let i = 0; i < n; i++) {
            const a = this.yaw + (i ? 1.6 : -1.6);
            _p.set(pos.x + Math.sin(a) * 3.5, this.floorY, pos.z + Math.cos(a) * 3.5);
            this._clampArena(_p);
            if (this.spawnAdd('buzzdrone', _p, { alt: 5, aggro: 34 })) S.fx.puff(_p.setY(this.floorY + 5), '#4a4356', 1.6, 0.6, null, 2, 0.6);
          }
        }
        if (this.stateT > 1.2) this.setState('hover');
        break;
      }
      case 'land': {          // phase 2 → 3: crash down, flood the roof
        if (enter) { this.later(0.9, () => this._landImpact()); }
        this.pose.hover = Math.max(0, this.pose.hover - dt * (this.stateT > 0.6 ? 9 : 0.5));
        this.jet = this.stateT > 0.6 ? 0 : 1;
        this._moveTo(dt, this.home, 3);
        if (this.stateT > 2.6) this.setState('stalk');
        break;
      }
      case 'beam-aim': this._beamAim(dt, enter); break;
      case 'beam-fire': this._beamFire(dt, enter); break;
      case 'chest': this._chestOpen(dt, enter); break;
      case 'break': {
        this.pose.lean = lerp(this.pose.lean, -0.2, Math.min(1, dt * 4));
        this.chestOpen = Math.max(0, this.chestOpen - dt * 2);
        if (this.stateT > 1.8) {
          if (this.phase === 2) this.setState('hover-up');
          else if (this.phase === 3) this.setState('land');
          else this.setState('stalk');
        }
        break;
      }
      default: break;
    }
    if (!armDriven) {
      for (let i = 0; i < 2; i++) {
        const a = this.arm[i];
        this.restQ(i, _q);
        a.q.slerp(_q, Math.min(1, dt * 3));
        a.elbow = lerp(a.elbow, 0.35, Math.min(1, dt * 3));
        a.wrist = lerp(a.wrist, 0, Math.min(1, dt * 3));
        a.curl = lerp(a.curl, a.broken ? 0.4 : 1, Math.min(1, dt * 4));
      }
    }
    if (this.phase < 2 && st !== 'hover-up') { this.jet = lerp(this.jet, 0, Math.min(1, dt * 3)); }
    this._stepWaves(dt);
    this._stepFlood(dt);
    this._stompContact();
    pos.y = this.floorY;
    this.applyPose();
  }

  _next() {
    const seqs = [null, ['slam', 'slam', 'slam'], ['missiles', 'missiles', 'drones', 'missiles'], ['slam', 'beam', 'slam2', 'beam']];
    const seq = seqs[this.phase];
    const a = seq[this.seqI++ % seq.length];
    if (a === 'slam' || a === 'slam2') {
      // pick an arm: in phase 1 only arms with an unbroken palm
      let i = this.slamArm;
      if (this.phase === 1 && this.arm[i].broken) i = 1 - i;
      this.slamArm = 1 - i;
      this.slamI = i;
      this.slamDouble = a === 'slam2';
      this.setState('slam-raise');
    } else if (a === 'missiles') this.setState('missiles');
    else if (a === 'drones') this.setState(this.addsAlive() < 3 ? 'drones' : 'missiles');
    else if (a === 'beam') this.setState('beam-aim');
  }

  _face(dt, rate) {
    const Pl = this.player;
    const want = Math.atan2(Pl.position.x - this.position.x, Pl.position.z - this.position.z);
    this.yaw = turnToward(this.yaw, want, rate * dt);
  }

  _walk(dt, speed) {
    this.fwd(_d);
    const pos = this.position;
    pos.addScaledVector(_d, speed * dt);
    this._clampZone(pos);
    this.walkSpeed = speed;
    const prev = this.walkPhase;
    this.walkPhase += dt * speed * 1.6;
    if (Math.floor(prev / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) {
      this.S.audio?.sfx('boss_step', { pos, volume: 1 });
      this.S.shake(pos, 0.25);
    }
  }

  _clampZone(p) {
    const c = this.aCenter;
    p.x = clamp(p.x, c.x - this.aHalf[0] + 5, c.x + this.aHalf[0] - 5);
    p.z = clamp(p.z, c.z - this.aHalf[1] + 1, c.z - 11);
    return p;
  }
  _clampArena(p) {
    const c = this.aCenter;
    p.x = clamp(p.x, c.x - this.aHalf[0] + 1.5, c.x + this.aHalf[0] - 1.5);
    p.z = clamp(p.z, c.z - this.aHalf[1] + 1.5, c.z + this.aHalf[1] - 1.5);
    return p;
  }

  _moveTo(dt, target, speed) {
    const pos = this.position;
    _d.subVectors(target, pos).setY(0);
    const L = _d.length();
    if (L > 0.05) pos.addScaledVector(_d, Math.min(1, (speed * dt) / L));
  }

  // ---- phase 1: slams ------------------------------------------------------------------------
  _slamRaise(dt, enter) {
    const S = this.S, i = this.slamI, a = this.arm[i];
    const T = this.phase === 3 ? 0.85 : 1.05;
    if (enter) {
      this.planSlam(i, this.player.position);
      this.warn(a.target, 2.6, T + 0.2, '#ff3b2a');
      S.audio?.sfx('boss_charge', { pos: this.position, volume: 0.9, dur: T });
      a.from.copy(a.q);
    }
    this._face(dt, 0.6);
    const k = smooth(this.stateT / T);
    this.raisedQ(i, _q);
    a.q.slerpQuaternions(a.from, _q, k);
    a.elbow = lerp(a.elbow, 0.9, Math.min(1, dt * 4));
    a.curl = lerp(a.curl, 1, Math.min(1, dt * 6));
    this.pose.lean = lerp(this.pose.lean, -0.15, Math.min(1, dt * 3));
    this.pose.twist = lerp(this.pose.twist, -a.side * 0.25, Math.min(1, dt * 3));
    this._relaxOther(dt, i);
    if (this.stateT >= T) this.setState('slam-down');
  }

  _slamDown(dt, enter) {
    const i = this.slamI, a = this.arm[i];
    const T = 0.2;
    if (enter) a.from.copy(a.q);
    const k = easeIn(this.stateT / T);
    this.pose.lean = lerp(this.pose.lean, 0.42, Math.min(1, dt * 14));
    this.pose.bend = lerp(this.pose.bend, 0.55, Math.min(1, dt * 14));
    this.pose.twist = lerp(this.pose.twist, a.side * 0.15, Math.min(1, dt * 10));
    this.applyPose();
    this.aimArmQ(i, a.target, _q);
    a.q.slerpQuaternions(a.from, _q, k);
    a.elbow = lerp(0.9, 0, k);
    this._relaxOther(dt, i);
    if (this.stateT >= T) this._slamImpact(i);
  }

  _slamImpact(i) {
    const S = this.S, a = this.arm[i];
    this.aimArmQ(i, a.target, a.q);
    a.elbow = 0;
    const at = _p.copy(a.target).setY(this.floorY);
    S.audio?.sfx('boss_slam', { pos: at, volume: 1 });
    S.audio?.sfx('bigboom', { pos: at, volume: 0.7 });
    S.shake(at, 1);
    S.fx.explosion(_w.copy(at).setY(this.floorY + 0.3), UP, this.pal.ink, 3.2);
    for (let k = 0; k < 5; k++) S.fx.puff(_w.copy(at).add(_t.set(Math.random() - 0.5, 0.2, Math.random() - 0.5).multiplyScalar(4)), '#8a8398', 2.4, 0.9, null, 2, 0.5);
    inkExplosion(S, at, UP, TEAM_MURK, { paintRadius: 3.2, damage: 0, owner: this, sound: 'boss_slam' });
    this.hurtNear(at, 3.2, 60);
    this.spawnWave(at, this.phase === 3 ? 1.45 : 0.62, this.phase === 3 ? 12 : 11);
    if (this.phase === 1 && !a.broken) this.setState('palm');
    else if (this.slamDouble) { this.slamDouble = false; this.slamI = 1 - i; this.setState('slam-raise'); }
    else this.setState(this.phase === 3 ? 'chest' : 'stalk');
  }

  /** Direct hit near a point (radius, damage) with knockback. */
  hurtNear(at, r, dmg) {
    const Pl = this.player;
    if (!Pl.alive) return;
    Pl.hitCenter(_hc);
    const d = Math.hypot(_hc.x - at.x, _hc.z - at.z);
    if (d < r && _hc.y - at.y < 3) this.hurt('slam', dmg, at, 11, 7, 0.5);
  }

  _palm(dt, enter) {
    const i = this.slamI, a = this.arm[i], A = this.arms[i];
    const T = this.phase === 1 ? 3.4 : 2.4;
    if (enter) { this.S.audio?.sfx('door', { pos: a.target, volume: 0.7 }); this._palmSaid = this._palmSaid || 0; }
    // hand flattens: wrist bends so the fingers lie on the roof, fingers open, palm core up
    const k = smooth(this.stateT / 0.35);
    const armPitch = Math.acos(clamp(-_d.set(0, -1, 0).applyQuaternion(a.q).applyQuaternion(this.upper.getWorldQuaternion(_q2)).y, -1, 1));
    a.wrist = lerp(a.wrist, (Math.PI / 2 - armPitch) * 0.9, k);
    a.curl = lerp(1, -0.05, k);
    if (this.stateT > 0.3 && !A.part.open && !A.part.broken) {
      A.part.setOpen(true);
      A.fistArmor.untargetable = true;
      if (this._palmSaid++ === 0) {
        this.say([{ who: 'pix', text: 'His palm is glowing! Hit it before he pulls it back!' }]);
        this.hint('Shoot the glowing palm!', 3);
      }
    }
    // tug to pull it free
    if (this.stateT > T - 0.8) {
      this.pose.lean = lerp(this.pose.lean, 0.3, Math.min(1, dt * 2));
      this.pose.twist = Math.sin(this.stateT * 18) * 0.03;
    }
    this._relaxOther(dt, i);
    if (this.stateT > T || A.part.broken) {
      A.part.setOpen(false);
      A.fistArmor.untargetable = false;
      this.setState(this.phase === 1 ? 'stalk' : 'chest');
    }
  }

  _relaxOther(dt, i) {
    const j = 1 - i, b = this.arm[j];
    this.restQ(j, _q);
    b.q.slerp(_q, Math.min(1, dt * 3));
    b.elbow = lerp(b.elbow, 0.4, Math.min(1, dt * 3));
    b.curl = lerp(b.curl, b.broken ? 0.4 : 1, Math.min(1, dt * 4));
  }

  // ---- shockwaves -----------------------------------------------------------------------------
  spawnWave(at, height, speed) {
    const mesh = this.wavePool.find((w) => !w.visible) || this.wavePool[0];
    mesh.visible = true;
    const base = Math.max(this.floorY, this.flood > 0.01 ? this.floodY() : this.floorY);
    this.waves.push({ c: at.clone().setY(base), r: 1.5, h: height, speed, hit: false, mesh, paintR: 0 });
    this.S.audio?.sfx('whoosh', { pos: at, volume: 0.9, pitch: 0.5 });
  }

  _stepWaves(dt) {
    const Pl = this.player;
    for (let k = this.waves.length - 1; k >= 0; k--) {
      const w = this.waves[k];
      w.r += w.speed * dt;
      const tube = w.h * 0.55;
      w.mesh.position.set(w.c.x, w.c.y + tube * 0.6, w.c.z);
      w.mesh.scale.set(w.r, w.r, tube / 0.05);
      w.mesh.material.opacity = clamp(1.2 - w.r / 26, 0, 0.92);
      // paint a ring of Murk every 1.6 m of growth
      if (w.r - w.paintR > 1.6 && w.c.y <= this.floorY + 0.01) {
        w.paintR = w.r;
        const n = Math.round(w.r * 1.4);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + w.r;
          _p.set(w.c.x + Math.cos(a) * w.r, w.c.y, w.c.z + Math.sin(a) * w.r);
          if (Math.abs(_p.x - this.aCenter.x) < this.aHalf[0] && Math.abs(_p.z - this.aCenter.z) < this.aHalf[1] + 4) this.S.ink.paint(_p, 0.8, TEAM_MURK, UP, { source: this });
        }
      }
      if (!w.hit && Pl.alive) {
        const d = Math.hypot(Pl.position.x - w.c.x, Pl.position.z - w.c.z);
        const feet = Pl.position.y - w.c.y;
        if (Math.abs(d - w.r) < 0.7 && feet < w.h && feet > -1.5) {
          if (this.hurt('wave', this.phase === 3 ? 40 : 45, w.c, 8, 6, 0.4)) w.hit = true;
        }
      }
      if (w.r > 28) { w.mesh.visible = false; this.waves.splice(k, 1); }
    }
  }

  _stompContact() {
    // standing on the mech's feet / right under it hurts a little and shoves
    const Pl = this.player;
    if (!Pl.alive || this.pose.hover > 0.5) return;
    for (const L of this.legs) {
      L.foot.getWorldPosition(_t);
      if (Math.hypot(Pl.position.x - _t.x, Pl.position.z - _t.z) < 1.5 * MS && Pl.position.y - this.floorY < 1.2 * MS && this.walkSpeed > 0.1) this.hurt('stomp', 25, _t, 9, 5, 1);
    }
  }

  // ---- phase 2: hover + missiles -------------------------------------------------------------
  _pickHover() {
    const c = this.aCenter;
    this.hoverTarget.set(c.x + (Math.random() - 0.5) * this.aHalf[0] * 1.2, this.floorY, c.z - this.aHalf[1] * 0.2 - Math.random() * this.aHalf[1] * 0.6);
    this._clampZone(this.hoverTarget);
    this._hoverRetarget = 3 + Math.random() * 2;
  }

  _hoverMove(dt) {
    this._hoverRetarget -= dt;
    if (this._hoverRetarget <= 0) this._pickHover();
    this._moveTo(dt, this.hoverTarget, 2.2);
    this._face(dt, 1.2);
    this.jet = lerp(this.jet, 1, Math.min(1, dt * 3));
    const firing = this.state === 'missiles';
    this.pose.hover = lerp(this.pose.hover, (firing ? 0.9 : 1.6) + Math.sin(this.t * 1.7) * 0.25, Math.min(1, dt * 2));
    this.pose.bend = lerp(this.pose.bend, firing ? 0.35 : 0.25, Math.min(1, dt * 2));
    this.pose.lean = lerp(this.pose.lean, firing ? 0.3 : 0.08, Math.min(1, dt * 2));
    // jets rain a little Murk
    this._rainT = (this._rainT || 0) - dt;
    if (this._rainT <= 0) {
      this._rainT = 0.5;
      const L = this.legs[Math.random() < 0.5 ? 0 : 1];
      L.foot.getWorldPosition(_t);
      this.lob(_t.setY(_t.y - 0.8), _p.set(_t.x + (Math.random() - 0.5) * 2, this.floorY, _t.z + (Math.random() - 0.5) * 2), 0.45, { damage: 14, splash: { radius: 1.1, damage: 12 }, paint: 1.3, size: 0.24 });
    }
  }

  _missiles(dt, enter) {
    const S = this.S, Pl = this.player;
    this._hoverMove(dt);
    const lockT = 1.1, n = 8, gap = 0.13, flight = 1.45;
    if (enter) {
      this.salvo = [];
      S.audio?.sfx('boss_alarm', { pos: this.position, volume: 0.8 });
      for (const p of this.pods) if (!p.part.broken) p.part.setOpen(true);
      // lock rings around the player
      for (let i = 0; i < n; i++) {
        const t = _p.copy(Pl.position);
        t.x += Pl.velocity.x * (lockT * 0.5); t.z += Pl.velocity.z * (lockT * 0.5);
        if (i > 0) { const a = (i / (n - 1)) * Math.PI * 2 + Math.random(), r = 2 + Math.random() * 4.5; t.x += Math.cos(a) * r; t.z += Math.sin(a) * r; }
        this._clampArena(t);
        const g = this.ground(t, new THREE.Vector3());
        this.salvo.push(g);
        this.warn(g, 2.3, lockT + i * gap + flight, '#ff3b2a');
      }
      this._lockBeeps = 0;
      if (!this._podSaid) { this._podSaid = true; this.say([{ who: 'brine', text: 'Missile pods open on his shoulders! That\'s your target!' }]); }
    }
    if (this.stateT < lockT && Math.floor(this.stateT / 0.18) > this._lockBeeps) { this._lockBeeps++; S.audio?.sfx('boss_lock', { pos: this.position, volume: 0.7 }); }
    for (let i = 0; i < this.salvo.length; i++) {
      const at = lockT + i * gap;
      if (this.salvo[i] && this.stateT >= at) {
        const pods = this.pods.filter((p) => !p.part.broken);
        const pod = pods.length ? pods[i % pods.length] : this.pods[i % 2];
        pod.muzzle.getWorldPosition(_t);
        this._launchMissile(_t, this.salvo[i], flight);
        this.salvo[i] = null;
      }
    }
    if (this.stateT > lockT + n * gap + 2.4) {
      for (const p of this.pods) p.part.setOpen(false);
      this.setState('hover');
    }
  }

  _launchMissile(from, to, T) {
    const S = this.S;
    const mesh = this.missilePool.find((m) => m.userData.free);
    const self = this;
    if (mesh) mesh.userData.free = false;
    const g = 16;
    _d.set((to.x - from.x) / T, (to.y - from.y + 0.5 * g * T * T) / T, (to.z - from.z) / T);
    S.audio?.sfx('missile', { pos: from, volume: 0.6 });
    S.fx.puff(from, '#d8d4e6', 1, 0.5, null, 2, 0.6);
    const land = (pos, n) => {
      if (mesh) { mesh.userData.free = true; mesh.parent?.remove(mesh); }
      inkExplosion(S, pos, n || UP, TEAM_MURK, { paintRadius: 2.2, damage: 45, dmgRadius: 2.3, owner: self, sound: 'boom' });
    };
    S.projectiles.spawn({
      pos: from, vel: _d, team: TEAM_MURK, owner: this, damage: 0, size: 0.25, radius: 0.25, gravity: g, life: T + 3, mesh: mesh || undefined, ignoreActors: true, fx: false,
      onStep: (p) => {
        if (p.mesh) { _w.copy(p.pos).add(p.vel); p.mesh.lookAt(_w); }
        if (Math.random() < 0.5) S.fx.puff(p.pos, '#cfc9dc', 0.45, 0.4, null, 1.8, 0.5);
      },
      onHit: (p, hit) => land(hit.point, hit.normal),
      onExpire: (p) => land(p.pos, UP),
    });
  }

  // ---- phase 3: flood, beam, chest -----------------------------------------------------------
  floodY() { return this.floorY - 0.35 + this.flood * 1.3; }

  _landImpact() {
    const S = this.S, pos = this.position;
    S.audio?.sfx('boss_slam', { pos, volume: 1 });
    S.audio?.sfx('boss_splash', { pos, volume: 1 });
    S.shake(pos, 1);
    S.flash('#d9ccff', 0.5);
    this.spawnWave(_p.copy(pos), 0.62, 12);
    this.floodTarget = 1;
    this.floodMesh.visible = true;
    this._floodPaint = 0;
    this.say([{ who: 'pix', text: 'The roof is flooding with Murk! Get up on the platforms, now!', mood: 'shock' }]);
    this.hint('Get onto the platforms!', 4);
  }

  _stepFlood(dt) {
    if (this.floodTarget <= 0 && this.flood <= 0) return;
    const prev = this.flood;
    this.flood = Math.min(this.floodTarget, this.flood + dt / 6);
    this.floodMesh.position.y = this.floodY();
    // paint the roof Murk once the flood is half up (a sweep of splats from the mech outward).
    // Until then the roof stays runnable at full speed: a player caught in the far north corner
    // needs ~4 s to reach the stairs, and wading through Murk at 36 % speed took ~9 s (a certain
    // splat at the old 20 dps).
    if (this.flood > prev && this.flood > FLOOD_SAFE && this._floodPaint < 1) {
      const c = this.aCenter, hx = this.aHalf[0], hz = this.aHalf[1];
      const cols = 14, rows = 14;
      const total = cols * rows;
      const from = Math.floor(this._floodPaint * total), to = Math.floor(Math.min(1, ((this.flood - FLOOD_SAFE) / (1 - FLOOD_SAFE)) * 1.05) * total);
      for (let i = from; i < to; i++) {
        const cx = i % cols, cz = Math.floor(i / cols);
        _p.set(c.x - hx + (cx + 0.5) * (2 * hx / cols), this.floorY, c.z - hz + (cz + 0.5) * (2 * hz / rows));
        this.S.ink.paint(_p, 2.3, TEAM_MURK, UP, { source: this });
      }
      this._floodPaint = Math.min(1, to / total);
    }
    // the flood hurts whoever wades in it
    const Pl = this.player;
    if (Pl.alive && this.flood > FLOOD_SAFE && Pl.position.y < this.floodY() - 0.05) this.hurt('flood', 3, _p.copy(Pl.position).setY(this.floorY - 5), 0, 0, 0.25);
  }

  _beamAim(dt, enter) {
    const S = this.S, Pl = this.player;
    const T = 1.0;
    if (enter) S.audio?.sfx('boss_charge', { pos: this.position, volume: 1, dur: T });
    this._face(dt, 1.4);
    this.lureTip.getWorldPosition(this.beamFromV || (this.beamFromV = new THREE.Vector3()));
    if (this.stateT < T - 0.25) (this.beamLock || (this.beamLock = new THREE.Vector3())).copy(Pl.position);
    this.beam.aim(this.beamFromV, this.beamLock);
    if (this.stateT > T) this.setState('beam-fire');
  }

  _beamFire(dt, enter) {
    const S = this.S, Pl = this.player;
    const T = 1.1;
    if (enter) {
      S.audio?.sfx('boss_beam', { pos: this.position, volume: 1, dur: T });
      _d.subVectors(this.beamLock, this.beamFromV).setY(0).normalize();
      const perp = _t.set(-_d.z, 0, _d.x);
      this.bA = this.beamLock.clone().addScaledVector(perp, -6);
      this.bB = this.beamLock.clone().addScaledVector(perp, 6);
      this.bPaint = new THREE.Vector3(1e9, 0, 0);
    }
    const k = clamp(this.stateT / T, 0, 1);
    this.lureTip.getWorldPosition(this.beamFromV);
    _p.lerpVectors(this.bA, this.bB, k);
    _d.subVectors(_p, this.beamFromV);
    const len = _d.length();
    _d.divideScalar(Math.max(1e-4, len));
    const hit = S.level.raycast(this.beamFromV, _d, len + 4, { staticOnly: true });
    const end = hit ? hit.point : _t.copy(this.beamFromV).addScaledVector(_d, len);
    this.beam.fire(this.beamFromV, end, this.t);
    if (end.distanceTo(this.bPaint) > 0.4) { this.bPaint.copy(end); S.ink.paint(end, 1.1, TEAM_MURK, hit ? hit.normal : UP, { source: this }); }
    if (Pl.alive && this.beam.distanceTo(Pl.hitCenter(_hc)) < 1.1) this.hurt('beam', 40, end, 3.5, 3.5, 0.7);   // soft shove: pontoons are small
    if (k >= 1) { this.beam.hide(); this.setState('chest'); }
  }

  _chestOpen(dt, enter) {
    const T = 3.8;
    if (enter) {
      this.S.audio?.sfx('door', { pos: this.position, volume: 1 });
      this.S.audio?.sfx('boss_sputter', { pos: this.position, volume: 0.6 });
      if (!this._chestSaid) { this._chestSaid = true; this.say([{ who: 'pix', text: 'The Sunburst Core is in the chest! Hit it when the armour opens!' }]); }
    }
    this.pose.lean = lerp(this.pose.lean, -0.1, Math.min(1, dt * 3));
    this.pose.bend = lerp(this.pose.bend, 0.2, Math.min(1, dt * 3));
    this.chestOpen = this.stateT < T - 0.4 ? Math.min(1, this.chestOpen + dt * 3) : Math.max(0, this.chestOpen - dt * 3);
    const open = this.chestOpen > 0.6 && this.stateT < T - 0.3;
    if (open !== this.core.open && !this.core.broken) this.core.setOpen(open);
    this.chestArmor.untargetable = this.chestOpen > 0.3;
    if (this.stateT > T) { this.core.setOpen(false); this.chestArmor.untargetable = false; this.setState('stalk'); }
  }

  // ---------------------------------------------------------------------------------------------
  onWeakBroken(part) {
    const S = this.S;
    const armI = this.arms.findIndex((A) => A.part === part);
    if (armI >= 0) {
      this.arm[armI].broken = true;
      this.arms[armI].fistArmor.untargetable = false;
      if (this.arm[0].broken && this.arm[1].broken) this._advance();
      else { S.audio?.sfx('boss_roar', { pos: this.position, volume: 0.9, pitch: 0.8 }); this.setState('stalk'); }
      return;
    }
    const pod = this.pods.find((p) => p.part === part);
    if (pod) {
      S.fx.puff(pod.pod.getWorldPosition(_t), '#2c2733', 2.5, 1.2, _d.set(0, 1.5, 0), 2, 0.7);
      if (this.pods.every((p) => p.part.broken)) this._advance();
      return;
    }
    if (part === this.core) this.startDefeat();
  }

  _advance() {
    const S = this.S;
    this.phase++;
    this.seqI = 0;
    for (const p of this.parts) if (p.kind === 'weak') p.setOpen(false);
    for (const A of this.arms) A.fistArmor.untargetable = false;
    this.setState('break');
    S.audio?.sfx('boss_roar', { pos: this.position, volume: 1, pitch: 0.7 });
    S.shake(this.position, 0.8);
    this.later(0.4, () => {
      if (this.phase === 2) this.phaseBanter([{ who: 'murkwell', text: 'You are ruining my suit! This is ITALIAN gray!', mood: 'angry' }]);
      else this.phaseBanter([{ who: 'murkwell', text: 'All power to the Mech! If I can\'t have colour, NOBODY CAN!', mood: 'angry' }, { who: 'brine', text: 'Hang in there, sprout! He\'s running on fumes!' }]);
    });
  }

  // ---------------------------------------------------------------------------------------------
  idle(dt) {
    for (let i = 0; i < 2; i++) { this.restQ(i, this.arm[i].q); this.arm[i].curl = i ? 1 : -0.05; this.arm[i].elbow = 0.35; }
    this.chestOpen = 0.8; this.podOpen = 0.8;
    this.applyPose();
    void dt;
  }

  animate(dt) {
    const t = this.rt, st = this.state;
    // doors / lids
    for (const d of this.doors) d.piv.rotation.y = d.s * this.chestOpen * 1.6;
    const podTarget = this.dormant ? 1 : this.pods.some((p) => p.part.open) ? 1 : 0;
    this.podOpen += (podTarget - this.podOpen) * Math.min(1, dt * 6);
    for (const p of this.pods) p.lid.rotation.x = -(p.part.broken ? 0.4 : this.podOpen) * 1.9;
    this.coreGem.rotation.y += dt * 1.2;
    // jets
    const jet = this.jet;
    this.jetMat.emissiveIntensity = 0.2 + jet * (3 + Math.sin(t * 40) * 0.8);
    for (const L of this.legs) {
      L.flame.material.opacity = jet * (0.6 + Math.random() * 0.3);
      L.flame.scale.set(1.4 * jet + 0.01, (2.4 + Math.random() * 0.6) * jet + 0.01, 1);
    }
    // eyes + lure
    const angry = st === 'slam-raise' || st === 'beam-aim' || st === 'missiles' || st === 'intro';
    this.eyeMat.emissive.copy(angry ? EYE_RED : EYE_AMBER);
    this.eyeMat.emissiveIntensity = angry ? 3 + Math.sin(t * 20) : 2.2;
    const lure = st === 'beam-aim' ? 3 + Math.sin(t * 30) * 2 : st === 'beam-fire' ? 6 : 2.4 + Math.sin(t * 2) * 0.5;
    this.lureMat.emissiveIntensity = lure;
    this.lureGlow.scale.setScalar(2.2 + lure * 0.3);
    this.seamMat.emissiveIntensity = 1.3 + Math.sin(t * 2.4) * 0.4 + (this._lightning || 0) * 2;
    this._lightning = Math.max(0, (this._lightning || 0) - dt * 3);
    // raised fist glows red before a slam
    if (st === 'slam-raise') this.S.fx.burst(this.arms[this.slamI].fistTip.getWorldPosition(_t), UP, '#ff5a2a', 1, 2, { size: 0.08, life: 0.3 });
    // exhaust
    this._smokeT = (this._smokeT || 0) - dt;
    if (this._smokeT <= 0) {
      this._smokeT = this.done ? 0.3 : 0.2;
      for (const s of this.stacks) this.S.fx.puff(s.getWorldPosition(_t), '#3a3346', 1.1, 0.9, _d.set(0, 2, 0), 2.2, 0.5);
    }
    // flood surface shimmer
    if (this.floodMesh.visible) this.floodMat.emissiveIntensity = 0.22 + Math.sin(t * 1.5) * 0.06;
    const mood = this.defeated ? 'panic' : angry || st === 'break' ? 'angry' : 'idle';
    this.pilot.update(dt, mood);
    if (this._podFly) this._animatePod(dt);
  }

  // ---------------------------------------------------------------------------------------------
  onDefeatStart() {
    this.beam.hide();
    this.floodTarget = 0;
    for (const w of this.waves) w.mesh.visible = false;
    this.waves.length = 0;
    this.chestOpen = 1;
    this.fall = { a: 0, av: 0, y: 0, vy: 0 };
    this.removeColliders();
    this.say([{ who: 'murkwell', text: 'No... no, no, NO! Not my beautiful gray!', mood: 'angry' }]);
  }

  defeatStep(dt, t) {
    const pos = this.position;
    // the flood drains away as the mech fails
    if (this.flood > 0) {
      this.flood = Math.max(0, this.flood - dt / 1.8);
      this.floodMesh.position.y = this.floodY();
      if (this.flood <= 0) this.floodMesh.visible = false;
    }
    // stagger back toward the tower edge, then topple over it
    this.pose.hover = Math.max(0, this.pose.hover - dt * 3);
    this.jet = Math.max(0, this.jet - dt);
    if (t < 2.4) {
      this.pose.lean = -0.1 + Math.sin(t * 9) * 0.06;
      this.pose.bend = 0.2 + Math.sin(t * 7) * 0.08;
      this.fwd(_d);
      pos.addScaledVector(_d, -dt * 1.2);
      for (let i = 0; i < 2; i++) { this.raisedQ(i, _q); this.arm[i].q.slerp(_q, Math.min(1, dt * 2)); this.arm[i].curl = -0.1; }
    } else {
      // topple on the heels until it lies over the parapet, then slide off the edge and drop
      const f = this.fall;
      this.fwd(_d);
      const c = this.aCenter;
      const back = -((pos.x - c.x) * _d.x + (pos.z - c.z) * _d.z);
      if (f.a < 1.3) {
        f.av += dt * 1.15;
        f.a = Math.min(1.3, f.a + f.av * dt);
        if (!this._fallSfx) { this._fallSfx = true; this.S.audio?.sfx('rumble', { pos, volume: 1 }); this.S.audio?.sfx('boss_roar', { pos, volume: 0.8, pitch: 0.55 }); }
        if (f.a >= 1.3) { this.S.audio?.sfx('boss_slam', { pos, volume: 1 }); this.S.shake(pos, 0.9); }
      } else {
        f.slide = (f.slide || 0) + dt * 6;
        pos.addScaledVector(_d, -f.slide * dt);
        if (back > this.aHalf[1] + 1.5) {
          f.vy -= 22 * dt; pos.y += f.vy * dt;
          f.a = Math.min(2.4, f.a + dt * 0.9);
        }
      }
    }
    this.applyPose();
    this.model.rotation.x = -(this.fall.a || 0);
    this.model.rotation.order = 'YXZ';
    if (t > 2.2 && !this._podFly) this._ejectPod();
    // far below: the crash
    if (pos.y < this.floorY - 45 && !this._crashed) {
      this._crashed = true;
      this.S.audio?.sfx('bigboom', { volume: 0.8 });
      this.S.shake(this.position, 0.4);
    }
    if (pos.y < this.floorY - 70) this.model.visible = false;
  }

  finalBlastAt(out) { return out.copy(this.home).setY(this.floorY + 1); }

  onFinalBlast() {
    // the roof drains back to colour
    this.floodTarget = 0;
    this.flood = 0;
    this.floodMesh.visible = false;
    const c = this.aCenter;
    for (let i = 0; i < 12; i++) {
      _p.set(c.x + (Math.random() - 0.5) * this.aHalf[0] * 1.6, this.floorY, c.z + (Math.random() - 0.5) * this.aHalf[1] * 1.6);
      this.S.ink.paint(_p, 3 + Math.random() * 2, TEAM_HERO, UP, { source: this });
    }
  }

  _ejectPod() {
    const pod = this.pod;
    pod.getWorldPosition(_t);
    pod.getWorldQuaternion(_q);
    this.S.scene.add(pod);          // reparent to the world
    pod.position.copy(_t);
    pod.quaternion.copy(_q);
    pod.scale.setScalar(this.model.scale.x);
    this._podFly = { v: new THREE.Vector3(2, 14, -6), t: 0, spin: 0 };
    this.S.audio?.sfx('launch', { pos: _t, volume: 1 });
    this.S.audio?.sfx('boss_whir', { pos: _t, volume: 0.8, dur: 2 });
    this.say([{ who: 'murkwell', text: 'This isn\'t over, squid! A Murkwell ALWAYS has an exit strategy!', mood: 'angry' }]);
  }

  _animatePod(dt) {
    const f = this._podFly, pod = this.pod;
    f.t += dt;
    f.v.y = Math.max(4, f.v.y - dt * 3);
    f.v.z -= dt * 3;
    pod.position.addScaledVector(f.v, dt);
    pod.rotation.y += dt * 2.5;
    pod.rotation.z = Math.sin(f.t * 6) * 0.2;
    this._podPuff = (this._podPuff || 0) - dt;
    if (this._podPuff <= 0) { this._podPuff = 0.06; this.S.fx.puff(pod.position, '#ffe98a', 0.7, 0.5, _d.set(0, -2, 0), 2, 0.7); }
    if (f.t > 7) { pod.visible = false; this._podFly = null; }
  }

  onDispose() {
    this.pilot?.dispose();
    if (this.S.env && this.S.env.onLightning) this.S.env.onLightning = this._prevLightning || null;
    this.floodMesh.parent?.remove(this.floodMesh);
    for (const w of this.wavePool) w.parent?.remove(w);
    for (const m of this.missilePool) m.parent?.remove(m);
    if (this.pod.parent && this.pod.parent !== this.head) { this.pod.parent.remove(this.pod); }
  }
}

void easeOut; void DOWN;

registerEntity('boss-murkwell', (s, d) => new MurkwellMech(s, d));
