// Super jump: squid-launch from anywhere to a teammate or the base. A beacon marks the landing spot
// for everyone (genre rule: the landing is telegraphed), the jumper crouches for a beat, flies a
// high arc and lands with a splash that inks the ground. Used by the player (map + Interact) and
// by bots (regroup after respawn).
import * as THREE from 'three';

const PREP = 0.55, FLY = 1.15;
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

let GEO = null;
function geos() {
  if (GEO) return GEO;
  GEO = {
    ring: new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2),
    beam: new THREE.CylinderGeometry(0.35, 0.6, 7, 16, 1, true).translate(0, 3.5, 0),
  };
  for (const g of Object.values(GEO)) g.userData.cached = true;
  return GEO;
}

export class SuperJumps {
  constructor(mode) {
    this.mode = mode;
    this.S = mode.session;
    this.list = [];
  }

  isJumping(actor) {
    for (let i = 0; i < this.list.length; i++) if (this.list[i].actor === actor) return true;
    return false;
  }

  /**
   * @param {Player} actor
   * @param {object} target  { actor } (teammate, followed until mid-flight) or { pos: Vector3 }
   */
  start(actor, target) {
    if (!actor.alive || actor.flying || this.isJumping(actor)) return false;
    const S = this.S;
    const to = new THREE.Vector3().copy(target.actor ? target.actor.position : target.pos);
    const color = S.ink.color(actor.team);
    const g = geos();
    const marker = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    const ring = new THREE.Mesh(g.ring, ringMat);
    ring.position.y = 0.06;
    const ring2 = new THREE.Mesh(g.ring, ringMat);
    ring2.position.y = 0.06;
    const beam = new THREE.Mesh(g.beam, beamMat);
    marker.add(ring, ring2, beam);
    marker.position.copy(to);
    S.scene.add(marker);
    actor.frozen = true;
    actor.kit.main.cancel();
    if (actor.form !== 'squid') actor._changeForm?.('squid');
    actor.velocity.set(0, 0, 0);
    this.list.push({ actor, target, from: actor.position.clone(), to, t: 0, phase: 'prep', marker, ring, ring2, beam, mats: [ringMat, beamMat] });
    S.audio?.sfx('superjump', { pos: actor.isPlayer ? undefined : actor.position, volume: actor.isPlayer ? 0.8 : 0.5 });
    S.fx.ring(actor.position, UP, color, 1.4, 0.5);
    return true;
  }

  step(dt) {
    const S = this.S;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const j = this.list[i];
      const a = j.actor;
      j.t += dt;
      if (!a.alive) { this._end(i, false); continue; }
      if (j.phase === 'prep') {
        a.velocity.set(0, 0, 0);
        if (j.t >= PREP) {
          j.phase = 'fly'; j.t = 0;
          j.from.copy(a.position);
          a.flying = true;
          a.untargetable = true;
          S.fx.burst(a.position, UP, S.ink.color(a.team), 14, 6);
          S.audio?.sfx('launch', { pos: a.position, volume: a.isPlayer ? 0.7 : 0.4 });
        }
        continue;
      }
      // follow a teammate target until the arc passes its peak
      const s0 = Math.min(1, j.t / FLY);
      const ta = j.target.actor;
      if (ta && ta.alive && s0 < 0.55 && !ta.flying) {
        const g = S.level.groundBelow(_v.copy(ta.position).setY(ta.position.y + 0.5), 6);
        j.to.copy(g ? g.point : ta.position);
        j.marker.position.copy(j.to);
      }
      const s = s0 * s0 * (3 - 2 * s0);
      const apex = Math.max(j.from.y, j.to.y) + 11 - j.from.y;
      const h = j.from.y + (j.to.y - j.from.y) * s + apex * 4 * s * (1 - s);
      a.position.set(j.from.x + (j.to.x - j.from.x) * s, h, j.from.z + (j.to.z - j.from.z) * s);
      const ds = (6 * s0 * (1 - s0)) / FLY;
      a.velocity.set(0, ((j.to.y - j.from.y) + apex * 4 * (1 - 2 * s)) * ds, 0);
      a.yaw = Math.atan2(j.to.x - j.from.x, j.to.z - j.from.z);
      if (s0 >= 1) this._end(i, true);
    }
  }

  /** Per frame: pulse the beacons. */
  render(dt) {
    for (const j of this.list) {
      const k = (performance.now() * 0.002) % 1;
      j.ring.scale.setScalar(0.6 + k * 1.2);
      j.mats[0].opacity = 0.85 * (1 - k * 0.6);
      j.ring2.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.08);
      j.beam.rotation.y += dt * 2;
    }
  }

  _end(i, landed) {
    const j = this.list[i];
    this.list.splice(i, 1);
    const a = j.actor, S = this.S;
    a.frozen = false;
    a.flying = false;
    a.untargetable = false;
    if (landed) {
      a.position.copy(j.to);
      a.velocity.set(0, -4, 0);
      a.invulnerable = Math.max(a.invulnerable || 0, 0.4);
      const color = S.ink.color(a.team);
      S.ink.paint(j.to, 2.1, a.team, UP, { source: a });
      S.fx.explosion(j.to, UP, color, 1.6);
      S.audio?.sfx('splash_big', { pos: a.isPlayer ? undefined : j.to, volume: a.isPlayer ? 0.8 : 0.5 });
      if (a.isPlayer) S.shake?.(j.to, 0.35);
      this.mode.onSuperJumpLanded?.(a);
    }
    S.scene.remove(j.marker);
    for (const m of j.mats) m.dispose();
    j.marker.clear();
  }

  dispose() {
    for (let i = this.list.length - 1; i >= 0; i--) this._end(i, false);
  }
}
