// Shoot-to-activate switch and the heavy roller-shutter gate it opens.
//   { type: 'switch', pos, yaw?, id?, targets:['gateId'], timer?: seconds, toggle?: false }
//   { type: 'gate', pos, yaw?, id, size:[w,h,d], openOn?: 'switch' | 'switch:<id>' | 'group:<g>' | 'event:<name>',
//     closeOn?: 'event:<name>', open?: false, dir?: 'up'|'down', color? }
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import {
  PropActor, geo, mat, rimMat, glowMat, canvasTex, makeGlowSprite, boxCollider, onSpec, drawMurkEmblem, drawSquidEmblem,
  TEAM_HERO, TEAM_MURK, UP, clamp, easeOutBack,
} from './common.js';

const _v = new THREE.Vector3();
const HEAD_Y = 1.85;

/** Target faces drawn in the live palette: front = Murk bullseye, back = hero disc with a check. */
function targetTex(kind, color) {
  const c = '#' + color.getHexString();
  return canvasTex('switch-face-' + kind + c, 256, 256, (x, w, h) => {
    x.translate(w / 2, h / 2);
    if (kind === 'murk') {
      const rings = [c, '#ffffff', c, '#ffffff', c];
      for (let i = 0; i < rings.length; i++) {
        x.fillStyle = rings[i];
        x.beginPath(); x.arc(0, 0, 128 - i * 22, 0, Math.PI * 2); x.fill();
      }
      drawMurkEmblem(x, 0, 0, 30, '#ffffff', '#1d1838');
    } else {
      x.fillStyle = c; x.beginPath(); x.arc(0, 0, 128, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 12;
      x.beginPath(); x.arc(0, 0, 104, 0, Math.PI * 2); x.stroke();
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.strokeStyle = 'rgba(20,16,50,0.35)'; x.lineWidth = 34;
      x.beginPath(); x.moveTo(-52, 6); x.lineTo(-14, 46); x.lineTo(58, -40); x.stroke();
      x.strokeStyle = '#ffffff'; x.lineWidth = 26;
      x.beginPath(); x.moveTo(-54, 0); x.lineTo(-16, 40); x.lineTo(56, -46); x.stroke();
      drawSquidEmblem(x, 70, 62, 16, '#ffffff', c);
    }
  });
}

class Switch extends PropActor {
  constructor(session, def) {
    super(session, def, { hp: 1, hitRadius: 0.5, hitHeight: 0.5 });
    this.bodyRadius = 0.4;        // session._separate keeps the player just outside the base
    this.on = false;
    this.t = 0;
    this.flipT = -1;
    this.timerT = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this.murkCol = session.ink.color(TEAM_MURK).clone();
    const g = this.group;
    const steel = mat('sw-steel', () => rimMat('#2c3150', { roughness: 0.4, metalness: 0.5, rim: 0.2 }));
    const white = mat('sw-white', () => rimMat('#eceaf4', { roughness: 0.32, rim: 0.2 }));
    const hazard = mat('sw-hazard', () => rimMat('#ffffff', { map: hazardTex(), roughness: 0.5, rim: 0.15 }));
    const add = (m, y) => { m.position.y = y; m.castShadow = true; g.add(m); return m; };
    add(new THREE.Mesh(geo('sw-base', () => new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8)), steel), 0.09);
    const postH = HEAD_Y - 0.6 - 0.18;         // ends inside the yoke, below the plate
    add(new THREE.Mesh(geo('sw-post2', () => new THREE.CylinderGeometry(0.06, 0.075, postH, 10)), white), 0.18 + postH / 2);
    add(new THREE.Mesh(geo('sw-band', () => new THREE.CylinderGeometry(0.085, 0.085, 0.3, 10)), hazard), 0.55);
    // head: ring frame + flip plate (front = Murk bullseye, back = hero squid)
    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y;
    g.add(this.head);
    const frame = new THREE.Mesh(geo('sw-frame', () => new THREE.TorusGeometry(0.46, 0.06, 10, 36)), steel);
    frame.castShadow = true;
    const yoke = new THREE.Mesh(geo('sw-yoke', () => new THREE.BoxGeometry(0.1, 0.22, 0.1)), steel);
    yoke.position.y = -0.52;
    this.head.add(frame, yoke);
    this.faceFront = this.own(rimMat('#ffffff', { map: targetTex('murk', this.murkCol), roughness: 0.35, rim: 0.3, emissive: this.murkCol, emissiveIntensity: 0.25 }));
    this.faceBack = this.own(rimMat('#ffffff', { map: targetTex('hero', this.heroCol), roughness: 0.35, rim: 0.3, emissive: this.heroCol, emissiveIntensity: 0.25 }));
    // plate = rim + two upright faces (front +Z, back −Z) so the art is never rotated or mirrored
    this.plate = new THREE.Group();
    const rimP = new THREE.Mesh(geo('sw-plate-rim', () => new THREE.CylinderGeometry(0.4, 0.4, 0.07, 36, 1, true).rotateX(Math.PI / 2)), white);
    rimP.castShadow = true;
    const faceG = geo('sw-face', () => new THREE.CircleGeometry(0.4, 36));
    const front = new THREE.Mesh(faceG, this.faceFront);
    front.position.z = 0.035;
    const back = new THREE.Mesh(faceG, this.faceBack);
    back.position.z = -0.035;
    back.rotation.y = Math.PI;
    this.plate.add(rimP, front, back);
    this.head.add(this.plate);
    this.lampMat = this.own(glowMat(this.murkCol, 2.2));
    this.lamp = new THREE.Mesh(geo('sw-lamp', () => new THREE.SphereGeometry(0.075, 10, 8)), this.lampMat);
    this.lamp.position.y = 0.58;
    this.head.add(this.lamp);
    this.glow = makeGlowSprite(this.murkCol, 1.5, 0.3);
    this.own(this.glow.material);
    this.head.add(this.glow);
    g.updateMatrixWorld(true);
  }

  hitCenter(out) { return out.set(this.position.x, this.position.y + HEAD_Y, this.position.z); }

  damage(amount, info = {}) {
    if (info.team === TEAM_MURK || !this.alive) return false;
    this.flashT = 0.12;
    this.wob = 1;
    const S = this.session;
    this.hitCenter(_v);
    S.fx.burst(_v, UP, this.heroCol, 6, 3, { size: 0.05 });
    // toggles ignore hits while the plate is still flipping, so an automatic weapon's stream of
    // shots doesn't flicker the switch (and its gates) on/off every frame
    const ready = !this.def.toggle || this.t - (this.flipAt ?? -9) > 0.9;   // 0.9 s = one plate flip
    if (!this.on) { if (ready) this.activate(info.source); } else if (this.def.toggle && ready) this.deactivate();
    return true;
  }

  activate(by) {
    if (this.on) return;
    this.on = true;
    this.flipT = 0;
    this.flipAt = this.t;
    this.flipFrom = this.plate.rotation.y;
    this.flipTo = Math.PI * 3;
    this.timerT = this.def.timer || 0;
    const S = this.session;
    this.hitCenter(_v);
    S.audio?.sfx('ding', { pos: _v, volume: 0.9 });
    S.audio?.sfx('switch_on', { pos: _v, volume: 0.6 });
    S.fx.burst(_v, UP, this.heroCol, 22, 6, { size: 0.07 });
    S.fx.ring(_v, UP, this.heroCol, 1.8, 0.4);
    this.lampMat.color.copy(this.heroCol).multiplyScalar(2.4);
    this.glow.material.color.copy(this.heroCol);
    const id = this.id;
    S.events.emit('switch', id);
    if (id) S.events.emit('switch:' + id, { id, by });
    for (const t of this.def.targets || []) {
      const e = S.entity(t);
      if (!e) continue;
      if (this.def.toggle) e.toggle?.(); else e.open?.();
    }
  }

  deactivate() {
    if (!this.on) return;
    this.on = false;
    this.flipT = 0;
    this.flipAt = this.t;
    this.flipFrom = this.plate.rotation.y;
    this.flipTo = this.plate.rotation.y + Math.PI;
    const S = this.session;
    S.audio?.sfx('switch_off', { pos: this.position, volume: 0.6 });
    this.lampMat.color.copy(this.murkCol).multiplyScalar(2.2);
    this.glow.material.color.copy(this.murkCol);
    S.events.emit('switchOff', this.id);
    // toggle switches flip their targets on every hit; timed switches shut them again
    for (const t of this.def.targets || []) { const e = S.entity(t); if (this.def.toggle) e?.toggle?.(); else e?.close?.(); }
  }

  step(dt) {
    this.t += dt;
    if (this.on && this.timerT > 0) {
      const before = this.timerT;
      this.timerT -= dt;
      if (this.timerT < 3 && Math.floor(before * 2) !== Math.floor(this.timerT * 2)) this.session.audio?.sfx('clack', { pos: this.position, volume: 0.5 });
      if (this.timerT <= 0) this.deactivate();
    }
  }

  render(dt) {
    const t = this.t;
    if (this.flipT >= 0) {
      this.flipT += dt;
      const k = clamp(this.flipT / 0.9, 0, 1);
      this.plate.rotation.y = this.flipFrom + (this.flipTo - this.flipFrom) * easeOutBack(k, 1.3);
      if (k >= 1) { this.flipT = -1; this.plate.rotation.y = this.flipTo % (Math.PI * 2); }
    }
    this.wob = Math.max(0, (this.wob || 0) - dt * 4);
    this.head.rotation.z = Math.sin(t * 30) * 0.12 * this.wob;
    this.head.rotation.x = Math.sin(t * 24) * 0.08 * this.wob;
    const pulse = this.on ? 0.8 : 0.5 + 0.5 * Math.sin(t * 4.2);
    this.glow.material.opacity = 0.2 + pulse * 0.3;
    this.faceFront.emissiveIntensity = 0.15 + pulse * 0.25;
    if (this.on && this.timerT > 0 && this.timerT < 3) this.lamp.visible = Math.sin(t * 20) > 0; else this.lamp.visible = true;
  }
}

function hazardTex() {
  return canvasTex('hazard', 128, 128, (x, w, h) => {
    x.fillStyle = '#ffc21a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1c1c28';
    for (let i = -2; i < 6; i++) {
      x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + h, h); x.lineTo(i * 32 + h, h); x.fill();
    }
  }, { repeat: true });
}

function shutterTex() {
  return canvasTex('gate-shutter', 128, 256, (x, w, h) => {
    const slat = 32;
    for (let y = 0; y < h; y += slat) {
      const g = x.createLinearGradient(0, y, 0, y + slat);
      g.addColorStop(0, '#f2f3f7'); g.addColorStop(0.45, '#c3c7d2'); g.addColorStop(0.8, '#8d93a3'); g.addColorStop(1, '#5d6272');
      x.fillStyle = g; x.fillRect(0, y, w, slat);
    }
    x.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1);
  }, { repeat: true });
}

class Gate extends Entity {
  constructor(session, def) {
    super(session, def);
    const [w, h, d] = def.size || [4, 3.2, 0.5];
    this.w = w; this.h = h; this.d = d;
    this.dir = def.dir === 'down' ? 'down' : 'up';
    this.openAmt = def.open ? 1 : 0;
    this.target = this.openAmt;
    this.openTime = def.openTime ?? 1.1;
    this.t = 0;
    this.moving = false;
    const g = this.group;
    const steel = mat('gate-steel', () => rimMat('#3a3f58', { roughness: 0.42, metalness: 0.55, rim: 0.2 }));
    const dark = mat('gate-dark', () => rimMat('#1f2233', { roughness: 0.5, metalness: 0.45, rim: 0.12 }));
    const hazard = mat('gate-hazard', () => rimMat('#ffffff', { map: hazardTex(), roughness: 0.55, rim: 0.15 }));
    const pw = 0.5, pd = d + 0.35;
    // frame: pillars with hazard faces, lintel housing with the roll drum
    const pillarG = this.own(new THREE.BoxGeometry(pw, h + 0.7, pd));
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(pillarG, steel);
      p.position.set(sx * (w / 2 + pw / 2), (h + 0.7) / 2, 0);
      p.castShadow = true; p.receiveShadow = true;
      const hz = new THREE.Mesh(geo('gate-hz', () => new THREE.PlaneGeometry(1, 1)), hazard);
      hz.scale.set(pw * 0.7, h * 0.85, 1);
      hz.position.set(sx * (w / 2 + pw / 2), h * 0.45, pd / 2 + 0.005);
      const hzb = hz.clone(); hzb.position.z = -pd / 2 - 0.005; hzb.rotation.y = Math.PI;
      g.add(p, hz, hzb);
    }
    const lintel = new THREE.Mesh(this.own(new THREE.BoxGeometry(w + pw * 2 + 0.2, 0.75, pd + 0.1)), dark);
    lintel.position.y = h + 0.7 - 0.375 + 0.02;
    lintel.castShadow = true;
    const stripe = new THREE.Mesh(geo('gate-hz', () => new THREE.PlaneGeometry(1, 1)), hazard);
    stripe.scale.set(w + pw * 2, 0.16, 1);
    stripe.position.set(0, h + 0.1, pd / 2 + 0.06);
    g.add(lintel, stripe);
    // warning beacons
    this.beaconMat = this.own(glowMat('#ffae1f', 1.2));
    this.beacons = [];
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(geo('gate-beacon', () => new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.beaconMat);
      b.position.set(sx * (w / 2 + pw / 2), h + 0.72, 0);
      const cap = new THREE.Mesh(geo('gate-beacon-base', () => new THREE.CylinderGeometry(0.15, 0.17, 0.08, 12)), dark);
      cap.position.copy(b.position).setY(b.position.y - 0.02);
      g.add(b, cap);
      this.beacons.push(b);
    }
    // the shutter (visual scales up into the housing; collider slides rigidly)
    const tex = shutterTex().clone();
    tex.repeat.set(1, h / 1.4);
    this.own(tex);
    this.shutterTex = tex;
    this.shutterMat = this.own(rimMat(def.color || '#b9bfcf', { map: tex, roughness: 0.38, metalness: 0.6, rim: 0.18 }));
    this.panel = new THREE.Mesh(this.own(new THREE.BoxGeometry(w, h, 0.14).translate(0, -h / 2, 0)), this.shutterMat);
    this.panel.castShadow = true; this.panel.receiveShadow = true;
    this.bottomBar = new THREE.Mesh(this.own(new THREE.BoxGeometry(w, 0.18, 0.2)), hazard);
    this.bottomBar.castShadow = true;
    g.add(this.panel, this.bottomBar);
    // emblem on the shutter (Murk-owned doors)
    this.col = boxCollider(w, h, d, true);
    g.add(this.col);
    this._layout();
    g.updateMatrixWorld(true);
    const L = session.level;
    this.dyn = L.addDynamic(this.col, { owner: this, tag: 'gate' });
    this.dyn.enabled = this.openAmt < 0.999;
    // pillar colliders
    this.pillarCols = [];
    for (const sx of [-1, 1]) {
      const c = boxCollider(pw, h + 0.7, pd);
      c.position.x = sx * (w / 2 + pw / 2);
      g.add(c);
      g.updateMatrixWorld(true);
      this.pillarCols.push(L.addDynamic(c, { owner: {}, tag: 'gate-frame' }));
    }
    this.offs = [];
    const openSpec = def.openOn && def.openOn !== 'switch' ? def.openOn : null;
    const o1 = onSpec(session, openSpec, () => this.open());
    const o2 = onSpec(session, def.closeOn, () => this.close());
    if (o1) this.offs.push(o1);
    if (o2) this.offs.push(o2);
  }

  get isOpen() { return this.target > 0.5; }

  _layout() {
    const h = this.h, a = this.openAmt;
    if (this.dir === 'up') {
      // rolls up into the housing: top stays, height shrinks
      const vis = Math.max(0.001, 1 - a);
      this.panel.position.y = h;
      this.panel.scale.y = vis;
      this.shutterTex.repeat.y = (h / 1.4) * vis;   // slats keep their size and slide up into the drum
      this.bottomBar.position.y = h - vis * h + 0.09;
      this.col.position.y = h / 2 + a * h;
    } else {
      this.panel.position.y = h - a * (h + 0.1);
      this.panel.scale.y = 1;
      this.bottomBar.position.y = h - a * (h + 0.1) - h + 0.09;
      this.col.position.y = h / 2 - a * (h + 0.1);
      this.panel.visible = a < 0.999;
    }
    this.bottomBar.visible = !(this.dir === 'down' && a > 0.97);
  }

  open() {
    if (this.target === 1) return;
    this.target = 1;
    this._startMove();
    this.session.events.emit('gateOpened', this.id);
  }

  close() {
    if (this.target === 0) return;
    this.target = 0;
    this.dyn.enabled = true;
    this._startMove();
    this.session.events.emit('gateClosed', this.id);
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  _startMove() {
    const S = this.session;
    this.moving = true;
    _v.copy(this.position).setY(this.position.y + this.h * 0.5);
    S.audio?.sfx('gate_clank', { pos: _v, volume: 0.8 });
    S.audio?.sfx('door', { pos: _v, volume: 0.9 });
    S.shake(this.position, 0.3);
    S.input?.rumble?.(0.3, 0.5, 250);
  }

  step(dt) {
    this.t += dt;
    if (!this.moving) return;
    const sp = dt / this.openTime;
    const before = this.openAmt;
    this.openAmt = this.target > this.openAmt ? Math.min(this.target, this.openAmt + sp) : Math.max(this.target, this.openAmt - sp);
    this._layout();
    this.group.updateMatrixWorld(true);
    if (this.target < this.openAmt || this.target === 0) this._clearDoorway();
    // dust along the bottom edge while it moves
    if (Math.floor(before * 10) !== Math.floor(this.openAmt * 10)) {
      const S = this.session;
      for (let i = 0; i < 3; i++) {
        _v.set((Math.random() - 0.5) * this.w, 0.1, (Math.random() - 0.5) * 0.6).applyAxisAngle(UP, this.group.rotation.y).add(this.position);
        S.fx.puff(_v, '#cfc6b8', 0.7, 0.8, null, 2.2, 0.35);
      }
    }
    if (this.openAmt === this.target) {
      this.moving = false;
      if (this.target === 1) this.dyn.enabled = false;
      this.session.audio?.sfx('gate_clank', { pos: this.position, volume: 0.6 });
      this.session.shake(this.position, 0.15);
    }
  }

  /**
   * A closing shutter must never pin the player inside its collider (capsule resolution would
   * squash them into the floor): anyone standing in the doorway is nudged out to the nearer side.
   */
  _clearDoorway() {
    const p = this.session.player;
    if (!p.alive) return;
    const a = this.openAmt, h = this.h, r = 0.34;
    const bottom = this.dir === 'up' ? a * h : -a * (h + 0.1);
    const top = bottom + h;
    _v.copy(p.position).sub(this.position).applyAxisAngle(UP, -this.group.rotation.y);
    const head = _v.y + (p.form === 'squid' ? 0.5 : 1.4);
    if (Math.abs(_v.x) > this.w / 2 + r || Math.abs(_v.z) > this.d / 2 + r || head < bottom || _v.y > top) return;
    const side = _v.z >= 0 ? 1 : -1;
    _v.z = side * (this.d / 2 + r + 0.04);
    _v.applyAxisAngle(UP, this.group.rotation.y).add(this.position);
    p.position.x = _v.x; p.position.z = _v.z;
    _v.set(0, 0, side).applyAxisAngle(UP, this.group.rotation.y);
    const vn = p.velocity.dot(_v);
    if (vn < 0) p.velocity.addScaledVector(_v, -vn);
  }

  render(dt) {
    const t = this.t;
    const on = this.moving;
    const k = on ? (Math.sin(t * 14) > 0 ? 3.2 : 0.5) : (this.isOpen ? 0.35 : 0.9);
    this.beaconMat.color.set(this.isOpen && !on ? '#4dff9a' : '#ffae1f').multiplyScalar(k);
    for (const b of this.beacons) b.rotation.y += dt * (on ? 10 : 1);
  }

  dispose() {
    for (const o of this.offs) o();
    this.session.level.removeDynamic(this.dyn);
    for (const p of this.pillarCols) this.session.level.removeDynamic(p);
    super.dispose();
  }
}

registerEntity('switch', (s, d) => new Switch(s, d));
registerEntity('gate', (s, d) => new Gate(s, d));
