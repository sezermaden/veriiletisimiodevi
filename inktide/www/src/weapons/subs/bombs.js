// Burst Bomb (bursts on impact) and Splash Bomb (bounces, sticks, fuse, big splat).
import * as THREE from 'three';
import { SubWeapon, registerSub, muzzleOf, inkExplosion } from '../base.js';
import { inkMat, charMat } from '../../actors/materials.js';
import { disposeTree } from '../../engine/dispose.js';

const _m = new THREE.Vector3();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function throwVelocity(w, speed, lift) {
  _v.copy(w.aim.dir);
  _v.y = Math.max(_v.y, -0.2) + lift;
  return _v.normalize().multiplyScalar(speed).add(new THREE.Vector3(w.velocity.x * 0.5, 0, w.velocity.z * 0.5));
}

function bombMesh(color, kind) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(kind === 'burst' ? 0.14 : 0.19, 16, 12), inkMat(color));
  g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 10), charMat('#30333d', { roughness: 0.5 }));
  cap.position.y = kind === 'burst' ? 0.14 : 0.19;
  g.add(cap);
  if (kind === 'splash') {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6b0' }));
    light.position.y = 0.24;
    g.add(light);
    g.userData.light = light;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class BurstBomb extends SubWeapon {
  static defaults = { cost: 40, speed: 17, lift: 0.35, paintRadius: 1.9, damage: 60, dmgRadius: 2.2 };
  use() {
    const w = this.w, S = w.session, s = this.s;
    muzzleOf(w, _m, 0.3, 0.1, 1.25);
    const color = S.ink.color(w.team);
    const mesh = bombMesh(color, 'burst');
    const explode = (p, pos, n) => {
      inkExplosion(S, pos, n || _up, w.team, { paintRadius: s.paintRadius, damage: s.damage, dmgRadius: s.dmgRadius, owner: w, sound: 'pop' });
      disposeTree(mesh);               // the flight mesh is removed from the scene by Projectiles.kill
    };
    S.projectiles.spawn({
      pos: _m, vel: throwVelocity(w, s.speed, s.lift), team: w.team, owner: w, damage: 0, radius: 0.18,
      gravity: 24, life: 4, mesh,
      onHit: (p, hit) => explode(p, hit.point, hit.normal),
      onExpire: (p) => explode(p, p.pos, _up),
      onStep: (p, dt) => { mesh.rotation.x += dt * 12; },
      fx: false,
    });
    S.audio?.sfx('throw', { pos: _m, volume: 0.6 });
    return true;
  }
}

export class SplashBomb extends SubWeapon {
  static defaults = { cost: 70, speed: 15, lift: 0.4, fuse: 1.1, paintRadius: 3.1, damage: 180, dmgRadius: 3.2 };
  use() {
    const w = this.w, S = w.session, s = this.s;
    muzzleOf(w, _m, 0.3, 0.1, 1.25);
    const color = S.ink.color(w.team);
    const mesh = bombMesh(color, 'splash');
    const bomb = { landed: false, t: 0, pos: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0) };
    S.projectiles.spawn({
      pos: _m, vel: throwVelocity(w, s.speed, s.lift), team: w.team, owner: w, damage: 0, radius: 0.2,
      gravity: 22, life: 6, mesh, fx: false,
      // a bomb that hits someone in flight glances off and drops at their feet (without `pierce`
      // Projectiles would kill it on contact: no explosion, mesh never freed)
      pierce: true,
      onHit: (p, hit) => {
        if (!hit.actor || bomb.landed) return;
        p.vel.set(-p.vel.x * 0.25, Math.max(1.5, -p.vel.y * 0.2), -p.vel.z * 0.25);
        S.audio?.sfx('clack', { pos: hit.point, volume: 0.4 });
      },
      onWorld: (p, hit) => {
        // bounce a little off walls, settle on floors
        if (hit.normal.y > 0.6 && p.vel.length() < 6) {
          bomb.landed = true; bomb.pos.copy(hit.point).addScaledVector(hit.normal, 0.18); bomb.n.copy(hit.normal);
          p.pos.copy(bomb.pos); p.vel.set(0, 0, 0); p.gravity = 0; p.ignoreActors = true;
          return true;
        }
        const vn = p.vel.dot(hit.normal);
        p.vel.addScaledVector(hit.normal, -1.6 * vn).multiplyScalar(0.45);
        p.pos.copy(hit.point).addScaledVector(hit.normal, 0.2);
        S.audio?.sfx('clack', { pos: hit.point, volume: 0.4 });
        return true;
      },
      onStep: (p, dt) => {
        if (bomb.landed) {
          p.vel.set(0, 0, 0); p.pos.copy(bomb.pos);
          bomb.t += dt;
          const blink = Math.sin(bomb.t * (8 + bomb.t * 26)) > 0;
          if (mesh.userData.light) mesh.userData.light.visible = blink;
          mesh.scale.setScalar(1 + bomb.t * 0.25);
          if (bomb.t >= s.fuse) {
            inkExplosion(S, bomb.pos, bomb.n, w.team, { paintRadius: s.paintRadius, damage: s.damage, dmgRadius: s.dmgRadius, owner: w });
            S.projectiles.kill(p);
            disposeTree(mesh);
          }
        } else {
          mesh.rotation.x += dt * 8;
        }
      },
      onExpire: (p) => { inkExplosion(S, p.pos, _up, w.team, { paintRadius: s.paintRadius, damage: s.damage, dmgRadius: s.dmgRadius, owner: w }); disposeTree(mesh); },
    });
    S.audio?.sfx('throw', { pos: _m, volume: 0.6 });
    return true;
  }
}

registerSub('burst-bomb', BurstBomb);
registerSub('splash-bomb', SplashBomb);
