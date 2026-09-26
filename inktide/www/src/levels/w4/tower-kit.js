// Murkwell Tower kit — shared by 4-1 The Ascent and 4-2 Gray Heart.
//
// Stage-local mechanic (registered on import, same contract as entities/stage/*):
//   { type: 'wind-gust', pos, size:[w,h,d], dir:[dx,dz], strength?: 3.6, period?: 5.5, gust?: 1.6,
//     warn?: 1.1, offset?: 0 }
//       storm gusts over an exposed ledge. pos = centre of the zone floor (axis-aligned box).
//       Idle → warning streaks + whistle → a gust that shoves the player along `dir` (stronger in
//       the air). Climbing a wall or hiding submerged in your own ink shelters you, and so does
//       hugging the wall: leave the strip next to the tower out of the zone.
//
// Brush helpers: facade (dark unpaintable tower skin with window bands), ledge (cantilevered slab
// with brackets), pillar (paintable climbing strip).
import * as THREE from 'three';
import { Entity, registerEntity } from '../../entities/base.js';
import { block, box } from '../kit.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

class WindGust extends Entity {
  constructor(session, def) {
    super(session, { ...def, yaw: 0 });
    const [w, h, d] = def.size || [4, 4, 10];
    this.half = new THREE.Vector3(w / 2, h, d / 2);
    const dir = def.dir || [1, 0];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    this.dir = new THREE.Vector3(dir[0] / len, 0, dir[1] / len);
    this.strength = def.strength ?? 3.6;
    this.period = def.period ?? 5.5;
    this.gust = def.gust ?? 1.6;
    this.warn = def.warn ?? 1.1;
    this.t = ((def.offset ?? 0) % this.period + this.period) % this.period;
    this.state = 'idle';
    this.fxT = 0;
    this.hinted = false;
    this.group.visible = false;
  }

  inside(p, pad = 0) {
    const dx = p.x - this.position.x, dz = p.z - this.position.z, dy = p.y - this.position.y;
    return Math.abs(dx) <= this.half.x + pad && Math.abs(dz) <= this.half.z + pad && dy >= -0.5 && dy <= this.half.y;
  }

  _state() {
    const g0 = this.period - this.gust, w0 = g0 - this.warn;
    return this.t >= g0 ? 'gust' : this.t >= w0 ? 'warn' : 'idle';
  }

  step(dt) {
    const S = this.session, p = S.player;
    this.t = (this.t + dt) % this.period;
    const st = this._state();
    const near = this.inside(p.position, 6);
    if (st !== this.state) {
      if (near && st === 'warn') {
        S.audio?.sfx('whoosh', { volume: 0.35, pitch: 0.45 });
        if (!this.hinted) { this.hinted = true; S.hud?.hint?.('Gust incoming! Hug the wall or dive into your ink ({swim}).', 3.5); }
      }
      if (near && st === 'gust') { S.audio?.sfx('whoosh', { volume: 0.8, pitch: 0.35 }); S.audio?.sfx('rumble', { volume: 0.3, pitch: 1.6 }); }
      this.state = st;
    }
    if (st !== 'gust' || !p.alive || p.frozen) return;
    if (!this.inside(p.position)) return;
    if (p.climbing || p.submerged) return;
    const k = this.strength * (p.grounded ? 1 : 1.45) * Math.min(1, (this.t - (this.period - this.gust)) * 4 + 0.25);
    p.position.addScaledVector(this.dir, k * dt);
    if (Math.random() < dt * 3) S.camRig?.addTrauma?.(0.08);
  }

  render(dt) {
    const S = this.session;
    if (this.state === 'idle') return;
    const pl = S.player.position;
    if (!this.inside(pl, 12)) return;
    this.fxT -= dt;
    if (this.fxT > 0) return;
    const gust = this.state === 'gust';
    this.fxT = gust ? 0.03 : 0.08;
    const n = gust ? 4 : 2;
    for (let i = 0; i < n; i++) {
      // streaks enter from the upwind side of the zone, around the player's height
      _v.set(
        this.position.x + (Math.random() - 0.5) * this.half.x * 2,
        Math.max(this.position.y + 0.2, pl.y + (Math.random() - 0.2) * 3),
        this.position.z + (Math.random() - 0.5) * this.half.z * 2,
      ).addScaledVector(this.dir, -2.5);
      _w.copy(this.dir).multiplyScalar(gust ? 16 : 9);
      S.fx.spray(_v, _w, gust ? '#eef2ff' : '#c9d0e8', 1, 0.8, { size: 0.03, life: 0.45, gravity: 0.5, floor: _v.y - 10 });
    }
  }
}
registerEntity('wind-gust', (s, d) => new WindGust(s, d));

// { type: 'fall-guard', drop?: 9 } — on a vertical climb a missed jump should cost a checkpoint,
// not the whole climb: falling more than `drop` metres below the active respawn point splats.
class FallGuard extends Entity {
  constructor(session, def) {
    super(session, def);
    this.drop = def.drop ?? 9;
    this.group.visible = false;
  }

  step() {
    const S = this.session, p = S.player;
    if (!p.alive || p.frozen || p.grounded) return;
    const cp = S.spawnPoint?.pos;
    if (!cp || p.position.y > cp.y - this.drop || p.velocity.y > -1) return;
    S.fx.burst(p.position, UP_V, '#ffffff', 12, 5);
    p.splat({ kind: 'fall' });
  }
}
const UP_V = new THREE.Vector3(0, 1, 0);
registerEntity('fall-guard', (s, d) => new FallGuard(s, d));

// { type: 'glow', pos, shape: 'box'|'cyl'|'torus'|'sphere', size?:[w,h,d], radius?, height?, tube?,
//   color?, intensity?: 2.4, pulse?: 0, speed?: 2, spin?: [x,y,z] rad/s, tilt?: [x,y,z], halo?: 0 }
// Pure dressing: unlit, bloom-friendly energy conduits, core rings and reactor lights.
const GLOW_GEO = {
  box: (d) => new THREE.BoxGeometry(...(d.size || [1, 1, 1])),
  cyl: (d) => new THREE.CylinderGeometry(d.radius ?? 0.5, d.radiusBottom ?? d.radius ?? 0.5, d.height ?? 1, d.sides ?? 20, 1, !!d.open),
  torus: (d) => new THREE.TorusGeometry(d.radius ?? 2, d.tube ?? 0.08, 8, d.segments ?? 64),
  sphere: (d) => new THREE.SphereGeometry(d.radius ?? 0.5, 20, 14),
};
class Glow extends Entity {
  constructor(session, def) {
    super(session, def);
    this.base = new THREE.Color(def.color || '#9a6bff');
    this.k = def.intensity ?? 2.4;
    this.pulse = def.pulse ?? 0;
    this.speed = def.speed ?? 2;
    this.spin = def.spin || null;
    this.t = def.phase ?? Math.random() * 6;
    this.mat = this.own(new THREE.MeshBasicMaterial({ color: this.base.clone().multiplyScalar(this.k), transparent: def.opacity != null, opacity: def.opacity ?? 1, side: def.open ? THREE.DoubleSide : THREE.FrontSide }));
    const g = (GLOW_GEO[def.shape] || GLOW_GEO.box)(def);
    this.own(g);
    this.mesh = new THREE.Mesh(g, this.mat);
    if (def.tilt) this.mesh.rotation.set(def.tilt[0] || 0, def.tilt[1] || 0, def.tilt[2] || 0);
    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
    if (def.halo) {
      const sp = new THREE.Sprite(this.own(new THREE.SpriteMaterial({ map: haloTex(), color: this.base, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
      sp.scale.setScalar(def.halo);
      this.halo = sp;
      this.group.add(sp);
    }
  }

  render(dt) {
    this.t += dt;
    if (this.pulse) {
      const f = 1 + Math.sin(this.t * this.speed) * this.pulse;
      this.mat.color.copy(this.base).multiplyScalar(this.k * f);
      if (this.halo) this.halo.material.opacity = 0.4 + 0.25 * f;
    }
    if (this.spin) { this.pivot.rotation.x += this.spin[0] * dt; this.pivot.rotation.y += this.spin[1] * dt; this.pivot.rotation.z += this.spin[2] * dt; }
  }
}
let _halo = null;
function haloTex() {
  if (_halo) return _halo;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c);
  return _halo;
}
registerEntity('glow', (s, d) => new Glow(s, d));

// ---------------------------------------------------------------------------------------------
// Brush helpers

/**
 * Tower core (x0..x1, z0..z1, y0..y1): dark unpaintable skin plus tinted glass window bands every
 * `floor` metres on all four faces (skipping bands listed in o.skip as [yLow, yHigh]).
 */
export function facade(x0, z0, x1, z1, y0, y1, o = {}) {
  const out = [box(x0, y0, z0, x1, y1, z1, { mat: 'metal', color: o.color || '#3b3650', paint: false })];
  const floor = o.floor ?? 4, t = 0.12, inset = 0.5;
  const glass = { mat: 'glass', color: o.glass || '#b7a8ff' };
  const band = { mat: 'concrete', color: o.band || '#6d6784', paint: false };
  for (let y = y0 + (o.first ?? 1); y + floor <= y1 + 0.01; y += floor) {
    if ((o.skip || []).some(([a, b]) => y + floor > a && y < b)) continue;
    const g0 = y + 0.5, g1 = y + floor - 0.6;
    out.push(box(x0 + inset, g0, z1, x1 - inset, g1, z1 + t, glass));
    out.push(box(x0 + inset, g0, z0 - t, x1 - inset, g1, z0, glass));
    out.push(box(x1, g0, z0 + inset, x1 + t, g1, z1 - inset, glass));
    out.push(box(x0 - t, g0, z0 + inset, x0, g1, z1 - inset, glass));
    // spandrel band under the next floor
    out.push(box(x0 - 0.18, y + floor - 0.35, z0 - 0.18, x1 + 0.18, y + floor, z1 + 0.18, band));
  }
  return out;
}

/** Cantilevered ledge slab (top at y) with a few brackets underneath along its long side. */
export function ledge(x0, z0, x1, z1, y, o = {}) {
  const lo = [Math.min(x0, x1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(z0, z1)];
  const out = [box(lo[0], y - (o.t ?? 0.6), lo[1], hi[0], y, hi[1], { mat: o.mat || 'concrete', color: o.color || '#b8b4c8' })];
  const alongX = hi[0] - lo[0] >= hi[1] - lo[1];
  const L = alongX ? hi[0] - lo[0] : hi[1] - lo[1];
  const n = Math.max(1, Math.round(L / (o.every ?? 5)));
  for (let i = 0; i <= n; i++) {
    const s = (alongX ? lo[0] : lo[1]) + 0.4 + i * ((L - 0.8) / Math.max(1, n));
    if (alongX) out.push(box(s - 0.2, y - 1.6, lo[1], s + 0.2, y - 0.6, hi[1] - 0.4, { mat: 'metal', color: '#2e2a3d', paint: false }));
    else out.push(box(lo[0], y - 1.6, s - 0.2, hi[0] - 0.4, y - 0.6, s + 0.2, { mat: 'metal', color: '#2e2a3d', paint: false }));
  }
  return out;
}

/** Paintable climbing pillar (centre x/z, size w×d) from y0 to y1. */
export const pillar = (cx, cz, w, d, y0, y1, c = '#c9c3dc') => block(cx, cz, w, d, y0, y1 - y0, { mat: 'concrete', color: c });

/** Decor shorthand. */
export const D = (kind, x, y, z, o = {}) => ({ type: 'decor', kind, pos: [x, y, z], ...o });
