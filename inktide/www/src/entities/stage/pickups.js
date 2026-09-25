// Collectibles: pearls (currency, instanced per session), pearl trails and the hidden Lost Postcard.
//   { type: 'pearl', pos, vel?:[x,y,z] }                 pos = ground point, the pearl hovers above it
//   { type: 'pearl-trail', pos, to:[x,y,z], count?, arc? }
//   { type: 'postcard', pos, id, title, text }
import * as THREE from 'three';
import { Entity, registerEntity, spawnEntity } from '../base.js';
import { save } from '../../engine/save.js';
import {
  geo, mat, rimMat, glowTexture, canvasTex, makeGlowSprite, drawSquidEmblem, roundRect,
  UP, DOWN, clamp, hash01,
} from './common.js';

const HOVER = 0.55;
const MAGNET = 3.0;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _c = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _dir = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// One instanced mesh (+ additive halo quads) per session for every pearl.
const BATCHES = new WeakMap();
const CHAINS = new WeakMap();

class PearlBatch {
  constructor(session) {
    this.session = session;
    this.list = [];
    this.cap = 0;
    this.pearlMat = mat('pearl', () => rimMat('#fff6fb', { roughness: 0.08, metalness: 0.05, rim: 0.9, rimColor: '#9fe3ff', emissive: '#ffe1f3', emissiveIntensity: 0.2, env: 1.9 }));
    this.haloMat = mat('pearl-halo', () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(1.0, 0.85, 1.0), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this._grow(64);
  }

  _grow(n) {
    const old = this.mesh, oldH = this.halo;
    this.cap = n;
    this.mesh = new THREE.InstancedMesh(geo('pearl', () => new THREE.SphereGeometry(0.15, 16, 12)), this.pearlMat, n);
    this.halo = new THREE.InstancedMesh(geo('pearl-halo', () => new THREE.PlaneGeometry(1, 1)), this.haloMat, n);
    for (const m of [this.mesh, this.halo]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = this.list.length;
      this.session.scene.add(m);
    }
    this.mesh.castShadow = true;
    this.halo.renderOrder = 3;
    if (old) {
      for (let i = 0; i < this.list.length; i++) {
        old.getMatrixAt(i, _m); this.mesh.setMatrixAt(i, _m);
        oldH.getMatrixAt(i, _m); this.halo.setMatrixAt(i, _m);
      }
      this.session.scene.remove(old, oldH);
      old.dispose(); oldH.dispose();
    }
  }

  add(p) {
    if (this.list.length >= this.cap) this._grow(this.cap * 2);
    p.slot = this.list.length;
    this.list.push(p);
    this.mesh.count = this.halo.count = this.list.length;
  }

  remove(p) {
    const i = p.slot;
    if (i < 0 || this.list[i] !== p) return;
    const last = this.list.pop();
    if (last !== p) {
      this.list[i] = last;
      last.slot = i;
      this.mesh.getMatrixAt(this.list.length, _m); this.mesh.setMatrixAt(i, _m);
      this.halo.getMatrixAt(this.list.length, _m); this.halo.setMatrixAt(i, _m);
    }
    p.slot = -1;
    this.mesh.count = this.halo.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
    if (!this.list.length) this.dispose();
  }

  set(i, pos, spin, scale, halo) {
    _q.setFromAxisAngle(UP, spin);
    _s.set(scale, scale * 0.96, scale);
    _m.compose(pos, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    _s.setScalar(halo);
    _m.compose(pos, this.session.camera.quaternion, _s);
    this.halo.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.session.scene.remove(this.mesh, this.halo);
    this.mesh.dispose(); this.halo.dispose();
    if (BATCHES.get(this.session) === this) BATCHES.delete(this.session);
  }
}

function batchFor(session) {
  let b = BATCHES.get(session);
  if (!b) { b = new PearlBatch(session); BATCHES.set(session, b); }
  return b;
}

/** Credit pearls through the mode (story keeps the count) or the session counter. */
export function addPearls(session, n) {
  if (session.mode?.addPearls) session.mode.addPearls(n);
  else session.pearls = (session.pearls || 0) + n;
}

/** Spawn n pearls popping out of a point (crates, balloons, enemies). */
export function spawnPearls(session, pos, n = 1, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.6;
    const sp = (o.spread ?? 2.2) * (0.6 + Math.random() * 0.5);
    spawnEntity(session, { type: 'pearl', pos: [pos.x, pos.y, pos.z], vel: [Math.cos(a) * sp, (o.up ?? 6.5) + Math.random() * 2, Math.sin(a) * sp] });
  }
}

class Pearl extends Entity {
  constructor(session, def) {
    super(session, def);
    this.batch = batchFor(session);
    this.batch.add(this);
    this.t = hash01(this.position.x, this.position.z, this.position.y) * 10;
    this.home = new THREE.Vector3().copy(this.position);
    this.vel = new THREE.Vector3();
    this.state = 'idle';
    this.speed = 0;
    this.scale = 1;
    this.delay = 0;
    if (def.vel) {
      this.state = 'drop';
      this.vel.fromArray(def.vel);
      this.delay = 0.35;
      this.scale = 0.2;
    } else {
      this.position.y += HOVER;
      this.home.copy(this.position);
    }
  }

  step(dt) {
    this.t += dt;
    const S = this.session, pl = S.player;
    this.delay = Math.max(0, this.delay - dt);
    if (this.state === 'drop') {
      this.vel.y -= 18 * dt;
      const len = this.vel.length() * dt;
      if (len > 1e-5) {
        _dir.copy(this.vel).normalize();
        const hit = S.level.raycast(this.position, _dir, len + 0.15);
        if (hit) {
          this.position.copy(hit.point).addScaledVector(hit.normal, 0.15);
          const vn = this.vel.dot(hit.normal);
          this.vel.addScaledVector(hit.normal, -vn * 1.5);
          this.vel.multiplyScalar(0.6);
          if (hit.normal.y > 0.6 && this.vel.lengthSq() < 4) {
            this.state = 'idle';
            this.home.copy(hit.point).addScaledVector(UP, HOVER);
          }
        } else this.position.addScaledVector(this.vel, dt);
      }
      if (this.position.y < S.level.killY) { this.remove(); return; }
    } else if (this.state === 'idle') {
      // settle toward the hover point
      this.position.lerp(this.home, Math.min(1, dt * 6));
    }
    if (!pl.alive || this.delay > 0) return;
    pl.hitCenter(_c);
    const d2 = _c.distanceToSquared(this.position);
    if (this.state !== 'magnet' && d2 < MAGNET * MAGNET) { this.state = 'magnet'; this.speed = Math.max(2, this.vel.length() * 0.3); }
    if (this.state === 'magnet') {
      this.speed = Math.min(22, this.speed + 40 * dt);
      const d = Math.sqrt(d2);
      if (d < 0.55 || d < this.speed * dt) { this.collect(); return; }
      _dir.subVectors(_c, this.position).divideScalar(d);
      this.position.addScaledVector(_dir, this.speed * dt);
    }
  }

  collect() {
    const S = this.session;
    addPearls(S, 1);
    let ch = CHAINS.get(S);
    if (!ch) CHAINS.set(S, (ch = { t: -9, n: 0 }));
    ch.n = S.time - ch.t < 0.6 ? Math.min(ch.n + 1, 12) : 0;
    ch.t = S.time;
    S.audio?.sfx('pearl', { volume: 0.5, pitch: 1 + ch.n * 0.06, throttle: 0.01 });
    S.fx.burst(this.position, UP, '#ffffff', 7, 3.5, { size: 0.045, gravity: 6 });
    S.fx.burst(this.position, UP, '#ffd6f2', 4, 2.5, { size: 0.035, gravity: 4 });
    S.fx.ring(this.position, S.camera.getWorldDirection(_w).negate(), '#fff1fb', 0.55, 0.25);
    S.events.emit('pearl', { pos: this.position.clone() });
    this.remove();
  }

  render(dt) {
    if (this.slot < 0) return;
    this.scale = Math.min(1, this.scale + dt * 4);
    const bob = this.state === 'idle' ? Math.sin(this.t * 2.6) * 0.08 : 0;
    _v.copy(this.position).setY(this.position.y + bob);
    const tw = 0.62 + Math.sin(this.t * 5.3) * 0.12 + (this.state === 'magnet' ? 0.2 : 0);
    this.batch.set(this.slot, _v, this.t * 2.2, this.scale, tw * this.scale);
  }

  dispose() {
    this.batch.remove(this);
    super.dispose();
  }
}

class PearlTrail extends Entity {
  constructor(session, def) {
    super(session, def);
    const a = new THREE.Vector3().fromArray(def.pos || [0, 0, 0]);
    const b = new THREE.Vector3().fromArray(def.to || def.pos || [0, 0, 0]);
    const n = Math.max(1, def.count ?? Math.max(2, Math.round(a.distanceTo(b) / 1.2) + 1));
    const arc = def.arc ?? 0;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      _v.lerpVectors(a, b, t);
      _v.y += arc * 4 * t * (1 - t);
      spawnEntity(session, { type: 'pearl', pos: [_v.x, _v.y, _v.z] });
    }
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Lost Postcard

function postcardFront(seed, title) {
  return canvasTex('postcard-front:' + seed + ':' + title, 512, 340, (x, w, h) => {
    const r = (k) => hash01(seed, k);
    const hue = Math.floor(r(1) * 60) - 20;            // sunset hues vary per card
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h);
    const m = 16;
    x.save();
    roundRect(x, m, m, w - m * 2, h - m * 2, 10); x.clip();
    const sky = x.createLinearGradient(0, m, 0, h * 0.62);
    sky.addColorStop(0, `hsl(${230 + hue * 0.3}, 70%, 42%)`);
    sky.addColorStop(0.55, `hsl(${330 + hue}, 80%, 66%)`);
    sky.addColorStop(1, `hsl(${30 + hue * 0.5}, 95%, 70%)`);
    x.fillStyle = sky; x.fillRect(0, 0, w, h);
    // sun
    x.fillStyle = '#fff1b8';
    x.beginPath(); x.arc(w * (0.25 + r(2) * 0.2), h * 0.56, 52, 0, Math.PI * 2); x.fill();
    // sea
    const sea = x.createLinearGradient(0, h * 0.6, 0, h);
    sea.addColorStop(0, '#2aa6d8'); sea.addColorStop(1, '#10407a');
    x.fillStyle = sea; x.fillRect(0, h * 0.6, w, h * 0.4);
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const y = h * 0.64 + i * 12, ox = (i * 37) % 60;
      x.beginPath();
      for (let px = -ox; px < w; px += 60) { x.moveTo(px, y); x.quadraticCurveTo(px + 15, y - 5, px + 30, y); }
      x.stroke();
    }
    // lighthouse on a rock (the Prism Wellspring lives beneath it)
    const lx = w * 0.72;
    x.fillStyle = '#2b2350';
    x.beginPath(); x.ellipse(lx, h * 0.63, 90, 26, 0, Math.PI, 0); x.fill();
    x.fillStyle = '#f7f3ea';
    x.beginPath(); x.moveTo(lx - 22, h * 0.61); x.lineTo(lx - 13, h * 0.2); x.lineTo(lx + 13, h * 0.2); x.lineTo(lx + 22, h * 0.61); x.fill();
    x.fillStyle = '#e8432f';
    for (let i = 0; i < 3; i++) { const y0 = h * 0.26 + i * 38; x.fillRect(lx - 16 - i * 2, y0, 32 + i * 4, 14); }
    x.fillStyle = '#2b2350'; x.fillRect(lx - 17, h * 0.14, 34, 22);
    x.fillStyle = '#fff6a8'; x.fillRect(lx - 12, h * 0.155, 24, 14);
    x.fillStyle = 'rgba(255,246,168,0.35)';
    x.beginPath(); x.moveTo(lx, h * 0.17); x.lineTo(lx - 240, h * 0.05); x.lineTo(lx - 240, h * 0.3); x.fill();
    // rainbow ink streak
    ['#ff8a1f', '#ffd23f', '#3fd6a0', '#2fb6ff', '#8a5bff'].forEach((c, i) => {
      x.strokeStyle = c; x.lineWidth = 7;
      x.beginPath(); x.arc(w * 0.72, h * 0.66, 150 - i * 8, Math.PI * 1.08, Math.PI * 1.5); x.stroke();
    });
    // a squid waving from the rock
    drawSquidEmblem(x, lx - 62, h * 0.55, 16, '#ff8a1f', '#1b1838');
    x.restore();
    // title
    x.font = '44px Bungee, Impact, sans-serif';
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.lineWidth = 8; x.strokeStyle = '#1b1838';
    x.strokeText('GREETINGS', 34, 74); x.fillStyle = '#fff4d6'; x.fillText('GREETINGS', 34, 74);
    x.font = '26px Bungee, Impact, sans-serif';
    x.lineWidth = 6; x.strokeText('FROM TIDEHAVEN', 36, 108); x.fillStyle = '#ffd23f'; x.fillText('FROM TIDEHAVEN', 36, 108);
    if (title) {
      x.font = '600 22px "Baloo 2", sans-serif';
      x.fillStyle = 'rgba(27,24,56,0.85)';
      roundRect(x, 30, h - 62, Math.min(w - 60, x.measureText(title).width + 28), 36, 12); x.fill();
      x.fillStyle = '#ffffff'; x.fillText(title, 44, h - 37);
    }
  });
}

function postcardBack(seed, text) {
  return canvasTex('postcard-back:' + seed, 512, 340, (x, w, h) => {
    x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#d6cbb4'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(w * 0.56, 30); x.lineTo(w * 0.56, h - 30); x.stroke();
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(w * 0.6, 170 + i * 36); x.lineTo(w - 30, 170 + i * 36); x.stroke(); }
    // stamp
    x.fillStyle = '#ffffff'; x.fillRect(w - 118, 26, 90, 110);
    x.fillStyle = '#2fb6ff'; x.fillRect(w - 110, 34, 74, 94);
    drawSquidEmblem(x, w - 73, 80, 26, '#ffffff', '#1b1838');
    x.strokeStyle = 'rgba(40,30,80,0.45)'; x.lineWidth = 3;
    x.beginPath(); x.arc(w - 150, 90, 38, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(w - 150, 90, 28, 0, Math.PI * 2); x.stroke();
    // handwriting
    x.fillStyle = '#2a2a5a';
    x.font = '500 20px "Baloo 2", sans-serif';
    const words = String(text || 'Wish you were here!').split(/\s+/);
    let line = '', y = 60;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (x.measureText(t).width > w * 0.5 - 40) { x.fillText(line, 28, y); line = wd; y += 28; if (y > h - 40) break; } else line = t;
    }
    if (y <= h - 40) x.fillText(line, 28, y);
  });
}

class Postcard extends Entity {
  constructor(session, def) {
    super(session, def);
    this.t = 0;
    this.collected = false;
    this.flyT = -1;
    const seed = hashString(def.id || 'postcard');
    const stageId = session.opts?.levelDef?.id;
    this.already = !!(stageId && save.stage?.(stageId)?.postcard);
    const edge = mat('postcard-edge', () => rimMat('#fffaf0', { roughness: 0.7, rim: 0.3 }));
    const front = this.own(rimMat('#ffffff', { map: postcardFront(seed, def.title || ''), roughness: 0.55, rim: 0.35, emissive: '#ffffff', emissiveIntensity: 0.12, transparent: this.already, opacity: this.already ? 0.45 : 1 }));
    const back = this.own(rimMat('#ffffff', { map: postcardBack(seed, def.text || ''), roughness: 0.7, rim: 0.3, transparent: this.already, opacity: this.already ? 0.45 : 1 }));
    front.emissiveMap = front.map;
    this.card = new THREE.Mesh(geo('postcard', () => new THREE.BoxGeometry(0.96, 0.64, 0.025)), [edge, edge, edge, edge, front, back]);
    this.card.castShadow = true;
    this.holder = new THREE.Group();
    this.holder.position.y = 1.2;
    this.holder.add(this.card);
    this.glow = makeGlowSprite('#ffe9a8', 2.0, 0.5);
    this.own(this.glow.material);
    this.holder.add(this.glow);
    this.group.add(this.holder);
    // soft ground marker
    this.marker = new THREE.Mesh(geo('postcard-marker', () => new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2)),
      this.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.2, 0.7), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.marker.position.y = 0.03;
    this.group.add(this.marker);
  }

  step(dt) {
    this.t += dt;
    if (this.collected) {
      this.flyT += dt;
      if (this.flyT > 0.45) this.remove();
      return;
    }
    const S = this.session, pl = S.player;
    if (!pl.alive) return;
    pl.hitCenter(_c);
    this.holder.getWorldPosition(_v);
    if (_c.distanceToSquared(_v) < 1.45 * 1.45) this.collect();
  }

  collect() {
    const S = this.session;
    this.collected = true;
    this.flyT = 0;
    const d = this.def;
    this.holder.getWorldPosition(_v);
    S.audio?.sfx('postcard', { volume: 0.8 });
    S.fx.burst(_v, UP, '#fff3b0', 22, 5, { size: 0.06, gravity: 3 });
    S.fx.burst(_v, UP, '#ffffff', 12, 4, { size: 0.04, gravity: 2 });
    S.fx.ring(_v, UP, '#ffe9a8', 1.6, 0.5);
    S.events.emit('postcard', { id: d.id, def: d });
    if (S.mode?.collectPostcard) S.mode.collectPostcard(d.id, d);
    else {
      S.hud?.toast?.('LOST POSTCARD FOUND!', 'big');
      if (d.title) S.hud?.hint?.(`${d.title}${d.text ? ' — ' + d.text : ''}`, 6);
    }
  }

  render(dt) {
    const t = this.t;
    if (this.collected) {
      // zip up into the player and shrink
      const k = clamp(this.flyT / 0.45, 0, 1);
      this.session.player.hitCenter(_c);
      this.group.worldToLocal(_c);
      this.holder.position.lerp(_c, Math.min(1, dt * 12));
      this.holder.scale.setScalar(Math.max(0.01, 1 - k));
      this.card.rotation.y += dt * 20;
      this.marker.material.opacity = 0.35 * (1 - k);
      return;
    }
    this.holder.position.y = 1.2 + Math.sin(t * 1.8) * 0.12;
    this.card.rotation.y = t * 1.3;
    this.card.rotation.z = Math.sin(t * 1.1) * 0.12;
    this.glow.material.opacity = 0.35 + Math.sin(t * 3.1) * 0.12;
    this.marker.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
    this._sp = (this._sp || 0) - dt;
    if (this._sp <= 0) {
      this._sp = 0.22;
      this.holder.getWorldPosition(_v);
      _v.x += (Math.random() - 0.5) * 0.9; _v.y += (Math.random() - 0.5) * 0.6; _v.z += (Math.random() - 0.5) * 0.9;
      _w.set(0, 0.8, 0);
      this.session.fx.spray(_v, _w, Math.random() < 0.6 ? '#fff3b0' : '#ffffff', 1, 0.4, { size: 0.035, life: 0.8, gravity: -0.5 });
    }
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 997;
}

registerEntity('pearl', (s, d) => new Pearl(s, d));
registerEntity('pearl-trail', (s, d) => new PearlTrail(s, d));
registerEntity('postcard', (s, d) => new Postcard(s, d));
