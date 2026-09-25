// Bounce pad: step or land on it and it squashes, then fires you upward.
//   { type: 'spring', pos, yaw?, power?: 16, push?: 0 (m/s along yaw), color? }
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import { geo, mat, rimMat, glowMat, canvasTex, TEAM_HERO, UP, playerOffset } from './common.js';

const BASE_H = 0.08, COIL_H = 0.15, PAD_H = 0.08, R = 0.66;
const _o = { h2: 0, dy: 0 };
const _v = new THREE.Vector3();

function padTex() {
  return canvasTex('spring-top', 256, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.translate(w / 2, h / 2);
    x.strokeStyle = '#1b1838'; x.lineWidth = 10;
    x.beginPath(); x.arc(0, 0, 112, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#1b1838';
    for (let i = 0; i < 2; i++) {
      x.beginPath();
      x.moveTo(-58, 30 - i * 56); x.lineTo(0, -22 - i * 56); x.lineTo(58, 30 - i * 56);
      x.lineTo(58, 56 - i * 56); x.lineTo(0, 6 - i * 56); x.lineTo(-58, 56 - i * 56); x.closePath(); x.fill();
    }
  });
}

function coilGeometry() {
  return geo('spring-coil', () => {
    const pts = [];
    const turns = 3.5, n = 64;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.46, t, Math.sin(a) * 0.46));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.045, 6, false);
  });
}

class Spring extends Entity {
  constructor(session, def) {
    super(session, def);
    this.power = def.power ?? 16;
    this.push = def.push ?? 0;
    this.t = 0;
    this.cool = 0;
    this.comp = 0;          // compression spring state (visual)
    this.compV = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    const g = this.group;
    const dark = mat('spring-dark', () => rimMat('#20233a', { roughness: 0.45, metalness: 0.5, rim: 0.15 }));
    const chrome = mat('spring-chrome', () => rimMat('#e6e9f2', { roughness: 0.18, metalness: 0.85, rim: 0.35, env: 1.5 }));
    const base = new THREE.Mesh(geo('spring-base', () => new THREE.CylinderGeometry(R + 0.06, R + 0.12, BASE_H, 28)), dark);
    base.position.y = BASE_H / 2;
    base.receiveShadow = true; base.castShadow = true;
    this.coil = new THREE.Mesh(coilGeometry(), chrome);
    this.coil.position.y = BASE_H;
    this.coil.scale.y = COIL_H;
    this.coil.castShadow = true;
    const color = new THREE.Color(def.color || '#ffd23f');
    this.topMat = this.own(rimMat(color, { map: padTex(), roughness: 0.35, rim: 0.35, emissive: color, emissiveIntensity: 0.08 }));
    this.sideMat = this.own(rimMat(color, { roughness: 0.4, rim: 0.3 }));
    this.pad = new THREE.Mesh(geo('spring-pad', () => new THREE.CylinderGeometry(R, R, PAD_H, 28)), [this.sideMat, this.topMat, this.sideMat]);
    this.pad.castShadow = true; this.pad.receiveShadow = true;
    this.ringMat = this.own(glowMat(this.heroCol, 1.8));
    this.ring = new THREE.Mesh(geo('spring-ring', () => new THREE.TorusGeometry(R + 0.02, 0.025, 6, 32)), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    g.add(base, this.coil, this.pad, this.ring);
    this._layout();
  }

  _layout() {
    const c = Math.max(-0.7, Math.min(1.6, this.comp));
    this.coil.scale.y = COIL_H * (1 - c * 0.75);
    this.coil.scale.x = this.coil.scale.z = 1 + Math.max(0, c) * 0.08;
    const top = BASE_H + this.coil.scale.y;
    this.pad.position.y = top + PAD_H / 2;
    this.ring.position.y = top + PAD_H * 0.5;
    this.pad.scale.set(1 + Math.max(0, c) * 0.1, 1 - Math.max(0, c) * 0.25, 1 + Math.max(0, c) * 0.1);
  }

  get top() { return BASE_H + COIL_H + PAD_H; }

  step(dt) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    const S = this.session, p = S.player;
    if (this.cool > 0 || !p.alive || p.frozen) return;
    playerOffset(S, this.position, _o);
    if (_o.h2 > (R + 0.15) ** 2) return;
    const rel = _o.dy - this.top;
    if (rel < -this.top - 0.2 || rel > 0.45 || p.velocity.y > 1.5) return;
    // boing
    this.cool = 0.35;
    p.velocity.y = this.power;
    if (this.push) {
      const yaw = this.group.rotation.y;
      p.velocity.x += Math.sin(yaw) * this.push;
      p.velocity.z += Math.cos(yaw) * this.push;
    }
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.position.y = Math.max(p.position.y, this.position.y + this.top);
    this.comp = 1.2;
    this.compV = -18;
    _v.copy(this.position).setY(this.position.y + this.top);
    S.audio?.sfx('spring', { pos: _v, volume: 0.8 });
    S.fx.ring(_v, UP, this.heroCol, 1.8, 0.35);
    S.fx.ring(_v, UP, '#ffffff', 1.1, 0.25);
    S.fx.burst(_v, UP, this.heroCol, 10, 5, { size: 0.06, spread: 0.5 });
    S.fx.puff(_v, '#ffffff', 0.6, 0.3, null, 2, 0.35);
    S.events.emit('spring', { id: this.id });
  }

  render(dt) {
    this.t += 0;
    // damped oscillation: compressed → overshoot up → settle
    this.compV += (-160 * this.comp - 9 * this.compV) * dt;
    this.comp += this.compV * dt;
    this._layout();
    const k = 1.4 + Math.sin(this.t * 3) * 0.4 + Math.max(0, -this.comp) * 3;
    this.ringMat.color.copy(this.heroCol).multiplyScalar(k);
  }
}

registerEntity('spring', (s, d) => new Spring(s, d));
