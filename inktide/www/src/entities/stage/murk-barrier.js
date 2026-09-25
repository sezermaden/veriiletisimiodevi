// Murk barrier: a translucent energy wall (hex field + scrolling noise, ripples where ink hits it)
// between two emitter pylons. Solid until its enemy `group` is cleared (or `openOn` fires), then
// it burns away.
//   { type: 'murk-barrier', pos, yaw?, size:[w,h,d], group?, openOn?: 'event:<name>'|'group:<g>' }
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import { geo, mat, rimMat, glowMat, boxCollider, onSpec, onGroupCleared, groupAlive, TEAM_MURK, UP, clamp } from './common.js';

const _v = new THREE.Vector3();
const _l = new THREE.Vector3();

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform vec3 color;
uniform vec2 size;
uniform float time;
uniform float dissolve;
uniform float intensity;
uniform vec4 ripples[4];
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
#include <common>
#include <fog_pars_fragment>
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.07 + 3.1; a *= 0.5; } return v; }
float hexEdge(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 hh = r * 0.5;
  vec2 a = mod(p, r) - hh;
  vec2 b = mod(p - hh, r) - hh;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(gv);
  float d = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  return smoothstep(0.40, 0.49, d);
}
void main() {
  vec2 p = vUv * size;
  float n1 = fbm(p * 0.7 + vec2(0.0, -time * 0.55));
  float n2 = fbm(p * 1.9 + vec2(time * 0.35, time * 0.8));
  float hex = hexEdge(p * 1.8 + vec2(0.0, time * 0.05));
  float scan = smoothstep(0.92, 1.0, fract(p.y * 0.45 - time * 0.6));
  float ex = min(p.x, size.x - p.x), ey = min(p.y, size.y - p.y);
  float edge = 1.0 - smoothstep(0.0, 0.45, min(ex, ey));
  float rip = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = ripples[i];
    float age = time - r.z;
    if (age > 0.0 && age < 0.9) {
      float d = length(p - r.xy);
      rip += smoothstep(0.16, 0.0, abs(d - age * 3.5)) * (1.0 - age / 0.9) + smoothstep(0.5, 0.0, d) * max(0.0, 0.3 - age);
    }
  }
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  // dissolve: burn away along the noise field
  float nd = n1 * 0.65 + n2 * 0.35;
  float th = dissolve * 1.25 - 0.12;
  if (nd < th) discard;
  float burn = (dissolve > 0.001) ? smoothstep(th + 0.09, th, nd) : 0.0;
  float a = 0.16 + n1 * 0.22 + hex * (0.32 + n2 * 0.25) + edge * 0.55 + scan * 0.18 + rip * 0.7 + fres * 0.2 + burn;
  vec3 col = color * (0.7 + n2 * 0.8) + color * hex * 0.9 + vec3(1.0, 0.85, 1.0) * (rip * 0.9 + edge * 0.35 + scan * 0.25) + vec3(1.0, 0.7, 1.0) * burn * 2.5;
  gl_FragColor = vec4(col * intensity, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

class MurkBarrier extends Entity {
  constructor(session, def) {
    super(session, def);
    const [w, h, d] = def.size || [6, 4, 0.4];
    this.w = w; this.h = h; this.d = d;
    this.t = 0;
    this.state = 'up';
    this.dissolveT = 0;
    this.ripple = 0;
    this.murkCol = session.ink.color(TEAM_MURK).clone();
    const g = this.group;

    this.uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      color: { value: this.murkCol.clone().lerp(new THREE.Color('#b77dff'), 0.25) },
      size: { value: new THREE.Vector2(w, h) },
      time: { value: 0 },
      dissolve: { value: 0 },
      intensity: { value: 1.25 },
      ripples: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -10, 0)) },
    }]);
    this.fieldMat = this.own(new THREE.ShaderMaterial({
      uniforms: this.uni, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    }));
    this.field = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, h, 1, 1).translate(0, h / 2, 0)), this.fieldMat);
    this.field.renderOrder = 4;
    g.add(this.field);

    // emitter pylons + top/bottom conduit rails
    const steel = mat('mb-steel', () => rimMat('#2d2640', { roughness: 0.38, metalness: 0.6, rim: 0.3, rimColor: '#c7a8ff' }));
    const dark = mat('mb-dark', () => rimMat('#15121f', { roughness: 0.5, metalness: 0.5, rim: 0.1 }));
    this.coilMat = this.own(glowMat(this.murkCol, 2.6));
    const pylonG = geo('mb-pylon', () => new THREE.BoxGeometry(0.42, 1, 0.55));
    const capG = geo('mb-cap', () => new THREE.CylinderGeometry(0.18, 0.3, 0.3, 6));
    const coilG = geo('mb-coil', () => new THREE.TorusGeometry(0.26, 0.05, 6, 16));
    this.coils = [];
    for (const sx of [-1, 1]) {
      const px = sx * (w / 2 + 0.21);
      const pyl = new THREE.Mesh(pylonG, steel);
      pyl.scale.y = h + 0.4;
      pyl.position.set(px, (h + 0.4) / 2, 0);
      pyl.castShadow = true;
      const cap = new THREE.Mesh(capG, dark);
      cap.position.set(px, h + 0.55, 0);
      const orb = new THREE.Mesh(geo('mb-orb', () => new THREE.SphereGeometry(0.13, 10, 8)), this.coilMat);
      orb.position.set(px, h + 0.78, 0);
      g.add(pyl, cap, orb);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(coilG, this.coilMat);
        c.rotation.x = Math.PI / 2;
        c.position.set(px, 0.6 + i * (h - 0.8) / 2, 0);
        c.scale.setScalar(1.05);
        g.add(c);
        this.coils.push(c);
      }
    }
    const railG = this.own(new THREE.BoxGeometry(w + 0.1, 0.12, 0.2));
    const rb = new THREE.Mesh(railG, dark); rb.position.y = 0.06;
    const rt = new THREE.Mesh(railG, dark); rt.position.y = h + 0.04;
    this.railGlow = new THREE.Mesh(this.own(new THREE.BoxGeometry(w, 0.03, 0.22)), this.coilMat);
    this.railGlow.position.y = 0.13;
    g.add(rb, rt, this.railGlow);

    this.col = boxCollider(w, h, d);
    g.add(this.col);
    g.updateMatrixWorld(true);
    this.dyn = session.level.addDynamic(this.col, { owner: this, tag: 'murk-barrier' });

    this.offs = [];
    if (def.group) {
      this.offs.push(onGroupCleared(session, def.group, () => this.drop()));
      this._groupCheckT = 0.5;
    }
    const o = onSpec(session, def.openOn, () => this.drop());
    if (o) this.offs.push(o);
  }

  onInkHit(p, hit) {
    if (this.state !== 'up') return;
    _l.copy(hit.point);
    this.field.worldToLocal(_l);
    const r = this.uni.ripples.value[this.ripple++ % 4];
    r.set(_l.x + this.w / 2, _l.y, this.t, 0);
    this.session.audio?.sfx('barrier_hit', { pos: hit.point, volume: 0.4, throttle: 0.06 });
  }

  drop() {
    if (this.state !== 'up') return;
    this.state = 'dissolving';
    this.dissolveT = 0;
    this.dyn.enabled = false;
    const S = this.session;
    _v.copy(this.position).setY(this.position.y + this.h / 2);
    S.audio?.sfx('barrier_down', { pos: _v, volume: 0.9 });
    S.shake(_v, 0.2);
    for (let i = 0; i < 10; i++) {
      _l.set((Math.random() - 0.5) * this.w, Math.random() * this.h, 0).applyAxisAngle(UP, this.group.rotation.y).add(this.position);
      S.fx.puff(_l, this.murkCol, 0.9, 0.9, null, 2, 0.5);
      S.fx.burst(_l, UP, this.murkCol, 3, 3, { size: 0.05, gravity: 2 });
    }
    S.events.emit('barrierDown', { id: this.id });
  }

  step(dt) {
    this.t += dt;
    // a group whose members were never spawned (or died before we listened) must not lock forever
    if (this.state === 'up' && this.def.group && this._groupCheckT !== undefined) {
      this._groupCheckT -= dt;
      if (this._groupCheckT <= 0) {
        this._groupCheckT = 1;
        this._seen = this._seen || groupAlive(this.session, this.def.group) > 0;
        if (this._seen && groupAlive(this.session, this.def.group) === 0) this.drop();
      }
    }
    if (this.state === 'dissolving') {
      this.dissolveT += dt;
      if (this.dissolveT > 1.3) { this.state = 'down'; this.field.visible = false; }
    }
  }

  render(dt) {
    const t = this.t;
    this.uni.time.value = t;
    const k = this.state === 'up' ? 1 : clamp(1 - this.dissolveT / 1.2, 0, 1);
    this.uni.dissolve.value = this.state === 'up' ? 0 : clamp(this.dissolveT / 1.1, 0, 1);
    this.coilMat.color.copy(this.murkCol).multiplyScalar(0.3 + k * (2.2 + Math.sin(t * 6) * 0.5));
    for (let i = 0; i < this.coils.length; i++) this.coils[i].rotation.z = t * (i % 2 ? 2 : -2);
    if (this.state === 'up') {
      this._humT = (this._humT || 0) - dt;
      if (this._humT <= 0) {
        this._humT = 0.4;
        const pl = this.session.player.position;
        if (pl.distanceToSquared(this.position) < 64) this.session.audio?.sfx('barrier_hum', { pos: this.position, volume: 0.25, throttle: 0.3 });
      }
    }
  }

  dispose() {
    for (const o of this.offs) o?.();
    this.session.level.removeDynamic(this.dyn);
    super.dispose();
  }
}

registerEntity('murk-barrier', (s, d) => new MurkBarrier(s, d));
