// Squid launch pad: stand on it in squid form and press Jump (or stay submerged for a moment) to
// be launched on a ballistic arc to `target`. The pad shows the arc as a dotted hologram.
//   { type: 'launchpad', pos, target:[x,y,z], height?, time? }
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import {
  geo, mat, rimMat, glowMat, canvasTex, makeGlowSprite, TEAM_HERO, UP, DOWN, clamp, lerp, playerOffset,
} from './common.js';

const PAD_R = 1.3, PAD_TOP = 0.17, DOTS = 22;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _o = { h2: 0, dy: 0 };

function ringsTex() {
  return canvasTex('pad-rings', 256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.translate(w / 2, h / 2);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 7; x.beginPath(); x.arc(0, 0, 118, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 100, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 0.5; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 60, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 1;
    for (let i = 0; i < 24; i++) {
      x.save(); x.rotate((i / 24) * Math.PI * 2);
      x.fillRect(104, -3, i % 2 ? 8 : 12, 6);
      x.restore();
    }
  });
}

function chevronTex() {
  return canvasTex('pad-chevrons', 128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#ffffff'; x.lineWidth = 16; x.lineJoin = 'miter'; x.lineCap = 'butt';
    x.beginPath(); x.moveTo(20, 96); x.lineTo(64, 40); x.lineTo(108, 96); x.stroke();
  }, { repeat: true });
}

function maskTex() {
  return canvasTex('pad-mask', 128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.62, '#ffffff'); g.addColorStop(0.85, '#000000'); g.addColorStop(1, '#000000');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, { linear: true });
}

class Launchpad extends Entity {
  constructor(session, def) {
    super(session, def);
    this.t = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    const g = this.group;
    // target (ground-snapped) and flight direction
    const tgt = def.target ? new THREE.Vector3().fromArray(def.target) : _v.set(0, 3, 10).applyAxisAngle(UP, g.rotation.y).add(this.position).clone();
    const hit = session.level.raycast(_w.copy(tgt).setY(tgt.y + 1.5), DOWN, 4);
    if (hit && hit.normal.y > 0.6) tgt.y = hit.point.y;
    this.target = tgt;
    this.dir = new THREE.Vector3(tgt.x - this.position.x, 0, tgt.z - this.position.z);
    this.hdist = this.dir.length();
    if (this.hdist > 1e-3) this.dir.divideScalar(this.hdist); else this.dir.set(0, 0, 1);
    this.flightYaw = Math.atan2(this.dir.x, this.dir.z);

    // ---- model ----
    const steel = mat('pad-steel', () => rimMat('#23284a', { roughness: 0.4, metalness: 0.5, rim: 0.2 }));
    const white = mat('pad-white', () => rimMat('#eef0f6', { roughness: 0.3, rim: 0.2 }));
    const dark = mat('pad-dark', () => rimMat('#12142a', { roughness: 0.55, rim: 0.05 }));
    const base = new THREE.Mesh(geo('pad-base', () => new THREE.CylinderGeometry(PAD_R, PAD_R + 0.14, 0.16, 36)), steel);
    base.position.y = 0.08; base.receiveShadow = true; base.castShadow = true;
    const rim = new THREE.Mesh(geo('pad-rim', () => new THREE.TorusGeometry(PAD_R, 0.07, 8, 44)), white);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.16; rim.castShadow = true;
    const disc = new THREE.Mesh(geo('pad-disc', () => new THREE.CircleGeometry(PAD_R - 0.04, 40).rotateX(-Math.PI / 2)), dark);
    disc.position.y = 0.162; disc.receiveShadow = true;
    g.add(base, rim, disc);
    this.ringMat = this.own(glowMat(this.heroCol, 1.6, { map: ringsTex(), additive: true, opacity: 0.9 }));
    this.rings = new THREE.Mesh(geo('pad-rings', () => new THREE.PlaneGeometry(2 * PAD_R - 0.1, 2 * PAD_R - 0.1).rotateX(-Math.PI / 2)), this.ringMat);
    this.rings.position.y = 0.168;
    this.rings.renderOrder = 2;
    const chev = chevronTex().clone();
    chev.repeat.set(1, 2.2);
    this.own(chev);
    this.chevTex = chev;
    this.chevMat = this.own(glowMat(this.heroCol, 2.2, { map: chev, additive: true, opacity: 1 }));
    this.chevMat.alphaMap = maskTex();
    this.chev = new THREE.Mesh(geo('pad-chev', () => new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2)), this.chevMat);
    this.chev.position.y = 0.172;
    this.chev.rotation.y = this.flightYaw - g.rotation.y + Math.PI;
    this.chev.renderOrder = 3;
    g.add(this.rings, this.chev);
    // rim studs
    const studMat = this.own(glowMat(this.heroCol, 2.4));
    this.studMat = studMat;
    const studG = geo('pad-stud', () => new THREE.SphereGeometry(0.06, 8, 6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(studG, studMat);
      s.position.set(Math.cos(a) * (PAD_R + 0.06), 0.12, Math.sin(a) * (PAD_R + 0.06));
      g.add(s);
    }
    this.glow = makeGlowSprite(this.heroCol, 2.4, 0.3);
    this.own(this.glow.material);
    this.glow.position.y = 0.5;
    g.add(this.glow);

    // arc hologram (world space; parented to the scene through a helper group)
    this.dotMat = this.own(glowMat(this.heroCol, 2.0, { transparent: true, opacity: 0.85 }));
    this.dots = new THREE.InstancedMesh(geo('pad-dot', () => new THREE.SphereGeometry(0.1, 10, 8)), this.dotMat, DOTS);
    this.dots.frustumCulled = false;
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.own({ dispose: () => this.dots.dispose() });
    this.dotsHolder = new THREE.Group();
    this.dotsHolder.add(this.dots);
    session.scene.add(this.dotsHolder);
    this.dotsShow = 0;
    this.arcStart = new THREE.Vector3().copy(this.position).setY(this.position.y + PAD_TOP + 0.3);
    this.arc = this._solveArc(this.arcStart, this.target, {});

    // paint the floor under the pad so the squid can submerge on it
    session.ink.paint(this.position, PAD_R + 0.2, TEAM_HERO, UP, { source: 'level' });

    this.flight = null;
    this.chargeT = 0;
    this.wasOn = false;
    this.hinted = false;
    g.updateMatrixWorld(true);
  }

  /** Quadratic height profile through y0 (s=0) and y1 (s=1) with apex H0 above y0. */
  _solveArc(start, end, out) {
    const y0 = start.y, y1 = end.y;
    const hd = Math.hypot(end.x - start.x, end.z - start.z);
    const apex = Math.max(y0, y1) + (this.def.height ?? Math.max(2.5, hd * 0.32));
    const H0 = apex - y0, d = y1 - y0;
    const b = -(2 * H0 - d) - 2 * Math.sqrt(Math.max(0, H0 * (H0 - d)));
    out.a = d - b; out.b = b;
    out.y0 = y0;
    out.T = this.def.time ?? clamp(0.75 + hd * 0.045 + H0 * 0.05, 0.9, 2.6);
    out.start = start.clone(); out.end = end.clone();
    return out;
  }

  _arcPoint(arc, s, out) {
    out.x = lerp(arc.start.x, arc.end.x, s);
    out.z = lerp(arc.start.z, arc.end.z, s);
    out.y = arc.y0 + arc.a * s + arc.b * s * s;
    return out;
  }

  step(dt) {
    this.t += dt;
    const S = this.session, p = S.player;
    if (this.flight) { this._fly(dt); return; }
    if (!p.alive || p.frozen) { this.wasOn = false; this.chargeT = 0; return; }
    playerOffset(S, this.position, _o);
    const on = _o.h2 < (PAD_R - 0.1) ** 2 && _o.dy > -0.4 && _o.dy < 0.9;
    const squid = p.form === 'squid';
    if (on && !this.hinted) {
      this.hinted = true;
      if (!squid) S.hud?.hint?.('Hold {swim} and press {jump} to launch!', 3);
    }
    if (!on) this.hinted = false;
    if (on && squid) {
      if (p.jumpBuffer > 0) { p.jumpBuffer = 0; this.launch(); return; }
      if (this.wasOn && p.velocity.y > 3 && !p.grounded) { this.launch(); return; }   // the player's own jump used the press
      if (p.submerged) {
        this.chargeT += dt;
        if (Math.floor(this.chargeT * 8) !== Math.floor((this.chargeT - dt) * 8)) S.audio?.sfx('pad_charge', { level: this.chargeT / 0.55, volume: 0.35 });
        if (this.chargeT > 0.55) { this.launch(); return; }
      } else this.chargeT = Math.max(0, this.chargeT - dt * 2);
    } else this.chargeT = Math.max(0, this.chargeT - dt * 3);
    this.wasOn = on && squid && p.grounded;
  }

  launch() {
    const S = this.session, p = S.player;
    const start = new THREE.Vector3().copy(p.position);
    start.x = lerp(start.x, this.position.x, 0.6);
    start.z = lerp(start.z, this.position.z, 0.6);
    start.y = Math.max(start.y, this.position.y) + 0.1;
    this.flight = { t: 0, arc: this._solveArc(start, this.target, {}), frozeIt: !p.frozen };
    p.frozen = true;
    p.velocity.set(0, 0, 0);
    this.chargeT = 0;
    this.wasOn = false;
    S.audio?.sfx('launch', { volume: 0.8 });
    S.audio?.sfx('whoosh', { volume: 0.5 });
    S.fx.burst(this.position, UP, this.heroCol, 26, 8, { size: 0.08, spread: 0.6 });
    S.fx.ring(_v.copy(this.position).setY(this.position.y + PAD_TOP + 0.02), UP, this.heroCol, 2.6, 0.45);
    S.fx.ring(_v, UP, '#ffffff', 1.6, 0.3);
    S.shake(this.position, 0.25);
    S.input?.rumble?.(0.5, 0.4, 160);
    this.pulse = 1;
    S.events.emit('launch', { id: this.id, target: this.target });
  }

  _fly(dt) {
    const S = this.session, p = S.player, f = this.flight;
    f.t += dt;
    const arc = f.arc;
    const s = Math.min(1, f.t / arc.T);
    this._arcPoint(arc, s, p.position);
    // velocity = d(position)/dt (for animation, camera FOV and landing)
    const vy = (arc.a + 2 * arc.b * s) / arc.T;
    p.velocity.set((arc.end.x - arc.start.x) / arc.T, vy, (arc.end.z - arc.start.z) / arc.T);
    p.yaw = this.flightYaw;
    p.grounded = false;
    if (s >= 1) {
      this.flight = null;
      if (f.frozeIt) p.frozen = false;
      p.position.copy(this.target);
      p.velocity.set(this.dir.x * 1.5, -4, this.dir.z * 1.5);
      S.ink.paint(this.target, 1.5, TEAM_HERO, UP, { source: p });
      S.fx.burst(this.target, UP, this.heroCol, 18, 6, { size: 0.07 });
      S.fx.ring(_v.copy(this.target).setY(this.target.y + 0.03), UP, this.heroCol, 2.2, 0.45);
      S.audio?.sfx('splash', { volume: 0.7 });
      S.shake(this.target, 0.18);
      S.events.emit('launchLanded', { id: this.id });
    }
  }

  render(dt) {
    const t = this.t;
    const S = this.session;
    this.chevTex.offset.y = -t * 1.6;
    const charge = clamp(this.chargeT / 0.55, 0, 1);
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 2.5);
    const k = 1.4 + Math.sin(t * 4) * 0.3 + charge * 2 + this.pulse * 3;
    this.ringMat.color.copy(this.heroCol).multiplyScalar(k);
    this.chevMat.color.copy(this.heroCol).multiplyScalar(1.8 + charge * 2 + this.pulse * 2);
    this.rings.rotation.y += dt * (0.4 + charge * 6);
    this.glow.material.opacity = 0.22 + charge * 0.4 + this.pulse * 0.5;
    this.glow.scale.setScalar(2.2 + charge * 1.2 + this.pulse * 2);
    if (charge > 0.05 && Math.random() < charge * 0.6) {
      const a = Math.random() * Math.PI * 2;
      _v.set(this.position.x + Math.cos(a) * PAD_R * 0.8, this.position.y + PAD_TOP, this.position.z + Math.sin(a) * PAD_R * 0.8);
      S.fx.spray(_v, _w.set(-Math.cos(a) * 1.5, 3, -Math.sin(a) * 1.5), this.heroCol, 1, 0.4, { size: 0.05, life: 0.4, gravity: 0 });
    }

    // arc hologram: visible when the player is near
    const near = S.player.alive && !this.flight && S.player.position.distanceToSquared(this.position) < 11 * 11;
    this.dotsShow += ((near ? 1 : 0) - this.dotsShow) * Math.min(1, dt * 5);
    this.dots.visible = this.dotsShow > 0.02;
    if (this.dots.visible) {
      for (let i = 0; i < DOTS; i++) {
        const s = (i + 1) / (DOTS + 1);
        this._arcPoint(this.arc, s, _v);
        const wave = 0.5 + 0.5 * Math.sin((s * 6 - t * 3) * Math.PI);
        _s.setScalar(this.dotsShow * (0.55 + wave * 0.6) * (i === DOTS - 1 ? 1.6 : 1));
        _m.compose(_v, _q.identity(), _s);
        this.dots.setMatrixAt(i, _m);
      }
      this.dots.instanceMatrix.needsUpdate = true;
    }

    // flight: ink trail + camera swings to look along the arc
    if (this.flight) {
      const p = S.player;
      S.fx.spray(p.position, _w.copy(p.velocity).multiplyScalar(-0.15), this.heroCol, 2, 1.2, { size: 0.07, life: 0.45 });
      if (Math.random() < 0.3) S.fx.puff(p.position, this.heroCol, 0.5, 0.35, _w.set(0, 0, 0), 1.5, 0.4);
      const want = Math.atan2(-this.dir.x, -this.dir.z);
      let d = ((want - S.camRig.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      S.camRig.yaw += d * Math.min(1, dt * 2.5);
    }
  }

  dispose() {
    if (this.flight?.frozeIt) this.session.player.frozen = false;
    this.session.scene.remove(this.dotsHolder);
    super.dispose();
  }
}

registerEntity('launchpad', (s, d) => new Launchpad(s, d));
