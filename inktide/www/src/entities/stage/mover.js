// Moving platform (dynamic collider) that ping-pongs along `path`. Riders are carried through
// `lastDelta` (the player adds it while grounded on us). activate:'ink' platforms only run while
// they were recently hit by hero ink or the player stands on them.
//   { type: 'mover', pos, size:[w,h,d], path:[[x,y,z],…], speed: 2.5, wait: 1, mat: 'metal'|'wood'|'murk',
//     activate?: 'ink', loop?: false, return?: false }
// pos / path points are the centre of the platform's TOP surface.
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import { surfaceTextures } from '../../world/textures.js';
import { geo, mat, rimMat, glowMat, canvasTex, boxCollider, TEAM_HERO, UP, clamp, splatTouches } from './common.js';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();

function hazardTex() {
  return canvasTex('hazard', 128, 128, (x, w, h) => {
    x.fillStyle = '#ffc21a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1c1c28';
    for (let i = -2; i < 6; i++) {
      x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + h, h); x.lineTo(i * 32 + h, h); x.fill();
    }
  }, { repeat: true });
}

function arrowTex() {
  return canvasTex('mover-arrows', 128, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.lineJoin = 'miter';
    for (let i = 0; i < 2; i++) { x.beginPath(); x.moveTo(20 + i * 50, 10); x.lineTo(50 + i * 50, 32); x.lineTo(20 + i * 50, 54); x.stroke(); }
  }, { repeat: true });
}

const LOOKS = {
  metal: { top: 'metal', side: '#565d78', topTint: '#d5d9e4', trim: true },
  wood: { top: 'wood', side: '#8a5a34', topTint: '#f0d6b0', trim: false },
  murk: { top: 'murk', side: '#3a2f58', topTint: '#c9b8f0', trim: true },
  container: { top: 'container', side: '#2f7fd8', topTint: '#ffffff', trim: false },
};

class Mover extends Entity {
  constructor(session, def) {
    super(session, def);
    const [w, h, d] = def.size || [3, 0.5, 3];
    this.w = w; this.h = h; this.d = d;
    const base = def.pos || [0, 0, 0];
    let path = def.path && def.path.length ? def.path : [base, [base[0], base[1] + 3, base[2]]];
    if (def.relative) path = path.map((p) => [p[0] + base[0], p[1] + base[1], p[2] + base[2]]);
    this.path = path.map((p) => new THREE.Vector3().fromArray(p));
    if (this.path.length === 1) this.path.push(this.path[0].clone());
    this.loop = !!def.loop;
    if (this.loop) this.path.push(this.path[0].clone());
    this.cum = [0];
    for (let i = 1; i < this.path.length; i++) this.cum.push(this.cum[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
    this.total = this.cum[this.cum.length - 1];
    this.speed = def.speed ?? 2.5;
    this.wait = def.wait ?? 1;
    this.inkMode = def.activate === 'ink';
    this.s = 0;
    this.dir = 1;
    this.waitT = this.inkMode ? 0 : this.wait * 0.5;
    this.inkT = 0;
    this.idleT = 0;
    this.lastDelta = new THREE.Vector3();
    this.t = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this._pathAt(this.s, this.position);

    // ---- model ----
    const look = LOOKS[def.mat] || (def.mat ? { top: def.mat, side: '#565d78', topTint: '#ffffff', trim: true } : LOOKS.metal);
    const tex = surfaceTextures(look.top);
    const topMat = this.own(new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, color: look.topTint, roughness: 0.6, metalness: look.top === 'metal' ? 0.45 : 0.05 }));
    const sideMat = mat('mover-side-' + (def.mat || 'metal'), () => rimMat(look.side, { roughness: 0.45, metalness: 0.4, rim: 0.2 }));
    const g = this.group;
    // slab: top uses the surface texture with world-ish UV scale, sides are painted steel
    const slabG = this.own(new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0));
    const uv = slabG.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2.5, uv.getY(i) * d / 2.5);
    this.slab = new THREE.Mesh(slabG, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    this.slab.castShadow = true; this.slab.receiveShadow = true;
    g.add(this.slab);
    if (look.trim) {
      const hz = mat('mover-hazard', () => rimMat('#ffffff', { map: hazardTex(), roughness: 0.5, rim: 0.2 }));
      const trimG = geo('mover-trim', () => new THREE.BoxGeometry(1, 1, 1));
      for (const [sx, sz, lx, lz] of [[0, 1, w + 0.04, 0.1], [0, -1, w + 0.04, 0.1], [1, 0, 0.1, d + 0.04], [-1, 0, 0.1, d + 0.04]]) {
        const tr = new THREE.Mesh(trimG, hz);
        tr.scale.set(lx, 0.14, lz);
        tr.position.set(sx * (w / 2 - 0.03), -0.06, sz * (d / 2 - 0.03));
        g.add(tr);
      }
    }
    // undercarriage: motor housing + running lights
    const dark = mat('mover-dark', () => rimMat('#1d2031', { roughness: 0.5, metalness: 0.4, rim: 0.1 }));
    const motor = new THREE.Mesh(geo('mover-motor', () => new THREE.CylinderGeometry(0.5, 0.35, 0.45, 12)), dark);
    motor.position.y = -h - 0.2;
    motor.scale.set(Math.min(1.4, w / 2.5), 1, Math.min(1.4, d / 2.5));
    motor.castShadow = true;
    g.add(motor);
    this.lightMat = this.own(glowMat(this.inkMode ? '#8a8fa8' : '#5cf2ff', this.inkMode ? 0.8 : 2.2));
    const lg = geo('mover-light', () => new THREE.BoxGeometry(1, 1, 1));
    for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(lg, this.lightMat);
      l.scale.set(w * 0.6, 0.06, 0.04);
      l.position.set(0, -h * 0.5, sz * (d / 2 + 0.01));
      g.add(l);
    }
    if (this.inkMode) {
      // ink-powered: turbine underneath + glowing arrows on top that light up in hero colour
      this.fan = new THREE.Group();
      this.fan.position.y = -h - 0.45;
      const hub = new THREE.Mesh(geo('mover-hub', () => new THREE.SphereGeometry(0.16, 10, 8)), dark);
      this.fan.add(hub);
      const bladeG = geo('mover-blade', () => new THREE.BoxGeometry(0.9, 0.04, 0.2));
      const bladeM = mat('mover-blade', () => rimMat('#dfe3ec', { roughness: 0.35, metalness: 0.5, rim: 0.2 }));
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(bladeG, bladeM); b.rotation.y = (i / 3) * Math.PI * 2; b.rotation.x = 0.35; b.position.set(Math.cos(b.rotation.y) * 0.0, 0, 0); this.fan.add(b); }
      g.add(this.fan);
      const at = arrowTex().clone(); this.own(at);
      at.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 1.2)), 1);
      this.arrowTex = at;
      this.arrowMat = this.own(glowMat('#9aa0b8', 1.0, { map: at, transparent: true, opacity: 0.8, depthWrite: false }));
      const ar = new THREE.Mesh(geo('mover-arrow-plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.arrowMat);
      ar.scale.set(Math.max(w, d) * 0.7, 1, 0.5);
      ar.position.y = 0.012;
      // point along the first path leg
      _a.subVectors(this.path[1], this.path[0]);
      ar.rotation.y = Math.atan2(-_a.z, _a.x);
      ar.renderOrder = 2;
      g.add(ar);
    }
    // collider
    this.col = boxCollider(w, h, d);
    this.col.position.y = -h;
    g.add(this.col);
    g.updateMatrixWorld(true);
    this.dyn = session.level.addDynamic(this.col, { owner: this, tag: 'mover' });
  }

  _pathAt(s, out) {
    const c = this.cum;
    let i = 1;
    while (i < c.length - 1 && c[i] < s) i++;
    const seg = c[i] - c[i - 1];
    const k = seg > 1e-6 ? (s - c[i - 1]) / seg : 0;
    return out.lerpVectors(this.path[i - 1], this.path[i], clamp(k, 0, 1));
  }

  onInkHit(p, hit) {
    if (p.team === TEAM_HERO && this.inkMode && splatTouches(hit, p.paint?.radius ?? 0.4)) {
      if (this.inkT <= 0) this.session.audio?.sfx('sponge_grow', { pos: this.position, volume: 0.35, pitch: 1.4 });
      this.inkT = 1.4;
    }
  }

  get playerOn() {
    const p = this.session.player;
    return p.alive && p.grounded && p.contacts.dynamic?.owner === this;
  }

  step(dt) {
    this.t += dt;
    this.inkT = Math.max(0, this.inkT - dt);
    const running = !this.inkMode || this.inkT > 0 || this.playerOn;
    _v.copy(this.position);
    if (this.total < 1e-4) { this.lastDelta.set(0, 0, 0); return; }
    if (this.inkMode && !running) {
      this.idleT += dt;
      if (this.def.return && this.idleT > 1.5 && this.s > 0) {
        this.s = Math.max(0, this.s - this.speed * 0.5 * dt);
        this.dir = 1;
      }
    } else if (this.waitT > 0) {
      this.idleT = 0;
      this.waitT -= dt;
    } else {
      this.idleT = 0;
      // ease in/out near the ends of the path
      const edge = this.loop ? Infinity : Math.min(this.s, this.total - this.s);
      const ease = clamp(edge / 0.9, 0.25, 1);
      this.s += this.dir * this.speed * ease * dt;
      if (this.loop) {
        if (this.s >= this.total) this.s -= this.total;
      } else if (this.s >= this.total) {
        this.s = this.total; this.dir = -1; this.waitT = this.wait;
      } else if (this.s <= 0) {
        this.s = 0; this.dir = 1; this.waitT = this.wait;
      }
    }
    this._pathAt(this.s, this.position);
    this.lastDelta.subVectors(this.position, _v);
    this.running = running && this.lastDelta.lengthSq() > 1e-10;
    this.group.updateMatrixWorld(true);
    if (this.lastDelta.y < -1e-5) this._guardBelow();
  }

  /**
   * A descending platform must not squash the player into the floor (the capsule would be pushed
   * down through it): anyone underneath whose head reaches the slab is nudged out sideways.
   */
  _guardBelow() {
    const p = this.session.player;
    if (!p.alive) return;
    const r = 0.34, bottom = this.position.y - this.h;
    const head = p.position.y + (p.form === 'squid' ? 0.55 : 1.4);
    if (p.position.y > bottom - 0.05 || head < bottom - 0.05) return;
    _a.copy(p.position).sub(this.position).applyAxisAngle(UP, -this.group.rotation.y);
    const ox = this.w / 2 + r - Math.abs(_a.x), oz = this.d / 2 + r - Math.abs(_a.z);
    if (ox <= 0 || oz <= 0) return;
    if (ox < oz) _a.x = Math.sign(_a.x || 1) * (this.w / 2 + r + 0.04);
    else _a.z = Math.sign(_a.z || 1) * (this.d / 2 + r + 0.04);
    _a.applyAxisAngle(UP, this.group.rotation.y).add(this.position);
    p.position.x = _a.x; p.position.z = _a.z;
  }

  render(dt) {
    if (this.fan) {
      this.fanSpin = (this.fanSpin || 0) + ((this.running ? 14 : 0) - (this.fanSpin || 0)) * Math.min(1, dt * 3);
      this.fan.rotation.y += this.fanSpin * dt;
      const on = this.inkT > 0 || this.playerOn;
      if (on) this.arrowMat.color.copy(this.heroCol).multiplyScalar(2.2); else this.arrowMat.color.setRGB(0.6, 0.62, 0.72);
      if (this.running) this.arrowTex.offset.x -= dt * 1.5 * this.dir;
      if (on) this.lightMat.color.copy(this.heroCol).multiplyScalar(2.2); else this.lightMat.color.setRGB(0.5, 0.52, 0.6);
    } else {
      const k = 1.6 + Math.sin(this.t * 3) * 0.6;
      this.lightMat.color.setRGB(0.36 * k, 0.95 * k, k);
    }
  }

  dispose() {
    this.session.level.removeDynamic(this.dyn);
    super.dispose();
  }
}

registerEntity('mover', (s, d) => new Mover(s, d));
