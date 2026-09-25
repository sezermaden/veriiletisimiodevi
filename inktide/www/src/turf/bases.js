// Team bases: a shimmering energy curtain in the team colour around each spawn pad, team flags,
// and the barrier rule — rivals inside a base zone take heavy damage and are pushed back out.
import * as THREE from 'three';
import { charMat } from '../actors/materials.js';
import { disposeTree } from '../engine/dispose.js';

const VERT = /* glsl */`
varying vec2 vUv;
varying float vH;
void main() {
  vUv = uv;
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */`
uniform vec3 color;
uniform float time;
varying vec2 vUv;
varying float vH;
void main() {
  float bands = smoothstep(0.55, 1.0, fract(vUv.y * 5.0 - time * 0.9));
  float hex = smoothstep(0.82, 1.0, abs(sin(vUv.x * 60.0 + sin(vUv.y * 20.0 + time) * 0.6)));
  float edge = smoothstep(0.18, 0.0, vH) * 0.9 + smoothstep(0.85, 1.0, vH) * 0.5;
  float fade = 1.0 - smoothstep(0.55, 1.0, vH);
  float a = (0.08 + bands * 0.22 + hex * 0.08) * fade + edge * 0.45;
  gl_FragColor = vec4(color * (1.2 + edge), a);
}`;

const _c = new THREE.Vector3();

export class BaseBarriers {
  /**
   * @param {Session} session
   * @param {object} zones  { 1: {min,max}, 2: {min,max} } by team
   * @param {object} info   { floorY (deck), top (pad top) }
   */
  constructor(session, zones, info = {}) {
    this.S = session;
    this.zones = zones;
    this.group = new THREE.Group();
    this.group.name = 'turf-bases';
    session.scene.add(this.group);
    this.mats = [];
    this.hitT = 0;
    for (const team of [1, 2]) {
      const z = zones[team];
      if (!z) continue;
      const mat = new THREE.ShaderMaterial({
        uniforms: { color: { value: session.ink.color(team) }, time: { value: 0 } },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      });
      this.mats.push(mat);
      const y0 = info.floorY ?? z.min[1] + 2.5 - 1, y1 = (info.top ?? z.min[1] + 2.5) + 2.2;
      const x0 = z.min[0] + 0.5, x1 = z.max[0] - 0.2, z0 = z.min[2] + 0.3, z1 = z.max[2] - 0.3;
      const h = y1 - y0;
      const wall = (w, cx, cz, rotY) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
        m.position.set(cx, y0 + h / 2, cz);
        m.rotation.y = rotY;
        m.renderOrder = 3;
        this.group.add(m);
      };
      wall(x1 - x0, (x0 + x1) / 2, z0, 0);
      wall(x1 - x0, (x0 + x1) / 2, z1, 0);
      // only the side facing the arena (and the back) — front is at max x for Alpha, min x for Bravo
      wall(z1 - z0, x0, (z0 + z1) / 2, Math.PI / 2);
      wall(z1 - z0, x1, (z0 + z1) / 2, Math.PI / 2);
      // team flags at the back corners
      const backX = team === 1 ? x0 + 0.4 : x1 - 0.4;
      for (const fz of [z0 + 0.4, z1 - 0.4]) this.group.add(this._flag(session.ink.color(team), backX, info.top ?? z.min[1] + 2.5, fz, team === 1 ? 0 : Math.PI));
    }
  }

  _flag(color, x, y, z, yaw) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), charMat('#e8e6f0', { roughness: 0.4, metalness: 0.3 }));
    pole.position.y = 1.7;
    const clothMat = charMat(color, { roughness: 0.55, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.2 });
    clothMat.userData.teamColor = color;
    this.mats.push(clothMat);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 8, 2), clothMat);
    cloth.position.set(0.66, 2.95, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), charMat('#ffd23f', { roughness: 0.3 }));
    knob.position.y = 3.45;
    g.add(pole, cloth, knob);
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.userData.cloth = cloth;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  inZone(team, p) {
    const z = this.zones[team];
    return !!z && p.x >= z.min[0] && p.x <= z.max[0] && p.y >= z.min[1] && p.y <= z.max[1] && p.z >= z.min[2] && p.z <= z.max[2];
  }

  /** Fixed step: rivals inside a base get zapped and shoved out. */
  step(dt, players) {
    this.hitT -= dt;
    for (const p of players) {
      if (!p.alive || p.flying) continue;
      const enemyBase = p.team === 1 ? 2 : 1;
      if (!this.inZone(enemyBase, p.position)) continue;
      const z = this.zones[enemyBase];
      _c.set((z.min[0] + z.max[0]) / 2, p.position.y, (z.min[2] + z.max[2]) / 2);
      const push = _c.subVectors(p.position, _c).setY(0);
      if (push.lengthSq() < 1e-4) push.set(enemyBase === 1 ? 1 : -1, 0, 0);
      push.normalize();
      p.velocity.x = push.x * 7; p.velocity.z = push.z * 7;
      if (p.grounded) p.velocity.y = 4;
      p.damage(130 * dt, { source: null, team: enemyBase, kind: 'barrier', dir: push.clone() });
      if (this.hitT <= 0) {
        this.hitT = 0.3;
        this.S.fx.burst(p.hitCenter(new THREE.Vector3()), push, this.S.ink.color(enemyBase), 10, 5);
        this.S.audio?.sfx('hit', { pos: p.isPlayer ? undefined : p.position, volume: 0.5 });
      }
    }
  }

  render(dt) {
    for (const m of this.mats) if (m.uniforms) m.uniforms.time.value += dt;
    const t = performance.now() * 0.001;
    if (!this.flags) { this.flags = []; this.group.traverse((o) => { if (o.userData.cloth) this.flags.push(o); }); }
    for (const o of this.flags) o.userData.cloth.rotation.y = Math.sin(t * 3 + o.position.z) * 0.25;
  }

  dispose() {
    this.S.scene.remove(this.group);
    disposeTree(this.group);
  }
}
