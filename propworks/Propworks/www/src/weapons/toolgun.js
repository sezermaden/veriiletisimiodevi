/* The Tool Gun and its tools.

   A tool is { id, name, cat, help[], options[], left(tr), right(tr), reload(tr) }. Two-click
   tools keep a `stage` and show "select second object" on the HUD. Options are edited in
   the spawn menu's tool panel and persist per session. */
import * as THREE from 'three';
import { Weapon } from './weapons.js';
import { toolgunModel } from './viewmodels.js';
import { Audio } from '../core/audio.js';
import { weld, axis, ballsocket, rope, elastic, nocollide, contraption } from '../physics/constraints.js';
import { createBalloon, createThruster, createWheel, createHoverball, createDynamite, createLamp, ATTACHMENT_FACTORIES } from './attachments.js';
import { PAINTABLE_MATERIALS, materialLabel } from '../render/materials.js';
import { textTexture } from '../render/textures.js';

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const KEY_CHOICES = [[1, 'Channel 1 (Num8 / I / D-Up)'], [2, 'Channel 2 (Num2 / K / D-Down)'], [3, 'Channel 3 (Num4 / J / D-Left)'], [4, 'Channel 4 (Num6 / L / D-Right)'], [5, 'Channel 5 (Num5 / U)'], [6, 'Channel 6 (Num0 / O)']];
const COLORS = ['#ffffff', '#ff3030', '#ff8a1f', '#ffd21f', '#4cd964', '#2fb8ff', '#3a5bff', '#a64dff', '#ff4dc4', '#8a8a8a', '#333333', '#8b5a2b'];

/** Build every tool. `g` is the game. */
export function buildTools(g) {
  const T = {};
  const needEntity = (tr) => tr?.entity && tr.entity.body && tr.entity.kind !== 'npc' && tr.entity.kind !== 'world' && tr.entity.kind !== 'player';
  const undo = (label, ents = [], cons = []) => g.undo.push(label, ents, cons);
  const two = (tool, tr, make) => {
    if (tool.stage === 0) {
      if (!needEntity(tr)) return false;
      tool.first = { e: tr.entity, p: V(tr.point), n: V(tr.normal) };
      tool.stage = 1;
      g.hud.toolStatus(tool.name + ': select the second object (or the world)');
      return true;
    }
    const a = tool.first.e;
    if (a.removed) { tool.stage = 0; return false; }
    const b = needEntity(tr) ? tr.entity : null;
    if (b === a) return false;
    if (!b && tr?.entity?.kind !== 'world' && !tr?.world) return false;
    const c = make(a, b, tool.first, { p: V(tr.point), n: V(tr.normal) });
    tool.stage = 0;
    g.hud.toolStatus(null);
    if (c) { undo(tool.name, [], [c]); g.onConstraint?.(tool.id, c); }
    return !!c;
  };

  T.weld = {
    name: 'Weld', cat: 'Constraints', help: ['Left click: weld two objects together (second click on the world welds to the world)', 'Right click: easy weld — weld to the object behind it', 'Reload: remove all welds'], options: [],
    left(tr) { return two(this, tr, (a, b) => { Audio.play('weld', { pos: a.curr.p }); g.progress.welds++; return weld(g, a, b); }); },
    right(tr) {
      if (!needEntity(tr)) return false;
      const a = tr.entity;
      const behind = g.physics.raycast(V(tr.point).addScaledVector(g.aimDir(), 0.02), g.aimDir(), 3, { excludeBody: a.body, predicate: (c) => g.physics.colliderOwner.get(c.handle) !== g.player });
      const b = behind?.entity && behind.entity.body && behind.entity.kind !== 'npc' ? behind.entity : null;
      const c = weld(g, a, b);
      Audio.play('weld', { pos: a.curr.p });
      undo('Weld', [], [c]);
      return true;
    },
    reload(tr) { return removeConstraints(tr, 'weld'); },
  };
  T.axis = {
    name: 'Axis', cat: 'Constraints', help: ['Left click: first object (axis = surface normal), then what it spins against', 'Reload: remove axes'], options: [],
    left(tr) { return two(this, tr, (a, b, f) => { Audio.play('weld', { pos: f.p }); return axis(g, a, b, f.p, f.n); }); },
    reload(tr) { return removeConstraints(tr, 'axis'); },
  };
  T.ballsocket = {
    name: 'Ball Socket', cat: 'Constraints', help: ['Left click: first object, then the pivot point on the second', 'Reload: remove ball sockets'], options: [],
    left(tr) { return two(this, tr, (a, b, f, s) => { Audio.play('weld', { pos: s.p }); return ballsocket(g, a, b, s.p); }); },
    reload(tr) { return removeConstraints(tr, 'ballsocket'); },
  };
  T.rope = {
    name: 'Rope', cat: 'Constraints', help: ['Left click: start point, then end point', 'Reload: remove ropes'],
    options: [{ key: 'slack', label: 'Extra length (m)', type: 'slider', min: 0, max: 5, step: 0.1, value: 0.3 }, { key: 'width', label: 'Width', type: 'slider', min: 0.005, max: 0.08, step: 0.005, value: 0.015 }],
    left(tr) { return two(this, tr, (a, b, f, s) => { Audio.play('rope', { pos: s.p }); return rope(g, a, b, f.p, s.p, { slack: this.o.slack, width: this.o.width }); }); },
    reload(tr) { return removeConstraints(tr, 'rope'); },
  };
  T.elastic = {
    name: 'Elastic', cat: 'Constraints', help: ['Left click: start point, then end point — a spring between them', 'Reload: remove elastics'],
    options: [{ key: 'stiffness', label: 'Stiffness', type: 'slider', min: 50, max: 2000, step: 50, value: 400 }, { key: 'damping', label: 'Damping', type: 'slider', min: 0, max: 100, step: 5, value: 20 }],
    left(tr) { return two(this, tr, (a, b, f, s) => { Audio.play('rope', { pos: s.p }); return elastic(g, a, b, f.p, s.p, { stiffness: this.o.stiffness, damping: this.o.damping }); }); },
    reload(tr) { return removeConstraints(tr, 'elastic'); },
  };
  T.nocollide = {
    name: 'No-Collide', cat: 'Constraints', help: ['Left click: two objects that should pass through each other', 'Right click: this object collides only with the world'], options: [],
    left(tr) { return two(this, tr, (a, b) => (b ? nocollide(g, a, b) : null)); },
    right(tr) { if (!needEntity(tr)) return false; const e = tr.entity; e.setCollisions(!e.collide); g.hud.notify(e.collide ? 'Collisions on' : 'Collides with world only'); return true; },
  };

  T.balloon = {
    name: 'Balloon', cat: 'Construction', help: ['Left click: tie a balloon here', 'Right click: balloon without a rope'],
    options: [{ key: 'force', label: 'Lift force', type: 'slider', min: 0.1, max: 5, step: 0.1, value: 1 }, { key: 'length', label: 'Rope length (m)', type: 'slider', min: 0.5, max: 8, step: 0.25, value: 2 }, { key: 'color', label: 'Colour', type: 'color', value: '#ff3030' }],
    left(tr) {
      if (!tr) return false;
      const e = createBalloon(g, V(tr.point), { color: this.o.color, force: this.o.force, ropeLength: this.o.length, target: needEntity(tr) ? tr.entity : null, point: V(tr.point), normal: tr.normal });
      undo('Balloon', [e]); g.onToolSpawn?.('balloon', e, tr.entity);
      return true;
    },
    right(tr) { if (!tr) return false; const e = createBalloon(g, V(tr.point).addScaledVector(V(tr.normal), 0.5), { color: this.o.color, force: this.o.force }); undo('Balloon', [e]); return true; },
  };
  T.thruster = {
    name: 'Thruster', cat: 'Construction', help: ['Left click: attach a thruster (it pushes away from the surface)', 'Keys: set in the options below'],
    options: [{ key: 'force', label: 'Force', type: 'slider', min: 0.1, max: 10, step: 0.1, value: 1.5 }, { key: 'keyFwd', label: 'Key (forward)', type: 'select', choices: KEY_CHOICES, value: 1 }, { key: 'keyBack', label: 'Key (reverse)', type: 'select', choices: KEY_CHOICES, value: 2 }, { key: 'toggle', label: 'Toggle on/off', type: 'check', value: false }],
    left(tr) { if (!tr) return false; const e = createThruster(g, tr.point, tr.normal, needEntity(tr) ? tr.entity : null, { ...this.o }); undo('Thruster', [e]); g.onToolSpawn?.('thruster', e, tr.entity); return true; },
  };
  T.wheel = {
    name: 'Wheel', cat: 'Construction', help: ['Left click: attach a motor wheel (axle along the surface normal)', 'Keys: forward / reverse set below'],
    options: [{ key: 'radius', label: 'Radius (m)', type: 'slider', min: 0.2, max: 1.2, step: 0.05, value: 0.45 }, { key: 'torque', label: 'Torque', type: 'slider', min: 0.2, max: 6, step: 0.1, value: 1.5 }, { key: 'keyFwd', label: 'Key (forward)', type: 'select', choices: KEY_CHOICES, value: 1 }, { key: 'keyBack', label: 'Key (reverse)', type: 'select', choices: KEY_CHOICES, value: 2 }],
    left(tr) { if (!tr) return false; const e = createWheel(g, tr.point, tr.normal, needEntity(tr) ? tr.entity : null, { ...this.o }); undo('Wheel', [e]); g.onToolSpawn?.('wheel', e, tr.entity); return true; },
  };
  T.hoverball = {
    name: 'Hoverball', cat: 'Construction', help: ['Left click: attach a hoverball — holds its height', 'Keys raise / lower it'],
    options: [{ key: 'strength', label: 'Strength', type: 'slider', min: 0.1, max: 3, step: 0.1, value: 1 }, { key: 'keyUp', label: 'Key (up)', type: 'select', choices: KEY_CHOICES, value: 1 }, { key: 'keyDown', label: 'Key (down)', type: 'select', choices: KEY_CHOICES, value: 2 }],
    left(tr) { if (!tr) return false; const e = createHoverball(g, tr.point, tr.normal, needEntity(tr) ? tr.entity : null, { ...this.o }); undo('Hoverball', [e]); return true; },
  };
  T.dynamite = {
    name: 'Dynamite', cat: 'Construction', help: ['Left click: plant dynamite', 'Press its key to light the fuse'],
    options: [{ key: 'key', label: 'Detonate key', type: 'select', choices: KEY_CHOICES, value: 5 }, { key: 'damage', label: 'Power', type: 'slider', min: 0.3, max: 3, step: 0.1, value: 1 }],
    left(tr) { if (!tr) return false; const e = createDynamite(g, tr.point, tr.normal, needEntity(tr) ? tr.entity : null, { ...this.o }); undo('Dynamite', [e]); return true; },
  };
  T.lamp = {
    name: 'Lamp', cat: 'Construction', help: ['Left click: attach a spot lamp', 'Its key toggles it'],
    options: [{ key: 'color', label: 'Colour', type: 'color', value: '#fff2d6' }, { key: 'brightness', label: 'Brightness', type: 'slider', min: 0.2, max: 3, step: 0.1, value: 1 }, { key: 'key', label: 'Toggle key', type: 'select', choices: KEY_CHOICES, value: 6 }],
    left(tr) { if (!tr) return false; const e = createLamp(g, tr.point, tr.normal, needEntity(tr) ? tr.entity : null, { ...this.o }); undo('Lamp', [e]); return true; },
  };
  T.remover = {
    name: 'Remover', cat: 'Construction', help: ['Left click: remove an object', 'Right click: remove the whole contraption', 'Reload: remove its constraints only'], options: [],
    left(tr) {
      if (!needEntity(tr) || tr.entity.flags.noRemove) return false;
      tr.entity.remove({ effect: 'dissolve' }); Audio.play('remove', { pos: tr.point }); g.onRemoveTool?.(tr.entity); return true;
    },
    right(tr) {
      if (!needEntity(tr) || tr.entity.flags.noRemove) return false;
      const all = contraption(tr.entity).filter((e) => !e.flags.noRemove);
      for (const e of all) e.remove({ effect: 'dissolve' });
      Audio.play('remove', { pos: tr.point });
      g.hud.notify(`Removed ${all.length} object${all.length > 1 ? 's' : ''}`);
      return true;
    },
    reload(tr) { if (!needEntity(tr)) return false; const n = tr.entity.constraints.size; for (const c of [...tr.entity.constraints]) c.remove(); return n > 0; },
  };
  T.weight = {
    name: 'Weight', cat: 'Construction', help: ['Left click: set the mass', 'Right click: copy the mass of an object'], options: [{ key: 'mass', label: 'Mass (kg)', type: 'slider', min: 1, max: 2000, step: 1, value: 100 }],
    left(tr) { if (!needEntity(tr)) return false; tr.entity.setMass(this.o.mass); g.hud.notify(`${tr.entity.name}: ${this.o.mass} kg`); return true; },
    right(tr) { if (!needEntity(tr)) return false; this.o.mass = Math.round(tr.entity.mass); g.hud.notify(`Copied ${this.o.mass} kg`); g.spawnmenu?.refreshTool(); return true; },
  };
  T.duplicator = {
    name: 'Duplicator', cat: 'Construction', help: ['Right click: copy a contraption', 'Left click: paste it'], options: [],
    right(tr) {
      if (!needEntity(tr)) return false;
      this.copy = serializeContraption(g, tr.entity);
      g.hud.notify(`Copied ${this.copy.entities.length} object${this.copy.entities.length > 1 ? 's' : ''}`);
      return true;
    },
    left(tr) {
      if (!this.copy || !tr) return false;
      const made = pasteContraption(g, this.copy, V(tr.point), g.player.rig.yaw);
      undo('Duplication', made.entities, made.constraints);
      return made.entities.length > 0;
    },
  };
  T.colour = {
    name: 'Colour', cat: 'Render', help: ['Left click: paint', 'Right click: copy colour', 'Reload: reset'], options: [{ key: 'color', label: 'Colour', type: 'color', value: '#2fb8ff' }],
    left(tr) { if (!needEntity(tr)) return false; tr.entity.setColor(this.o.color); return true; },
    right(tr) { if (!needEntity(tr) || !tr.entity.color) return false; this.o.color = tr.entity.color; g.spawnmenu?.refreshTool(); return true; },
    reload(tr) { if (!needEntity(tr)) return false; tr.entity.setColor('#ffffff'); tr.entity.color = null; return true; },
  };
  T.material = {
    name: 'Material', cat: 'Render', help: ['Left click: apply surface material (changes sound and friction too)', 'Right click: copy material'],
    options: [{ key: 'material', label: 'Material', type: 'select', choices: PAINTABLE_MATERIALS.map((k) => [k, materialLabel(k)]), value: 'chrome' }],
    left(tr) { if (!needEntity(tr)) return false; tr.entity.setMaterial(this.o.material); return true; },
    right(tr) { if (!needEntity(tr) || !tr.entity.materialKey) return false; this.o.material = tr.entity.materialKey; g.spawnmenu?.refreshTool(); return true; },
  };
  T.ignite = {
    name: 'Ignite', cat: 'Render', help: ['Left click: set on fire', 'Right click: extinguish'], options: [{ key: 'time', label: 'Burn time (s)', type: 'slider', min: 1, max: 60, step: 1, value: 10 }],
    left(tr) { if (!needEntity(tr)) return false; tr.entity.ignite(this.o.time); return true; },
    right(tr) { if (!needEntity(tr)) return false; tr.entity.extinguish(); return true; },
  };

  function removeConstraints(tr, type) {
    if (!needEntity(tr)) return false;
    let n = 0;
    for (const c of [...tr.entity.constraints]) if (c.type === type) { c.remove(); n++; }
    if (n) g.hud.notify(`Removed ${n} ${type}${n > 1 ? 's' : ''}`);
    return n > 0;
  }

  // default option values -> tool.o
  for (const [id, t] of Object.entries(T)) {
    t.id = id;
    t.stage = 0;
    t.o = {};
    for (const o of t.options) t.o[o.key] = o.value;
  }
  return T;
}

export const TOOL_ORDER = ['weld', 'axis', 'ballsocket', 'rope', 'elastic', 'nocollide', 'balloon', 'thruster', 'wheel', 'hoverball', 'dynamite', 'lamp', 'remover', 'weight', 'duplicator', 'colour', 'material', 'ignite'];
export { COLORS };

/* ------------------------------------------------------------------ duplicator */
function serializeContraption(g, root) {
  const ents = contraption(root).filter((e) => e.body && (e.kind === 'prop' || ATTACHMENT_FACTORIES[e.kind] || e.kind === 'balloon'));
  const baseP = root.curr.p.clone();
  const minY = Math.min(...ents.map((e) => e.curr.p.y - (e.halfHeight || 0.3)));
  const yaw = g.player.rig.yaw;
  const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const index = new Map(ents.map((e, i) => [e, i]));
  const entities = ents.map((e) => ({
    kind: e.kind, key: e.key,
    p: e.curr.p.clone().sub(baseP).setY(e.curr.p.y - minY).applyQuaternion(inv).toArray(),
    q: inv.clone().multiply(e.curr.q).toArray(),
    frozen: e.frozen, color: e.color, material: e.materialKey, data: e.data ? { ...e.data } : null,
    parent: e.parentEntity && index.has(e.parentEntity) ? index.get(e.parentEntity) : -1,
  }));
  const cons = [];
  const seen = new Set();
  for (const e of ents) for (const c of e.constraints) {
    if (seen.has(c) || !index.has(c.a) || (c.b && !index.has(c.b))) continue;
    seen.add(c);
    if (c.b === null) continue;   // world attachments do not duplicate
    cons.push({ type: c.type, a: index.get(c.a), b: index.get(c.b), data: JSON.parse(JSON.stringify(c.data)) });
  }
  return { entities, constraints: cons };
}

function pasteContraption(g, copy, point, yaw) {
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const made = [];
  const constraints = [];
  for (const d of copy.entities) {
    const p = new THREE.Vector3().fromArray(d.p).applyQuaternion(rot).add(point).add(new THREE.Vector3(0, 0.05, 0));
    const q = rot.clone().multiply(new THREE.Quaternion().fromArray(d.q));
    let e = null;
    if (d.kind === 'prop') e = g.entities.spawnProp(d.key, p, q, { owner: 'player', color: d.color, material: d.material });
    else if (d.kind === 'balloon') e = createBalloon(g, p, { color: d.data?.color, force: d.data?.force });
    else if (ATTACHMENT_FACTORIES[d.kind]) {
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      e = ATTACHMENT_FACTORIES[d.kind](g, p, n, null, d.data || {});
      e.setTransform(p, q);
    }
    if (e) e.owner = 'player';
    made.push(e);
  }
  for (const c of copy.constraints) {
    const a = made[c.a], b = made[c.b];
    if (!a || !b) continue;
    let k = null;
    const pa = a.localToWorld(new THREE.Vector3().fromArray(c.data.la));
    const pb = b.localToWorld(new THREE.Vector3().fromArray(c.data.lb));
    if (c.type === 'weld') k = weld(g, a, b);
    else if (c.type === 'ballsocket') k = ballsocket(g, a, b, pa);
    else if (c.type === 'rope') k = rope(g, a, b, pa, pb, { length: c.data.length, width: c.data.width });
    else if (c.type === 'elastic') k = elastic(g, a, b, pa, pb, { stiffness: c.data.stiffness, damping: c.data.damping });
    else if (c.type === 'nocollide') k = nocollide(g, a, b);
    else if (c.type === 'axis') {
      const p2 = a.localToWorld(new THREE.Vector3().fromArray(c.data.la2));
      k = axis(g, a, b, pa, p2.clone().sub(pa).normalize());
    }
    if (k) constraints.push(k);
  }
  copy.entities.forEach((d, i) => {
    const e = made[i];
    if (!e) return;
    if (d.parent >= 0 && made[d.parent]) { e.parentEntity = made[d.parent]; made[d.parent].attachments.add(e); }
    if (d.frozen) e.setFrozen(true, false);
  });
  Audio.play('spawn');
  return { entities: made.filter(Boolean), constraints };
}

/* ------------------------------------------------------------------ the gun */
export class ToolGun extends Weapon {
  constructor(game) {
    super(game, { id: 'toolgun', name: 'Tool Gun', slot: 6, model: toolgunModel, base: [0.18, -0.2, -0.36] });
    this.tools = buildTools(game);
    this.current = 'weld';
    this.screenTime = 0;
    game.toolgun = this;
    this._drawScreen();
  }

  get tool() { return this.tools[this.current]; }

  setTool(id) {
    if (!this.tools[id]) return;
    if (this.tool) this.tool.stage = 0;
    this.current = id;
    this.game.hud?.toolStatus(null);
    this._drawScreen();
  }

  _drawScreen() {
    const tex = this.parts.screenTex;
    if (!tex) return;
    const c = tex.userData.canvas, g = c.getContext('2d');
    g.fillStyle = '#0b1a2a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#9fdcff'; g.shadowColor = '#3fa9ff'; g.shadowBlur = 12;
    g.font = 'bold 40px Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(this.tool.name, c.width / 2, c.height / 2);
    tex.needsUpdate = true;
  }

  update(input, dt) {
    super.update(input, dt);
    const act = input.justPressed('primary') ? 'left' : input.justPressed('secondary') ? 'right' : input.justPressed('reload') ? 'reload' : null;
    if (!act || this.cooldown > 0) return;
    const t = this.tool;
    if (!t[act]) return;
    if (!this.game.canUseTool?.(this.current)) { Audio.play('toolgun_error'); return; }
    this.cooldown = 0.18;
    const tr = this.game.trace(200);
    const ok = t[act].call(t, tr);
    const from = this.muzzleWorld();
    this.kick = 1;
    if (ok) {
      Audio.play('toolgun_fire', { volume: 0.7 });
      if (tr) {
        this.game.fx.tracer(from, V(tr.point), { color: new THREE.Color(1.2, 2.6, 4), width: 0.012, speed: 400 });
        this.game.fx.beamHit(V(tr.point), tr.normal);
      }
    } else {
      Audio.play('toolgun_error');
      if (tr) this.game.fx.tracer(from, V(tr.point), { color: new THREE.Color(2, 0.4, 0.3), width: 0.008, speed: 400 });
    }
  }

  holster() { if (this.tool) this.tool.stage = 0; this.game.hud?.toolStatus(null); }
  hudInfo() { return null; }
}

export { textTexture };
