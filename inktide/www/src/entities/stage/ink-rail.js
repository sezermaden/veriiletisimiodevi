// Ink rail: a glass-sheathed tube along `points`. Shoot the node at its start to charge it (the
// light races down the rail); then touch it in squid form to ride it at high speed. Jump (or
// release swim) to hop off; at the end you fly off with your momentum.
//   { type: 'ink-rail', pos, points:[[x,y,z],…], speed?: 15, active?: false, activeOn?: 'event:x' }
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import {
  geo, mat, rimMat, glowMat, makeGlowSprite, HitProxy, onSpec,
  TEAM_HERO, TEAM_MURK, UP, DOWN, clamp,
} from './common.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Vector3();

class InkRail extends Entity {
  constructor(session, def) {
    super(session, def);
    this.group.position.set(0, 0, 0);    // rails are authored in world space
    this.group.rotation.set(0, 0, 0);
    this.t = 0;
    this.speed = def.speed ?? 15;
    this.active = false;
    this.onT = 0;                         // activation front 0..1
    this.riding = null;
    this.cooldown = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this.murkCol = session.ink.color(TEAM_MURK).clone();

    const base = def.pos || [0, 0, 0];
    let pts = (def.points && def.points.length >= 2 ? def.points : [base, [base[0], base[1], base[2] - 10]]);
    if (def.relative) pts = pts.map((p) => [p[0] + base[0], p[1] + base[1], p[2] + base[2]]);
    const vecs = pts.map((p) => new THREE.Vector3().fromArray(p));
    this.curve = new THREE.CatmullRomCurve3(vecs, false, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    const N = Math.max(8, Math.ceil(this.length / 0.2));
    this.N = N;
    this.lut = new Float32Array((N + 1) * 3);
    const sp = this.curve.getSpacedPoints(N);
    this.bbox = new THREE.Box3();
    for (let i = 0; i <= N; i++) { this.lut[i * 3] = sp[i].x; this.lut[i * 3 + 1] = sp[i].y; this.lut[i * 3 + 2] = sp[i].z; this.bbox.expandByPoint(sp[i]); }
    this.bbox.expandByScalar(1.2);

    // ---- tube with an emissive activation front + flowing stripes ----
    const tubeG = this.own(new THREE.TubeGeometry(this.curve, Math.max(16, Math.ceil(this.length * 5)), 0.09, 10, false));
    this.uni = {
      railOn: { value: 0 }, railTime: { value: 0 }, railLen: { value: this.length },
      railCol: { value: this.heroCol.clone() }, railIdle: { value: this.murkCol.clone().multiplyScalar(0.6) },
    };
    const U = this.uni;
    this.tubeMat = this.own(new THREE.MeshStandardMaterial({ color: '#48445e', roughness: 0.22, metalness: 0.5, envMapIntensity: 1.2 }));
    this.tubeMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vRailU;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRailU = uv.x;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vRailU;\nuniform float railOn, railTime, railLen;\nuniform vec3 railCol, railIdle;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float railLit = step(vRailU, railOn);
          diffuseColor.rgb = mix(diffuseColor.rgb, railCol * 0.55, railLit);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float d = vRailU * railLen;
            float stripe = smoothstep(0.55, 1.0, fract(d * 0.7 - railTime * 2.4));
            float front = exp(-abs(vRailU - railOn) * railLen * 1.2) * step(railOn, 0.999);
            totalEmissiveRadiance += railCol * (railLit * (0.9 + stripe * 1.8) + front * 5.0);
            totalEmissiveRadiance += railIdle * (1.0 - railLit) * (0.12 + 0.12 * sin(railTime * 3.0 - d * 0.8));
          }`);
    };
    this.tubeMat.customProgramCacheKey = () => 'stage-ink-rail';
    this.tube = new THREE.Mesh(tubeG, this.tubeMat);
    this.tube.castShadow = true;
    this.group.add(this.tube);
    // glass sleeve that glows once charged
    this.sleeveMat = this.own(glowMat(this.heroCol, 1.2, { additive: true, opacity: 0.0, side: THREE.DoubleSide }));
    this.sleeve = new THREE.Mesh(this.own(new THREE.TubeGeometry(this.curve, Math.max(16, Math.ceil(this.length * 3)), 0.17, 10, false)), this.sleeveMat);
    this.sleeve.renderOrder = 3;
    this.group.add(this.sleeve);

    // ---- supports every ~5 m down to the ground ----
    const steel = mat('rail-steel', () => rimMat('#2c3048', { roughness: 0.45, metalness: 0.55, rim: 0.2 }));
    const light = mat('rail-light', () => rimMat('#cfd3e0', { roughness: 0.35, metalness: 0.4, rim: 0.2 }));
    const postG = geo('rail-post', () => new THREE.CylinderGeometry(0.055, 0.08, 1, 8).translate(0, 0.5, 0));
    const footG = geo('rail-foot', () => new THREE.CylinderGeometry(0.2, 0.26, 0.1, 8));
    const clampG = geo('rail-clamp', () => new THREE.TorusGeometry(0.13, 0.035, 6, 14));
    const count = Math.max(2, Math.round(this.length / 5) + 1);
    for (let i = 0; i < count; i++) {
      const s = i / (count - 1);
      const u = clamp(s, 0.02, 0.98);
      this.curve.getPointAt(u, _v);
      this.curve.getTangentAt(u, _t);
      const cl = new THREE.Mesh(clampG, light);
      cl.position.copy(_v);
      cl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _t);
      this.group.add(cl);
      const g = session.level.raycast(_w.copy(_v).setY(_v.y - 0.2), DOWN, 16, { staticOnly: true });
      if (g && _v.y - g.point.y > 0.5) {
        const h = _v.y - 0.13 - g.point.y;
        const post = new THREE.Mesh(postG, steel);
        post.position.copy(g.point);
        post.scale.y = h;
        post.castShadow = true;
        const foot = new THREE.Mesh(footG, steel);
        foot.position.copy(g.point).setY(g.point.y + 0.05);
        this.group.add(post, foot);
      }
    }

    // ---- start node (shoot it) and end cap ----
    this.curve.getPointAt(0, _v); this.curve.getTangentAt(0, _t);
    this.nodePos = new THREE.Vector3().copy(_v).addScaledVector(_t, -0.28);
    const node = new THREE.Group();
    node.position.copy(this.nodePos);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _t);
    const housing = new THREE.Mesh(geo('rail-housing', () => new THREE.CylinderGeometry(0.22, 0.3, 0.4, 12).rotateX(Math.PI / 2)), steel);
    housing.position.z = 0.1;
    housing.castShadow = true;
    this.orbMat = this.own(rimMat('#ffffff', { roughness: 0.15, rim: 0.8, emissive: this.murkCol, emissiveIntensity: 0.8, env: 1.5 }));
    this.orb = new THREE.Mesh(geo('rail-orb', () => new THREE.SphereGeometry(0.26, 18, 14)), this.orbMat);
    this.orb.position.z = -0.12;
    this.gyroMat = this.own(glowMat(this.murkCol, 2.2));
    this.gyro1 = new THREE.Mesh(geo('rail-gyro', () => new THREE.TorusGeometry(0.4, 0.025, 6, 32)), this.gyroMat);
    this.gyro2 = new THREE.Mesh(geo('rail-gyro', () => new THREE.TorusGeometry(0.4, 0.025, 6, 32)), this.gyroMat);
    this.gyro1.position.z = this.gyro2.position.z = -0.12;
    node.add(housing, this.orb, this.gyro1, this.gyro2);
    this.nodeGlow = makeGlowSprite(this.murkCol, 1.4, 0.5);
    this.own(this.nodeGlow.material);
    this.nodeGlow.position.z = -0.12;
    node.add(this.nodeGlow);
    this.group.add(node);
    this.node = node;
    this.curve.getPointAt(1, _v);
    const cap = new THREE.Mesh(geo('rail-cap', () => new THREE.SphereGeometry(0.15, 12, 10)), light);
    cap.position.copy(_v);
    this.group.add(cap);

    this.proxy = new HitProxy(session, { radius: 0.5, height: 0.4, onHit: (amt, info) => this._onNodeHit(info) });
    node.getWorldPosition(this.proxy.center);
    this.proxy.position.copy(this.proxy.center);

    if (def.active) this.activate(true);
    this._off = onSpec(session, def.activeOn, () => this.activate());
  }

  _onNodeHit(info) {
    if (info.team !== TEAM_HERO) return false;
    const S = this.session;
    S.audio?.sfx('rail_hit', { pos: this.nodePos, volume: 0.6 });
    S.fx.burst(this.nodePos, UP, this.heroCol, 8, 3.5, { size: 0.05 });
    if (!this.active) this.activate();
  }

  activate(instant = false) {
    if (this.active) return;
    this.active = true;
    this.onT = instant ? 1 : 0;
    const S = this.session;
    this.orbMat.emissive.copy(this.heroCol);
    this.gyroMat.color.copy(this.heroCol).multiplyScalar(2.4);
    this.nodeGlow.material.color.copy(this.heroCol);
    if (!instant) {
      S.audio?.sfx('rail_on', { pos: this.nodePos, volume: 0.8 });
      S.fx.burst(this.nodePos, UP, this.heroCol, 24, 6, { size: 0.07 });
      S.fx.ring(this.nodePos, UP, this.heroCol, 1.6, 0.4);
      S.hud?.hint?.('Rail charged! Touch it in squid form ({swim}) to ride.', 3);
    }
    S.events.emit('railActivated', { id: this.id });
  }

  _sample(s, out, tan) {
    const N = this.N, L = this.length;
    const f = clamp(s / L, 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(f)), k = f - i;
    const a = i * 3, b = a + 3, l = this.lut;
    out.set(l[a] + (l[b] - l[a]) * k, l[a + 1] + (l[b + 1] - l[a + 1]) * k, l[a + 2] + (l[b + 2] - l[a + 2]) * k);
    if (tan) tan.set(l[b] - l[a], l[b + 1] - l[a + 1], l[b + 2] - l[a + 2]).normalize();
    return out;
  }

  step(dt) {
    this.t += dt;
    if (this.active && this.onT < 1) this.onT = Math.min(1, this.onT + dt * 26 / Math.max(4, this.length));
    this.cooldown = Math.max(0, this.cooldown - dt);
    const S = this.session, p = S.player;
    if (this.riding) { this._ride(dt); return; }
    if (!this.active || this.onT < 0.3 || this.cooldown > 0 || !p.alive || p.frozen || p.form !== 'squid') return;
    _c.copy(p.position).setY(p.position.y + 0.25);
    if (!this.bbox.containsPoint(_c)) return;
    // nearest LUT point
    const l = this.lut;
    let best = Infinity, bi = 0;
    for (let i = 0; i <= this.N; i++) {
      const dx = l[i * 3] - _c.x, dy = l[i * 3 + 1] - _c.y, dz = l[i * 3 + 2] - _c.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best) { best = d2; bi = i; }
    }
    if (best > 0.9 * 0.9) return;
    const s = (bi / this.N) * this.length;
    if (s / this.length > this.onT) return;           // not charged that far yet
    this._sample(s, _v, _t);
    const along = p.velocity.dot(_t);
    const dir = along < -1.5 || bi === this.N ? -1 : 1;
    if ((dir > 0 && bi >= this.N - 1) || (dir < 0 && bi <= 1)) return;
    this.riding = { s, dir, vy: 0, t: 0 };
    S.audio?.sfx('rail_ride', { volume: 0.6 });
    S.audio?.sfx('splash', { volume: 0.4, pitch: 1.3 });
    S.fx.burst(_v, UP, this.heroCol, 12, 4, { size: 0.06 });
    S.events.emit('railRide', { id: this.id });
  }

  _ride(dt) {
    const S = this.session, p = S.player, r = this.riding;
    r.t += dt;
    // the player's own jump (grounded near the rail) already consumed the press → honour it
    const jumped = p.velocity.y > r.vy + 3.5;
    if (!p.alive || p.frozen) { this._detach(0, false); return; }
    if (p.jumpBuffer > 0 || jumped) { p.jumpBuffer = 0; this._detach(9.5, true); return; }
    if (p.form !== 'squid') { this._detach(2, false); return; }
    const sp = Math.min(this.speed, 6 + r.t * 40);        // quick spin-up
    r.s += r.dir * sp * dt;
    if (r.s <= 0 || r.s >= this.length) {
      r.s = clamp(r.s, 0, this.length);
      this._detach(3.5, true, true);
      return;
    }
    this._sample(r.s, _v, _t);
    p.position.copy(_v).setY(_v.y + 0.07);
    p.velocity.copy(_t).multiplyScalar(r.dir * sp);
    r.vy = p.velocity.y;
    p.yaw = Math.atan2(p.velocity.x, p.velocity.z);
    p.grounded = false;
  }

  _detach(up, withMomentum, end = false) {
    const S = this.session, p = S.player, r = this.riding;
    this.riding = null;
    this.cooldown = 0.45;
    if (withMomentum) {
      this._sample(r.s, _v, _t);
      p.velocity.copy(_t).multiplyScalar(r.dir * this.speed * (end ? 1 : 0.85));
      p.velocity.y = Math.max(p.velocity.y, 0) + up;
      S.audio?.sfx(end ? 'whoosh' : 'jump', { volume: 0.5, pitch: 1.2 });
      S.fx.burst(p.position, UP, this.heroCol, 14, 5, { size: 0.06 });
      S.fx.ring(p.position, _t, this.heroCol, 1.2, 0.3);
    } else {
      p.velocity.multiplyScalar(0.5);
    }
  }

  get ridingPlayer() { return !!this.riding; }

  render(dt) {
    const t = this.t;
    const U = this.uni;
    U.railTime.value = t;
    U.railOn.value = this.active ? this.onT * 1.001 : 0;
    this.sleeveMat.opacity = this.active ? this.onT * (0.16 + Math.sin(t * 4) * 0.04) + (this.riding ? 0.12 : 0) : 0;
    this.sleeve.visible = this.sleeveMat.opacity > 0.01;
    // node: spinning gyros, pulsing "shoot me" glow while idle
    this.gyro1.rotation.set(t * 2.1, t * 1.3, 0);
    this.gyro2.rotation.set(-t * 1.4, 0, t * 2.4);
    const pulse = this.active ? 0.6 : 0.5 + 0.5 * Math.sin(t * 5);
    this.nodeGlow.scale.setScalar(1.1 + pulse * 0.6);
    this.nodeGlow.material.opacity = 0.35 + pulse * 0.35;
    this.orbMat.emissiveIntensity = this.active ? 1.4 : 0.35 + pulse * 0.7;
    if (this.riding) {
      const S = this.session, p = S.player;
      this._fxT = (this._fxT || 0) - dt;
      _w.copy(p.velocity).multiplyScalar(-0.12);
      _w.y += 1.5;
      S.fx.spray(p.position, _w, this.heroCol, 2, 2, { size: 0.05, life: 0.35 });
      if (this._fxT <= 0) {
        this._fxT = 0.08;
        _t.copy(p.velocity).normalize();
        S.fx.ring(_v.copy(p.position).setY(p.position.y + 0.1), _t, this.heroCol, 0.7, 0.25);
        S.audio?.sfx('rail_ride', { volume: 0.25, pitch: 1 + Math.random() * 0.1, throttle: 0.22 });
      }
      // camera eases toward the ride direction
      const want = Math.atan2(-p.velocity.x, -p.velocity.z);
      let d = ((want - S.camRig.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      if (Math.hypot(p.velocity.x, p.velocity.z) > 3) S.camRig.yaw += d * Math.min(1, dt * 1.2);
    }
  }

  dispose() {
    this.proxy.dispose();
    this._off?.();
    super.dispose();
  }
}

registerEntity('ink-rail', (s, d) => new InkRail(s, d));
