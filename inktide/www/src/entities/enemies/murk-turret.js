// Murk Turret — a static armoured emplacement. The head sweeps while idle; once it spots you it
// tracks (with a limited turn rate, so circling it works), whines up and fires bursts from twin
// barrels. `rate` scales how often it bursts.
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { MurkEnemy, G, M, mesh, UP, clamp, angleDiff } from './common.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const MUZZLES = [new THREE.Vector3(0.31, 0.2, 0.8), new THREE.Vector3(-0.31, 0.2, 0.8)];

function plinthBolts() {
  return G.merged('turret-bolts', () => {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      parts.push([G.cyl(0.035, 0.04, 0.03, 8), M(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5)]);
    }
    return parts;
  });
}

export class MurkTurret extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 150, hitRadius: 0.72, hitHeight: 1.5, aggro: 18, walker: false, turnRate: 2.3, knockMul: 0,
      pearls: [2, 3], deathPaint: 2.3, popupH: 2.05, eyeH: 1.05, turnsGroup: false, loseTime: 2.2,
    });
    this.rate = def.rate ?? 1;
    this.burst = 0;
    this.shotT = 0;
    this.coolT = 0.8;
    this.windT = -1;
    this.barrel = 0;
    this.pitch = 0;
    this.kick = [0, 0];
    this._build();
  }

  get visionCone() { return 0.35; }

  _build() {
    const P = this.pal;
    const steel = this.metal(P.steel, { roughness: 0.3, metalness: 0.6, rim: 0.35 });
    const steelDark = this.metal(P.steelDark, { roughness: 0.4, metalness: 0.5, rim: 0.3 });
    const hatM = this.matte(P.hat, { roughness: 0.38, rim: 0.35 });
    const inkM = this.mat(P.ink, { ink: true, rim: 0.5, emissiveIntensity: 0.25 });
    const tar = this.mat(P.tar, { ink: true, rim: 0.6, emissiveIntensity: 0.1 });
    const dark = this.mat(P.dark, { roughness: 0.2, rim: 0.1 });
    this.eyeM = this.glowMat(P.glow, 1.5);
    const lureM = this.glowMat(P.glow, 1.8);
    this.tankMat = this.glowMat(P.ink, 0.5);
    this.tankMat.roughness = 0.08;

    // --- static plinth ---
    const base = this.root;
    const hz = mesh(G.cyl(0.76, 0.8, 0.1, 8), hatM, base);
    hz.position.y = 0.05;
    hz.rotation.y = Math.PI / 8;
    const plinth = mesh(G.cyl(0.64, 0.74, 0.32, 8), steelDark, base);
    plinth.position.y = 0.26;
    plinth.rotation.y = Math.PI / 8;
    const band = mesh(G.cyl(0.665, 0.69, 0.07, 8), inkM, base);
    band.position.y = 0.26;
    band.rotation.y = Math.PI / 8;
    const top = mesh(G.cyl(0.6, 0.64, 0.06, 8), steel, base);
    top.position.y = 0.45;
    top.rotation.y = Math.PI / 8;
    this.detail(mesh(plinthBolts(), steelDark, base)).position.y = 0.49;
    // tar oozing out from under the plinth
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4;
      const o = mesh(G.sphere(0.16, 12, 8), tar, base);
      o.position.set(Math.sin(a) * 0.72, 0.02, Math.cos(a) * 0.72);
      o.scale.set(1.4, 0.35, 1);
      o.rotation.y = a;
    }

    this.rigid(base, 'base');
    // --- rotating head ---
    const yawG = new THREE.Group();
    yawG.position.y = 0.48;
    base.add(yawG);
    this.yawG = yawG;
    const neck = mesh(G.cyl(0.32, 0.4, 0.3, 20), steel, yawG);
    neck.position.y = 0.15;
    const ring = mesh(G.torus(0.37, 0.04, 8, 28), inkM, yawG);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.26;
    const pitchG = new THREE.Group();
    pitchG.position.y = 0.55;
    yawG.add(pitchG);
    this.pitchG = pitchG;
    const house = mesh(G.rbox(0.9, 0.52, 0.76, 0.15), steel, pitchG);
    house.position.y = 0.02;
    const cap = mesh(G.rbox(0.72, 0.1, 0.6, 0.05), steelDark, pitchG);
    cap.position.y = 0.29;
    for (const s of [-1, 1]) {
      const stripe = mesh(G.rbox(0.03, 0.1, 0.6, 0.012), hatM, pitchG);
      stripe.position.set(s * 0.455, 0.02, 0);
      const cheek = mesh(G.rbox(0.12, 0.34, 0.5, 0.05), steelDark, pitchG);
      cheek.position.set(s * 0.44, -0.02, 0.05);
    }
    // the Murk eye with armoured brow slats
    const eye = new THREE.Group();
    eye.position.set(0, 0.03, 0.38);
    pitchG.add(eye);
    mesh(G.torus(0.16, 0.045, 10, 28), steelDark, eye).scale.set(1, 1, 1.3);
    mesh(G.sphere(0.155, 22, 16), this.eyeM, eye, false).scale.set(1, 1, 0.5);
    const pupil = mesh(G.sphere(0.058, 12, 10), dark, eye, false);
    pupil.scale.set(0.6, 1.45, 0.35);
    pupil.position.z = 0.074;
    pupil.userData.keep = true;
    this.pupil = pupil;
    this.brows = [];
    for (const s of [-1, 1]) {
      const b = mesh(G.rbox(0.2, 0.07, 0.12, 0.03), steelDark, eye);
      b.position.set(s * 0.1, 0.2, 0.02);
      this.brows.push(b);
    }
    this.eyeHalo = this.halo(P.glow, 0.7, eye, 0.2);
    this.eyeHalo.position.z = 0.1;
    // twin barrels
    this.barrels = [];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const g = new THREE.Group();
      g.position.set(s * 0.31, 0.2, 0.3);
      pitchG.add(g);
      const shroud = mesh(G.rbox(0.18, 0.18, 0.3, 0.05), steelDark, g);
      shroud.position.z = 0.05;
      const tube = mesh(G.cylZ(0.05, 0.06, 0.42, 14), steel, g);
      tube.position.z = 0.3;
      const tip = mesh(G.torus(0.058, 0.02, 8, 18), inkM, g);
      tip.position.z = 0.5;
      this.barrels.push(g);
      this.rigid(g, 'barrel');
    }
    // ink tank on the back
    const tank = mesh(G.capsuleZ(0.16, 0.26), this.tankMat, pitchG);
    tank.position.set(0, 0.05, -0.72);
    for (const z of [-0.6, -0.36]) {
      const b = mesh(G.torus(0.165, 0.02, 6, 20), steel, pitchG);
      b.position.set(0, 0.05, z);
    }
    // lure antenna (company logo, and a very bad idea for a sentry)
    const lure = new THREE.Group();
    lure.position.set(0.18, 0.33, -0.1);
    pitchG.add(lure);
    mesh(G.tube('turret-lure', [[0, 0, 0], [0, 0.16, -0.04], [0, 0.3, 0.05], [0, 0.3, 0.17], [0, 0.23, 0.23]], 0.014, 16, 6), steelDark, lure);
    const bulb = mesh(G.sphere(0.05, 12, 8), lureM, lure, false);
    bulb.position.set(0, 0.22, 0.24);
    this.detail(this.halo(P.glow, 0.3, bulb, 0.5));
    this.lure = lure;
    this.rigid(pitchG, 'pitch');
  }

  onState(s) {
    if (s !== 'attack') { this.burst = 0; this.windT = -1; }
  }

  behave(dt) {
    const S = this.session;
    this.coolT -= dt;
    switch (this.state) {
      case 'idle': case 'patrol': case 'return':
        this.faceYaw = this.homeYaw + Math.sin(this.t * 0.55) * 0.95;
        if (this.state === 'return') this.setState('idle');
        break;
      case 'search':
        this.faceYaw = this.searchYaw + Math.sin(this.stateT * 1.3) * 1.1;
        break;
      default: this.faceTarget();
    }
    // head pitch toward the target
    let wantPitch = 0;
    if (this.aware && this.target) {
      const T = this.canSee ? this.target.position : this.lastSeen;
      const dy = T.y + 0.7 - (this.position.y + this.eyeH);
      wantPitch = clamp(Math.atan2(dy, this.distXZ(T) || 1), -0.5, 0.6);
    }
    this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 5);
    if (this.state !== 'attack') return;

    const aligned = Math.abs(angleDiff(this.yaw, this.faceYaw)) < 0.2;
    if (this.burst > 0) {
      this.shotT -= dt;
      if (this.shotT <= 0) {
        if (this.canSee || this.sinceSeen < 0.3) this.fireOne();
        this.burst--;
        this.shotT = 0.11;
        if (this.burst === 0) this.coolT = (1.25 + Math.random() * 0.35) / (this.rate * Math.sqrt(this.diff));
      }
    } else if (this.windT >= 0) {
      this.windT += dt;
      if (this.windT > 0.38) { this.windT = -1; this.burst = 5; this.shotT = 0; }
    } else if (this.coolT <= 0 && this.canSee && aligned && this.distXZ(this.target.position) < this.aggro * 1.3) {
      this.windT = 0;
      S.audio?.sfx('turret_whine', { pos: this.position, volume: 0.6 });
    }
  }

  fireOne() {
    const b = this.barrels[this.barrel];
    this.kick[this.barrel] = 1;
    const m = this.worldOf(this.pitchG, MUZZLES[this.barrel], _m);
    this.barrel = 1 - this.barrel;
    const o = { speed: 24, damage: 14, gravity: 14, gravityDelay: 0.25, lead: 0.75, spread: 2.6 };
    this.aimAt(m, o.speed, o, _d);
    this.shoot(m, _d, { ...o, size: 0.11, paint: 0.5, trailEvery: 1.4, trailRadius: 0.3, falloff: { start: 12, end: 22, min: 0.55 }, sfx: 'turret_shot', volume: 0.55 });
    this.session.fx.puff(m, '#d9d0ec', 0.3, 0.25, _p.copy(_d).multiplyScalar(1.2), 1.6, 0.45);
    void b;
  }

  onPop(c) {
    const S = this.session;
    S.fx.burst(c, UP, this.pal.steel, 14, 7, { size: 0.08, spread: 1.4 });
    S.fx.burst(c, UP, this.pal.hat, 6, 5, { size: 0.05 });
  }

  animate(dt) {
    this.yawG.rotation.y = this.yaw;
    this.pitchG.rotation.x = -this.pitch - this.hurtT * 0.5;
    for (let i = 0; i < 2; i++) {
      this.kick[i] = Math.max(0, this.kick[i] - dt * 9);
      this.barrels[i].position.z = 0.3 - this.kick[i] * 0.12;
    }
    const wind = this.windT >= 0 ? this.windT / 0.38 : 0;
    const want = this.aware ? this.pal.angry : this.state === 'search' ? this.pal.wary : this.pal.glow;
    this.eyeM.color.lerp(want, Math.min(1, dt * 8));
    this.eyeM.emissive.copy(this.eyeM.color);
    this.eyeM.emissiveIntensity = 1.5 + wind * 1.5 + (this.burst > 0 ? 0.8 : 0);
    this.eyeHalo.material.color.copy(this.eyeM.color);
    this.eyeHalo.material.opacity = 0.2 + wind * 0.5 + (this.burst > 0 ? 0.3 : 0);
    this.tankMat.emissiveIntensity = 0.5 + wind * 0.8;
    // brows
    const ang = this.aware ? 0.35 : this.state === 'search' ? -0.2 : 0.05;
    this.brows[0].rotation.z += (-ang - this.brows[0].rotation.z) * Math.min(1, dt * 10);
    this.brows[1].rotation.z += (ang - this.brows[1].rotation.z) * Math.min(1, dt * 10);
    // shudder while spinning up
    this.pitchG.position.x = wind > 0 ? Math.sin(this.t * 70) * 0.012 : 0;
    this.lure.rotation.x = Math.sin(this.t * 2.2) * 0.1 - this.kick[0] * 0.2 - this.kick[1] * 0.2;
    this.lure.rotation.z = Math.sin(this.t * 1.6) * 0.08;
    this.pupil.position.x = Math.sin(this.t * 0.9) * (this.aware ? 0.005 : 0.03);
  }
}

registerEntity('murk-turret', (s, d) => new MurkTurret(s, d));
