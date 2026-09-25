// Pooled ink FX: glossy droplets (instanced, stretched along velocity), expanding splash rings,
// soft puffs (sprites) and sparkles. Everything is fixed-size pools — nothing allocates per frame.
import * as THREE from 'three';
import { softSprite } from '../world/textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

export class Particles {
  constructor(scene, opts = {}) {
    this.scene = scene;
    // ---- droplets ----
    const max = this.max = opts.max || 1600;
    this.dp = new Float32Array(max * 3);
    this.dv = new Float32Array(max * 3);
    this.dl = new Float32Array(max);      // life left
    this.dL = new Float32Array(max);      // life total
    this.ds = new Float32Array(max);      // size
    this.dg = new Float32Array(max);      // gravity
    this.dFloor = new Float32Array(max);  // y at which it dies
    this.alive = 0;
    this.cursor = 0;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0, envMapIntensity: 1.3 });
    this.drops = new THREE.InstancedMesh(geo, mat, max);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.setColorAt(0, new THREE.Color());
    this.drops.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.drops.castShadow = false;
    scene.add(this.drops);
    this.dCol = new Float32Array(max * 3);

    // ---- rings ----
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.55, 1, 28);
    for (let i = 0; i < 48; i++) {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
      r.visible = false;
      r.renderOrder = 2;
      scene.add(r);
      this.rings.push({ mesh: r, t: 0, life: 0, size: 1 });
    }
    this.ringCursor = 0;

    // ---- puffs (billboard sprites) ----
    this.puffs = [];
    const tex = softSprite('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)', 64);
    for (let i = 0; i < 96; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false;
      scene.add(sp);
      this.puffs.push({ sp, t: 0, life: 0, size: 1, vel: new THREE.Vector3(), grow: 1 });
    }
    this.puffCursor = 0;
  }

  /** Radial burst of droplets away from a surface. */
  burst(pos, normal, color, count = 12, speed = 5, opts = {}) {
    const n = normal || _up;
    const spread = opts.spread ?? 0.9;
    const size = opts.size ?? 0.07;
    for (let i = 0; i < count; i++) {
      _d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(spread);
      _d.add(n).normalize();
      const sp = speed * (0.45 + Math.random() * 0.75);
      this._spawn(pos, _d.x * sp, _d.y * sp, _d.z * sp, color, size * (0.6 + Math.random() * 0.8), opts.life ?? 0.6 + Math.random() * 0.35, opts.gravity ?? 20, opts.floor ?? pos.y - 4);
    }
  }

  /** Droplets flying along a velocity with random jitter (muzzle spray, trails). */
  spray(pos, vel, color, count = 4, jitter = 1.2, opts = {}) {
    for (let i = 0; i < count; i++) {
      this._spawn(pos,
        vel.x + (Math.random() - 0.5) * jitter, vel.y + (Math.random() - 0.5) * jitter, vel.z + (Math.random() - 0.5) * jitter,
        color, (opts.size ?? 0.05) * (0.6 + Math.random() * 0.8), opts.life ?? 0.35 + Math.random() * 0.2, opts.gravity ?? 16, opts.floor ?? pos.y - 6);
    }
  }

  _spawn(pos, vx, vy, vz, color, size, life, gravity, floor) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.dp[i * 3] = pos.x; this.dp[i * 3 + 1] = pos.y; this.dp[i * 3 + 2] = pos.z;
    this.dv[i * 3] = vx; this.dv[i * 3 + 1] = vy; this.dv[i * 3 + 2] = vz;
    this.dl[i] = life; this.dL[i] = life; this.ds[i] = size; this.dg[i] = gravity; this.dFloor[i] = floor;
    _c.set(color);
    this.dCol[i * 3] = _c.r; this.dCol[i * 3 + 1] = _c.g; this.dCol[i * 3 + 2] = _c.b;
  }

  /** Flat splash ring on a surface. */
  ring(pos, normal, color, size = 1.2, life = 0.45) {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.mesh.position.copy(pos).addScaledVector(normal || _up, 0.03);
    r.mesh.quaternion.setFromUnitVectors(_up, normal || _up);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
    r.t = 0; r.life = life; r.size = size;
  }

  /** Soft cloud puff (mist, dust, special FX glow). */
  puff(pos, color, size = 1, life = 0.6, vel = null, grow = 1.8, opacity = 0.7) {
    const p = this.puffs[this.puffCursor];
    this.puffCursor = (this.puffCursor + 1) % this.puffs.length;
    p.sp.position.copy(pos);
    p.sp.material.color.set(color);
    p.sp.visible = true;
    p.t = 0; p.life = life; p.size = size; p.grow = grow; p.op = opacity;
    if (vel) p.vel.copy(vel); else p.vel.set(0, 0.6, 0);
  }

  /** Big ink explosion: burst + ring + puffs. */
  explosion(pos, normal, color, radius = 2) {
    this.burst(pos, normal, color, Math.round(18 + radius * 10), 4 + radius * 2.2, { size: 0.09 + radius * 0.02, spread: 1.4 });
    this.ring(pos, normal, color, radius * 1.1, 0.5);
    for (let i = 0; i < 4; i++) {
      _p.copy(pos).add(_d.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(radius * 0.6));
      this.puff(_p, color, radius * 0.8, 0.5 + Math.random() * 0.3, _d.set(0, 1.2, 0), 1.6, 0.55);
    }
  }

  update(dt) {
    // droplets
    const drops = this.drops;
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.dl[i] <= 0) continue;
      this.dl[i] -= dt;
      const i3 = i * 3;
      this.dv[i3 + 1] -= this.dg[i] * dt;
      this.dp[i3] += this.dv[i3] * dt;
      this.dp[i3 + 1] += this.dv[i3 + 1] * dt;
      this.dp[i3 + 2] += this.dv[i3 + 2] * dt;
      if (this.dp[i3 + 1] < this.dFloor[i]) this.dl[i] = 0;
      if (this.dl[i] <= 0) continue;
      const k = this.dl[i] / this.dL[i];
      const size = this.ds[i] * Math.min(1, k * 2.5);
      _p.set(this.dp[i3], this.dp[i3 + 1], this.dp[i3 + 2]);
      _d.set(this.dv[i3], this.dv[i3 + 1], this.dv[i3 + 2]);
      const sp = _d.length();
      if (sp > 1e-3) _q.setFromUnitVectors(_up, _d.divideScalar(sp)); else _q.identity();
      const st = 1 + Math.min(2.2, sp * 0.12);
      _s.set(size / Math.sqrt(st), size / Math.sqrt(st), size * st);
      _m.compose(_p, _q, _s);
      drops.setMatrixAt(n, _m);
      _c.setRGB(this.dCol[i3], this.dCol[i3 + 1], this.dCol[i3 + 2]);
      drops.setColorAt(n, _c);
      n++;
    }
    drops.count = n;
    drops.instanceMatrix.needsUpdate = true;
    if (drops.instanceColor) drops.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(r.size * (0.3 + e * 0.9));
      r.mesh.material.opacity = 0.85 * (1 - k);
    }
    for (const p of this.puffs) {
      if (!p.sp.visible) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.sp.visible = false; continue; }
      p.sp.position.addScaledVector(p.vel, dt);
      p.sp.scale.setScalar(p.size * (1 + (p.grow - 1) * k));
      p.sp.material.opacity = p.op * (1 - k) * Math.min(1, k * 8);
    }
  }

  clear() {
    this.dl.fill(0);
    for (const r of this.rings) r.mesh.visible = false;
    for (const p of this.puffs) p.sp.visible = false;
  }

  dispose() {
    this.scene.remove(this.drops);
    this.drops.geometry.dispose();
    this.drops.material.dispose();
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.material.dispose(); }
    for (const p of this.puffs) { this.scene.remove(p.sp); p.sp.material.dispose(); }
  }
}
