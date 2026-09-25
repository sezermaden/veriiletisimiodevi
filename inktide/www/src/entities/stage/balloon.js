// Inflatable Murk target balloon on a tether. Pops on any hero hit (splashing ink below); when the
// last balloon of a `group` pops the session emits 'balloons:<group>'.
//   { type: 'balloon', pos, group?, color?, pearls?: 0, move?:[dx,dy,dz], period?: 4, tether?: true }
//   pos = the balloon's centre in the air.
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { PropActor, geo, mat, rimMat, canvasTex, drawMurkEmblem, TEAM_HERO, TEAM_MURK, UP, DOWN, css, hash01 } from './common.js';
import { spawnPearls } from './pickups.js';

const GROUPS = new WeakMap();
const STRING_PTS = 12;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function balloonGeometry() {
  return geo('balloon-body', () => {
    const pts = [[0.05, -0.5], [0.11, -0.44], [0.27, -0.32], [0.41, -0.12], [0.47, 0.06], [0.45, 0.22], [0.36, 0.36], [0.2, 0.46], [0.0, 0.5]];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateY(Math.PI);                    // texture centre (u = 0.5) faces +Z
    return g;
  });
}

function balloonTexture(color) {
  const hex = css(color);
  return canvasTex('balloon-skin:' + hex, 512, 256, (x, w, h) => {
    x.fillStyle = hex; x.fillRect(0, 0, w, h);
    // glossy vertical seams
    x.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) x.fillRect(i * (w / 6), 0, 6, h);
    // emblem, pre-squashed horizontally for the lathe's UV aspect
    for (const cx of [w * 0.5, 0, w]) {        // front, and the back one split across the seam
      x.save();
      x.translate(cx, h * 0.5);
      x.scale(0.72, 1);
      x.fillStyle = 'rgba(20,14,40,0.45)';
      x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.fill();
      drawMurkEmblem(x, 0, 0, 58, '#ffffff', 'rgba(20,14,40,0.35)');
      x.restore();
    }
  });
}

class Balloon extends PropActor {
  constructor(session, def) {
    super(session, def, { hp: 1, hitRadius: 0.55, hitHeight: 0.4 });
    this.t = hash01(this.position.x, this.position.z) * 20;
    this.base = this.position.clone();
    this.cur = this.position.clone();
    this.popped = false;
    this.col = new THREE.Color(def.color || session.ink.color(TEAM_MURK));
    const g = this.group;
    this.body = new THREE.Group();
    g.add(this.body);
    this.skin = this.own(rimMat('#ffffff', { map: balloonTexture(this.col), roughness: 0.18, rim: 0.55, rimColor: '#ffe9ff', env: 1.5, emissive: this.col, emissiveIntensity: 0.08 }));
    const b = new THREE.Mesh(balloonGeometry(), this.skin);
    b.scale.setScalar(1.15);
    b.castShadow = true;
    const knot = new THREE.Mesh(geo('balloon-knot', () => new THREE.ConeGeometry(0.07, 0.12, 8)), this.skin);
    knot.position.y = -0.6;
    this.body.add(b, knot);
    // tether down to a little sandbag anchor
    this.tethered = def.tether !== false;
    if (this.tethered) {
      const hit = session.level.raycast(this.position, DOWN, 30, { staticOnly: true });
      this.anchor = hit ? hit.point.clone() : this.position.clone().setY(this.position.y - 3);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRING_PTS * 3), 3));
      this.own(sg);
      this.string = new THREE.Line(sg, mat('balloon-string', () => new THREE.LineBasicMaterial({ color: '#f4f0ff', transparent: true, opacity: 0.85 })));
      this.string.frustumCulled = false;
      session.scene.add(this.string);
      const bag = new THREE.Mesh(geo('balloon-bag', () => new THREE.CylinderGeometry(0.16, 0.2, 0.2, 10)), mat('balloon-bag', () => rimMat('#8a6a48', { roughness: 0.9, rim: 0.1 })));
      bag.position.copy(this.anchor).sub(this.position).setY(this.anchor.y - this.position.y + 0.1);
      bag.castShadow = true;
      g.add(bag);
      this.bag = bag;
    }
    const grp = def.group;
    if (grp) {
      let m = GROUPS.get(session);
      if (!m) GROUPS.set(session, (m = new Map()));
      m.set(grp, (m.get(grp) || 0) + 1);
    }
  }

  hitCenter(out) { return out.copy(this.cur); }

  damage(amount, info = {}) {
    if (!this.alive || info.team === TEAM_MURK) return;
    super.damage(1, info);
  }

  onDeath() {
    const S = this.session;
    const c = this.cur;
    this.popped = true;
    this.body.visible = false;
    if (this.string) this.string.visible = false;
    S.audio?.sfx('balloon_pop', { pos: c, volume: 0.9 });
    S.fx.burst(c, UP, this.col, 18, 5, { size: 0.1, gravity: 7, spread: 1.6 });
    S.fx.burst(c, UP, '#ffffff', 8, 4, { size: 0.05, gravity: 6 });
    S.fx.explosion(c, UP, S.ink.color(TEAM_HERO), 0.9);
    const hit = S.level.raycast(c, DOWN, 12, { staticOnly: true });
    if (hit) S.ink.paint(hit.point, 1.1, TEAM_HERO, hit.normal, { source: S.player });
    if (this.def.pearls) spawnPearls(S, c, this.def.pearls, { up: 3 });
    const grp = this.def.group;
    if (grp) {
      const m = GROUPS.get(S);
      const left = Math.max(0, (m?.get(grp) || 1) - 1);
      m?.set(grp, left);
      S.events.emit('balloonPopped', { group: grp, left });
      if (left === 0) {
        S.events.emit('balloons:' + grp, { group: grp });
        S.audio?.sfx('ding', { volume: 0.7, pitch: 1.25 });
      }
    }
    this.remove();
  }

  step(dt) {
    this.t += dt;
    const t = this.t, d = this.def;
    this.cur.copy(this.base);
    if (d.move) {
      const k = 0.5 - 0.5 * Math.cos((t / (d.period ?? 4)) * Math.PI * 2);
      this.cur.x += d.move[0] * k; this.cur.y += (d.move[1] || 0) * k; this.cur.z += (d.move[2] || 0) * k;
    }
    this.cur.y += Math.sin(t * 1.6) * 0.14;
    this.cur.x += Math.sin(t * 0.9) * 0.08;
    this.cur.z += Math.cos(t * 0.7) * 0.08;
  }

  render() {
    const t = this.t;
    this.body.position.subVectors(this.cur, this.base);
    this.body.rotation.set(Math.sin(t * 1.1) * 0.1, t * 0.35, Math.cos(t * 0.9) * 0.1);
    this.body.scale.set(1 + Math.sin(t * 3.1) * 0.015, 1 - Math.sin(t * 3.1) * 0.015, 1 + Math.sin(t * 3.1) * 0.015);
    if (this.string) {
      // gentle catenary from the knot to the anchor
      const a = this.string.geometry.attributes.position;
      _v.copy(this.cur).setY(this.cur.y - 0.62 * 1.0);
      _w.copy(this.anchor).setY(this.anchor.y + 0.18);
      for (let i = 0; i < STRING_PTS; i++) {
        const s = i / (STRING_PTS - 1);
        const x = _v.x + (_w.x - _v.x) * s + Math.sin(s * Math.PI) * Math.sin(t * 1.3 + s * 3) * 0.12;
        const y = _v.y + (_w.y - _v.y) * s;
        const z = _v.z + (_w.z - _v.z) * s + Math.sin(s * Math.PI) * Math.cos(t * 1.1 + s * 2) * 0.12;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true;
    }
  }

  dispose() {
    if (this.string) this.session.scene.remove(this.string);
    if (!this.popped && this.def.group) {
      const m = GROUPS.get(this.session);
      if (m) m.set(this.def.group, Math.max(0, (m.get(this.def.group) || 1) - 1));
    }
    super.dispose();
  }
}

registerEntity('balloon', (s, d) => new Balloon(s, d));
