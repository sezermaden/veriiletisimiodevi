// THE GRINDER — Foreman Dredge's roller tank (World 1 boss).
//
// Loop: track the player → rev (headlights strobe, engine revs, a chevron lane shows the charge
// line) → CHARGE in a straight line painting a wide Murk lane and flattening anything in front →
// ram a wall/pillar/container → STUNNED: the rear armour shutters slide open and the glowing fuel
// tank (the stolen Ember Core's glow) is the only weak point. Mortar volleys with ground target
// rings keep the player moving. Phase 2 (1 tank break): Gloopers join and every charge is a
// double charge. Phase 3 (2 breaks): faster, shorter tells and a spinning roller sweep.
// Three tank breaks → defeat.
//
//   { type: 'boss-grinder', pos, yaw, arena: { center:[x,y,z], half:[hx,hz] } }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import {
  Boss, G, UP, TEAM_MURK, clamp, lerp, smooth, easeOut, angleDiff, turnToward, emblemTexture, hazardTexture,
  chevronTexture, canvasTex, mergeStatic,
} from './common.js';
import { Pilot } from './pilots.js';

const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _o = new THREE.Vector3();
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();

const TANK_HP = 420;
const SC = 1.25;          // model scale (all gameplay distances below are multiplied by it)
const PH = [null,
  { track: 2.2, turn: 1.1, drive: 2.4, rev: 1.3, vmax: 16, stun: 3.6, salvo: 5, flight: 1.3, flatten: 70 },
  { track: 1.7, turn: 1.3, drive: 2.8, rev: 1.1, vmax: 17, stun: 3.4, salvo: 7, flight: 1.25, flatten: 75 },
  { track: 1.2, turn: 1.7, drive: 3.3, rev: 0.85, vmax: 19.5, stun: 3.1, salvo: 8, flight: 1.1, flatten: 80 },
];
const SEQ = [null, ['charge', 'charge', 'mortar'], ['charge', 'mortar', 'charge', 'charge', 'mortar'], ['charge', 'sweep', 'charge', 'mortar', 'sweep']];

function nameplateTex() {
  return canvasTex('grinder-plate', 512, 128, (x, w, h) => {
    x.fillStyle = '#16121e'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffc53a'; x.fillRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#16121e'; x.fillRect(16, 16, w - 32, h - 32);
    x.fillStyle = '#ffc53a';
    x.font = '900 70px "Bungee", "Lilita One", "Arial Black", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('GRINDER', w / 2, h / 2 + 4);
  });
}

export class Grinder extends Boss {
  constructor(session, def) {
    super(session, def, { name: 'The Grinder', coreColor: '#ff7a2e', phases: 3 });
    this.yaw = def.yaw ?? 0;
    this.group.rotation.y = 0;
    this.model.rotation.y = this.yaw;
    this.speed = 0;
    this.rollSpeed = 0;
    this.rollAngle = 0;
    this.seqI = 0;
    this.tankBreaks = 0;
    this.secondCharge = false;
    this.chargeDist = 0;
    this.paintAcc = 0;
    this.shutterK = 0;
    this.stunnedOnce = false;
    this.turretYaw = 0; this.barrelPitch = -0.7; this.recoil = 0;
    this.salvoN = 0;
    this.lean = 0; this.leanV = 0;
    this.smokeT = 0;
    this.defeatDuration = 4.8;
    this.defeatCamDist = 13; this.defeatCamHeight = 6;
    this.defeatBooms = 3.6;
    this.armorHint = 'The Grinder is armoured! Make it ram a wall, then hit the glowing fuel tank.';
    this._build();
    const hp = Math.round(TANK_HP * this.hpMul);
    this.tank = this.part({ kind: 'weak', name: 'tank', anchor: this.tankG, radius: 0.85 * SC, hp, mats: [this.tankMat], glow: this.tankGlow, glowSize: 2.6, color: this.coreColor });
    this.group.updateMatrixWorld(true);
    this.setState(this.dormant ? 'idle' : 'intro');
  }

  // ---------------------------------------------------------------------------------------------
  _build() {
    const P = this.pal;
    const tar = this.mat('tar', new THREE.Color('#2a2338').lerp(P.ink, 0.06), { roughness: 0.42, metalness: 0.35 });
    const tarL = this.mat('tarL', new THREE.Color('#4a4260').lerp(P.ink, 0.1), { roughness: 0.4, metalness: 0.4 });
    const violet = this.mat('violet', P.ink.clone().lerp(new THREE.Color('#ffffff'), 0.08), { roughness: 0.35, metalness: 0.2 });
    const steel = this.mat('steel', P.steel, { roughness: 0.35, metalness: 0.7 });
    const steelD = this.mat('steelD', P.steelDark, { roughness: 0.45, metalness: 0.6 });
    const rubber = this.mat('rubber', P.rubber, { roughness: 0.85, rim: 0.15 });
    const yellow = this.mat('yellow', P.hazard, { roughness: 0.4 });
    const inkM = this.mat('ink', P.ink, { ink: true, rim: 0.5 });
    const hazard = this.mat('hazard', '#ffffff', { roughness: 0.45 });
    hazard.map = hazardTexture(); hazard.needsUpdate = true;
    const glass = this.own(new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.6, depthWrite: false }));
    const head = this.glowMat('headlight', '#fff4c8', 1.6);
    const red = this.glowMat('redlight', '#ff3b2a', 1.8);
    const emblem = this.own(new THREE.MeshStandardMaterial({ map: emblemTexture(), transparent: true, alphaTest: 0.05, roughness: 0.5 }));
    const plate = this.own(new THREE.MeshStandardMaterial({ map: nameplateTex(), roughness: 0.5, emissive: '#ffc53a', emissiveIntensity: 0.08 }));
    this.headMat = head; this.redMat = red;

    const m = this.model;
    m.scale.setScalar(SC);
    // --- tracks (outside the tilting body) ---
    this.wheels = [];
    for (const s of [-1, 1]) {
      this.mesh(G.rbox(0.9, 1.15, 5.3, 0.4), rubber, m, [s * 2.05, 0.6, -0.3]);
      this.mesh(G.box(1.05, 0.12, 5.5), violet, m, [s * 2.05, 1.24, -0.3]);
      this.mesh(G.box(0.08, 0.12, 5.3), yellow, m, [s * 2.56, 1.24, -0.3]);
      for (let i = 0; i < 5; i++) {
        const w = this.node(m, [s * 2.05, 0.56, -2.2 + i * 0.95]);
        this.mesh(G.cylX(0.4, 0.95, 20), steel, w);
        this.mesh(G.cylX(0.2, 1.0, 12), yellow, w);
        this.mesh(G.box(1.0, 0.1, 0.5), steelD, w);
        this.wheels.push(w);
      }
      // track cleats (static)
      for (let i = 0; i < 11; i++) this.mesh(G.box(0.95, 0.1, 0.18), steelD, m, [s * 2.05, 1.14, -2.8 + i * 0.5]);
    }

    // --- body (hull, cab, tank, turret) — tilts on impacts / revs ---
    const body = this.body = this.node(m, [0, 0, 0]);
    this.mesh(G.rbox(3.4, 1.5, 4.7, 0.28), tar, body, [0, 1.35, -0.35]);
    this.mesh(G.rbox(3.0, 0.32, 3.4, 0.12), violet, body, [0, 2.2, -0.9]);
    this.mesh(G.box(3.62, 0.5, 0.32), hazard, body, [0, 0.95, 2.05]);
    this.mesh(G.box(3.5, 0.14, 0.14), steel, body, [0, 2.12, 1.95]);
    // rivets / panel seams
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) this.mesh(G.sphere(0.06, 8, 6), steel, body, [s * 1.71, 1.85, -2.2 + i * 1.3]);
      const e = this.mesh(G.plane(1.5, 1.5), emblem, body, [s * 1.72, 1.35, -0.45], [0, s * Math.PI / 2, 0]);
      e.castShadow = false;
    }
    // headlights
    this.lights = [];
    for (const s of [-1, 1]) {
      this.mesh(G.cylZ(0.3, 0.3, 0.16, 18), steelD, body, [s * 1.15, 1.72, 2.0]);
      this.mesh(G.cylZ(0.24, 0.24, 0.1, 18), head, body, [s * 1.15, 1.72, 2.08]);
      this.lights.push(this.sprite('#fff1c0', 1.8, 0.55, body, [s * 1.15, 1.72, 2.3]));
      this.mesh(G.box(0.3, 0.14, 0.06), red, body, [s * 1.5, 1.6, -2.73]);
    }
    // cab
    const cab = this.cab = this.node(body, [0, 2.1, 0.7]);
    this.mesh(G.rbox(2.2, 0.24, 1.95, 0.1), yellow, cab, [0, 1.42, 0]);
    this.mesh(G.box(2.0, 1.3, 0.14), tar, cab, [0, 0.7, -0.85]);
    this.mesh(G.box(2.1, 0.16, 1.9), tarL, cab, [0, 0.06, 0]);
    for (const [x, z] of [[-0.98, 0.86], [0.98, 0.86], [-0.98, -0.86], [0.98, -0.86]]) this.mesh(G.box(0.14, 1.3, 0.14), tarL, cab, [x, 0.72, z]);
    const ws = this.mesh(G.box(1.84, 1.1, 0.04), glass, cab, [0, 0.72, 0.87], [-0.12, 0, 0]); ws.castShadow = false;
    for (const s of [-1, 1]) { const w = this.mesh(G.box(0.04, 1.0, 1.58), glass, cab, [s * 0.99, 0.72, 0]); w.castShadow = false; }
    this.mesh(G.box(1.9, 0.3, 0.06), plate, cab, [0, 1.25, 0.99]);
    this.pilot = new Pilot(this, 'dredge', this.node(cab, [0, 0.12, -0.05]), 1.0);
    // beacon
    this.beacon = this.node(cab, [0, 1.62, -0.35]);
    this.mesh(G.cyl(0.18, 0.2, 0.26, 16), red, this.beacon);
    this.beaconGlow = this.sprite('#ff3b2a', 1.6, 0.6, this.beacon, [0, 0.05, 0]);
    // stars for the dizzy state
    this.stars = this.node(cab, [0, 2.1, 0]);
    const starM = this.glowMat('star', '#ffe14d', 2.2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.mesh(G.cone(0.14, 0.14, 4), starM, this.stars, [Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9], [0, 0, 0], [1, 1.6, 1]).castShadow = false;
    }
    this.stars.visible = false;
    // exhaust stacks
    this.stacks = [];
    for (const s of [-1, 1]) {
      this.mesh(G.cyl(0.17, 0.19, 1.4, 14), steelD, body, [s * 1.2, 2.9, -1.95]);
      this.mesh(G.cyl(0.24, 0.24, 0.14, 14), steel, body, [s * 1.2, 3.62, -1.95]);
      this.stacks.push(this.node(body, [s * 1.2, 3.75, -1.95]));
    }
    // mortar turret
    const tur = this.turret = this.node(body, [0, 2.36, -1.05]);
    this.mesh(G.cyl(0.72, 0.84, 0.36, 22), steel, tur, [0, 0.18, 0]);
    this.mesh(G.torus(0.78, 0.06, 8, 26), yellow, tur, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
    const brl = this.barrel = this.node(tur, [0, 0.46, 0]);
    this.barrelInner = this.node(brl, [0, 0, 0]);
    this.mesh(G.cylZ(0.3, 0.36, 1.45, 18), steelD, this.barrelInner, [0, 0, 0.55]);
    this.mesh(G.torus(0.33, 0.07, 8, 20), steel, this.barrelInner, [0, 0, 1.28]);
    this.mesh(G.sphere(0.48, 18, 12), steel, brl, [0, 0, 0]);
    this.muzzle = this.node(this.barrelInner, [0, 0, 1.45]);

    // rear fuel tank (the weak point) + sliding shutters
    const tg = this.tankG = this.node(body, [0, 1.78, -2.95]);
    this.tankMat = this.mat('tankcore', this.coreColor, { emissive: this.coreColor, emissiveIntensity: 1.6, roughness: 0.15, rim: 0.6, rimColor: '#ffffff' });
    this.mesh(G.capsuleX(0.6, 1.3), this.tankMat, tg);
    for (const x of [-0.72, 0, 0.72]) this.mesh(G.cylX(0.64, 0.1, 22), steelD, tg, [x, 0, 0]);
    this.mesh(G.box(1.9, 0.12, 0.5), steelD, tg, [0, -0.62, 0.15]);
    this.tankGlow = this.sprite(this.coreColor, 2.6, 0.5, tg, [0, 0, -0.2]);
    this.shutters = [];
    for (const s of [-1, 1]) {
      const sh = this.node(body, [s * 0.62, 1.8, -3.55]);
      this.mesh(G.rbox(1.22, 1.55, 0.2, 0.06), tarL, sh);
      this.mesh(G.box(1.22, 0.28, 0.06), hazard, sh, [0, -0.5, -0.11]);
      this.mesh(G.box(0.1, 1.4, 0.08), steel, sh, [-s * 0.56, 0, -0.12]);
      this.shutters.push({ g: sh, s });
    }

    // --- roller on arms ---
    for (const s of [-1, 1]) {
      this.mesh(G.box(0.38, 0.4, 2.1), steelD, m, [s * 2.28, 1.12, 2.55]);
      this.mesh(G.cylX(0.3, 0.5, 16), yellow, m, [s * 2.28, 1.12, 1.6]);
    }
    this.mesh(hoodGeometry(), tarL, m, [0, 1.05, 3.45]);
    this.mesh(G.box(4.7, 0.2, 0.12), hazard, m, [0, 2.25, 3.2]);
    const roller = this.roller = this.node(m, [0, 1.05, 3.45]);
    this.mesh(G.cylX(1.0, 4.3, 32), inkM, roller);
    for (const s of [-1, 1]) {
      this.mesh(G.cylX(1.1, 0.2, 28), steel, roller, [s * 2.2, 0, 0]);
      this.mesh(G.cylX(0.35, 0.3, 16), yellow, roller, [s * 2.36, 0, 0]);
    }
    for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) this.mesh(G.torus(1.02, 0.075, 8, 32), steel, roller, [x, 0, 0], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (const x of [-1.2, -0.4, 0.4, 1.2]) {
        const c = this.mesh(G.cone(0.16, 0.36, 6), steel, roller, [x + (i % 2) * 0.4 - 0.2, Math.cos(a) * 1.05, Math.sin(a) * 1.05], [a, 0, 0]);
        c.castShadow = false;
      }
    }

    // --- charge lane telegraph ---
    const laneMat = this.own(new THREE.MeshBasicMaterial({ map: chevronTexture().clone(), color: '#ff3b2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, fog: false }));
    laneMat.map.wrapS = laneMat.map.wrapT = THREE.RepeatWrapping;
    laneMat.map.needsUpdate = true;
    this.own(laneMat.map);
    this.laneMat = laneMat;
    this.lane = new THREE.Mesh(G.quad(), laneMat);
    this.lane.visible = false;
    this.lane.renderOrder = 3;
    this.S.scene.add(this.lane);

    // --- solid colliders ---
    this.collider(4.95, 2.3, 5.6, m, 0, 1.15, -0.4);
    this.collider(2.1, 1.5, 1.9, m, 0, 2.95, 0.7);
    this.collider(4.95, 2.1, 2.2, m, 0, 1.05, 3.45);

    // explosion anchors for the defeat sequence
    this.anchors.push(this.tankG, this.turret, this.cab, this.roller, this.stacks[0], this.stacks[1], this.body);
    this.model.traverse((o) => { if (o.isMesh && o.material === glass) o.castShadow = false; });
    mergeStatic(this, this.model);
  }

  // ---------------------------------------------------------------------------------------------
  fwd(out = _f) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right(out = _r) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  /** Clearance ahead of the roller (static geometry + arena box). Returns { dist, hit }. */
  probe(maxDist) {
    const S = this.S, pos = this.position;
    const f = this.fwd(_f), r = this.right(_r);
    let best = maxDist, bestHit = null;
    for (const x of [-2.25 * SC, 0, 2.25 * SC]) {
      for (const h of [0.55, 1.7 * SC]) {
        _o.copy(pos).addScaledVector(r, x).addScaledVector(f, 3.45 * SC);
        _o.y = this.floorY + h;
        const hit = S.level.raycast(_o, f, maxDist + 1.15 * SC, { staticOnly: true });
        if (hit && hit.distance - 1.1 * SC < best) { best = hit.distance - 1.1 * SC; bestHit = hit; }
      }
    }
    const A = this.arena;
    if (A?.half) {
      // stay inside the arena box (roller front must not leave it)
      const cx = A.center[0], cz = A.center[2];
      for (let d = 0; d <= best; d += 0.5) {
        const px = pos.x + f.x * (d + 4.5 * SC), pz = pos.z + f.z * (d + 4.5 * SC);
        if (Math.abs(px - cx) > A.half[0] || Math.abs(pz - cz) > A.half[1]) { best = d; bestHit = null; break; }
      }
    }
    return { dist: Math.max(0, best), hit: bestHit };
  }

  nextAttack() {
    const seq = SEQ[this.phase];
    const a = seq[this.seqI++ % seq.length];
    if (a === 'charge') this.setState('rev');
    else if (a === 'mortar') this.setState('mortar');
    else if (a === 'sweep') this.setState('sweep-warn');
  }

  onStart() {
    this.S.audio?.sfx('boss_rev', { pos: this.position, volume: 1, pitch: 0.8, dur: 1.6 });
  }

  // ---------------------------------------------------------------------------------------------
  think(dt) {
    const S = this.S, Pl = this.player, C = PH[this.phase];
    const pos = this.position;
    const enter = this.entered();
    let move = 0;
    switch (this.state) {
      case 'intro': {
        this.rollSpeed = 3 * Math.sin(this.stateT * 4);
        if (this.stateT > 0.7 && !this._roared) {
          this._roared = true;
          S.audio?.sfx('boss_roar', { pos, volume: 1 });
          S.shake(pos, 0.6);
          S.fx.burst(this.stacks[0].getWorldPosition(_t), UP, '#3b3348', 10, 3, { size: 0.12 });
        }
        if (this.stateT > 2.6) this.setState('track');
        break;
      }
      case 'track': {
        const want = Math.atan2(Pl.position.x - pos.x, Pl.position.z - pos.z);
        this.yaw = turnToward(this.yaw, want, C.turn * dt);
        const face = Math.abs(angleDiff(this.yaw, want));
        const pr = this.probe(3);
        const tgtSpeed = face < 0.6 && pr.dist > 1.2 ? C.drive : 0;
        this.speed = lerp(this.speed, tgtSpeed, Math.min(1, dt * 3));
        move = this.speed;
        this.rollSpeed = this.speed;
        this._contact(dt, 22, 6);
        if (this.stateT > C.track && this.grace <= 0 && Pl.alive) this.nextAttack();
        break;
      }
      case 'rev': {
        const T = C.rev;
        if (enter) {
          if (!this._quickRev) S.audio?.sfx('boss_rev', { pos, volume: 1, dur: T });
          this._quickRev = false;
          this.speed = 0;
        }
        if (this.stateT < T * 0.72 && Pl.alive) {
          const want = Math.atan2(Pl.position.x - pos.x, Pl.position.z - pos.z);
          this.yaw = turnToward(this.yaw, want, 3.2 * dt);
        }
        this.rollSpeed = lerp(this.rollSpeed, 22, Math.min(1, dt * 3));
        const pr = this.probe(34);
        this.laneLen = Math.max(2, pr.dist + 1);
        this.lean = -0.05;
        if (this.stateT > T) {
          if (this.laneLen < 8 && (this._repos || 0) < 2) {
            // too close to a wall to build up speed: back off first
            this._repos = (this._repos || 0) + 1;
            this.setState('reposition');
            break;
          }
          this._repos = 0;
          this.chargeDist = 0; this.paintAcc = 0;
          this.setState('charge');
          S.audio?.sfx('whoosh', { pos, volume: 0.8, pitch: 0.6 });
        }
        break;
      }
      case 'reposition': {    // reverse away from the wall, turning toward the player
        move = this.stateT < 1.5 ? -4 : 0;
        this.rollSpeed = move;
        if (Pl.alive) {
          const want = Math.atan2(Pl.position.x - pos.x, Pl.position.z - pos.z);
          this.yaw = turnToward(this.yaw, want, 1.4 * dt);
        }
        if (this.stateT > 1.7) { this.setState('rev'); this.stateT = C.rev * 0.4; this._quickRev = true; S.audio?.sfx('boss_rev', { pos, volume: 1, dur: C.rev * 0.6 }); }
        break;
      }
      case 'charge': {
        this.speed = Math.min(C.vmax, this.speed + 34 * dt);
        this.rollSpeed = this.speed;
        const step = this.speed * dt;
        const pr = this.probe(step + 1.5);
        this._flatten(C.flatten);
        if (pr.dist <= step + 0.05) {
          move = pr.dist / dt;
          this._ram(pr.hit);
          break;
        }
        move = this.speed;
        this.chargeDist += step;
        if (this.chargeDist > 34) { this.setState('skid'); break; }
        this.lean = 0.03;
        break;
      }
      case 'bounce': {       // phase 2: shrug off the first impact and go again
        this.speed = lerp(this.speed, -3.2, Math.min(1, dt * 8));
        move = this.stateT < 0.45 ? this.speed : 0;
        this.rollSpeed = move;
        if (this.stateT > 0.5) {
          const want = Math.atan2(Pl.position.x - pos.x, Pl.position.z - pos.z);
          this.yaw = turnToward(this.yaw, want, 3.6 * dt);
        }
        if (this.stateT > 0.95) { this.setState('rev'); this.stateT = C.rev * 0.35; this._quickRev = true; S.audio?.sfx('boss_rev', { pos, volume: 1, dur: C.rev * 0.65 }); }
        break;
      }
      case 'skid': {
        this.speed = Math.max(0, this.speed - 30 * dt);
        move = this.speed;
        this.rollSpeed = this.speed * 0.3;
        if (this.speed > 2) S.fx.burst(this.roller.getWorldPosition(_t).setY(this.floorY + 0.2), UP, '#ffe7a0', 2, 4, { size: 0.04, life: 0.3 });
        if (this.speed <= 0.01 && this.stateT > 0.5) { this.secondCharge = false; this.setState('track'); }
        break;
      }
      case 'stunned': {
        this.speed = 0;
        this.rollSpeed = lerp(this.rollSpeed, 0, Math.min(1, dt * 2));
        if (this.stateT > 0.28 && !this.tank.open && !this.tank.broken) this.tank.setOpen(true);
        if (this.stateT > C.stun) {
          this.tank.setOpen(false);
          this.setState('recover');
        }
        break;
      }
      case 'recover': {
        move = this.stateT < 0.6 ? -1.8 : 0;
        this.rollSpeed = move;
        if (this.stateT > 1.0) this.setState('track');
        break;
      }
      case 'mortar': this._mortar(dt, enter); this.rollSpeed = 0; this.speed = 0; break;
      case 'sweep-warn': {
        this.speed = 0;
        if (enter) {
          S.audio?.sfx('boss_alarm', { pos, volume: 1 });
          this.warn(pos, 5.8 * SC, 1.15, '#ff3b2a');
        }
        this.rollSpeed = lerp(this.rollSpeed, 16, Math.min(1, dt * 3));
        this.lean = 0.04;
        if (this.stateT > 1.15) { this.setState('sweep'); S.audio?.sfx('boss_rev', { pos, volume: 1, dur: 2.2, pitch: 1.3 }); }
        break;
      }
      case 'sweep': {
        const T = 2.3;
        const spin = (Math.PI * 4) / T;
        this.yaw += spin * dt * smooth(Math.min(1, this.stateT * 3)) * (this.stateT > T - 0.4 ? (T - this.stateT) / 0.4 : 1);
        this.rollSpeed = 18;
        // paint the ring the roller sweeps + hurt anyone inside it
        this.roller.getWorldPosition(_t);
        _t.y = this.floorY;
        this.paintAcc += spin * 3.45 * SC * dt;
        if (this.paintAcc > 0.6) { this.paintAcc = 0; S.ink.paint(_t, 2.2, TEAM_MURK, UP, { source: this }); }
        const dx = Pl.position.x - pos.x, dz = Pl.position.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 5.8 * SC && Pl.position.y - this.floorY < 2.4 * SC) this.hurt('sweep', 45, pos, 12, 7, 1.0);
        if (Math.floor(this.stateT / 0.32) !== Math.floor((this.stateT - dt) / 0.32)) {
          this.fwd(_d);
          const tgt = _p.copy(pos).addScaledVector(_d, 9.5 + Math.random() * 5);
          tgt.y = this.floorY;
          this._clampArena(tgt);
          this.warn(tgt, 1.7, 0.9);
          this.lob(_t.setY(this.floorY + 2), tgt, 0.9, { damage: 26, splash: { radius: 1.8, damage: 30 }, paint: 1.7, size: 0.36 });
        }
        if (this.stateT > T) { this.lean = 0; this.setState('recover'); }
        break;
      }
      case 'break': {
        this.speed = 0; this.rollSpeed = 0;
        if (this.stateT > 2.2) {
          this.tank.restore(1);
          this.updateBar();
          this.setState('track');
        }
        break;
      }
      default: break;
    }
    // integrate
    if (move < 0 && this._rearBlocked()) move = 0;
    if (move !== 0) {
      this.fwd(_f);
      pos.addScaledVector(_f, move * dt);
      // paint the roller's track
      this.paintAcc += Math.abs(move) * dt;
      const every = this.state === 'charge' ? 0.5 : 0.7;
      if (this.paintAcc >= every) {
        this.paintAcc = 0;
        _t.copy(pos).addScaledVector(_f, move > 0 ? 3.45 * SC : 0).setY(this.floorY);
        S.ink.paint(_t, this.state === 'charge' ? 2.45 * SC : 1.7 * SC, TEAM_MURK, UP, { source: this });
      }
    }
    pos.y = this.floorY;
    const A = this.arena;
    if (A?.half) {
      pos.x = clamp(pos.x, A.center[0] - A.half[0] + 3.2 * SC, A.center[0] + A.half[0] - 3.2 * SC);
      pos.z = clamp(pos.z, A.center[2] - A.half[1] + 3.2 * SC, A.center[2] + A.half[1] - 3.2 * SC);
    }
    this.model.rotation.y = this.yaw;
    this.rollAngle += (this.rollSpeed / 1.0) * dt;
  }

  _rearBlocked() {
    const f = this.fwd(_f), r = this.right(_r);
    _d.copy(f).negate();
    for (const x of [-2 * SC, 0, 2 * SC]) {
      _o.copy(this.position).addScaledVector(r, x).addScaledVector(f, -3.3 * SC);
      _o.y = this.floorY + 0.8;
      const hit = this.S.level.raycast(_o, _d, 0.9, { staticOnly: true });
      if (hit) return true;
    }
    return false;
  }

  _clampArena(p) {
    const A = this.arena;
    if (!A?.half) return p;
    p.x = clamp(p.x, A.center[0] - A.half[0] + 1.5, A.center[0] + A.half[0] - 1.5);
    p.z = clamp(p.z, A.center[2] - A.half[1] + 1.5, A.center[2] + A.half[1] - 1.5);
    return p;
  }

  /** Low-speed shove when the roller bumps into the player. */
  _contact(dt, dmg, knock) {
    void dt;
    if (this.speed < 0.8) return;
    const Pl = this.player, pos = this.position;
    this.fwd(_f); this.right(_r);
    _d.subVectors(Pl.position, pos);
    const lz = _d.dot(_f), lx = _d.dot(_r);
    if (lz > 2.2 * SC && lz < 4.9 * SC && Math.abs(lx) < 2.8 * SC && Pl.position.y - this.floorY < 2.3 * SC) {
      _o.copy(pos).addScaledVector(_f, lz);
      this.hurt('bump', dmg, _o, knock, 4, 0.8);
    }
  }

  /** The charge flattens anything in front of the roller. */
  _flatten(dmg) {
    const Pl = this.player, pos = this.position;
    if (!Pl.alive) return;
    this.fwd(_f); this.right(_r);
    _d.subVectors(Pl.position, pos);
    const lz = _d.dot(_f), lx = _d.dot(_r);
    if (lz > 1.8 * SC && lz < 5.0 * SC && Math.abs(lx) < 2.85 * SC && Pl.position.y - this.floorY < 2.5 * SC) {
      // knock the player SIDEWAYS out of the lane (never ahead of the roller, or it would pin them)
      const side = Math.abs(lx) > 0.25 ? Math.sign(lx) : (Math.random() < 0.5 ? -1 : 1);
      _o.copy(pos).addScaledVector(_f, lz - 0.6).addScaledVector(_r, lx - side * 1.5);
      if (this.hurt('flatten', dmg, _o, 13, 7.5, 1.2)) {
        this.S.audio?.sfx('boss_slam', { pos: Pl.position, volume: 0.7, pitch: 1.5 });
        this.S.fx.burst(Pl.position, UP, this.pal.ink, 18, 6);
      }
    }
  }

  _ram(hit) {
    const S = this.S, pos = this.position;
    const at = hit ? hit.point : this.roller.getWorldPosition(_t);
    S.audio?.sfx('boss_slam', { pos: at, volume: 1 });
    S.audio?.sfx('clack', { pos: at, volume: 0.8 });
    S.shake(at, 0.85);
    S.fx.burst(at, hit ? hit.normal : UP, '#ffe7a0', 26, 9, { size: 0.06, life: 0.5 });
    for (let i = 0; i < 4; i++) S.fx.puff(_p.copy(at).add(_d.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(2.4)), '#b7ab9a', 2.2, 0.9, null, 2.2, 0.6);
    if (hit) S.ink.paint(hit.point, 2.6, TEAM_MURK, hit.normal, { source: this });
    this.speed = 0;
    this.lean = -0.1; this.leanV = -1.2;
    if (this.chargeDist < 2.5 && !this._forceStun) {
      // barely moved: a bump, not a crash
      this.setState('bounce');
      this._forceStun = true;
      return;
    }
    this._forceStun = false;
    if (this.phase === 2 && !this.secondCharge) {
      this.secondCharge = true;
      this.setState('bounce');
      return;
    }
    this.secondCharge = false;
    this.setState('stunned');
    S.audio?.sfx('boss_sputter', { pos, volume: 0.8 });
    if (!this.stunnedOnce) {
      this.stunnedOnce = true;
      this.say([{ who: 'brine', text: 'It\'s dazed! The fuel tank on its back is open. Get behind it and paint it!' }]);
      this.hint('Shoot the glowing fuel tank on its back!', 3.5);
    }
  }

  _mortar(dt, enter) {
    const S = this.S, Pl = this.player, C = PH[this.phase];
    const T = C.flight;
    if (enter) {
      this.salvoN = 0;
      S.audio?.sfx('boss_alarm', { pos: this.position, volume: 0.6 });
      if (this.phase >= 2 && this.addsAlive() < 3) this._spawnGloopers(this.phase === 2 ? 2 : 1);
    }
    // aim the turret at the player
    _d.subVectors(Pl.position, this.position);
    const want = Math.atan2(_d.x, _d.z) - this.yaw;
    this.turretYaw = this.turretYaw + angleDiff(this.turretYaw, want) * Math.min(1, dt * 6);
    this.barrelPitch = lerp(this.barrelPitch, -1.0, Math.min(1, dt * 5));
    const fireAt = 0.55 + this.salvoN * 0.2;
    if (this.salvoN < C.salvo && this.stateT >= fireAt) {
      const i = this.salvoN++;
      const tgt = _p.copy(Pl.position);
      tgt.x += Pl.velocity.x * T * 0.55; tgt.z += Pl.velocity.z * T * 0.55;
      if (i > 0) {
        const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 3.8;
        tgt.x += Math.cos(a) * r; tgt.z += Math.sin(a) * r;
      }
      this._clampArena(tgt);
      const g = this.ground(tgt, _t);
      this.warn(g, 1.9, T);
      this.muzzle.getWorldPosition(_o);
      this.lob(_o, g, T, { damage: 30, splash: { radius: 2.0, damage: 34 }, paint: 1.9, size: 0.42 });
      this.recoil = 1;
      S.audio?.sfx('boss_mortar', { pos: _o, volume: 0.9 });
      S.fx.puff(_o, '#4a3d5c', 1.4, 0.5, null, 2, 0.6);
      S.fx.burst(_o, UP, this.pal.ink, 6, 4, { size: 0.08 });
    }
    if (this.stateT > fireAt + 0.7 && this.salvoN >= C.salvo) {
      this.setState('track');
    }
  }

  _spawnGloopers(n) {
    const S = this.S;
    this.fwd(_f);
    S.audio?.sfx('door', { pos: this.position, volume: 0.8 });
    for (let i = 0; i < n; i++) {
      _p.copy(this.position).addScaledVector(_f, -3.4 * SC).setY(this.floorY + 2.6 * SC);
      const side = i % 2 ? 1 : -1;
      this.right(_r);
      const vx = -_f.x * 5 + _r.x * side * 3, vz = -_f.z * 5 + _r.z * side * 3;
      this.spawnAdd('glooper', _p, { launch: [vx, 7, vz], aggro: 30 });
    }
  }

  onWeakBroken(part) {
    if (part !== this.tank) return;
    const S = this.S;
    this.tankBreaks++;
    this.tank.setOpen(false);
    if (this.tankBreaks >= 3) { this.startDefeat(); return; }
    this.phase++;
    this.seqI = 0;
    this.setState('break');
    this.lean = -0.12; this.leanV = -2;
    S.audio?.sfx('boss_roar', { pos: this.position, volume: 1, pitch: 1.05 });
    this.later(0.4, () => {
      if (this.phase === 2) {
        this.phaseBanter([
          { who: 'dredge', text: 'Hey! You scratched the paint! ...Wait, we don\'t HAVE paint. You scratched the GRAY!', mood: 'angry' },
          { who: 'pix', text: 'He\'s getting mad! Keep moving, Kai!' },
        ]);
        this._spawnGloopers(2);
      } else {
        this.phaseBanter([{ who: 'dredge', text: 'Full throttle! Safety regulations are more of a suggestion anyway!', mood: 'angry' }]);
      }
    });
  }

  barFrac() {
    const t = this.tank;
    return (3 - this.tankBreaks - 1 + (t.broken ? 0 : t.hp / t.maxHp)) / 3;
  }

  // ---------------------------------------------------------------------------------------------
  idle(dt) { this.rollSpeed = 0.6; this.rollAngle += this.rollSpeed * dt; this.shutterTarget = 1; }

  animate(dt) {
    const S = this.S, t = this.rt, st = this.state;
    // roller + wheels
    this.roller.rotation.x = this.rollAngle;
    for (const w of this.wheels) w.rotation.x = this.rollAngle * 2.4;
    // body lean spring + engine vibration
    const leanTarget = st === 'rev' || st === 'sweep-warn' ? -0.05 : st === 'charge' ? 0.035 : st === 'stunned' ? 0.05 : 0;
    this.leanV += ((leanTarget - this.lean) * 60 - this.leanV * 8) * dt;
    this.lean += this.leanV * dt;
    const vib = st === 'rev' || st === 'sweep-warn' ? 0.035 : st === 'charge' ? 0.02 : this.defeated ? 0 : 0.008;
    this.body.rotation.x = this.lean;
    this.body.position.y = Math.sin(t * 43) * vib;
    this.body.rotation.z = Math.sin(t * 37) * vib * 0.5;
    // headlights
    let hl = 1.4;
    if (st === 'rev' || st === 'sweep-warn') hl = Math.sin(t * 32) > 0 ? 5 : 0.4;
    else if (st === 'charge') hl = 4;
    else if (st === 'stunned') hl = Math.random() < 0.15 ? 0.2 : 0.8;
    else if (this.defeated) hl = Math.random() < 0.3 ? 1.5 : 0.1;
    this.headMat.emissiveIntensity = hl;
    for (const l of this.lights) { l.material.opacity = clamp(hl * 0.16, 0.05, 0.85); l.scale.setScalar(1.4 + hl * 0.25); }
    // beacon
    this.beacon.rotation.y += dt * (st === 'sweep-warn' || st === 'sweep' ? 18 : 4);
    this.beaconGlow.material.opacity = 0.35 + 0.35 * Math.max(0, Math.sin(t * (st === 'sweep-warn' ? 24 : 6)));
    this.redMat.emissiveIntensity = 1.4 + Math.max(0, Math.sin(t * 6)) * 1.5;
    // dizzy stars
    this.stars.visible = st === 'stunned' || st === 'break';
    if (this.stars.visible) { this.stars.rotation.y += dt * 4; this.stars.position.y = 2.1 + Math.sin(t * 5) * 0.08; }
    // shutters (open while the tank is exposed)
    const open = this.tank.open || this.dormant ? 1 : 0;
    this.shutterK += (open - this.shutterK) * Math.min(1, dt * 10);
    for (const sh of this.shutters) sh.g.position.x = sh.s * (0.62 + this.shutterK * 1.1);
    // turret
    if (st !== 'mortar') { this.turretYaw += angleDiff(this.turretYaw, 0) * Math.min(1, dt * 2); this.barrelPitch = lerp(this.barrelPitch, -0.55, Math.min(1, dt * 2)); }
    this.turret.rotation.y = this.turretYaw;
    this.barrel.rotation.x = this.barrelPitch;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.barrelInner.position.z = -this.recoil * 0.35;
    // lane telegraph
    if (st === 'rev' && !this.defeated) {
      this.fwd(_f);
      const L = this.laneLen || 10;
      this.lane.visible = true;
      this.lane.position.copy(this.position).addScaledVector(_f, 4.45 * SC + L / 2).setY(this.floorY + 0.05);
      this.lane.rotation.set(0, this.yaw, 0);
      this.lane.scale.set(4.8 * SC, 1, L);
      this.laneMat.map.repeat.set(1, L / (4.8 * SC));
      this.laneMat.map.offset.y = -t * 2.2;
      this.laneMat.opacity = 0.35 + 0.3 * Math.max(0, Math.sin(t * 16));
    } else this.lane.visible = false;
    // exhaust
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      const hard = st === 'rev' || st === 'charge' || st === 'sweep-warn' || st === 'sweep';
      this.smokeT = this.done ? 0.35 : hard ? 0.07 : 0.28;
      for (const s of this.stacks) {
        s.getWorldPosition(_t);
        S.fx.puff(_t, this.done ? '#2c2733' : '#4a4356', hard ? 1.1 : 0.7, hard ? 0.6 : 0.9, _d.set(0, hard ? 3 : 1.4, 0), 2.2, hard ? 0.7 : 0.45);
      }
      if (st === 'stunned') S.fx.puff(this.roller.getWorldPosition(_t).setY(this.floorY + 2.2), '#9d9486', 1.4, 0.8, _d.set(0, 1, 0), 2, 0.5);
    }
    // pilot
    const mood = this.defeated ? 'panic' : st === 'stunned' ? 'panic' : st === 'rev' || st === 'charge' || st === 'break' || st === 'intro' ? 'angry' : 'idle';
    this.pilot.update(dt, mood);
    if (this._dredgeFly) this._animateEject(dt);
  }

  // ---------------------------------------------------------------------------------------------
  onDefeatStart() {
    this.speed = 0;
    this.lane.visible = false;
    this.stars.visible = false;
    this.say([{ who: 'dredge', text: 'No no no no! Not the Grinder! I just had it waxed!', mood: 'panic' }]);
  }

  defeatStep(dt, t) {
    // shudder, then collapse: tracks buckle, roller drops off, turret flies, Dredge ejects
    this.rollSpeed = Math.max(0, this.rollSpeed - dt * 6);
    this.rollAngle += this.rollSpeed * dt;
    const k = smooth((t - 2.6) / 1.2);
    this.model.position.y = -0.45 * k + (t < 2.6 ? Math.sin(t * 50) * 0.04 : 0);
    this.model.rotation.z = 0.12 * k;
    this.model.rotation.x = -0.06 * k;
    this.roller.position.y = 1.05 - 0.55 * k;
    this.roller.position.z = 3.45 + 0.6 * k;
    this.roller.rotation.z = 0.25 * k;
    this.cab.rotation.z = -0.1 * k;
    if (t > 2.9 && !this._turretOff) {
      this._turretOff = true;
      this.turretV = new THREE.Vector3(1.5, 9, -2);
      this.S.audio?.sfx('bigboom', { pos: this.position, volume: 1 });
    }
    if (this._turretOff) {
      this.turretV.y -= 22 * dt;
      this.turret.position.addScaledVector(this.turretV, dt);
      this.turret.rotation.x += dt * 6;
      if (this.turret.position.y < -1.8) { this.turret.position.y = -1.8; this.turretV.set(0, 0, 0); }
    }
    if (t > 3.3 && !this._dredgeFly) {
      this._dredgeFly = { v: new THREE.Vector3(-2, 11, -4), t: 0 };
      this.S.audio?.sfx('launch', { pos: this.position, volume: 0.8 });
    }
    for (const sh of this.shutters) sh.g.rotation.x = -0.6 * k;
  }

  _animateEject(dt) {
    const f = this._dredgeFly;
    f.t += dt;
    f.v.y -= 9 * dt;
    const r = this.pilot.root;
    r.position.addScaledVector(f.v, dt);
    r.rotation.z += dt * 7;
    r.rotation.x += dt * 3;
    const s = Math.max(0, 1 - f.t / 3);
    r.scale.setScalar(s);
    if (s <= 0) { r.visible = false; this._dredgeFly = null; }
  }

  finalBlastAt(out) { return this.body.getWorldPosition(out).setY(this.floorY + 1.4); }

  hitCenter(out) { return out.copy(this.position).setY(this.floorY + 2.6); }

  onDispose() {
    this.pilot?.dispose();
    this.lane.parent?.remove(this.lane);
  }
}

let _hood = null;
function hoodGeometry() {
  if (_hood) return _hood;
  _hood = new THREE.CylinderGeometry(1.28, 1.28, 4.55, 28, 1, true, Math.PI * 0.2, Math.PI * 0.66).rotateZ(Math.PI / 2);
  _hood.userData.cached = true;
  return _hood;
}

registerEntity('boss-grinder', (s, d) => new Grinder(s, d));
