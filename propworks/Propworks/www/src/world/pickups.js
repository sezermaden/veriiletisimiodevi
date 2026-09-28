/* Pickups: health kits, suit batteries, ammo boxes (physical, grabbable) and weapons
   (floating on a glowing pad until taken). Touch to collect. */
import * as THREE from 'three';
import { Entity } from './entities.js';
import { roundBox, boxGeo, cyl } from './geometry.js';
import { Audio } from '../core/audio.js';
import * as VM from '../weapons/viewmodels.js';

const MODELS = { crowbar: VM.crowbarModel, physgun: VM.physgunModel, gravgun: VM.gravgunModel, pistol: VM.pistolModel, smg: VM.smgModel, shotgun: VM.shotgunModel, grenade: VM.grenadeModel, toolgun: VM.toolgunModel };
const NAMES = { crowbar: 'Crowbar', physgun: 'Physics Gun', gravgun: 'Gravity Gun', pistol: '9mm Pistol', smg: 'SMG', shotgun: 'Shotgun', grenade: 'Frag Grenade', toolgun: 'Tool Gun' };

const std = (c, r = 0.5, m = 0.2, e = null, ei = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e || '#000', emissiveIntensity: ei });

export const PICKUPS = {
  health: { name: 'Health Kit', build: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(roundBox(0.42, 0.18, 0.3, 0.03), std('#f2f2f2', 0.4))); g.add(new THREE.Mesh(boxGeo(0.22, 0.012, 0.06), std('#e02020', 0.4, 0, '#e02020', 0.5)).translateY(0.092)); g.add(new THREE.Mesh(boxGeo(0.06, 0.012, 0.22), std('#e02020', 0.4, 0, '#e02020', 0.5)).translateY(0.092)); return { g, shape: { box: [0.21, 0.09, 0.15] } }; }, take: (game) => game.player.heal(25) && (Audio.play('heal'), true) },
  healthvial: { name: 'Health Vial', build: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(cyl(0.06, 0.2, 12), std('#7dffb0', 0.1, 0.1, '#30ff80', 0.8))); g.add(new THREE.Mesh(cyl(0.065, 0.04, 12), std('#ddd', 0.3, 0.8)).translateY(0.12)); return { g, shape: { cyl: [0.1, 0.06] } }; }, take: (game) => game.player.heal(10) && (Audio.play('heal'), true) },
  battery: { name: 'Suit Battery', build: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(roundBox(0.14, 0.28, 0.14, 0.02), std('#233e6b', 0.4, 0.6))); g.add(new THREE.Mesh(boxGeo(0.145, 0.16, 0.145), std('#4fb3ff', 0.2, 0.2, '#4fb3ff', 1.5))); g.add(new THREE.Mesh(cyl(0.03, 0.04, 8), std('#aaa', 0.3, 0.9)).translateY(0.16)); return { g, shape: { box: [0.07, 0.14, 0.07] } }; }, take: (game) => game.player.addArmor(15) && (Audio.play('armor'), true) },
  ammo_pistol: { name: 'Pistol Ammo', build: () => ammoBox('#6b5a2a'), take: (game) => game.weapons.addAmmo('pistol', 36) && (Audio.play('ammo'), true) },
  ammo_smg: { name: 'SMG Ammo', build: () => ammoBox('#3b5a2a'), take: (game) => game.weapons.addAmmo('smg', 90) && (Audio.play('ammo'), true) },
  ammo_buckshot: { name: 'Buckshot', build: () => ammoBox('#8a2a1f'), take: (game) => game.weapons.addAmmo('buckshot', 12) && (Audio.play('ammo'), true) },
  ammo_grenade: { name: 'Grenade', build: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), std('#3c4a2e', 0.6, 0.3)); b.scale.y = 1.2; g.add(b); return { g, shape: { ball: 0.1 } }; }, take: (game) => { const ok = game.weapons.addAmmo('grenade', 1); if (ok && !game.weapons.has('grenade')) game.weapons.give('grenade', { silent: true }); if (ok) Audio.play('ammo'); return ok; } },
};

function ammoBox(color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(roundBox(0.3, 0.18, 0.2, 0.02), std(color, 0.6, 0.3)));
  g.add(new THREE.Mesh(boxGeo(0.31, 0.04, 0.21), std('#1c1c1c', 0.5, 0.5)).translateY(0.06));
  return { g, shape: { box: [0.15, 0.09, 0.1] } };
}

export function spawnPickup(game, type, pos) {
  const def = PICKUPS[type];
  if (!def) return null;
  const { g, shape } = def.build();
  g.position.copy(pos);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const { body, colliders } = game.entities.buildBody([shape], { pos, quat: new THREE.Quaternion(), density: 2, surface: 'plastic' });
  const e = new Entity(game, { kind: 'pickup', name: def.name, object3d: g, body, colliders, surface: 'plastic', halfHeight: 0.1 });
  e.pickup = type;
  game.entities.add(e);
  e.behaviours.push(() => {
    const p = game.player;
    if (!p.alive || p.vehicle) return;
    const d = e.curr.p.distanceTo(new THREE.Vector3(p.pos.x, p.pos.y + 0.5, p.pos.z));
    if (d < 1.0 && def.take(game)) { game.hud?.pickup(def.name); e.remove(); }
  });
  return e;
}

/** A weapon floating over a small glowing pad. */
export function spawnWeaponPickup(game, id, pos, { onTake = null } = {}) {
  if (!MODELS[id]) return null;
  const model = MODELS[id]().root;
  const tmp = { name: NAMES[id] };
  // hide the gloved hand: world pickups show only the weapon
  model.traverse((o) => { if (o.isMesh && (o.geometry.type === 'CapsuleGeometry' || o.geometry.type === 'CylinderGeometry') && o.material.color?.getHexString() === '3b4148') o.visible = false; });
  model.children.filter((c) => c.type === 'Group' && c.children.length >= 6 && c.children.some((x) => x.geometry?.type === 'CapsuleGeometry')).forEach((h) => { h.visible = false; });
  const g = new THREE.Group();
  model.scale.setScalar(1.8);
  model.rotation.set(0, Math.PI / 2, 0);
  const holder = new THREE.Group(); holder.add(model);
  g.add(holder);
  const pad = new THREE.Mesh(cyl(0.45, 0.06, 32), std('#2a2e33', 0.4, 0.7));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 3) }));
  ring.position.y = 0.04;
  g.add(pad, ring);
  g.position.copy(pos);
  game.level.group.add(g);
  const u = { pos: pos.clone().add(new THREE.Vector3(0, 0.8, 0)), radius: 1.2, prompt: 'Take ' + tmp.name, enabled: true };
  let t = Math.random() * 6;
  const take = () => {
    if (!u.enabled) return;
    u.enabled = false;
    game.weapons.give(id, { select: true });
    g.removeFromParent();
    game.level.animated = game.level.animated.filter((f) => f !== anim);
    game.level.usables = game.level.usables.filter((x) => x !== u);
    onTake?.();
  };
  u.use = take;
  const anim = (dt) => {
    t += dt;
    holder.position.y = 0.9 + Math.sin(t * 2) * 0.08;
    holder.rotation.y += dt * 0.9;
    const p = game.player.pos;
    if (u.enabled && Math.hypot(p.x - pos.x, p.z - pos.z) < 0.9 && Math.abs(p.y - pos.y) < 1.5) take();
  };
  game.level.animated.push(anim);
  game.level.usables.push(u);
  return u;
}

/* ---------------------------------------------------------------- undo */
export class Undo {
  constructor(game) { this.game = game; this.stack = []; }
  push(label, entities = [], constraints = []) {
    this.stack.push({ label, entities: entities.filter(Boolean), constraints: constraints.filter(Boolean) });
    if (this.stack.length > 200) this.stack.shift();
  }
  undo() {
    while (this.stack.length) {
      const u = this.stack.pop();
      const live = u.entities.filter((e) => !e.removed);
      const liveC = u.constraints.filter((c) => !c.removed);
      if (!live.length && !liveC.length) continue;
      for (const c of liveC) c.remove();
      for (const e of live) e.remove({ effect: 'dissolve' });
      Audio.play('undo');
      this.game.hud?.notify('Undone ' + u.label, 'undo');
      return true;
    }
    this.game.hud?.notify('Nothing to undo', 'error');
    return false;
  }
  forget(e) { void e; }
  clear() { this.stack = []; }
}
