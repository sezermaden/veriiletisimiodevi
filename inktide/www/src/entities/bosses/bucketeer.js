// THE BUCKETEER — a flying mech bucket on four rotor arms, piloted by Foreman Dredge (World 2).
//
// It circles the rooftop, tilting to slosh arcing waves of Murk blobs at the player and flying
// sweeping pour runs that drop a falling curtain of ink. Four glowing ink valves on its lower rim
// are the first weak points (each bursts with a spurt). With all four broken it sputters down
// beside the central tower, folds its rotors and pops its lid: the Coral Core rises out of the
// bucket for a few seconds and can only be hit from high ground (the tower / corner ledges).
// Three core breaks win. Phase 2+ drops Buzzdrones; phase 3 pours double curtains.
//
//   { type: 'boss-bucketeer', pos (floor centre), arena: { center, radius }, tower: [x, topY, z] }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { Boss, G, UP, DOWN, TEAM_MURK, clamp, lerp, smooth, easeOut, angleDiff, turnToward, emblemTexture, hazardTexture, mergeStatic, EYE_RED, EYE_AMBER } from './common.js';
import { Pilot } from './pilots.js';

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _acc = new THREE.Vector3();

const VALVE_HP = 140;
const CORE_HP = 385;
const PH = [null,
  { alt: 6.8, omega: 0.32, rest: 2.7, window: 7.0, pour: 7, waveT: 1.05 },
  { alt: 6.8, omega: 0.42, rest: 2.2, window: 6.5, pour: 8, waveT: 1.0 },
  { alt: 6.6, omega: 0.52, rest: 1.7, window: 6.0, pour: 9, waveT: 0.95 },
];
const SEQ = [null, ['slosh', 'pour', 'slosh'], ['slosh', 'drones', 'pour', 'slosh'], ['pour', 'slosh', 'drones', 'pour', 'slosh']];

export class Bucketeer extends Boss {
  constructor(session, def) {
    super(session, def, { name: 'The Bucketeer', coreColor: '#ff5fa8', phases: 3 });
    const A = def.arena || {};
    this.center = new THREE.Vector3().fromArray(A.center || def.pos || [0, 0, 0]);
    this.orbitR = A.radius ?? 11;
    this.tower = def.tower ? new THREE.Vector3().fromArray(def.tower) : null;
    this.vel = new THREE.Vector3();
    this.yaw = def.yaw ?? 0;
    this.group.rotation.y = 0;
    this.theta = Math.atan2(this.position.z - this.center.z, this.position.x - this.center.x) || Math.PI / 2;
    this.alt = PH[1].alt;
    this.tilt = new THREE.Vector2();
    this.tiltV = new THREE.Vector2();
    this.seqI = 0;
    this.coreBreaks = 0;
    this.rotorSpin = 0; this.rotorSpeed = 0;
    this.armFold = 0; this.lidOpen = 0; this.coreRise = 0;
    this.pourAcc = 0;
    this.dripT = 0;
    this.firstValve = true;
    this.defeatDuration = 5.2;
    this.defeatBooms = 3.8;
    this.armorHint = 'Shoot the four glowing ink valves on the Bucketeer\'s rim!';
    this.target = new THREE.Vector3();
    this.pourFrom = new THREE.Vector3(); this.pourTo = new THREE.Vector3();
    this._build();
    // hover start: spawn pos is the floor under it
    this.position.y = this.floorY + (this.dormant ? 3.2 : 4.2);
    this.rotorSpeed = 24;
    this.group.updateMatrixWorld(true);
    this.setState(this.dormant ? 'idle' : 'intro');
  }

  // ---------------------------------------------------------------------------------------------
  _build() {
    const P = this.pal;
    const hull = this.mat('hull', new THREE.Color('#2e2740').lerp(P.ink, 0.08), { roughness: 0.38, metalness: 0.45 });
    const hullL = this.mat('hullL', new THREE.Color('#4c4463').lerp(P.ink, 0.1), { roughness: 0.4, metalness: 0.4 });
    const violet = this.mat('violet', P.ink.clone().lerp(new THREE.Color('#ffffff'), 0.1), { roughness: 0.35, metalness: 0.2 });
    const steel = this.mat('steel', P.steel, { roughness: 0.32, metalness: 0.7 });
    const steelD = this.mat('steelD', P.steelDark, { roughness: 0.45, metalness: 0.6 });
    const yellow = this.mat('yellow', P.hazard, { roughness: 0.4 });
    const red = this.mat('red', '#e0312b', { roughness: 0.4 });
    const inkM = this.mat('ink', P.ink, { ink: true, rim: 0.5 });
    const hazard = this.mat('hazard', '#ffffff', { roughness: 0.45 });
    hazard.map = hazardTexture(); hazard.needsUpdate = true;
    const glass = this.own(new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.26, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.6, depthWrite: false }));
    const eye = this.glowMat('eye', '#ffd23a', 2.2);
    const blur = this.own(new THREE.MeshBasicMaterial({ color: '#d8d4e8', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    const emblem = this.own(new THREE.MeshStandardMaterial({ map: emblemTexture(), transparent: true, alphaTest: 0.05, roughness: 0.5 }));
    this.eyeMat = eye;
    const m = this.model;
    const body = this.body = this.node(m);

    // bucket shell (lathe: outer wall up, inner wall down)
    const shell = G.lathe('bucket-shell', [[0.01, -1.5], [1.72, -1.5], [1.86, -1.36], [2.46, 1.26], [2.62, 1.46], [2.42, 1.48], [2.3, 1.24], [1.7, -1.22], [0.01, -1.22]], 40);
    this.mesh(shell, hull, body);
    this.mesh(G.torus(2.54, 0.14, 10, 44), yellow, body, [0, 1.46, 0], [Math.PI / 2, 0, 0]);
    const band = G.lathe('bucket-band', [[2.02, -0.2], [2.14, 0.3]], 40);
    this.mesh(band, violet, body, [0, 0, 0], null, [1.03, 1, 1.03]);
    this.mesh(G.torus(1.8, 0.1, 8, 36), steel, body, [0, -1.42, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.mesh(G.sphere(0.07, 8, 6), steel, body, [Math.sin(a) * 2.34, 0.95, Math.cos(a) * 2.34]);
    }
    for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const e = this.mesh(G.plane(1.3, 1.3), emblem, body, [Math.sin(a) * 2.2, 0.25, Math.cos(a) * 2.2], [0, a, 0]);
      e.rotation.x = 0.2; e.castShadow = false;
    }
    // ink inside + the core on its piston
    this.mesh(G.disc(2.28, 36), inkM, body, [0, 0.95, 0]);
    const core = this.coreG = this.node(body, [0, 0.2, 0]);
    this.coreMat = this.mat('core', this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.6, roughness: 0.1, rim: 0.7, rimColor: '#ffffff' });
    this.coreMat.flatShading = true;
    this.coreGem = this.mesh(new THREE.IcosahedronGeometry(0.72, 0), this.coreMat, core);
    this.coreGem.userData.noMerge = true;
    this.own(this.coreGem.geometry);
    this.mesh(G.torus(0.95, 0.06, 8, 30), steel, core, [0, 0, 0], [Math.PI / 2, 0, 0]);
    this.mesh(G.torus(0.95, 0.05, 8, 30), steel, core, [0, 0, 0], [0, 0, 0]);
    this.mesh(G.cyl(0.25, 0.32, 1.6, 12), steelD, core, [0, -1.0, 0]);
    this.coreGlow = this.sprite(this.coreColor, 3.4, 0.5, core);
    // lids (two halves hinged at ±x)
    this.lids = [];
    for (const s of [1, -1]) {
      const piv = this.node(body, [s * 2.36, 1.5, 0]);
      const lid = this.node(piv, [-s * 2.36, 0, 0], [0, s > 0 ? 0 : Math.PI, 0]);
      this.mesh(halfDisc(), hullL, lid);
      this.mesh(G.box(0.16, 0.18, 4.4), yellow, lid, [0.1, 0.12, 0]);
      this.mesh(G.box(1.6, 0.12, 0.24), steel, lid, [1.2, 0.12, 0]);
      this.lids.push({ piv, s });
    }
    // handle
    const handle = this.handle = this.node(body, [0, 1.46, 0]);
    this.mesh(G.torus(2.75, 0.12, 10, 40, Math.PI), steel, handle);
    for (const s of [-1, 1]) this.mesh(G.cylX(0.26, 0.3, 14), yellow, body, [s * 2.7, 1.46, 0]);
    this.mesh(G.cyl(0.24, 0.24, 1.1, 14), red, handle, [0, 2.75, 0], [0, 0, Math.PI / 2]);
    // spout
    this.mesh(G.cyl(0.55, 0.25, 0.7, 16), steelD, body, [0, -1.82, 0]);
    this.mesh(G.torus(0.28, 0.06, 8, 18), yellow, body, [0, -2.18, 0], [Math.PI / 2, 0, 0]);
    this.spout = this.node(body, [0, -2.25, 0]);
    // angry eye slits + cockpit canopy with Dredge
    for (const s of [-1, 1]) this.mesh(G.box(0.62, 0.16, 0.12), eye, body, [s * 0.55, -0.35, 1.98], [-0.22, 0, s * 0.22]);
    const canopy = this.node(body, [0, 1.2, 2.4]);
    this.mesh(G.torus(0.86, 0.09, 10, 30), yellow, canopy, [0, 0, 0.05], [0, 0, 0]);
    this.mesh(G.cyl(0.9, 0.9, 0.3, 24), hullL, canopy, [0, -0.35, -0.2]);
    this.pilot = new Pilot(this, 'dredge', this.node(canopy, [0, -0.4, -0.05]), 0.95);
    const dome = this.mesh(G.sphere(0.88, 24, 16), glass, canopy, [0, 0, 0]);
    dome.castShadow = false;
    // rotor arms (diagonals)
    this.arms = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const root = this.node(body, [Math.sin(a) * 2.35, 0.9, Math.cos(a) * 2.35], [0, a, 0]);
      const fold = this.node(root);
      this.mesh(G.box(0.34, 0.3, 2.0), steelD, fold, [0, 0, 1.0]);
      this.mesh(G.box(0.12, 0.34, 2.0), yellow, fold, [0, 0.02, 1.0]);
      const nac = this.node(fold, [0, 0.1, 2.1]);
      this.mesh(G.cyl(0.42, 0.48, 0.7, 18), hullL, nac);
      this.mesh(G.torus(0.46, 0.05, 8, 20), yellow, nac, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
      const rotor = this.node(nac, [0, 0.46, 0]);
      for (const r of [0, Math.PI / 2]) this.mesh(G.box(2.5, 0.05, 0.26), steel, rotor, [0, 0, 0], [0, r, 0]);
      this.mesh(G.sphere(0.14, 10, 8), red, rotor);
      const disc = this.mesh(G.disc(1.3, 32), blur, rotor, [0, 0.02, 0]);
      disc.castShadow = false;
      this.arms.push({ root, fold, rotor, nac, disc });
    }
    // valves (cardinals, low on the wall): pipe stub, handwheel, glowing sight bulb
    this.valves = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const v = this.node(body, [Math.sin(a) * 1.98, -0.85, Math.cos(a) * 1.98], [0, a, 0]);
      this.mesh(G.cylZ(0.22, 0.22, 0.55, 14), steelD, v, [0, 0, 0.2]);
      const wheel = this.node(v, [0, 0, 0.5]);
      this.mesh(G.torus(0.3, 0.05, 8, 22), red, wheel);
      for (const r of [0, Math.PI / 2]) this.mesh(G.box(0.58, 0.05, 0.05), red, wheel, [0, 0, 0], [0, 0, r]);
      const bulbMat = this.mat('valve' + i, this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.6, roughness: 0.1, rim: 0.6, rimColor: '#ffffff' });
      const bulb = this.node(v, [0, -0.32, 0.42]);
      this.mesh(G.sphere(0.27, 16, 12), bulbMat, bulb);
      this.mesh(G.torus(0.27, 0.04, 6, 16), steel, bulb, [0, 0, 0], [Math.PI / 2, 0, 0]);
      const glow = this.sprite(this.coreColor, 1.6, 0.5, bulb);
      const part = this.part({ kind: 'weak', name: 'valve' + i, anchor: bulb, radius: 0.62, hp: Math.round(VALVE_HP * this.hpMul), mats: [bulbMat], glow, glowSize: 1.7, color: this.coreColor });
      this.valves.push({ node: v, wheel, bulb, part, dripT: Math.random() });
      this.anchors.push(bulb);
    }
    // armour soak (bucket body) + the core weak point
    this.armor = this.part({ kind: 'armor', anchor: body, offset: [0, -0.15, 0], radius: 1.9 });
    this.core = this.part({ kind: 'weak', name: 'core', anchor: core, radius: 0.95, hp: Math.round(CORE_HP * this.hpMul), mats: [this.coreMat], glow: this.coreGlow, glowSize: 3.4, color: this.coreColor });
    this.anchors.push(core, canopy, ...this.arms.map((a) => a.nac));
    mergeStatic(this, this.model);
  }

  // ---------------------------------------------------------------------------------------------
  valvesAlive() { let n = 0; for (const v of this.valves) if (!v.part.broken) n++; return n; }

  barFrac() {
    let cur = this.core.broken ? 0 : this.core.hp;
    for (const v of this.valves) cur += v.part.broken ? 0 : v.part.hp;
    const per = this.core.maxHp + this.valves.reduce((s, v) => s + v.part.maxHp, 0);
    return (3 - this.coreBreaks - 1 + cur / per) / 3;
  }

  hitCenter(out) { return out.copy(this.position); }

  onStart() {
    this.S.audio?.sfx('boss_whir', { pos: this.position, volume: 1, dur: 2 });
  }

  _openValves(v) { for (const x of this.valves) x.part.setOpen(v); }

  /** Critically-damped flight toward this.target. */
  _fly(dt, k = 2.4, damp = 2.8) {
    const pos = this.position;
    _acc.subVectors(this.target, pos).multiplyScalar(k).addScaledVector(this.vel, -damp);
    this.vel.addScaledVector(_acc, dt);
    pos.addScaledVector(this.vel, dt);
  }

  _orbitTarget(dt, omega) {
    this.theta += omega * dt;
    const bob = Math.sin(this.t * 1.7) * 0.3;
    this.target.set(this.center.x + Math.cos(this.theta) * this.orbitR, this.floorY + this.alt + bob, this.center.z + Math.sin(this.theta) * this.orbitR);
  }

  _faceTarget(dt, rate = 1.2) {
    const Pl = this.player;
    const want = Math.atan2(Pl.position.x - this.position.x, Pl.position.z - this.position.z);
    this.yaw = turnToward(this.yaw, want, rate * dt);
  }

  // ---------------------------------------------------------------------------------------------
  think(dt) {
    const S = this.S, Pl = this.player, C = PH[this.phase], pos = this.position;
    const enter = this.entered();
    this.alt = C.alt;
    switch (this.state) {
      case 'intro': {
        this.rotorSpeed = lerp(this.rotorSpeed, 30, Math.min(1, dt * 1.5));
        this.target.set(pos.x, this.floorY + this.alt, pos.z);
        this._fly(dt, 1.4, 2.2);
        this._faceTarget(dt, 1);
        if (this.stateT > 1.4 && !this._roared) { this._roared = true; S.audio?.sfx('boss_roar', { pos, volume: 1, pitch: 1.2 }); S.shake(pos, 0.4); }
        if (this.stateT > 2.8) { this._openValves(true); this.setState('orbit'); }
        break;
      }
      case 'orbit': {
        this.rotorSpeed = 30;
        this._orbitTarget(dt, C.omega);
        this._fly(dt);
        this._faceTarget(dt);
        if (this.stateT > C.rest && this.grace <= 0 && Pl.alive) this._next();
        break;
      }
      case 'slosh-warn': {
        if (enter) S.audio?.sfx('slosh', { pos, volume: 1, pitch: 0.6 });
        this._orbitTarget(dt, C.omega * 0.3);
        this._fly(dt);
        this._faceTarget(dt, 2.5);
        if (this.stateT > 0.85) this.setState('slosh');
        break;
      }
      case 'slosh': {
        if (enter) this._slosh();
        this._orbitTarget(dt, C.omega * 0.3);
        this._fly(dt);
        if (this.stateT > 0.9) this.setState('orbit');
        break;
      }
      case 'pour-move': {
        if (enter) this._planPour();
        this.target.copy(this.pourFrom);
        this._fly(dt, 3, 3);
        this._faceTarget(dt, 2);
        if (pos.distanceTo(this.pourFrom) < 1.2 || this.stateT > 3.2) this.setState('pour-warn');
        break;
      }
      case 'pour-warn': {
        if (enter) {
          S.audio?.sfx('boss_alarm', { pos, volume: 0.8 });
          // line of rings along the pour path, on whatever the curtain lands on (tower top, decks…)
          for (let i = 0; i <= 5; i++) {
            _p.lerpVectors(this.pourFrom, this.pourTo, i / 5);
            this.warn(this.ground(_p, _p), 1.8, 0.9 + (i / 5) * (this.pourLen / C.pour), '#ff3b2a');
          }
        }
        this.target.copy(this.pourFrom);
        this._fly(dt, 3, 3);
        if (Math.random() < 0.5) this._dropBlob(0.7, 0.9);
        if (this.stateT > 0.9) this.setState('pour');
        break;
      }
      case 'pour': {
        const T = this.pourLen / C.pour;
        const k = clamp(this.stateT / T, 0, 1);
        this.target.lerpVectors(this.pourFrom, this.pourTo, k);
        this._fly(dt, 6, 4.5);
        this.pourAcc += dt;
        while (this.pourAcc > 0.055) {
          this.pourAcc -= 0.055;
          this._dropBlob(this.phase >= 3 ? 1.9 : 1.0, 1);
          if (this.phase >= 3) this._dropBlob(1.9, 1);
        }
        if (Math.floor(this.stateT / 0.35) !== Math.floor((this.stateT - dt) / 0.35)) S.audio?.sfx('slosh', { pos, volume: 0.7, pitch: 0.8 + Math.random() * 0.2 });
        if (k >= 1) {
          this.theta = Math.atan2(pos.z - this.center.z, pos.x - this.center.x);
          this.setState('orbit');
        }
        break;
      }
      case 'drones': {
        this._orbitTarget(dt, C.omega * 0.5);
        this._fly(dt);
        if (enter) {
          S.audio?.sfx('door', { pos, volume: 0.8 });
          const n = Math.min(2, 3 - this.addsAlive());
          for (let i = 0; i < n; i++) {
            const a = this.yaw + (i ? 1 : -1) * 1.2;
            _p.set(pos.x + Math.sin(a) * 2.5, this.floorY, pos.z + Math.cos(a) * 2.5);
            const e = this.spawnAdd('buzzdrone', _p, { alt: 4.8, aggro: 30 });
            if (e) S.fx.puff(_p.setY(this.floorY + 4.8), '#4a4356', 1.6, 0.6, null, 2, 0.6);
          }
        }
        if (this.stateT > 1.0) this.setState('orbit');
        break;
      }
      case 'sputter': {       // all valves broken: coughing descent to the perch
        if (enter) {
          this._openValves(false);
          this._planPerch();
          S.audio?.sfx('boss_sputter', { pos, volume: 1 });
          this.say(this.firstDown ? null : [{ who: 'brine', text: 'It\'s going down! Get up high and hit the core when the lid pops!' }]);
          if (!this.firstDown) this.hint('Climb the tower and shoot the core inside the bucket!', 4);
          this.firstDown = true;
        }
        this.rotorSpeed = lerp(this.rotorSpeed, 8, Math.min(1, dt));
        this.target.copy(this.perch);
        this.target.y += Math.sin(this.stateT * 9) * 0.3;
        this._fly(dt, 2, 2.4);
        this.armFold = smooth(this.stateT / 1.8);
        if (Math.random() < 0.3) S.fx.puff(this.arms[Math.floor(Math.random() * 4)].nac.getWorldPosition(_t), '#3a3346', 1.2, 0.7, _d.set(0, 1, 0), 2, 0.6);
        if (this.stateT > 2.1) this.setState('grounded');
        break;
      }
      case 'grounded': {
        if (enter) S.audio?.sfx('door', { pos, volume: 1 });
        this.target.copy(this.perch);
        this.target.y += Math.sin(this.t * 3) * 0.08;
        this._fly(dt, 3, 3);
        this.armFold = 1;
        this.lidOpen = smooth(this.stateT / 0.6);
        this.coreRise = smooth((this.stateT - 0.3) / 0.7);
        if (this.stateT > 0.8 && !this.core.open && !this.core.broken) this.core.setOpen(true);
        if (Math.random() < 0.08) S.fx.puff(this.arms[Math.floor(Math.random() * 4)].nac.getWorldPosition(_t), '#3a3346', 1, 0.7, _d.set(0, 1.2, 0), 2, 0.5);
        if (this.stateT > C.window) {
          // too slow: reseal, patch the valves and take off again
          this.core.setOpen(false);
          for (const v of this.valves) if (v.part.broken) v.part.restore(0.6);
          this.updateBar();
          this.setState('rise');
          this.say([{ who: 'dredge', text: 'Duct tape! Duct tape fixes everything!', mood: 'smug' }]);
        }
        break;
      }
      case 'core-break': {
        this.target.copy(this.perch);
        this.target.y += Math.sin(this.stateT * 20) * 0.15;
        this._fly(dt, 3, 3);
        if (this.stateT > 1.8) {
          this.core.restore(1);
          for (const v of this.valves) v.part.restore(1);
          this.updateBar();
          this.setState('rise');
        }
        break;
      }
      case 'rise': {
        this.lidOpen = 1 - smooth(this.stateT / 0.5);
        this.coreRise = 1 - smooth(this.stateT / 0.5);
        this.armFold = 1 - smooth((this.stateT - 0.3) / 1.2);
        this.rotorSpeed = lerp(this.rotorSpeed, 30, Math.min(1, dt * 2));
        if (enter) S.audio?.sfx('boss_whir', { pos, volume: 1, dur: 1.5 });
        this.theta = Math.atan2(pos.z - this.center.z, pos.x - this.center.x);
        this._orbitTarget(0, 0);
        this.target.y = this.floorY + this.alt;
        this._fly(dt, 1.6, 2.4);
        if (this.stateT > 2.0) { this._openValves(true); this.setState('orbit'); }
        break;
      }
      default: break;
    }
    // broken valves gush ink while flying
    if (this.state === 'orbit' || this.state === 'pour' || this.state === 'slosh') {
      for (const v of this.valves) {
        if (!v.part.broken) continue;
        v.dripT -= dt;
        if (v.dripT <= 0) {
          v.dripT = 0.55 + Math.random() * 0.3;
          v.bulb.getWorldPosition(_t);
          _p.set(_t.x + (Math.random() - 0.5) * 2, this.floorY, _t.z + (Math.random() - 0.5) * 2);
          this.lob(_t, _p, 0.75, { damage: 16, splash: { radius: 1.2, damage: 14 }, paint: 1.1, size: 0.22 });
        }
      }
    }
    // keep inside the arena disc
    _v.subVectors(pos, this.center).setY(0);
    const R = this.orbitR + 4;
    if (_v.length() > R) { _v.setLength(R); pos.x = this.center.x + _v.x; pos.z = this.center.z + _v.z; }
    this.model.rotation.y = this.yaw;
  }

  _next() {
    const a = SEQ[this.phase][this.seqI++ % SEQ[this.phase].length];
    if (a === 'slosh') this.setState('slosh-warn');
    else if (a === 'pour') this.setState('pour-move');
    else if (a === 'drones') this.setState(this.addsAlive() < 3 ? 'drones' : 'slosh-warn');
  }

  /** Arcing wave: 3 rows of blobs across the player's position. */
  _slosh() {
    const S = this.S, Pl = this.player, C = PH[this.phase];
    const pos = this.position;
    _d.subVectors(Pl.position, pos).setY(0);
    const dist = _d.length();
    _d.normalize();
    const perp = _q.set(-_d.z, 0, _d.x);
    const aim = _p.copy(Pl.position);
    aim.x += Pl.velocity.x * 0.5; aim.z += Pl.velocity.z * 0.5;
    const rows = [-1.7, 0, 1.7];
    const gaps = [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)];
    S.audio?.sfx('slosh', { pos, volume: 1, pitch: 0.7 });
    S.audio?.sfx('whoosh', { pos, volume: 0.7, pitch: 0.7 });
    _t.copy(pos).addScaledVector(_d, 2.2).setY(pos.y + 1.4);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 1 && gaps.includes(c)) continue;
        const lat = (c - 4) * 1.45 + (Math.random() - 0.5) * 0.4;
        _v.copy(aim).addScaledVector(_d, rows[r]).addScaledVector(perp, lat);
        this._clampFloor(_v);
        this._surface(_v);
        const T = C.waveT + r * 0.12 + Math.abs(c - 4) * 0.03;
        this.lob(_t, _v, T, { damage: 22, splash: { radius: 1.35, damage: 22 }, paint: 1.35, size: 0.3 });
      }
    }
    for (let c = 0; c < 9; c += 2) {
      _v.copy(aim).addScaledVector(perp, (c - 4) * 1.45);
      this._clampFloor(_v);
      this.warn(this._surface(_v), 1.5, C.waveT, '#ff3b2a');
    }
    S.fx.burst(_t, _d, this.pal.ink, 18, 6, { size: 0.12 });
    void dist;
  }

  /** Snap p onto the first static surface below the bucket's flight height (tower top, decks, roof). */
  _surface(p) {
    p.y = Math.max(this.position.y, this.floorY + 7);
    return this.ground(p, p);
  }

  _clampFloor(p) {
    const dx = p.x - this.center.x, dz = p.z - this.center.z;
    const d = Math.hypot(dx, dz), R = this.orbitR + 7;
    if (d > R) { p.x = this.center.x + dx / d * R; p.z = this.center.z + dz / d * R; }
    return p;
  }

  _planPour() {
    const Pl = this.player, C = PH[this.phase];
    // a chord through (near) the player, starting on the side the bucket is already on
    _d.subVectors(Pl.position, this.position).setY(0);
    if (_d.lengthSq() < 1) _d.set(1, 0, 0);
    _d.normalize();
    // fly high enough to clear the vantage tower (the player may be standing on it)
    const alt = Math.max(C.alt - 0.4, this.tower ? this.tower.y - this.floorY + 2.9 : 0);
    const through = _p.copy(Pl.position).setY(this.floorY + alt);
    const half = this.orbitR + 2;
    this.pourFrom.copy(through).addScaledVector(_d, -half * 0.8);
    this.pourTo.copy(through).addScaledVector(_d, half * 0.9);
    this._clampAir(this.pourFrom); this._clampAir(this.pourTo);
    this.pourLen = this.pourFrom.distanceTo(this.pourTo);
  }

  _clampAir(p) {
    const dx = p.x - this.center.x, dz = p.z - this.center.z;
    const d = Math.hypot(dx, dz), R = this.orbitR + 2;
    if (d > R) { p.x = this.center.x + dx / d * R; p.z = this.center.z + dz / d * R; }
    return p;
  }

  _planPerch() {
    const Pl = this.player;
    const T = this.tower || this.center;
    _d.subVectors(Pl.position, T).setY(0);
    const onTower = this.tower && _d.length() < 3.2 && Pl.position.y > this.tower.y - 0.5;
    if (onTower || _d.lengthSq() < 1) _d.subVectors(this.position, T).setY(0);
    if (_d.lengthSq() < 1e-3) _d.set(1, 0, 0);
    _d.normalize();
    this.perch = (this.perch || new THREE.Vector3()).set(T.x, this.floorY + 3.3, T.z);
    if (!this.tower) return;
    // settle on clear roof beside the tower: never on the stairs, the landing or an AC unit
    // (the bucket has no collider, so it would swallow the player walking up the stairs)
    const a0 = Math.atan2(_d.x, _d.z);
    for (let k = 0; k < 17; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
      _q.set(T.x + Math.sin(a) * 6.4, 0, T.z + Math.cos(a) * 6.4);
      if (this._perchClear(_q)) { this.perch.set(_q.x, this.floorY + 3.3, _q.z); return; }
    }
    this.perch.addScaledVector(_d, 6.4);
  }

  /** Nothing taller than a planter under the grounded bucket (spout ~1 m, rim ~1.8 m up). */
  _perchClear(c) {
    const L = this.S.level;
    for (let i = 0; i < 5; i++) {
      const a = i * (Math.PI / 2) + Math.PI / 4, r = i === 4 ? 0 : 2.4;
      _t.set(c.x + Math.sin(a) * r, this.floorY + 4, c.z + Math.cos(a) * r);
      const hit = L.raycast(_t, DOWN, 6, { staticOnly: true });
      if (hit && hit.point.y > this.floorY + (r ? 1.3 : 0.8)) return false;
    }
    return true;
  }

  /** One blob falling from the spout (pour curtain). */
  _dropBlob(spread, dmgMul) {
    const S = this.S;
    this.spout.getWorldPosition(_t);
    const side = _q.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar((Math.random() - 0.5) * 2 * spread);
    _v.set(this.vel.x * 0.35 + side.x * 1.2, -3, this.vel.z * 0.35 + side.z * 1.2);
    S.projectiles.spawn({
      pos: _t.add(side), vel: _v, team: TEAM_MURK, owner: this, damage: 20 * dmgMul, size: 0.3, radius: 0.3, gravity: 18, life: 3,
      paint: { radius: 1.25 }, splash: { radius: 1.3, damage: 16 * dmgMul },
    });
  }

  onWeakHit(part) {
    // a hit valve wheel spins
    const v = this.valves.find((x) => x.part === part);
    if (v) v.spin = 1;
  }

  onWeakBroken(part) {
    const S = this.S;
    if (part === this.core) {
      this.coreBreaks++;
      this.core.setOpen(false);
      if (this.coreBreaks >= 3) { this.startDefeat(); return; }
      this.phase++;
      this.seqI = 0;
      this.setState('core-break');
      S.audio?.sfx('boss_roar', { pos: this.position, volume: 1, pitch: 1.2 });
      this.later(0.5, () => {
        if (this.phase === 2) this.phaseBanter([{ who: 'dredge', text: 'Ow! Hey! This thing is a RENTAL!', mood: 'angry' }]);
        else this.phaseBanter([{ who: 'dredge', text: 'Engage turbo slosh! ...Which button is turbo slosh?', mood: 'worried' }, { who: 'pix', text: 'Not that one! Definitely not that one!' }]);
      });
      return;
    }
    // a valve: spurt of Murk, the bucket lurches
    const v = this.valves.find((x) => x.part === part);
    if (v) {
      v.bulb.getWorldPosition(_t);
      for (let i = 0; i < 6; i++) {
        _p.set(_t.x + (Math.random() - 0.5) * 5, this.floorY, _t.z + (Math.random() - 0.5) * 5);
        this.lob(_t, _p, 0.6 + Math.random() * 0.4, { damage: 14, splash: null, paint: 1.3, size: 0.26 });
      }
      S.fx.burst(_t, UP, this.pal.ink, 26, 8, { size: 0.12 });
    }
    this.tiltV.x += (Math.random() - 0.5) * 3; this.tiltV.y += (Math.random() - 0.5) * 3;
    if (this.firstValve) {
      this.firstValve = false;
      this.say([{ who: 'pix', text: 'A valve blew! Pop all four and that bucket\'s going down!' }]);
    }
    if (this.valvesAlive() === 0 && !this.defeated) this.setState('sputter');
  }

  // ---------------------------------------------------------------------------------------------
  idle(dt) {
    this.rotorSpeed = 24; this.rotorSpin += this.rotorSpeed * dt;
    this.position.y = this.floorY + 3.2 + Math.sin(this.t * 1.5) * 0.2;
    this.lidOpen = 0.7; this.coreRise = 0.8;
    this.model.rotation.y = this.yaw;
  }

  animate(dt) {
    const t = this.rt, st = this.state;
    this.rotorSpin += this.rotorSpeed * dt;
    // tilt: lean into velocity, wobble on sputter, lean toward the player to slosh
    const lx = clamp(this.vel.z * 0.03, -0.25, 0.25), lz = clamp(-this.vel.x * 0.03, -0.25, 0.25);
    let tx = lx, tz = lz;
    if (st === 'slosh-warn') {
      _d.subVectors(this.player.position, this.position).setY(0).normalize();
      tx = _d.z * 0.35; tz = -_d.x * 0.35;
    } else if (st === 'slosh') { tx = -lx; tz = -lz; }
    if (st === 'sputter') { tx += Math.sin(t * 7) * 0.18; tz += Math.cos(t * 6) * 0.18; }
    if (this.defeated) { tx = Math.sin(t * 5) * 0.4; tz = Math.cos(t * 4) * 0.4; }
    this.tiltV.x += ((tx - this.tilt.x) * 30 - this.tiltV.x * 6) * dt;
    this.tiltV.y += ((tz - this.tilt.y) * 30 - this.tiltV.y * 6) * dt;
    this.tilt.x += this.tiltV.x * dt; this.tilt.y += this.tiltV.y * dt;
    // world-space tilt around the body (model is yawed): apply on the group
    this.group.rotation.set(this.tilt.x, 0, this.tilt.y);
    this.body.position.y = Math.sin(t * 2.3) * 0.08;
    this.handle.rotation.x = Math.sin(t * 1.4) * 0.12 - this.tilt.x * 0.8;
    for (const a of this.arms) {
      a.rotor.rotation.y = this.rotorSpin * (a === this.arms[1] || a === this.arms[3] ? -1 : 1);
      a.fold.rotation.x = -this.armFold * 1.25;
      a.disc.material.opacity = clamp(this.rotorSpeed / 30, 0, 1) * 0.16;
    }
    for (const l of this.lids) l.piv.rotation.z = -l.s * this.lidOpen * 1.9;
    this.coreG.position.y = 0.2 + this.coreRise * 2.1;
    this.coreGem.rotation.y += dt * 1.5;
    this.coreGem.rotation.x = Math.sin(t) * 0.3;
    for (const v of this.valves) {
      v.spin = Math.max(0, (v.spin || 0) - dt * 2);
      v.wheel.rotation.z += dt * (v.part.broken ? 0 : 1 + v.spin * 25);
      if (v.part.broken && Math.random() < dt * 8) this.S.fx.spray(v.bulb.getWorldPosition(_t), _d.set(0, -3, 0), this.pal.ink, 1, 1.2, { size: 0.08 });
    }
    // drips from the spout
    this.dripT -= dt;
    if (this.dripT <= 0 && !this.dormant) {
      this.dripT = st === 'pour-warn' ? 0.03 : 0.25;
      this.S.fx.spray(this.spout.getWorldPosition(_t), _d.set(0, -2, 0), this.pal.ink, 1, 0.5, { size: 0.09, life: 0.8 });
    }
    this.eyeMat.emissiveIntensity = st === 'slosh-warn' || st === 'pour-warn' ? (Math.sin(t * 30) > 0 ? 4 : 1) : st === 'grounded' ? 0.4 : 2.2;
    this.eyeMat.emissive.copy(st === 'slosh-warn' || st === 'pour-warn' ? EYE_RED : EYE_AMBER);
    const mood = this.defeated || st === 'sputter' || st === 'grounded' ? 'panic' : st === 'slosh-warn' || st === 'pour' || st === 'intro' ? 'angry' : 'idle';
    this.pilot.update(dt, mood);
    if (this._eject) this._animateEject(dt);
    // rotor buzz
    this._buzzT = (this._buzzT || 0) - dt;
    if (this._buzzT <= 0 && this.rotorSpeed > 5 && !this.dormant && !this.done) { this._buzzT = 0.3; this.S.audio?.sfx('drone_buzz', { pos: this.position, volume: 0.5, pitch: 0.5 }); }
  }

  // ---------------------------------------------------------------------------------------------
  onDefeatStart() {
    this.vel.set(0, 2, 0);
    this.spinV = 3;
    this.say([{ who: 'dredge', text: 'Mayday! Mayday! Does anyone know how to land this thing?!', mood: 'panic' }]);
  }

  defeatStep(dt, t) {
    const pos = this.position;
    this.spinV = Math.min(9, this.spinV + dt * 2);
    this.yaw += this.spinV * dt;
    this.model.rotation.y = this.yaw;
    this.rotorSpeed = Math.max(0, this.rotorSpeed - dt * 6);
    if (t < 3.4) {
      // spiral down toward the roof
      this.vel.y -= 5 * dt;
      // spiral down beside the tower (never into it)
      if (!this.crashAt) {
        _v.subVectors(pos, this.center).setY(0);
        if (_v.lengthSq() < 1) _v.set(1, 0, 0);
        this.crashAt = this.center.clone().addScaledVector(_v.normalize(), this.tower ? 8.5 : 0);
      }
      _d.subVectors(this.crashAt, pos).setY(0).multiplyScalar(0.8);
      this.vel.x += (_d.x - this.vel.x) * dt; this.vel.z += (_d.z - this.vel.z) * dt;
      pos.addScaledVector(this.vel, dt);
      const g = this.floorY + 1.6;
      if (pos.y < g) { pos.y = g; this.vel.y = Math.abs(this.vel.y) * 0.35; this.S.audio?.sfx('boss_slam', { pos, volume: 1 }); this.S.shake(pos, 0.8); }
    } else {
      pos.y = Math.max(this.floorY + 1.2, pos.y - dt * 2);
      this.armFold = Math.min(1.6, this.armFold + dt);
    }
    if (t > 2.4 && !this._eject) {
      this._eject = { v: new THREE.Vector3(1.5, 10, 2), t: 0 };
      this.S.audio?.sfx('launch', { pos, volume: 0.8 });
    }
    this.lidOpen = Math.min(1.3, this.lidOpen + dt * 0.5);
  }

  _animateEject(dt) {
    const f = this._eject;
    f.t += dt;
    f.v.y -= 8 * dt;
    const r = this.pilot.root;
    r.position.addScaledVector(f.v, dt);
    r.rotation.z += dt * 6;
    const s = Math.max(0, 1 - f.t / 3);
    r.scale.setScalar(s);
    if (s <= 0) { r.visible = false; this._eject = null; }
  }

  finalBlastAt(out) { return out.copy(this.position); }

  onDispose() { this.pilot?.dispose(); }
}

let _half = null;
function halfDisc() {
  if (_half) return _half;
  _half = new THREE.CylinderGeometry(2.38, 2.38, 0.14, 36, 1, false, 0, Math.PI);
  _half.userData.cached = true;
  return _half;
}

registerEntity('boss-bucketeer', (s, d) => new Bucketeer(s, d));
