// Ink projectiles shared by every weapon, enemy and boss. Fixed-step, pooled, instanced.
import * as THREE from 'three';
import { TEAM_NONE } from '../ink/ink-system.js';

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _c = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _down = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();

/** Closest distance between segment ab and point p; returns t in [0,1] via out.t. */
function segPointDist(a, b, p, out) {
  _dir.subVectors(b, a);
  const len2 = _dir.lengthSq();
  let t = len2 > 0 ? _c.subVectors(p, a).dot(_dir) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  out.t = t;
  _c.copy(a).addScaledVector(_dir, t);
  return _c.distanceTo(p);
}

export class Projectiles {
  constructor(session, max = 700) {
    this.session = session;
    this.list = [];
    this.pool = [];
    this.max = max;
    const geo = new THREE.SphereGeometry(1, 12, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0, envMapIntensity: 1.4, emissive: '#000000' });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    session.scene.add(this.mesh);
    this._tmp = { t: 0 };
  }

  /**
   * Spawn a projectile.
   * @param {object} o  pos, vel, team, owner, damage, size, radius, gravity, gravityDelay, drag, life,
   *   paint: {radius}, trail: {every, radius}, falloff: {start, end, min}, pierce, onHit(p, hit),
   *   onWorld(p, hit) (return true to keep alive), onExpire(p), mesh (custom Object3D), noRender,
   *   color (override), splash: {radius, damage} (area damage on impact)
   */
  spawn(o) {
    if (this.list.length >= this.max) return null;
    const p = this.pool.pop() || { pos: new THREE.Vector3(), vel: new THREE.Vector3(), start: new THREE.Vector3() };
    p.pos.copy(o.pos); p.start.copy(o.pos); p.vel.copy(o.vel);
    p.team = o.team ?? TEAM_NONE;
    p.owner = o.owner || null;
    p.damage = o.damage ?? 0;
    p.size = o.size ?? 0.14;
    p.radius = o.radius ?? p.size;
    p.gravity = o.gravity ?? 24;
    p.gravityDelay = o.gravityDelay ?? 0;
    p.drag = o.drag ?? 0;
    p.life = o.life ?? 3;
    p.age = 0;
    p.paint = o.paint || null;
    p.trail = o.trail || null;
    p.trailAcc = 0;
    p.falloff = o.falloff || null;
    p.pierce = !!o.pierce;
    p.hitSet = p.pierce ? new Set() : null;
    p.onHit = o.onHit || null;
    p.onWorld = o.onWorld || null;
    p.onExpire = o.onExpire || null;
    p.onStep = o.onStep || null;
    p.mesh = o.mesh || null;
    p.noRender = !!o.noRender || !!o.mesh;
    p.color = o.color ? new THREE.Color(o.color) : null;
    p.splash = o.splash || null;
    p.dead = false;
    p.ignoreActors = !!o.ignoreActors;
    p.data = o.data || null;
    p.fx = o.fx ?? true;
    if (p.mesh) { p.mesh.position.copy(p.pos); if (!p.mesh.parent) this.session.scene.add(p.mesh); }
    this.list.push(p);
    return p;
  }

  kill(p) {
    if (p.dead) return;
    p.dead = true;
    if (p.mesh) { p.mesh.parent?.remove(p.mesh); }
  }

  step(dt) {
    const S = this.session;
    const level = S.level;
    const ink = S.ink;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.dead) continue;
      p.age += dt;
      if (p.age > p.gravityDelay) p.vel.y -= p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      _from.copy(p.pos);
      _to.copy(p.pos).addScaledVector(p.vel, dt);
      const segLen = _from.distanceTo(_to);
      p.onStep?.(p, dt);
      if (p.dead) continue;

      // --- actors ---
      let actorHit = null, actorT = 2;
      for (const a of (p.ignoreActors ? [] : S.actors)) {
        if (!a.alive || a.team === p.team || a.untargetable) continue;
        if (p.hitSet && p.hitSet.has(a)) continue;
        a.hitCenter(_hc);
        const reach = p.radius + a.hitRadius;
        // cheap reject
        if (Math.abs(_hc.x - _from.x) > reach + segLen + a.hitHeight || Math.abs(_hc.z - _from.z) > reach + segLen + a.hitHeight) continue;
        // test against a vertical segment for tall actors: sample three heights
        const hh = a.hitHeight * 0.5;
        let best = Infinity, bt = 0;
        for (const off of hh > 0.3 ? [-hh * 0.6, 0, hh * 0.6] : [0]) {
          _hc.y += off;
          const d = segPointDist(_from, _to, _hc, this._tmp);
          if (d < best) { best = d; bt = this._tmp.t; }
          _hc.y -= off;
        }
        if (best < reach && bt < actorT) { actorT = bt; actorHit = a; }
      }

      // --- world ---
      let worldHit = null;
      if (segLen > 1e-5) {
        _dir.subVectors(_to, _from).divideScalar(segLen);
        worldHit = level.raycast(_from, _dir, segLen + p.radius * 0.5);
      }
      const worldT = worldHit ? Math.min(1, worldHit.distance / Math.max(segLen, 1e-5)) : 2;

      if (actorHit && actorT <= worldT) {
        _c.copy(_from).lerp(_to, actorT);
        this._hitActor(p, actorHit, _c);
        if (!p.pierce) { this._impactFx(p, _c, null, true); this.kill(p); continue; }
      }
      if (worldHit) {
        if (p.onWorld && p.onWorld(p, worldHit)) { continue; }
        p.pos.copy(worldHit.point);
        if (p.paint && ink) ink.paint(worldHit.point, p.paint.radius, p.team, worldHit.normal, { source: p.owner });
        if (p.splash) this._splash(p, worldHit.point);
        worldHit.dynamic?.owner?.onInkHit?.(p, worldHit);
        if (p.onHit) p.onHit(p, worldHit);
        this._impactFx(p, worldHit.point, worldHit.normal, false);
        this.kill(p);
        continue;
      }
      p.pos.copy(_to);

      // --- trail drips paint the ground under the flight path ---
      if (p.trail && ink) {
        p.trailAcc += segLen;
        if (p.trailAcc >= p.trail.every) {
          p.trailAcc = 0;
          const g = level.raycast(p.pos, _down, 30, { staticOnly: true });
          if (g) ink.paint(g.point, p.trail.radius, p.team, g.normal, { source: p.owner });
        }
      }
      if (p.age >= p.life || p.pos.y < level.killY - 20) {
        if (p.onExpire) p.onExpire(p);
        this.kill(p);
      }
      if (p.mesh && !p.dead) p.mesh.position.copy(p.pos);
    }
    // compact
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.dead) this.pool.push(p); else this.list[w++] = p;
    }
    this.list.length = w;
  }

  _damageFor(p) {
    let d = p.damage;
    if (p.falloff) {
      const dist = p.pos.distanceTo(p.start);
      const f = p.falloff;
      if (dist > f.start) d *= Math.max(f.min, 1 - (dist - f.start) / Math.max(0.01, f.end - f.start) * (1 - f.min));
    }
    return d;
  }

  _hitActor(p, a, point) {
    if (p.hitSet) p.hitSet.add(a);
    const dmg = this._damageFor(p);
    if (dmg > 0) a.damage(dmg, { source: p.owner, team: p.team, point, dir: p.vel.clone().normalize(), kind: 'shot' });
    this.session.events.emit('hit', { target: a, source: p.owner, damage: dmg, point: point.clone() });
    if (p.splash) this._splash(p, point, a);
    if (p.onHit) p.onHit(p, { point: point.clone(), actor: a });
  }

  /** Area damage with linear falloff; `skip` already took the direct hit. */
  _splash(p, point, skip = null) {
    const S = this.session;
    for (const a of S.actors) {
      if (!a.alive || a.team === p.team || a === skip) continue;
      a.hitCenter(_hc);
      const d = _hc.distanceTo(point);
      if (d < p.splash.radius) {
        const dmg = p.splash.damage * (1 - (d / p.splash.radius) * 0.6);
        a.damage(dmg, { source: p.owner, team: p.team, point, dir: _hc.clone().sub(point).normalize(), kind: 'splash' });
        S.events.emit('hit', { target: a, source: p.owner, damage: dmg, point: point.clone() });
      }
    }
  }

  _impactFx(p, point, normal, onActor) {
    if (!p.fx) return;
    const S = this.session;
    const color = p.color || S.ink.color(p.team);
    const n = normal || UP;
    const big = p.paint ? p.paint.radius : 0.4;
    S.fx.burst(point, n, color, Math.round(4 + big * 6), 2.5 + big * 2, { size: 0.045 + big * 0.03 });
    if (!onActor && big > 0.3) S.fx.ring(point, n, color, big * 1.3, 0.35);
    if (S.audio && S.player) {
      const d2 = point.distanceToSquared(S.player.position);
      if (d2 < 900) S.audio.sfx(onActor ? 'hit' : 'splat', { pos: point, volume: Math.min(1, 0.3 + big * 0.5), pitch: 0.9 + Math.random() * 0.25 });
    }
  }

  render() {
    const mesh = this.mesh;
    let n = 0;
    const ink = this.session.ink;
    for (const p of this.list) {
      if (p.dead || p.noRender) continue;
      const sp = p.vel.length();
      if (sp > 1e-3) _q.setFromUnitVectors(_z, _dir.copy(p.vel).divideScalar(sp)); else _q.identity();
      const st = 1 + Math.min(1.6, sp * 0.03);
      _s.set(p.size, p.size, p.size * st);
      _m.compose(p.pos, _q, _s);
      mesh.setMatrixAt(n, _m);
      _col.copy(p.color || ink.color(p.team));
      mesh.setColorAt(n, _col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    for (const p of this.list) this.kill(p);
    this.list.length = 0;
  }

  dispose() {
    this.clear();
    this.session.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
