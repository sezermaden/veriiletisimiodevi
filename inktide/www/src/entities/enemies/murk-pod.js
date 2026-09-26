// Murk Pod — a pulsating tar pod rooted in a Murk puddle. When it senses you it swells, its lips
// peel open and it spits out a Glooper (or `spawn` type), up to `max` alive at once, every
// `interval` seconds. Destroy the pod to stop the flow; its spawn keep the pod's `group`.
import * as THREE from 'three';
import { registerEntity, spawnEntity } from '../base.js';
import { TEAM_MURK } from '../../ink/ink-system.js';
import { MurkEnemy, G, M, mesh, UP } from './common.js';

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

// onion-bulb silhouette with an orifice on top
const POD_PROFILE = [[0.001, 0], [0.5, 0.04], [0.74, 0.28], [0.83, 0.62], [0.78, 0.96], [0.62, 1.26], [0.44, 1.46], [0.3, 1.58], [0.22, 1.62], [0.17, 1.56]];

function podPoint(a, t, out, lift = 0.02) {
  // point on the profile at parameter t (0..1 along POD_PROFILE), angle a, nudged outward
  const f = t * (POD_PROFILE.length - 2);
  const i = Math.min(POD_PROFILE.length - 3, Math.floor(f));
  const k = f - i;
  const r = POD_PROFILE[i][0] + (POD_PROFILE[i + 1][0] - POD_PROFILE[i][0]) * k + lift;
  const y = POD_PROFILE[i][1] + (POD_PROFILE[i + 1][1] - POD_PROFILE[i][1]) * k;
  return out.set(Math.sin(a) * r, y, Math.cos(a) * r);
}

function veinGeometry(i) {
  const a = (i / 6) * Math.PI * 2 + 0.3;
  const pts = [];
  for (let s = 0; s <= 8; s++) {
    const t = 0.12 + (s / 8) * 0.8;
    const w = Math.sin(s * 1.3 + i) * 0.12;
    const p = podPoint(a + w, t, new THREE.Vector3(), 0.012);
    pts.push([p.x, p.y, p.z]);
  }
  return G.tube(`pod-vein-${i}`, pts, 0.028, 24, 6);
}

function podWarts() {
  return G.merged('pod-warts', () => {
    const parts = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996, t = 0.15 + ((i * 0.618) % 1) * 0.6;
      podPoint(a, t, v, -0.01);
      const s = 0.07 + ((i * 0.37) % 1) * 0.07;
      parts.push([G.sphere(1, 10, 8), M(v.x, v.y, v.z, 0, 0, 0, s, s * 0.8, s)]);
    }
    return parts;
  });
}

function podRoots() {
  // fat tar roots that taper and flatten into the puddle
  return G.merged('pod-roots3', () => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const len = 0.55 + (i % 3) * 0.22;
      const pts = [];
      for (let s = 0; s <= 4; s++) {
        const t = s / 4;
        const r = 0.5 + t * len;
        const aa = a + Math.sin(t * 2.5 + i) * 0.2;
        pts.push([Math.sin(aa) * r, 0.16 - t * 0.14, Math.cos(aa) * r]);
      }
      parts.push([G.taperTube(`pod-root-${i}`, pts, 0.2, 0.035, 14, 10, 0.55), null]);
    }
    return parts;
  });
}

export class MurkPod extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 220, hitRadius: 0.95, hitHeight: 1.75, aggro: 22, walker: false, knockMul: 0, turnRate: 0,
      pearls: [3, 3], deathPaint: 3, popup: false, eyeH: 1.3, loseTime: 5, searchTime: 4, turnsGroup: false,
    });
    this.max = def.max ?? 3;
    this.interval = def.interval ?? 4;
    this.spawnType = def.spawn ?? 'glooper';
    this.brood = [];
    this.spawnT = 1.0;
    this.birthT = -1;
    this.beat = 0;
    this.beatT = 0;
    this.painted = false;
    this._build();
    this.solidCollider(0.5, 0.84, 1.48);
  }

  get visionCone() { return -1; }

  _build() {
    const P = this.pal;
    const tar = this.mat(P.tar, { ink: true, rim: 0.65, emissiveIntensity: 0.1 });
    const tarLight = this.mat(P.tarLight, { ink: true, rim: 0.6, emissiveIntensity: 0.12 });
    const steel = this.metal(P.steel, { roughness: 0.3, metalness: 0.6, rim: 0.35 });
    const hatM = this.matte(P.hat, { roughness: 0.38, rim: 0.35 });
    this.veinM = this.glowMat(P.inkBright, 1.1);
    this.coreM = this.glowMat(P.inkBright, 2.2);

    const pod = new THREE.Group();
    this.root.add(pod);
    this.pod = pod;
    mesh(G.lathe('murk-pod', POD_PROFILE, 36), tar, pod);
    mesh(podWarts(), tarLight, pod);
    for (let i = 0; i < 6; i++) mesh(veinGeometry(i), this.veinM, pod, false);
    // glowing core visible through the orifice
    const core = mesh(G.sphere(0.24, 18, 12), this.coreM, pod, false);
    core.position.y = 1.5;
    core.userData.keep = true;
    this.core = core;
    this.coreHalo = this.halo(P.inkBright, 1.1, pod, 0.35);
    this.coreHalo.position.y = 1.75;
    // lips around the orifice
    this.lips = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * 0.2, 1.58, Math.cos(a) * 0.2);
      g.rotation.y = a;
      pod.add(g);
      const lip = mesh(G.sphere(0.16, 14, 10), tarLight, g);
      lip.scale.set(0.9, 0.42, 1.25);
      lip.position.set(0, 0.04, 0.06);
      this.lips.push(g);
    }
    // industrial collar: Murk Industries farms these things
    const collar = mesh(G.torus(0.63, 0.08, 10, 36), steel, this.root);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.12;
    const stripe = mesh(G.torus(0.705, 0.035, 6, 36), hatM, this.root);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.23;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const clamp = mesh(G.rbox(0.14, 0.26, 0.1, 0.035), steel, this.root);
      clamp.position.set(Math.sin(a) * 0.7, 0.16, Math.cos(a) * 0.7);
      clamp.rotation.set(0.25, a, 0, 'YXZ');
    }
    mesh(podRoots(), tar, this.root);
    this.rigid(this.root, 'base');
    this.rigid(pod, 'pod');
  }

  hitCenter(out) { return out.copy(this.position).setY(this.position.y + 0.85); }

  brood_alive() {
    let n = 0;
    for (let i = this.brood.length - 1; i >= 0; i--) {
      const e = this.brood[i];
      if (e.dead || !e.alive) this.brood.splice(i, 1); else n++;
    }
    return n;
  }

  behave(dt) {
    const S = this.session;
    if (!this.painted) {
      this.painted = true;
      S.ink.paint(this.position, 2.4, TEAM_MURK, UP, { source: this });
    }
    const active = this.aware || this.state === 'search';
    // heartbeat
    const period = active ? 0.8 : 1.5;
    this.beatT += dt;
    if (this.beatT >= period) {
      this.beatT = 0;
      this.beat = 1;
      if (S.player && this.position.distanceToSquared(S.player.position) < 18 * 18) S.audio?.sfx('pod_pulse', { pos: this.position, volume: active ? 0.55 : 0.3, throttle: 0.1 });
    }
    this.beat = Math.max(0, this.beat - dt * 2.4);
    if (this.state === 'return') this.setState('idle');

    if (!active) { this.birthT = -1; return; }
    if (this.birthT >= 0) {
      this.birthT += dt;
      if (this.birthT >= 0.75) { this.birthT = -1; this._spawn(); }
      return;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.brood_alive() < this.max) {
      this.birthT = 0;
      this.squashV -= 3;
    }
  }

  _spawn() {
    const S = this.session;
    this.spawnT = this.interval / Math.sqrt(this.diff);
    const T = this.target || S.player;
    let a = Math.random() * Math.PI * 2;
    if (T) a = Math.atan2(T.position.x - this.position.x, T.position.z - this.position.z) + (Math.random() - 0.5) * 1.6;
    const sp = 2.8 + Math.random() * 1.2;
    const top = _p.copy(this.position).setY(this.position.y + 1.7);
    const e = spawnEntity(S, {
      type: this.spawnType, pos: [top.x + Math.sin(a) * 0.3, top.y, top.z + Math.cos(a) * 0.3], yaw: a,
      group: this.groupName ?? undefined, alerted: true, pearls: [0, 1], launch: [Math.sin(a) * sp, 6.2, Math.cos(a) * sp],
    });
    if (e) this.brood.push(e);
    S.fx.burst(top, UP, this.pal.ink, 18, 6, { size: 0.08 });
    S.fx.burst(top, UP, this.pal.tar, 8, 4, { size: 0.07 });
    S.fx.puff(top, this.pal.inkBright, 1, 0.5, _d.set(0, 1.5, 0), 2, 0.45);
    S.audio?.sfx('pod_spawn', { pos: top, volume: 0.9 });
    this.squashV += 6;
  }

  onPop(c) {
    const S = this.session;
    S.fx.burst(_p.copy(c).setY(c.y + 0.8), UP, this.pal.inkBright, 16, 8, { size: 0.09 });
    S.fx.burst(c, UP, this.pal.tar, 16, 6, { size: 0.1, spread: 1.5 });
    S.shake?.(c, 0.3);
  }

  animate(dt) {
    void dt;
    const b = this.beat, birth = this.birthT >= 0 ? Math.min(1, this.birthT / 0.75) : 0;
    const ease = b * b;
    const swell = 1 + ease * 0.055 + birth * 0.12 + Math.sin(this.t * 1.3) * 0.01;
    this.pod.scale.set(swell, 1 + ease * 0.035 + birth * 0.08, swell);
    this.veinM.emissiveIntensity = 0.7 + ease * 1.2 + birth * 1.6;
    this.coreM.emissiveIntensity = 1.6 + ease * 1.5 + birth * 2.5;
    this.core.scale.setScalar(0.8 + ease * 0.25 + birth * 0.5);
    this.coreHalo.material.opacity = 0.25 + ease * 0.35 + birth * 0.5;
    this.coreHalo.scale.setScalar(1 + birth * 0.8 + ease * 0.3);
    const open = -1.35 + birth * 1.45 + ease * 0.22;   // petals fold over the orifice, peel open to spawn
    for (let i = 0; i < this.lips.length; i++) this.lips[i].rotation.x = open + Math.sin(this.t * 3 + i) * 0.04;
  }
}

registerEntity('murk-pod', (s, d) => new MurkPod(s, d));
