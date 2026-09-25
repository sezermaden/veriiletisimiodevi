// Turf Clash bot: a full Player (opts.isBot) wrapped in an Entity. step → brain then player.step
// with a fake input; render → player.render. The Player is pushed into session.actors so ink hits
// it like anyone else. Respawn goes through player.onRespawn (called by Player for bots).
import * as THREE from 'three';
import { Entity } from '../entities/base.js';
import { Player } from '../actors/player.js';
import { BotBrain } from './bot-ai.js';

/** The input a bot's Player reads: level-triggered only (edges go straight into player buffers). */
export class BotInput {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.fire = false;
    this.swim = false;
  }
  isDown(a) { return a === 'fire' ? this.fire : a === 'swim' ? this.swim : false; }
  justPressed() { return false; }
  triggerValue(a) { return this.isDown(a) ? 1 : 0; }
}

export const BOT_NAMES = [
  'Nori', 'Fizzwick', 'Pebble', 'Scoot', 'Jellybean', 'Kelpie', 'Mako', 'Wasabi', 'Zuzu', 'Riptide',
  'Bubbles', 'Coral', 'Sprocket', 'Tadpole', 'Glimmer', 'Squall', 'Marlo', 'Pip', 'Dotty', 'Blotch',
];
const SKINS = ['#f4c29b', '#e8b08a', '#c98a5e', '#8d5a3b', '#f8d6b8', '#6b4430', '#ffd9c0', '#b77b52'];
const TOPS = ['#27325e', '#e0453a', '#2fae62', '#ffd23f', '#7b3be0', '#1c1d24', '#f2f2f2', '#2f7fd8', '#ff7aa8', '#3fd0c9'];
const SHOES = ['#f2f2f2', '#1c1d24', '#ff8a1f', '#2fd0ff', '#e0453a', '#ffd23f'];
const HAIR = ['tails', 'bob', 'spikes'];

const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

/** Distinct look per bot (skin/top/shoes colours, hair style). */
export function botLook(r = Math.random) {
  return {
    skin: pick(SKINS, r), top: pick(TOPS, r), topAccent: pick(['#ffffff', '#1c1d24', '#ffd23f'], r),
    bottom: pick(['#2a2a38', '#27325e', '#4a3a2a', '#1c1d24'], r), shoes: pick(SHOES, r), shoeAccent: pick(SHOES, r),
    eye: pick(['#2b1d14', '#1a3a5a', '#2f5a2a', '#3a2616'], r), hair: pick(HAIR, r),
  };
}

const _sep = new THREE.Vector3();

export class TurfBot extends Entity {
  /**
   * @param {Session} session
   * @param {TurfMode} mode
   * @param {object} o  team, kit, name, look, difficulty, spawn {pos, yaw}, lane
   */
  constructor(session, mode, o) {
    super(session, { type: 'turf-bot' });
    this.mode = mode;
    this.input = new BotInput();
    this.aimYaw = o.spawn?.yaw ?? 0;
    this.home = o.spawn;
    this.player = new Player(session, { isBot: true, team: o.team, kit: o.kit, name: o.name, look: o.look, upgrades: {} });
    const p = this.player;
    p.bot = this;
    p.botMove = new THREE.Vector3();
    session.actors.push(p);
    this.brain = new BotBrain(this, mode, o.difficulty);
    this.brain.lane = o.lane ?? 0;
    p.onRespawn = () => this.respawn();
    p.onDamaged = (amount, info) => this.brain.onDamaged(amount, info);
    if (o.spawn) p.spawn(new THREE.Vector3().fromArray(o.spawn.pos), o.spawn.yaw);
    this.brain.reset();
  }

  get name() { return this.player.name; }

  respawn() {
    const sp = this.mode.spawnFor(this.player) || this.home;
    const pos = new THREE.Vector3().fromArray(sp.pos);
    this.player.spawn(pos, sp.yaw);
    this.aimYaw = sp.yaw + Math.PI;
    const S = this.session;
    S.fx.explosion(pos, new THREE.Vector3(0, 1, 0), S.ink.color(this.player.team), 1.2);
    S.ink.paint(pos, 1.4, this.player.team, new THREE.Vector3(0, 1, 0));
    S.audio?.sfx('superjump', { pos, volume: 0.4 });
    this.brain.reset();
    this.mode.onBotRespawn?.(this);
  }

  step(dt) {
    const p = this.player, inp = this.input;
    if (this.mode.botsActive && p.alive && !p.frozen) {
      this.brain.step(dt);
      const b = this.brain;
      // world move → camera-relative intent for Player.step
      const y = this.aimYaw;
      const fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      inp.move.y = b.move.x * fx + b.move.z * fz;
      inp.move.x = b.move.x * rx + b.move.z * rz;
      inp.fire = b.fire;
      inp.swim = b.swim;
    } else {
      inp.move.x = inp.move.y = 0;
      inp.fire = inp.swim = false;
    }
    p.swimToggled = inp.swim;          // honour the swim-toggle setting path in Player.step
    p.step(dt, inp, this.aimYaw);
    if (p.alive && !p.submerged && !p.frozen) this.separate();
  }

  /** Bots shouldn't stand inside each other (the session only separates the player). */
  separate() {
    const p = this.player;
    for (const a of this.mode.allPlayers) {
      if (a === p || !a.alive || a.submerged || a.flying || a.isPlayer) continue;
      const dy = Math.abs(a.position.y - p.position.y);
      if (dy > 1.2) continue;
      _sep.set(p.position.x - a.position.x, 0, p.position.z - a.position.z);
      const d = _sep.length();
      if (d > 0.62 || d < 1e-5) continue;
      p.position.addScaledVector(_sep.divideScalar(d), (0.62 - d) * 0.5);
    }
  }

  render(dt) { this.player.render(dt); }

  dispose() {
    const S = this.session;
    const i = S.actors.indexOf(this.player);
    if (i >= 0) S.actors.splice(i, 1);
    this.player.dispose();
    super.dispose();
  }
}
