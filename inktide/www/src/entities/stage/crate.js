// Breakable wooden crate: solid (you can stand on it), takes ink splotches when hit, bursts into
// planks after `hits` shots (explosions break it at once) and drops pearls.
//   { type: 'crate', pos, yaw?, size:[w,h,d] | number, hits?: 3, pearls?: 2, group? }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { PropActor, geo, mat, rimMat, inkBlobGeometry, canvasTex, boxCollider, TEAM_HERO, UP, hash01 } from './common.js';
import { spawnPearls } from './pickups.js';

const PLANKS = 14;
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);

export function crateTexture() {
  return canvasTex('crate-wood', 256, 256, (x, w, h) => {
    // planks
    const cols = ['#c98d4e', '#bf8246', '#d39a5a', '#c48848'];
    for (let i = 0; i < 5; i++) {
      x.fillStyle = cols[i % cols.length];
      x.fillRect(0, i * (h / 5), w, h / 5);
      x.fillStyle = 'rgba(90,50,20,0.35)';
      x.fillRect(0, i * (h / 5), w, 3);
      for (let k = 0; k < 7; k++) {
        x.strokeStyle = `rgba(110,65,30,${0.12 + Math.random() * 0.12})`;
        x.lineWidth = 1.5;
        x.beginPath();
        const y = i * (h / 5) + 6 + Math.random() * (h / 5 - 12);
        x.moveTo(0, y);
        x.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 8, w * 0.6, y + (Math.random() - 0.5) * 8, w, y + (Math.random() - 0.5) * 6);
        x.stroke();
      }
    }
    // frame + diagonal brace
    const frame = (px, py, pw, ph) => {
      x.fillStyle = '#a5692f'; x.fillRect(px, py, pw, ph);
      x.strokeStyle = 'rgba(60,32,12,0.55)'; x.lineWidth = 3; x.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
    };
    frame(0, 0, w, 30); frame(0, h - 30, w, 30); frame(0, 0, 30, h); frame(w - 30, 0, 30, h);
    x.save();
    x.translate(w / 2, h / 2); x.rotate(-Math.PI / 4);
    x.fillStyle = '#a5692f'; x.fillRect(-w * 0.62, -15, w * 1.24, 30);
    x.strokeStyle = 'rgba(60,32,12,0.55)'; x.lineWidth = 3; x.strokeRect(-w * 0.62, -15, w * 1.24, 30);
    x.restore();
    // nails
    x.fillStyle = '#4a4a55';
    for (const [px, py] of [[15, 15], [w - 15, 15], [15, h - 15], [w - 15, h - 15], [w / 2, 15], [w / 2, h - 15], [15, h / 2], [w - 15, h / 2]]) {
      x.beginPath(); x.arc(px, py, 3.2, 0, Math.PI * 2); x.fill();
    }
  });
}

class Crate extends PropActor {
  constructor(session, def) {
    const sz = typeof def.size === 'number' ? [def.size, def.size, def.size] : (def.size || [1.2, 1.2, 1.2]);
    super(session, def, { hp: def.hits ?? 3, hitRadius: Math.max(sz[0], sz[2]) * 0.55, hitHeight: sz[1] });
    this.sz = sz;
    this.solid = false;           // the box collider blocks the player (the hit circle would not fit a long crate)
    this.t = 0;
    this.wob = 0;
    this.blobs = 0;
    this.breakT = -1;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    const [w, h, d] = sz;
    const g = this.group;
    this.body = new THREE.Group();
    g.add(this.body);
    this.mat = this.own(rimMat('#ffffff', { map: crateTexture(), roughness: 0.78, rim: 0.18 }));
    if (def.color) this.mat.color.set(def.color);
    const box = new THREE.Mesh(geo('crate-box', () => new THREE.BoxGeometry(1, 1, 1)), this.mat);
    box.scale.set(w, h, d);
    box.position.y = h / 2;
    box.castShadow = true; box.receiveShadow = true;
    this.body.add(box);
    // steel corner brackets
    const iron = mat('crate-iron', () => rimMat('#3b3f4f', { roughness: 0.4, metalness: 0.6, rim: 0.15 }));
    const cg = geo('crate-corner', () => new THREE.BoxGeometry(0.16, 0.16, 0.16));
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz2 of [-1, 1]) {
      const c = new THREE.Mesh(cg, iron);
      c.position.set(sx * (w / 2 - 0.05), sy ? h - 0.05 : 0.05, sz2 * (d / 2 - 0.05));
      this.body.add(c);
    }
    this.inkMat = this.own(rimMat(this.heroCol, { roughness: 0.16, rim: 0.4, emissive: this.heroCol, emissiveIntensity: 0.1, env: 1.3 }));

    // planks for the break
    this.planks = new THREE.InstancedMesh(geo('crate-plank', () => new THREE.BoxGeometry(1, 1, 1)), this.mat, PLANKS);
    this.planks.visible = false;
    this.planks.frustumCulled = false;
    this.planks.castShadow = true;
    this.own({ dispose: () => this.planks.dispose() });
    g.add(this.planks);
    this.pd = [];
    for (let i = 0; i < PLANKS; i++) this.pd.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: new THREE.Vector3() });

    this.col = boxCollider(w, h, d);
    g.add(this.col);
    g.updateMatrixWorld(true);
    this.dyn = session.level.addDynamic(this.col, { owner: this, tag: 'crate' });
  }

  damage(amount, info = {}) {
    if (!this.alive) return false;
    const k = info.kind === 'explosion' ? 99 : info.kind === 'splash' ? 2 : 1;
    return super.damage(k, info);
  }

  onDamaged(amount, info) {
    const S = this.session;
    this.wob = 1;
    const c = this.hitCenter(_v);
    S.audio?.sfx('crate_hit', { pos: c, volume: 0.7, throttle: 0.04 });
    if (info.point) S.fx.burst(info.point, info.normal || UP, '#c98d4e', 5, 3, { size: 0.05 });
    if (info.point && this.hp > 0 && info.team === TEAM_HERO) this._blob(info.point, info.normal, info.paint);
  }

  /** Stick a glossy ink splotch on the crate face nearest the hit. */
  _blob(point, normal, paint) {
    if (this.blobs >= 7) return;
    this.blobs++;
    const [w, h, d] = this.sz;
    const loc = this.body.worldToLocal(_v.copy(point));
    // snap to the dominant face
    const ax = Math.abs(loc.x) / (w / 2), ay = Math.abs(loc.y - h / 2) / (h / 2), az = Math.abs(loc.z) / (d / 2);
    if (ax >= ay && ax >= az) { _n.set(Math.sign(loc.x), 0, 0); loc.x = Math.sign(loc.x) * (w / 2 + 0.006); }
    else if (ay >= az) { _n.set(0, Math.sign(loc.y - h / 2), 0); loc.y = loc.y > h / 2 ? h + 0.006 : -0.006; }
    else { _n.set(0, 0, Math.sign(loc.z)); loc.z = Math.sign(loc.z) * (d / 2 + 0.006); }
    loc.x = Math.max(-w / 2 - 0.01, Math.min(w / 2 + 0.01, loc.x));
    loc.z = Math.max(-d / 2 - 0.01, Math.min(d / 2 + 0.01, loc.z));
    const b = new THREE.Mesh(inkBlobGeometry(this.blobs), this.inkMat);
    b.position.copy(loc);
    b.quaternion.setFromUnitVectors(_z, _n);
    b.rotateZ(Math.random() * Math.PI * 2);
    b.scale.setScalar(0.28 + (paint ?? 0.5) * 0.35);
    this.body.add(b);
  }

  onDeath() {
    const S = this.session;
    const [w, h, d] = this.sz;
    this.breakT = 0;
    this.body.visible = false;
    // disable now, remove in dispose(): we may be inside the level's splat-notify loop over its colliders
    this.dyn.enabled = false;
    const c = this.hitCenter(_v).clone();
    this.planks.visible = true;
    for (let i = 0; i < PLANKS; i++) {
      const p = this.pd[i];
      const side = i % 6;
      p.p.set((hash01(i, 1) - 0.5) * w * 0.8, h * (0.2 + hash01(i, 2) * 0.7), (hash01(i, 3) - 0.5) * d * 0.8);
      p.v.set(p.p.x * 4 + (hash01(i, 4) - 0.5) * 3, 3 + hash01(i, 5) * 5, p.p.z * 4 + (hash01(i, 6) - 0.5) * 3);
      p.r.set(hash01(i, 7) * 3, hash01(i, 8) * 3, hash01(i, 9) * 3);
      p.w.set(hash01(i, 10) - 0.5, hash01(i, 11) - 0.5, hash01(i, 12) - 0.5).multiplyScalar(16);
      const long = side < 4 ? Math.max(w, d) * (0.5 + hash01(i, 13) * 0.4) : 0.25;
      p.s.set(long, 0.05, 0.16 + hash01(i, 14) * 0.08);
    }
    S.fx.burst(c, UP, '#c98d4e', 16, 6, { size: 0.07 });
    S.fx.burst(c, UP, '#8a5a2e', 10, 5, { size: 0.05 });
    S.fx.burst(c, UP, this.heroCol, 10, 5, { size: 0.06 });
    for (let i = 0; i < 4; i++) S.fx.puff(_v.copy(c).add(_n.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5)), '#d8c7aa', 0.9, 0.7, null, 2, 0.45);
    S.audio?.sfx('crate_break', { pos: c, volume: 0.9 });
    S.shake(c, 0.12);
    const n = this.def.pearls ?? 2;
    if (n > 0) spawnPearls(S, c, n);
  }

  step(dt) {
    this.t += dt;
    if (this.breakT >= 0) {
      this.breakT += dt;
      if (this.breakT > 2.2) this.remove();
    }
  }

  render(dt) {
    if (this.breakT < 0) {
      this.wob = Math.max(0, this.wob - dt * 5);
      const w = this.wob;
      this.body.scale.set(1 + Math.sin(this.t * 40) * 0.05 * w, 1 - w * 0.08, 1 + Math.cos(this.t * 40) * 0.05 * w);
      return;
    }
    const k = Math.max(0, 1 - Math.max(0, this.breakT - 1.4) / 0.8);
    for (let i = 0; i < PLANKS; i++) {
      const p = this.pd[i];
      p.v.y -= 20 * dt;
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.03) { p.p.y = 0.03; p.v.y *= -0.3; p.v.x *= 0.55; p.v.z *= 0.55; p.w.multiplyScalar(0.6); }
      p.r.addScaledVector(p.w, dt);
      _q.setFromEuler(_e.set(p.r.x, p.r.y, p.r.z));
      _s.copy(p.s).multiplyScalar(k);
      _m.compose(p.p, _q, _s);
      this.planks.setMatrixAt(i, _m);
    }
    this.planks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this.dyn) this.session.level.removeDynamic(this.dyn);
    super.dispose();
  }
}

registerEntity('crate', (s, d) => new Crate(s, d));
