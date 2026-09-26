// Ink sponge: a squashy yellow block that soaks up hero ink and swells into a full-size platform;
// Murk ink wrings it back down. The collider is a separate box whose vertices follow the current
// size (BVH refit), so the physics always matches the rigid-transform collision contract.
//   { type: 'sponge', pos, yaw?, size:[w,h,d], state?: 'small'|'full', min?: 0.32 }
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Entity, registerEntity } from '../base.js';
import { surfaceTextures } from '../../world/textures.js';
import { TEAM_HERO, TEAM_MURK, clamp, INVISIBLE, splatTouches } from './common.js';

const YELLOW = new THREE.Color('#ffe25a');

/** Rounded box with UVs projected per dominant axis in metres (so pores keep their size). */
function spongeGeometry(w, h, d) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(0.22, Math.min(w, h, d) * 0.12));
  g.translate(0, h / 2, 0);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / 1.6, v / 1.6);
  }
  return g;
}

class Sponge extends Entity {
  constructor(session, def) {
    super(session, def);
    const [w, h, d] = def.size || [2.5, 2.5, 2.5];
    this.size = new THREE.Vector3(w, h, d);
    this.min = def.min ?? 0.32;
    this.fill = def.state === 'full' ? 1 : 0;
    this.s = this._target();       // current (collider) scale factor, spring driven
    this.sv = 0;
    this.wobble = 0;
    this.wobbleV = 0;
    this.tint = 0;                 // 1 = hero soaked, -1 = murk flash
    this.t = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this.murkCol = session.ink.color(TEAM_MURK).clone();

    const tex = surfaceTextures('sponge');           // shared, repeat-wrapped
    this.mat = this.own(new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), color: YELLOW.clone(), roughness: 0.92, metalness: 0,
      emissive: new THREE.Color(0, 0, 0),
    }));
    this.body = new THREE.Mesh(this.own(spongeGeometry(w, h, d)), this.mat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // collider: unit-box vertices rescaled to the live size, refit each change
    const cg = this.own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    this.colBase = Float32Array.from(cg.attributes.position.array);
    this.colMesh = new THREE.Mesh(cg, INVISIBLE);
    this.colMesh.visible = false;
    this.group.add(this.colMesh);
    this._applyCollider(this.s);
    this.group.updateMatrixWorld(true);
    this.dyn = session.level.addDynamic(this.colMesh, { owner: this, tag: 'sponge' });
    this._applyCollider(this.s, true);
  }

  _target() { const f = clamp(this.fill, 0, 1); return this.min + (1 - this.min) * (f * f * (3 - 2 * f)); }

  _applyCollider(s, refit = false) {
    const a = this.colMesh.geometry.attributes.position;
    const b = this.colBase, arr = a.array;
    const sx = this.size.x * s, sy = this.size.y * s, sz = this.size.z * s;
    for (let i = 0; i < arr.length; i += 3) { arr[i] = b[i] * sx; arr[i + 1] = b[i + 1] * sy; arr[i + 2] = b[i + 2] * sz; }
    a.needsUpdate = true;
    this.colMesh.geometry.computeBoundingBox();
    this.colMesh.geometry.computeBoundingSphere();     // the level's splat notifier culls by sphere
    if (refit && this.dyn) this.dyn.bvh.refit();
    this.colScale = s;
  }

  /** Shots and splats (projectiles, bombs, rollers, brushes) that reach the collider land here. */
  onInkHit(p, hit) {
    const r = p.paint?.radius ?? 0.45;
    const S = this.session;
    if (!splatTouches(hit, r)) return;             // floor painting beside the sponge doesn't soak it
    const amt = 0.07 + r * 0.14;
    if (p.team === TEAM_HERO) {
      const before = this.fill;
      this.fill = Math.min(1.15, this.fill + amt);
      this.tint = Math.min(1, this.tint + 0.35);
      this.wobbleV += 2.2;
      if (this.fill > before) S.audio?.sfx('sponge_grow', { pos: hit.point, volume: 0.5, pitch: 0.8 + this.fill * 0.5, throttle: 0.07 });
      S.fx.burst(hit.point, hit.normal, this.heroCol, 5, 1.6, { size: 0.05, gravity: 4 });
    } else if (p.team === TEAM_MURK) {
      this.fill = Math.max(0, this.fill - amt * 1.2);
      this.tint = Math.max(-1, this.tint - 0.5);
      this.wobbleV -= 2.2;
      S.audio?.sfx('sponge_shrink', { pos: hit.point, volume: 0.5, throttle: 0.07 });
      S.fx.burst(hit.point, hit.normal, this.murkCol, 5, 1.6, { size: 0.05, gravity: 4 });
    }
  }

  step(dt) {
    this.t += dt;
    // critically-damped-ish spring with a little overshoot for the squishy feel
    const target = this._target();
    const k = 70, c = 11;
    this.sv += (k * (target - this.s) - c * this.sv) * dt;
    this.s += this.sv * dt;
    this.s = clamp(this.s, this.min * 0.9, 1.08);
    if (Math.abs(this.s - this.colScale) > 0.004) this._applyCollider(this.s, true);
    if (this.fill > 1) this.fill = Math.max(1, this.fill - dt * 0.2);
  }

  get grown() { return this.s > 0.9; }

  render(dt) {
    // hit wobble (visual only)
    this.wobbleV += (-60 * this.wobble - 7 * this.wobbleV) * dt;
    this.wobble += this.wobbleV * dt;
    const wb = this.wobble * 0.06;
    const s = this.s;
    this.body.scale.set(s * (1 + wb), s * (1 - wb * 1.4), s * (1 + wb));
    // soaked tint: yellow → lightly hero-coloured; murk hits flash violet then fade
    this.tint += (Math.min(this.fill, 1) * 0.55 - this.tint) * Math.min(1, dt * 1.5);
    const tint = this.tint;
    if (tint >= 0) this.mat.color.copy(YELLOW).lerp(this.heroCol, tint * 0.28);
    else this.mat.color.copy(YELLOW).lerp(this.murkCol, -tint * 0.6);
    this.mat.emissive.copy(this.heroCol).multiplyScalar(Math.max(0, tint) * 0.08);
  }

  dispose() {
    this.session.level.removeDynamic(this.dyn);
    super.dispose();
  }
}

registerEntity('sponge', (s, d) => new Sponge(s, d));
