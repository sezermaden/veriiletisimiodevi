// Entity + Actor base classes and the entity registry used by level definitions.
//
//   registerEntity('glooper', (session, def) => new Glooper(session, def));
//   level def: entities: [{ type: 'glooper', pos: [x, y, z], yaw: 0, ...params }]
//
// Entities get step(dt) at the fixed rate and render(dt) once per frame. Actors are entities that
// can be hit by ink (they are pushed into session.actors).
import * as THREE from 'three';
import { TEAM_MURK } from '../ink/ink-system.js';

const REGISTRY = {};

export function registerEntity(type, factory) { REGISTRY[type] = factory; }
export function entityTypes() { return Object.keys(REGISTRY); }

export function spawnEntity(session, def) {
  const f = REGISTRY[def.type];
  if (!f) { console.warn(`Unknown entity type "${def.type}"`); return null; }
  const e = f(session, def);
  if (e) session.addEntity(e);
  return e;
}

export class Entity {
  constructor(session, def = {}) {
    this.session = session;
    this.def = def;
    this.type = def.type;
    this.id = def.id || null;
    this.dead = false;
    this.group = new THREE.Group();
    this.group.name = def.type || 'entity';
    if (def.pos) this.group.position.fromArray(def.pos);
    if (def.yaw) this.group.rotation.y = def.yaw;
    session.scene.add(this.group);
    this._disposables = [];
  }

  get position() { return this.group.position; }

  /** Track geometries/materials to free on dispose. */
  own(...things) { this._disposables.push(...things); return things[0]; }

  step(dt) { void dt; }
  render(dt) { void dt; }

  remove() { this.dead = true; }

  dispose() {
    this.session.scene.remove(this.group);
    for (const d of this._disposables) d?.dispose?.();
    this.group.traverse((o) => {
      if (o.isMesh && o.userData.ownGeometry) o.geometry.dispose();
    });
  }
}

export class Actor extends Entity {
  constructor(session, def, o = {}) {
    super(session, def);
    this.team = o.team ?? TEAM_MURK;
    this.maxHp = def.hp ?? o.hp ?? 100;
    this.hp = this.maxHp;
    this.alive = true;
    this.hitRadius = o.hitRadius ?? 0.5;
    this.hitHeight = o.hitHeight ?? 1.2;
    this.untargetable = false;
    this.flashT = 0;
    this.velocity = new THREE.Vector3();
    this.invulnerable = 0;
    session.actors.push(this);
  }

  hitCenter(out) { return out.copy(this.position).setY(this.position.y + this.hitHeight * 0.5); }

  damage(amount, info = {}) {
    if (!this.alive || this.invulnerable > 0) return;
    this.hp -= amount;
    this.flashT = 0.12;
    this.onDamaged?.(amount, info);
    if (this.hp <= 0) { this.hp = 0; this.die(info); }
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.onDeath?.(info);
    this.session.events.emit('actorDefeated', { actor: this, by: info.source });
  }

  dispose() {
    const i = this.session.actors.indexOf(this);
    if (i >= 0) this.session.actors.splice(i, 1);
    super.dispose();
  }
}
