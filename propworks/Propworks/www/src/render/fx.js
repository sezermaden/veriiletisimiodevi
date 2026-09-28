/* Effects: pooled GPU particles, tracers, flash lights, decals, pixel debris, shockwaves.
   Everything is allocated once and recycled — an explosion never creates geometry. */
import * as THREE from 'three';
import { TEX } from './textures.js';

const V = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const randDir = (out = new THREE.Vector3()) => { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); return out.set(s * Math.cos(t), u, s * Math.sin(t)); };

/* ------------------------------------------------------------------ particles */
class ParticlePool {
  constructor(scene, max, { additive, texture }) {
    this.max = max;
    this.count = 0;
    this.p = new Float32Array(max * 3);    // position
    this.v = new Float32Array(max * 3);    // velocity
    this.c = new Float32Array(max * 4);    // rgba (render)
    this.c0 = new Float32Array(max * 3);   // start colour
    this.c1 = new Float32Array(max * 3);   // end colour
    this.s = new Float32Array(max);        // size (render)
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.fade = new Float32Array(max);     // 0 = linear fade, 1 = fade-in-out (smoke)
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('size', this.aSize);
    g.setAttribute('rot', this.aRot);
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; attribute float rot; uniform float scale;
        varying vec4 vC; varying float vR;
        void main(){ vC = color; vR = rot; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; varying float vR;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float cs = cos(vR), sn = sin(vR);
          uv = vec2(cs*uv.x - sn*uv.y, sn*uv.x + cs*uv.y) + 0.5;
          vec4 t = texture2D(map, uv); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a);
          if (gl_FragColor.a < 0.004) discard; }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }

  emit(pos, vel, o) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
    this.v[i * 3] = vel.x; this.v[i * 3 + 1] = vel.y; this.v[i * 3 + 2] = vel.z;
    const c0 = o.color, c1 = o.color1 || o.color;
    this.c0[i * 3] = c0.r; this.c0[i * 3 + 1] = c0.g; this.c0[i * 3 + 2] = c0.b;
    this.c1[i * 3] = c1.r; this.c1[i * 3 + 1] = c1.g; this.c1[i * 3 + 2] = c1.b;
    this.s0[i] = o.size; this.s1[i] = o.size1 ?? o.size;
    this.life[i] = o.life; this.age[i] = 0;
    this.drag[i] = o.drag ?? 0; this.grav[i] = o.gravity ?? 0; this.a0[i] = o.alpha ?? 1;
    this.rot[i] = Math.random() * 6.28; this.spin[i] = o.spin ?? 0; this.fade[i] = o.fade ?? 0;
  }

  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        n--; this._copy(n, i); i--; continue;
      }
      const k = this.age[i] / this.life[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.c[i * 4] = this.c0[i * 3] + (this.c1[i * 3] - this.c0[i * 3]) * k;
      this.c[i * 4 + 1] = this.c0[i * 3 + 1] + (this.c1[i * 3 + 1] - this.c0[i * 3 + 1]) * k;
      this.c[i * 4 + 2] = this.c0[i * 3 + 2] + (this.c1[i * 3 + 2] - this.c0[i * 3 + 2]) * k;
      this.c[i * 4 + 3] = this.a0[i] * (this.fade[i] ? Math.min(1, k * 6) * (1 - k) : 1 - k * k);
      this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.rot[i] += this.spin[i] * dt;
    }
    this.count = n;
    this.mesh.geometry.setDrawRange(0, n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aRot.needsUpdate = true;
  }

  _copy(from, to) {
    if (from === to) return;
    for (const [arr, w] of [[this.p, 3], [this.v, 3], [this.c, 4], [this.c0, 3], [this.c1, 3]]) for (let j = 0; j < w; j++) arr[to * w + j] = arr[from * w + j];
    for (const arr of [this.s, this.s0, this.s1, this.life, this.age, this.drag, this.grav, this.a0, this.rot, this.spin, this.fade]) arr[to] = arr[from];
  }

  clear() { this.count = 0; this.mesh.geometry.setDrawRange(0, 0); }
}

/* ------------------------------------------------------------------ FX facade */
export class FX {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.density = 1;
    this.add = new ParticlePool(scene, 3000, { additive: true, texture: TEX.spriteGlow });
    this.smoke = new ParticlePool(scene, 1200, { additive: false, texture: TEX.spriteSmoke });

    // tracers: stretched quads, one per bullet
    this.tracers = [];
    const tg = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), speed: 0, width: 0.02 });
    }

    // flash lights
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 12, 2);
      l.visible = false; scene.add(l);
      this.lights.push({ light: l, life: 0, max: 1, peak: 0 });
    }

    // decals
    this.decals = [];
    this.decalIndex = 0;
    const dg = new THREE.PlaneGeometry(1, 1);
    const holeTex = makeHoleTexture();
    const scorchTex = makeScorchTexture();
    this.decalMats = {
      hole: new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }),
      scorch: new THREE.MeshStandardMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }),
      glitch: new THREE.MeshBasicMaterial({ map: TEX.checker.map, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    };
    for (let i = 0; i < 96; i++) {
      const m = new THREE.Mesh(dg, this.decalMats.hole);
      m.visible = false; m.renderOrder = 1; scene.add(m);
      this.decals.push(m);
    }

    // pixel debris (corrupted enemies shed cubes of missing texture)
    this.maxCubes = 300;
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5 }), this.maxCubes);
    this.cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cubes.count = 0;
    this.cubes.castShadow = true;
    this.cubes.frustumCulled = false;
    scene.add(this.cubes);
    this.cubeData = [];

    // shockwave rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.5, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m);
      this.rings.push({ mesh: m, life: 0, max: 0.6, size: 6 });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color();
  }

  setDensity(d) { this.density = d; }

  clear() {
    this.add.clear(); this.smoke.clear();
    for (const t of this.tracers) { t.life = 0; t.mesh.visible = false; }
    for (const l of this.lights) { l.life = 0; l.light.visible = false; }
    for (const d of this.decals) d.visible = false;
    this.cubeData.length = 0; this.cubes.count = 0;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
  }

  _n(n) { return Math.max(1, Math.round(n * this.density)); }

  /* ------------------------------------------------ emitters */
  sparks(pos, normal, count = 12, color = new THREE.Color(3, 2, 0.8), speed = 6) {
    for (let i = 0; i < this._n(count); i++) {
      randDir(V);
      if (normal) V.add(normal).normalize();
      V.multiplyScalar(speed * rand(0.3, 1));
      this.add.emit(pos, V, { color, color1: new THREE.Color(1.2, 0.3, 0), size: rand(0.03, 0.07), size1: 0.01, life: rand(0.25, 0.7), gravity: 9, drag: 1.2 });
    }
  }

  dust(pos, normal, count = 6, color = new THREE.Color(0.55, 0.52, 0.48)) {
    for (let i = 0; i < this._n(count); i++) {
      randDir(V);
      if (normal) V.addScaledVector(normal, 1.3).normalize();
      V.multiplyScalar(rand(0.3, 1.4));
      this.smoke.emit(pos, V, { color, size: rand(0.12, 0.25), size1: rand(0.5, 0.9), life: rand(0.6, 1.3), drag: 2, gravity: -0.1, alpha: 0.45, fade: 1, spin: rand(-1, 1) });
    }
  }

  impact(pos, normal, surface = 'concrete') {
    if (surface === 'metal') this.sparks(pos, normal, 10);
    else if (surface === 'wood') { this.dust(pos, normal, 4, new THREE.Color(0.55, 0.4, 0.25)); this.chips(pos, normal, 5, 0x8a6036); }
    else if (surface === 'glass') this.sparks(pos, normal, 6, new THREE.Color(1.5, 2, 2.4), 3);
    else if (surface === 'flesh') this.blood(pos, normal);
    else if (surface === 'glitch') this.glitchBurst(pos, 6, 0.5);
    else { this.dust(pos, normal, 5); this.chips(pos, normal, 3, 0x777777); if (Math.random() < 0.3) this.sparks(pos, normal, 3); }
  }

  blood(pos, normal) {
    for (let i = 0; i < this._n(10); i++) {
      randDir(V); if (normal) V.add(normal).normalize();
      V.multiplyScalar(rand(1, 3));
      this.smoke.emit(pos, V, { color: new THREE.Color(0.35, 0.02, 0.02), size: rand(0.04, 0.1), size1: 0.14, life: rand(0.3, 0.6), gravity: 9, alpha: 0.9 });
    }
  }

  chips(pos, normal, count, color) {
    for (let i = 0; i < this._n(count); i++) {
      randDir(V); if (normal) V.addScaledVector(normal, 1.5).normalize();
      V.multiplyScalar(rand(2, 5));
      this.cube(pos, V, rand(0.015, 0.04), color, rand(0.6, 1.2));
    }
  }

  muzzle(pos, dir, big = false) {
    const col = new THREE.Color(4, 2.6, 1.1);
    for (let i = 0; i < this._n(big ? 10 : 6); i++) {
      V.copy(dir).multiplyScalar(rand(1, 4)).add(randDir(new THREE.Vector3()).multiplyScalar(0.6));
      this.add.emit(pos, V, { color: col, color1: new THREE.Color(1, 0.3, 0), size: rand(0.05, big ? 0.16 : 0.1), size1: 0.02, life: 0.06 });
    }
    this.flash(pos, 0xffb060, big ? 5 : 3, 0.06, 8);
  }

  smokePuff(pos, count = 4, color = new THREE.Color(0.6, 0.6, 0.6), size = 0.4) {
    for (let i = 0; i < this._n(count); i++) {
      randDir(V).multiplyScalar(rand(0.2, 0.8)); V.y = Math.abs(V.y) + 0.4;
      this.smoke.emit(pos, V, { color, size: size * rand(0.6, 1), size1: size * rand(2, 3), life: rand(1.2, 2.2), drag: 1, gravity: -0.3, alpha: 0.5, fade: 1, spin: rand(-0.6, 0.6) });
    }
  }

  fire(pos, scale = 1) {
    V.set(rand(-0.2, 0.2), rand(1, 2.2) * scale, rand(-0.2, 0.2));
    this.add.emit(pos, V, { color: new THREE.Color(3, 1.3, 0.3), color1: new THREE.Color(0.8, 0.1, 0), size: 0.35 * scale, size1: 0.08, life: rand(0.35, 0.7), drag: 0.5, spin: rand(-2, 2) });
    if (Math.random() < 0.25) this.smoke.emit(V.set(pos.x, pos.y + 0.6 * scale, pos.z), new THREE.Vector3(0, 1.2, 0), { color: new THREE.Color(0.15, 0.14, 0.13), size: 0.3 * scale, size1: 1.2 * scale, life: 1.8, alpha: 0.5, fade: 1, gravity: -0.4 });
  }

  explosion(pos, scale = 1) {
    const n = this._n(40 * scale);
    for (let i = 0; i < n; i++) {
      randDir(V).multiplyScalar(rand(2, 9) * scale);
      this.add.emit(pos, V, { color: new THREE.Color(4, 2.2, 0.7), color1: new THREE.Color(1.2, 0.25, 0.05), size: rand(0.5, 1.2) * scale, size1: rand(0.1, 0.4), life: rand(0.25, 0.6), drag: 4, spin: rand(-3, 3) });
    }
    for (let i = 0; i < this._n(26 * scale); i++) {
      randDir(V).multiplyScalar(rand(1, 4) * scale); V.y = Math.abs(V.y) * 1.2;
      this.smoke.emit(pos, V, { color: new THREE.Color(0.22, 0.2, 0.19), color1: new THREE.Color(0.45, 0.44, 0.43), size: rand(0.8, 1.6) * scale, size1: rand(3, 5) * scale, life: rand(2, 3.6), drag: 1.6, gravity: -0.35, alpha: 0.7, fade: 1, spin: rand(-0.5, 0.5) });
    }
    this.sparks(pos, null, 30 * scale, new THREE.Color(4, 2.5, 0.8), 14 * scale);
    this.chips(pos, null, 12, 0x333333);
    this.flash(pos, 0xff9a40, 60 * scale, 0.35, 22 * scale);
    this.ring(pos, 9 * scale);
  }

  glitchBurst(pos, count = 20, size = 1) {
    for (let i = 0; i < this._n(count); i++) {
      randDir(V).multiplyScalar(rand(1, 5) * size);
      this.cube(pos, V, rand(0.04, 0.12) * size, Math.random() < 0.5 ? 0xff00dc : 0x080808, rand(0.8, 1.6));
    }
    for (let i = 0; i < this._n(count * 0.6); i++) {
      randDir(V).multiplyScalar(rand(0.5, 3) * size);
      this.add.emit(pos, V, { color: new THREE.Color(3, 0, 2.6), size: rand(0.08, 0.2) * size, size1: 0.01, life: rand(0.2, 0.5), drag: 2 });
    }
  }

  spawnBurst(pos, radius = 0.6) {
    for (let i = 0; i < this._n(18); i++) {
      randDir(V);
      const p = new THREE.Vector3().copy(pos).addScaledVector(V, radius);
      this.add.emit(p, V.multiplyScalar(-radius * 1.6), { color: new THREE.Color(0.6, 1.6, 3), size: 0.06, size1: 0.01, life: 0.45 });
    }
  }

  beamHit(pos, normal, color = new THREE.Color(0.8, 2, 4)) {
    this.sparks(pos, normal, 8, color, 3);
    this.add.emit(pos, V.set(0, 0, 0), { color, size: 0.35, size1: 0.05, life: 0.18 });
  }

  splash(pos, scale = 1) {
    for (let i = 0; i < this._n(20 * scale); i++) {
      V.set(rand(-1, 1), rand(2, 5), rand(-1, 1)).multiplyScalar(scale);
      this.smoke.emit(pos, V, { color: new THREE.Color(0.8, 0.9, 1), size: rand(0.06, 0.14), size1: 0.04, life: rand(0.5, 0.9), gravity: 9.8, alpha: 0.8 });
    }
    this.ring(pos, 2 * scale, new THREE.Color(0.8, 0.9, 1));
  }

  /* ------------------------------------------------ primitives */
  cube(pos, vel, size, color, life) {
    if (this.cubeData.length >= this.maxCubes) this.cubeData.shift();
    const floor = this.groundProbe ? this.groundProbe(pos) : -1e9;
    this.cubeData.push({ p: pos.clone(), v: vel.clone(), size, color: new THREE.Color(color), life, age: 0, rot: new THREE.Euler(rand(0, 6), rand(0, 6), 0), spin: rand(-8, 8), floor });
  }

  tracer(from, to, { color = new THREE.Color(3, 2.4, 1.2), width = 0.02, speed = 260 } = {}) {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    t.from.copy(from); t.to.copy(to);
    t.max = t.life = Math.max(0.03, from.distanceTo(to) / speed);
    t.width = width;
    t.mesh.material.color.copy(color);
    t.mesh.visible = true;
  }

  flash(pos, color, intensity, life, distance = 10) {
    const f = this.lights.reduce((a, b) => (a.life < b.life ? a : b));
    f.light.position.copy(pos); f.light.color.set(color); f.light.distance = distance;
    f.peak = intensity; f.life = f.max = life; f.light.visible = true;
    f.light.intensity = intensity;
  }

  ring(pos, size, color = new THREE.Color(2, 1.5, 1)) {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.mesh.position.copy(pos); r.mesh.position.y += 0.05;
    r.mesh.material.color.copy(color);
    r.size = size; r.life = r.max = 0.5; r.mesh.visible = true;
  }

  decal(pos, normal, kind = 'hole', size = 0.12) {
    const d = this.decals[this.decalIndex++ % this.decals.length];
    d.material = this.decalMats[kind] || this.decalMats.hole;
    d.position.copy(pos).addScaledVector(normal, 0.004);
    d.lookAt(V.copy(pos).add(normal));
    d.rotateZ(Math.random() * 6.28);
    d.scale.setScalar(size * rand(0.85, 1.15));
    d.visible = true;
    d.userData.parent = null;
    return d;
  }

  /* ------------------------------------------------ tick */
  update(dt, camera) {
    this.add.update(dt);
    this.smoke.update(dt);
    const h = innerHeight;
    const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.add.mesh.material.uniforms.scale.value = scale;
    this.smoke.mesh.material.uniforms.scale.value = scale;

    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.mesh.visible = false; continue; }
      const k = 1 - t.life / t.max;
      const head = V.lerpVectors(t.from, t.to, Math.min(1, k + 0.25));
      const tail = new THREE.Vector3().lerpVectors(t.from, t.to, Math.max(0, k - 0.05));
      const len = head.distanceTo(tail);
      t.mesh.position.copy(tail);
      t.mesh.scale.set(t.width, len, 1);
      // orient: +Y along the segment, face the camera around it
      const dir = new THREE.Vector3().subVectors(head, tail).normalize();
      const toCam = new THREE.Vector3().subVectors(camera.position, tail).normalize();
      const x = new THREE.Vector3().crossVectors(dir, toCam).normalize();
      const z = new THREE.Vector3().crossVectors(x, dir);
      this._m.makeBasis(x, dir, z);
      t.mesh.quaternion.setFromRotationMatrix(this._m);
      t.mesh.material.opacity = 1 - k * 0.5;
    }

    for (const f of this.lights) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.light.visible = false; f.light.intensity = 0; continue; }
      f.light.intensity = f.peak * (f.life / f.max) ** 2;
    }

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      const k = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.2 + k * r.size);
      r.mesh.material.opacity = (1 - k) * 0.8;
    }

    let n = 0;
    for (let i = this.cubeData.length - 1; i >= 0; i--) {
      const c = this.cubeData[i];
      c.age += dt;
      if (c.age > c.life) { this.cubeData.splice(i, 1); continue; }
    }
    for (const c of this.cubeData) {
      c.v.y -= 11 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.floor + c.size / 2) { c.p.y = c.floor + c.size / 2; c.v.y *= -0.35; c.v.x *= 0.7; c.v.z *= 0.7; c.spin *= 0.6; }
      c.rot.x += c.spin * dt; c.rot.y += c.spin * 0.7 * dt;
      const s = c.size * Math.min(1, (c.life - c.age) * 3);
      this._q.setFromEuler(c.rot);
      this._m.compose(c.p, this._q, this._s.setScalar(s));
      this.cubes.setMatrixAt(n, this._m);
      this.cubes.setColorAt(n, c.color);
      n++;
    }
    this.cubes.count = n;
    this.cubes.instanceMatrix.needsUpdate = true;
    if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;
  }
}

function makeHoleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.25, 'rgba(10,10,10,0.95)'); grd.addColorStop(0.5, 'rgba(40,36,30,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeScorchTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const r = 30 + Math.random() * 90, a = Math.random() * 6.28, d = Math.random() * 40;
    const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export { randDir, rand };
