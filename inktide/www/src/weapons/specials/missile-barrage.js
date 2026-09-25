// Missile Barrage: a missile pod pops onto your back and locks onto up to four enemies within
// 45 m that are roughly in view (reticles over their heads for 0.8 s), then launches a volley of
// arcing ink missiles — two per target — that track them until the final dive and explode on
// impact. With nothing to lock onto, the volley rains down around the aim point instead.
import * as THREE from 'three';
import { Special, registerSpecial, muzzleOf } from '../base.js';
import { makeMissileModel, makeMissilePodModel, reticleTexture, addPoseHook } from '../models.js';
import { isCombatant, blast, noCharge, sfx, UP, DOWN } from '../mains/shared.js';

const _hc = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);

function bezier(out, p0, p1, p2, p3, t) {
  const u = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
}

export class MissileBarrage extends Special {
  static defaults = {
    range: 45, viewCos: 0.45, maxTargets: 4, lockTime: 0.8, perTarget: 2, salvoGap: 0.07,
    damage: 70, radius: 2.4, paintRadius: 2.5, noTargetCount: 6,
  };

  constructor(w, stats) {
    super(w, stats);
    this.reticles = [];
    this.pod = null;
    this.podK = 0;
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  activate() {
    this.clearReticles();
    super.activate();
    const w = this.w, S = w.session, s = this.s;
    this.t = 0;
    this.inFlight = 0;
    this.phase = 'lock';
    this.queue = [];
    this.launchT = 0;
    this.podK = 0;
    // pick targets: in range, roughly in view, nearest first
    const dir = w.aim.dir;
    const cand = [];
    const eye = _p.copy(w.position).setY(w.position.y + 1.3);
    for (const a of S.actors) {
      if (!isCombatant(a, w.team)) continue;
      a.hitCenter(_hc);
      _d.subVectors(_hc, eye);
      const dist = _d.length();
      if (dist > s.range || dist < 0.5) continue;
      if (_d.divideScalar(dist).dot(dir) < s.viewCos) continue;
      cand.push({ a, dist });
    }
    cand.sort((x, y) => x.dist - y.dist);
    this.targets = cand.slice(0, s.maxTargets).map((c) => c.a);
    this.aimPoint = w.aim.point.clone();
    const color = S.ink.color(w.team);
    this.reticles = this.targets.map((a, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTexture(), color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      sp.renderOrder = 10;
      sp.userData = { target: a, delay: i * 0.1, locked: false };
      sp.visible = false;
      S.scene.add(sp);
      return sp;
    });
    // pod on the back
    if (w.model?.torso) {
      this.pod = makeMissilePodModel(color);
      this.pod.position.set(0, 0.26, -0.2);
      this.pod.rotation.x = -0.25;
      this.pod.scale.setScalar(0.01);
      w.model.torso.add(this.pod);
      if (w.model.pack) w.model.pack.visible = false;
    }
    sfx(w, 'lock_start', { volume: 0.7 });
    sfx(w, 'special', { volume: 0.6 });
  }

  get blocksFire() { return this.active && this.phase === 'lock'; }

  update(dt) {
    const w = this.w, S = w.session, s = this.s;
    this.t += dt;
    if (this.phase === 'lock') {
      for (const r of this.reticles) {
        const ud = r.userData;
        if (!ud.locked && this.t >= ud.delay) {
          ud.locked = true;
          r.visible = true;
          ud.lockAt = this.t;
          sfx(w, 'lock_on', { volume: 0.5, pitch: 1 + this.reticles.indexOf(r) * 0.08, throttle: 0 });
        }
        this.placeReticle(r);
      }
      if (this.t >= s.lockTime) this.launch();
    } else if (this.phase === 'launch') {
      for (const r of this.reticles) this.placeReticle(r);
      this.launchT -= dt;
      while (this.launchT <= 0 && this.queue.length) {
        this.launchT += s.salvoGap;
        this.fireMissile(this.queue.shift());
      }
      if (!this.queue.length) { this.phase = 'done'; this.t = 0; }
    } else if (this.phase === 'done') {
      for (const r of this.reticles) this.placeReticle(r);
      // the special ends once the pod has retracted; missiles still in the air carry on by
      // themselves and their blasts never feed the gauge (noCharge). Reticles stay on the targets
      // until the volley has landed (pose() keeps them placed).
      if (this.t > 0.35) this.end();
    }
  }

  placeReticle(r) {
    const ud = r.userData, a = ud.target;
    if (!a.alive) { r.visible = false; return; }
    a.hitCenter(_hc);
    r.position.set(_hc.x, _hc.y + (a.hitHeight ?? 1.2) * 0.5 + 0.9, _hc.z);
    const k = ud.locked ? Math.min(1, (this.t - (ud.lockAt || 0)) / 0.25) : 0;
    const sc = THREE.MathUtils.lerp(2.6, 1.0, 1 - (1 - k) * (1 - k)) * (this.phase === 'lock' ? 1 : 0.9 + Math.sin(this.t * 30) * 0.1);
    r.scale.setScalar(sc);
    r.material.rotation = (1 - k) * 2.2 + this.t * 1.5;
    r.material.opacity = Math.min(1, k * 1.5);
  }

  launch() {
    const s = this.s;
    this.phase = 'launch';
    this.launchT = 0;
    this.queue = [];
    if (this.targets.length) {
      for (let k = 0; k < s.perTarget; k++) for (const a of this.targets) this.queue.push({ actor: a, offset: k === 0 ? 0 : 0.8 });
    } else {
      for (let i = 0; i < s.noTargetCount; i++) {
        const ang = (i / s.noTargetCount) * Math.PI * 2;
        const rr = i === 0 ? 0 : 2.6;
        this.queue.push({ actor: null, point: this.aimPoint.clone().add(new THREE.Vector3(Math.cos(ang) * rr, 0, Math.sin(ang) * rr)) });
      }
    }
  }

  launchPoint(i, out) {
    const pod = this.pod;
    if (pod && this.w.model?.kid?.visible) {
      const t = pod.userData.tubes[i % 4];
      return pod.localToWorld(out.copy(t));
    }
    return muzzleOf(this.w, out, -0.25, 0, 1.5);
  }

  fireMissile(job) {
    const w = this.w, S = w.session, s = this.s;
    const color = S.ink.color(w.team);
    const i = this.shotIdx = (this.shotIdx || 0) + 1;
    const p0 = this.launchPoint(i, new THREE.Vector3());
    const p3 = new THREE.Vector3();
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).setLength(job.offset || 0);
    const target = job.actor;
    const aimAt = (out) => {
      if (target && target.alive) {
        out.copy(target.position).add(jitter);
        return out;
      }
      if (job.point) {
        const g = S.level.raycast(_a.copy(job.point).setY(job.point.y + 2), DOWN, 30, { staticOnly: true });
        return out.copy(g ? g.point : job.point);
      }
      return out;
    };
    aimAt(p3);
    if (!target && !job.point) p3.copy(this.aimPoint);
    const dist = p0.distanceTo(p3);
    const T = 1.25 + Math.min(1.2, dist / 38);
    const side = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    const p1 = p0.clone().add(new THREE.Vector3(0, 7 + Math.random() * 2, 0)).add(side);
    const p2 = new THREE.Vector3();
    const mesh = makeMissileModel(color);
    mesh.position.copy(p0);
    let exploded = false;
    this.inFlight++;
    let puffT = 0;
    const boom = (pos, normal) => {
      if (exploded) return;
      exploded = true;
      this.inFlight--;
      noCharge(w, () => blast(S, pos, normal || UP, w.team, { owner: w, damage: s.damage, radius: s.radius, paintRadius: s.paintRadius, kind: 'special', sound: 'boom' }));
      mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    };
    const proj = S.projectiles.spawn({
      pos: p0, vel: _d.subVectors(p1, p0).normalize().multiplyScalar(8), team: w.team, owner: w,
      damage: 0, radius: 0.22, gravity: 0, life: T + 1.2, mesh, fx: false,
      onStep: (p, dt) => {
        const k = Math.min(1, p.age / T);
        if (k < 0.78) aimAt(p3);                                   // track until the final dive
        p2.copy(p3).setY(Math.max(p3.y + 8, p1.y - 1));
        const kn = Math.min(1.02, (p.age + dt) / T);
        bezier(_b, p0, p1, p2, p3, kn);
        if (kn >= 1) _b.addScaledVector(_a.subVectors(p3, p2).normalize(), (kn - 1) * T * 30);
        _a.copy(p.pos).addScaledVector(p.vel, dt);                // where this step ends
        p.vel.subVectors(_b, _a).divideScalar(dt);
        if (p.vel.lengthSq() > 1e-4) mesh.quaternion.setFromUnitVectors(_z, _d.copy(p.vel).normalize());
        const fl = mesh.userData.flame;
        const f = 0.8 + Math.random() * 0.5;
        fl[0].scale.set(f, f, f); fl[1].scale.set(f, f * 1.2, f);
        puffT -= dt;
        if (puffT <= 0) {
          puffT = 0.08;
          _a.copy(p.pos).addScaledVector(_d, -0.4);
          S.fx.puff(_a, '#f4f1ea', 0.28, 0.45, null, 2.4, 0.55);
          S.fx.spray(_a, _d.clone().multiplyScalar(-3), color, 1, 1, { size: 0.05, life: 0.3 });
        }
      },
      onHit: (p, hit) => boom(hit.point.clone(), hit.actor ? UP : hit.normal),
      onExpire: (p) => boom(p.pos.clone(), UP),
    });
    if (!proj) {                                                  // projectile pool full
      exploded = true;
      this.inFlight--;
      mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      return;
    }
    S.fx.puff(p0, '#ffffff', 0.5, 0.4, _d.set(0, 1.5, 0), 2, 0.6);
    S.fx.burst(p0, UP, color, 5, 3, { size: 0.05 });
    sfx(w, 'missile_launch', { volume: 0.55, throttle: 0.03 });
    this.podKick = 1;
  }

  end() {
    const wasActive = this.active;
    super.end();
    this.queue = [];
    this.postT = 0;
    // interrupted before launch (splatted, respawned): nothing is in the air, drop the reticles
    if (wasActive && this.phase === 'lock') this.clearReticles();
    this.phase = 'done';
    if (this.pod) {
      this.pod.parent?.remove(this.pod);
      this.pod.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      this.pod = null;
    }
    if (this.w.model?.pack) this.w.model.pack.visible = true;
  }

  clearReticles() {
    const S = this.w.session;
    for (const r of this.reticles) { S.scene.remove(r); r.material.dispose(); }
    this.reticles = [];
  }

  pose(dt, st, m) {
    void st; void m;
    // after the special ended: keep the lock reticles on the targets until the volley has landed
    if (!this.active && this.reticles.length) {
      this.t += dt;
      this.postT += dt;
      for (const r of this.reticles) this.placeReticle(r);
      if (this.inFlight <= 0 || this.postT > 6) this.clearReticles();
    }
    if (!this.pod) return;
    this.podK = Math.min(1, this.podK + dt * 6);
    const out = this.phase === 'done' ? Math.max(0, 1 - this.t / 0.35) : 1;
    const k = this.podK;
    this.podKick = Math.max(0, (this.podKick || 0) - dt * 10);
    const sc = (k < 1 ? k * (1 + Math.sin(k * Math.PI) * 0.4) : 1) * out;
    this.pod.scale.setScalar(Math.max(0.01, sc));
    this.pod.position.y = 0.26 - this.podKick * 0.03;
  }

  dispose() {
    this.unhook?.();
    if (this.active) this.end();
    this.clearReticles();
  }
}

registerSpecial('missile-barrage', MissileBarrage);
