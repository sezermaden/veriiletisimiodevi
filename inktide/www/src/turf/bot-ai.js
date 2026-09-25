// Turf Clash bot brain. Drives a Player (opts.isBot) through a fake input: movement intent, fire /
// swim held, jump/sub/special buffers and the aim ray.
//
// States: paint (pick a neutral/enemy floor cell, travel there — swimming through own ink, painting
// the way — then sweep the area), fight (lead + difficulty-scaled error and reaction time, strafe,
// keep the weapon's preferred distance, bombs), refill (swim in own ink when the tank is low),
// regroup (fall back when hurt / head back to the front after a respawn, sometimes super jump to a
// teammate) and special (use the special when it pays off). The brain "thinks" at ~10 Hz
// (perception, decisions, paths); the per-step part only steers, aims and fires.
import * as THREE from 'three';
import { MAINS } from '../weapons/base.js';
import { TEAM_HERO } from '../ink/ink-system.js';
import { WALK, JUMP, CLIMB, DROP } from './nav.js';

export const DIFFICULTY = {
  easy: { errFloor: 0.55, chargeErr: 1.6, react: 0.85, aimErr: 0.24, track: 0.6, turn: 4, fireCone: 0.14, sight: 18, subChance: 0.1, specialDelay: [5, 10], strafe: 0.3, retreatHp: 0.2, jump: 0, superJump: 0, engage: 0.75, dodge: 0, evade: 0.3 },
  normal: { errFloor: 0.45, chargeErr: 1.35, react: 0.5, aimErr: 0.16, track: 1.0, turn: 7, fireCone: 0.1, sight: 26, subChance: 0.3, specialDelay: [1.5, 5], strafe: 0.75, retreatHp: 0.32, jump: 0.06, superJump: 0.2, engage: 0.9, dodge: 0.15, evade: 0.65 },
  hard: { errFloor: 0.3, chargeErr: 1.1, react: 0.22, aimErr: 0.05, track: 2.4, turn: 11, fireCone: 0.075, sight: 33, subChance: 0.5, specialDelay: [0.4, 2.5], strafe: 1, retreatHp: 0.36, jump: 0.14, superJump: 0.4, engage: 1.15, dodge: 0.35, evade: 0.9 },
};

// per weapon class: preferred fight distance, paint aim distance, fire style
const PROFILE = {
  shooter: { pref: 6.5, paint: 5.5, style: 'hold' },
  dualies: { pref: 6, paint: 5, style: 'hold' },
  splatling: { pref: 10, paint: 8, style: 'spin' },
  charger: { pref: 16, paint: 11, style: 'charge' },
  blaster: { pref: 5.5, paint: 5, style: 'hold' },
  slosher: { pref: 6, paint: 5.5, style: 'hold' },
  roller: { pref: 1.5, paint: 1.6, style: 'roll' },
  brush: { pref: 1.5, paint: 1.6, style: 'hold' },
};

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _e = new THREE.Vector3();
const _t = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _q = new THREE.Vector3();
const _j = new THREE.Vector3();
const _jp = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const CLIMB_CHECK = [0.25, 0.6, 0.92];
const SIDES = [-0.4, 0.4];
const JUMP_PROBE = [1.2, 2.4, 3.4];

export class BotBrain {
  constructor(bot, mode, difficulty = 'normal') {
    this.bot = bot;
    this.p = bot.player;
    this.mode = mode;
    this.S = bot.session;
    this.D = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.teamBit = this.p.team === TEAM_HERO ? 1 : 2;
    this.sign = this.p.team === TEAM_HERO ? 1 : -1;       // +x is "forward" for Alpha
    const def = this.p.kit.def;
    this.cls = MAINS[def.main] ? def.main : 'shooter';
    this.prof = PROFILE[this.cls] || PROFILE.shooter;
    this.lane = 0;
    this.aggro = rnd(0.85, 1.2);
    // outputs consumed by TurfBot each step
    this.move = new THREE.Vector3();
    this.fire = false;
    this.swim = false;
    this.aimDir = new THREE.Vector3(1, 0, 0);
    this.aimWant = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    // memory
    this.goal = new THREE.Vector3();
    this.hasGoal = false;
    this.path = null;
    this.pathIdx = 0;
    this.pathGoalNode = -1;
    this.repathT = 0;
    this.avoid = new Map();       // edge index → until time
    this.target = null;
    this.targetSeenT = -9;
    this.lastSeen = new THREE.Vector3();
    this.reactT = 0;
    this.errV = new THREE.Vector3();
    this.errT = 0;
    this.trackT = 0;
    this.state = 'regroup';
    this.stateT = 0;
    this.thinkT = Math.random() * 0.1;
    this.sweep = Math.random() * 6;
    this.areaT = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.subCool = rnd(2, 5);
    this.specialWait = rnd(...this.D.specialDelay);
    this.stuckT = 0;
    this.lastPos = new THREE.Vector3();
    this.progT = 0;
    this.climb = null;
    this.fireWas = false;
    this.releaseT = 0;
    this.tapT = 0;
    this.hurtBy = null;
    this.hurtT = -9;
    this.ledgeT = 0;
    this.dodgeT = 0;
    this.throwT = 0;
    this.throwWant = new THREE.Vector3();
    this.lastMove = new THREE.Vector3();
    this.nudge = new THREE.Vector3();
    this.nudgeT = 0;
    this.climbAim = false;
    this.climbActive = false;     // stepClimb ran this step (edge guard / stuck checks)
    this.pathDrop = false;        // followPath is steering along a DROP edge this step
    this.evadeT = 0;              // running from an incoming missile barrage
    this.holdFireT = 0;
    this.evadeDir = new THREE.Vector3();
    this.evadeFrom = null;
    this.evadeSeenT = -9;
    this.travelled = 0;
    this._prevPos = new THREE.Vector3();
    this.debug = { goals: 0, paths: 0, pathFails: 0, stuck: 0, climbs: 0, climbFails: 0, subs: 0, specials: 0, superJumps: 0 };
  }

  get nav() { return this.mode.nav; }

  reset() {
    this.path = null; this.hasGoal = false; this.target = null; this.climb = null;
    this.state = 'regroup'; this.stateT = 0; this.stuckT = 0; this.progT = 0;
    this.evadeT = 0; this.nudgeT = 0; this.throwT = 0;
    this.specialWait = rnd(...this.D.specialDelay);
    this.lastPos.copy(this.p.position); this._prevPos.copy(this.p.position);
    this.aimDir.set(this.sign, 0, 0);
  }

  onDamaged(amount, info) {
    const src = info?.source;
    if (src && src.team !== undefined && src.team !== this.p.team && src.alive) {
      this.hurtBy = src; this.hurtT = this.S.time;
      if (!this.target) { this.target = src; this.reactT = this.D.react * 0.6; this.targetSeenT = this.S.time; this.lastSeen.copy(src.position); }
    }
  }

  // =============================================================================================
  step(dt) {
    const p = this.p, S = this.S;
    this.move.set(0, 0, 0);
    this.fire = false;
    this.swim = false;
    if (!p.alive || p.frozen) { this.fireWas = false; return; }
    this.eye.copy(p.position).setY(p.position.y + (p.form === 'squid' ? 0.6 : 1.15));
    this.travelled += Math.hypot(p.position.x - this._prevPos.x, p.position.z - this._prevPos.z);
    this._prevPos.copy(p.position);

    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT += 0.1; this.think(0.1); }
    this.stateT += dt;
    this.subCool -= dt;
    this.releaseT -= dt;
    this.ledgeT -= dt;
    this.dodgeT -= dt;
    this.throwT -= dt;
    this.nudgeT -= dt;
    this.evadeT -= dt;

    // default aim: where we are going
    let aiming = false;
    this.climbAim = false;
    this.climbActive = false;
    this.climbSwim = false;
    this.pathDrop = false;
    const special = p.kit.special;
    if (this.state === 'fight' && this.target) aiming = this.stepFight(dt);
    else if (this.state === 'special') aiming = this.stepSpecial(dt, special);
    else if (this.state === 'refill') this.stepRefill(dt);
    else if (this.state === 'regroup') this.stepRegroup(dt);
    else aiming = this.stepPaint(dt);
    if (this.climbAim) aiming = true;
    if (this.throwT > 0) { this.aimWant.copy(this.throwWant); aiming = true; this.swim = false; this.fire = false; }
    if (this.nudgeT > 0) this.move.copy(this.nudge);
    if (this.evadeT > 0 && this.state !== 'special' && !this.climbActive) {
      // missiles are tracking us: keep moving sideways (swim if we can), no shooting
      if (this.evadeT < 1.3 && !this.evadeFlipped) { this.evadeFlipped = true; if (Math.random() < 0.5) this.evadeDir.negate(); }
      this.move.copy(this.evadeDir);
      this.fire = false;
      this.swim = p.grounded && p.groundInk === p.team;
      aiming = false;
    }

    if (this.holdFireT > 0) { this.holdFireT -= dt; this.fire = false; }
    if (this.move.lengthSq() > 1) this.move.normalize();
    this.edgeGuard();
    if (!aiming) {
      // look along the travel direction, slightly down
      if (this.move.lengthSq() > 0.01) this.aimWant.copy(this.eye).addScaledVector(this.move, 6).setY(this.eye.y - 0.6);
      else this.aimWant.copy(this.eye).addScaledVector(this.aimDir, 6);
    }
    this.applyAim(dt);
    this.bot.aimYaw = Math.atan2(-this.aimDir.x, -this.aimDir.z);
    if (this.fire) this.swim = false;
    // edge: the frame fire goes down counts as a press
    if (this.fire && !this.fireWas) p.firePressed = true;
    this.fireWas = this.fire;
    this.lastMove.copy(this.move);
  }

  applyAim(dt) {
    _w.subVectors(this.aimWant, this.eye);
    const dist = Math.max(0.5, _w.length());
    _w.divideScalar(dist);
    const ang = this.aimDir.angleTo(_w);
    const maxA = this.D.turn * dt;
    if (ang <= maxA || ang < 1e-4) this.aimDir.copy(_w);
    else {
      // rotate toward the wanted direction by maxA (slerp on the unit sphere)
      const t = maxA / ang;
      this.aimDir.lerp(_w, t).normalize();
    }
    const p = this.p;
    p.aim.dir.copy(this.aimDir);
    p.aim.origin.copy(this.eye);
    p.aim.point.copy(this.eye).addScaledVector(this.aimDir, dist);
    p.aimPitch = Math.asin(Math.max(-1, Math.min(1, this.aimDir.y)));
    p.botMove = this.move;
  }

  // =============================================================================================
  think(dt) {
    const p = this.p, S = this.S, D = this.D, mode = this.mode;
    if (!mode.live) return;
    const inkF = p.ink / p.inkMax, hpF = p.hp / p.maxHp;

    // ---- perception ----
    let best = null, bestD = Infinity;
    const sight = D.sight;
    for (const a of mode.teamOf(p.enemyTeam)) {
      if (!a.alive || a.flying) continue;
      const d = a.position.distanceTo(p.position);
      if (d > sight) continue;
      if (a.submerged) {
        const hs = Math.hypot(a.velocity.x, a.velocity.z);
        if (!(d < 3 || (hs > 5 && d < 9))) continue;
      }
      a.hitCenter(_hc);
      if (!S.level.lineOfSight(this.eye, _hc)) continue;
      let score = d;
      if (a === this.target) score -= 4;
      if (a === this.hurtBy && S.time - this.hurtT < 2) score -= 6;
      score += (a.hp / a.maxHp) * 3;
      if (score < bestD) { bestD = score; best = a; }
    }
    if (best) {
      if (best !== this.target) {
        this.target = best;
        this.reactT = D.react * rnd(0.8, 1.3) * (S.time - this.hurtT < 1.5 ? 0.6 : 1);
        this.trackT = 0;
        this.rollError();
      }
      this.targetSeenT = S.time;
      this.lastSeen.copy(best.position);
    } else if (this.target && (!this.target.alive || S.time - this.targetSeenT > 1.6)) {
      this.target = null;
    }

    // ---- incoming missile barrage (reticle over our head): run sideways until it lands ----
    if (this.evadeT <= 0 && S.time - this.evadeSeenT > 3.5) {
      for (const a of mode.teamOf(p.enemyTeam)) {
        const sp = a.kit?.special;
        if (!sp?.active || !Array.isArray(sp.targets) || !sp.targets.includes(p)) continue;
        this.evadeSeenT = S.time;
        if (Math.random() >= (D.evade ?? 0.5)) break;
        _v.set(p.position.x - a.position.x, 0, p.position.z - a.position.z);
        if (_v.lengthSq() < 1e-4) _v.set(this.sign, 0, 0);
        _v.normalize();
        this.evadeDir.set(-_v.z, 0, _v.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1).addScaledVector(_v, 0.35).normalize();
        this.evadeT = 3.2;
        this.evadeFlipped = false;
        break;
      }
    }

    // ---- special ----
    const special = p.kit.special;
    if (this.state === 'special') {
      if (!special?.active && this.stateT > 0.6) this.setState('paint');
      else if (this.stateT > 9) this.setState('paint');
    } else if (p.special >= 100 && special) {
      this.specialWait -= dt;
      if (this.specialWait <= 0 && this.wantSpecial(special)) {
        this.setState('special');
        p.specialBuffer = 0.15;
        this.debug.specials++;
        this.specialWait = rnd(...D.specialDelay);
      }
    }

    // ---- state ----
    if (this.state !== 'special') {
      const tgt = this.target;
      const engageR = Math.min(sight, p.kit.main.range * 1.5 + 5) * D.engage * (tgt === this.hurtBy && S.time - this.hurtT < 2 ? 1.4 : 1);
      const engage = tgt && tgt.alive && tgt.position.distanceTo(p.position) < engageR;
      // only fight while the tank holds a useful shot (a dry charger would otherwise stand and stare)
      if (engage && inkF > 0.06 && p.ink >= this.shotInk() && !(this.state === 'regroup' && hpF < 0.5)) {
        if (hpF < D.retreatHp && tgt.hp / tgt.maxHp > hpF + 0.25) this.setState('regroup');
        else if (this.state !== 'fight') this.setState('fight');
      } else if (this.state === 'regroup' && (hpF < 0.8 || this.stateT < 1.2) && this.stateT < 5) {
        // keep falling back / heading out
      } else if (inkF < 0.2 || (this.state === 'refill' && inkF < 0.85 && this.stateT < 7)) {
        if (this.state !== 'refill') this.setState('refill');
      } else if (this.state !== 'paint') {
        this.setState('paint');
      }
    }

    // ---- goals + paths ----
    if (this.state === 'paint' || (this.state === 'regroup' && hpF >= 0.8)) {
      if (!this.hasGoal || this.goalDone()) this.pickPaintGoal();
    } else if (this.state === 'refill') {
      if (!this.hasGoal || this.goalKind !== 'refill') this.pickRefillGoal();
    } else if (this.state === 'regroup') {
      if (!this.hasGoal || this.goalKind !== 'retreat') this.pickRetreatGoal();
    } else if (this.state === 'fight' && this.target) {
      // chase / reposition toward the target (path only when there is no line of sight)
      if (S.time - this.targetSeenT > 0.25) {
        const n = this.nav.nearest(this.lastSeen, 3, this.teamBit);
        if (n >= 0 && this.nav.baseTeam[n] !== 3 - this.teamBit && this.lastSeen.distanceTo(p.position) < 22) this.setGoal(this.lastSeen, 'chase');
        else { this.target = null; this.setState('paint'); }
      }
    }
    this.repathT -= dt;
    if (!this.path) this.climb = null;
    const busy = p.flying || (special?.active && special.drivesMovement) || !p.grounded && p.velocity.y > 2;
    if (this.hasGoal && !this.climb && !busy && (!this.path || this.repathT <= 0)) this.plan();
    if (this.path && !this.climb) this.smoothPath();

    // ---- stuck detection: wanted to move but made < 0.5 m of progress in the last 1.5 s ----
    const ring = this.posRing || (this.posRing = { i: 0, pts: Array.from({ length: 15 }, () => new THREE.Vector3().copy(p.position)) });
    const old = ring.pts[ring.i];
    const moved = Math.hypot(p.position.x - old.x, p.position.z - old.z);
    old.copy(p.position);
    ring.i = (ring.i + 1) % ring.pts.length;
    const wantsMove = this.lastMove.lengthSq() > 0.2 && !this.climbActive && this.state !== 'fight' && !p.flying && !(special?.active && special.drivesMovement);
    if (wantsMove && moved < 0.5) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.stuckT > 0.6 && this.stuckT - dt <= 0.6 && p.grounded && this.safeJump(this.lastMove)) p.jumpBuffer = 0.15;
    if (this.stuckT > 1.4 && this.stuckT - dt <= 1.4) { this.path = null; this.noSmoothT = 3; }
    if (this.stuckT > 2.6) {
      this.debug.stuck++;
      this.stuckT = 0;
      this.path = null;
      this.hasGoal = false;
      this.nudge.set(rnd(-1, 1), 0, rnd(-1, 1)).normalize();
      this.nudgeT = 0.4;
      for (const pt of ring.pts) pt.copy(p.position);
    }

    this.dropEdge = this.onDropEdge();
    // the edge guard kept firing: the straight line was unsafe → re-plan and follow the nodes exactly
    if (this.guardT > 0.25) { this.guardT = 0; this.path = null; this.noSmoothT = 2.5; }
    this.noSmoothT = Math.max(0, (this.noSmoothT || 0) - dt);

    // ---- subs ----
    if (this.subCool <= 0 && p.form !== 'squid' && !special?.active) this.maybeSub();
  }

  /**
   * Would a jump (or a dualies dodge roll) along `dir` land on something? Samples the ground under
   * the arc (kid jump ≈ 3.5 m long). Keeps bots from hopping off piers and gangways mid-fight.
   */
  safeJump(dir) {
    const p = this.p, level = this.S.level;
    _j.set(dir.x, 0, dir.z);
    if (_j.lengthSq() < 1e-4) { _j.set(p.velocity.x, 0, p.velocity.z); if (_j.lengthSq() < 1e-4) return true; }
    _j.normalize();
    for (const d of JUMP_PROBE) {
      _jp.copy(p.position).addScaledVector(_j, d).setY(p.position.y + 1.2);
      const g = level.raycast(_jp, DOWN, 5, { staticOnly: true });
      if (!g || g.point.y < level.killY + 1.2 || g.normal.y < 0.5) return false;
    }
    return true;
  }

  /** Never walk or swim off into a void (water / kill plane) unless the path says drop. */
  edgeGuard() {
    const p = this.p;
    if (this.climbSwim || !p.grounded || this.move.lengthSq() < 0.01) return;
    const hs = Math.hypot(p.velocity.x, p.velocity.z);
    const look = 0.55 + hs * 0.17;
    const level = this.S.level;
    for (let k = 0; k < 2; k++) {
      // probe along the wanted move and along the current velocity
      if (k === 0) _v.set(this.move.x, 0, this.move.z);
      else if (hs > 1.5) _v.set(p.velocity.x, 0, p.velocity.z); else break;
      _v.normalize();
      _t.copy(p.position).addScaledVector(_v, look).setY(p.position.y + 0.6);
      let g = level.raycast(_t, DOWN, this.pathDrop ? 8.5 : 3.4, { staticOnly: true });
      if (g && g.point.y > level.killY + 1.2 && g.normal.y > 0.5) {
        // a ledge: at this speed, where do we come down? (a high drop carries us further out)
        const drop = p.position.y - g.point.y;
        if (drop < 0.8) continue;
        const reach = Math.max(hs, 2) * Math.sqrt((2 * drop) / 24) + 0.35;
        _t.copy(p.position).addScaledVector(_v, look + reach).setY(p.position.y + 0.6);
        g = level.raycast(_t, DOWN, drop + 3, { staticOnly: true });
        if (g && g.point.y > level.killY + 1.2 && g.normal.y > 0.5) continue;
      }
      const along = this.move.dot(_v);
      if (along > 0) this.move.addScaledVector(_v, -along);
      this.move.addScaledVector(_v, -0.7);
      if (this.evadeT > 0 && this.evadeDir.dot(_v) > 0) this.evadeDir.negate();
      this.ledgeT = 0.3;
      this.guardT = (this.guardT || 0) + 1 / 60;
      this.debug.edge = (this.debug.edge || 0) + 1;
      return;
    }
    this.guardT = Math.max(0, (this.guardT || 0) - 1 / 60);
  }

  setState(s) {
    if (s === this.state) return;
    this.state = s;
    this.stateT = 0;
    this.climb = null;          // a half-done climb must not outlive the state that started it
    if (s === 'paint' && this.goalKind !== 'paint') this.hasGoal = false;
    if (s !== 'fight') this.releaseT = 0;
  }

  // =============================================================================================
  // goals
  setGoal(pos, kind) {
    if (this.hasGoal && this.goalKind === kind && this.goal.distanceToSquared(pos) < 2) return;
    this.goal.copy(pos);
    this.goalKind = kind;
    this.hasGoal = true;
    this.path = null;
    this.areaT = 0;
    this.goalT = this.S.time;
    this.debug.goals++;
  }

  goalDone() {
    if (this.goalKind !== 'paint') return this.goalKind !== 'paint';
    // done after sweeping the area for a moment, or when the spot is ours now and we're near
    if (this.areaT > this.areaDur) return true;
    if (this.S.time - this.goalT > 22) return true;
    return false;
  }

  pickPaintGoal() {
    const mode = this.mode, p = this.p, nav = this.nav, ink = this.S.ink;
    let bestS = 0, bx = 0, by = 0, bz = 0;
    const mates = mode.teamOf(p.team);
    const halfLen = mode.halfLength;
    for (let k = 0; k < 22; k++) {
      const s = mode.samplePaintPoint(_v);
      if (!s) continue;
      const team = ink.inkAt(s.face, _v);
      if (team === p.team) continue;
      const d = _v.distanceTo(p.position);
      let score = (team === p.enemyTeam ? 1.45 : 1) * Math.exp(-d / 22) * (d < 3 ? 0.4 : 1);
      // lanes spread the team out; the front is where the match is decided
      score *= 0.45 + Math.exp(-((_v.z - this.lane) ** 2) / (2 * 11 * 11));
      const prog = (this.sign * _v.x + halfLen) / (2 * halfLen);
      score *= 0.55 + 0.9 * Math.exp(-((prog - 0.5 * this.aggro) ** 2) / (2 * 0.22 * 0.22));
      // neighbourhood need
      score *= 0.4 + (1 - ink.inkFraction(s.face, _v, 1.5, p.team));
      for (const m of mates) if (m !== p && m.bot?.brain?.hasGoal && m.bot.brain.goal.distanceToSquared(_v) < 49) score *= 0.3;
      if (score > bestS) {
        const n = nav.nearest(_v, 2.2, this.teamBit);
        if (n < 0 || nav.baseTeam[n]) continue;
        // floor that runs on under a solid block (a stack, a container) can never be inked
        _jp.copy(_v).setY(_v.y + 0.05);
        if (this.S.level.raycast(_jp, UP, 1.6, { staticOnly: true })) continue;
        bestS = score; bx = nav.px[n]; by = nav.py[n]; bz = nav.pz[n];
      }
    }
    if (bestS > 0) {
      this.setGoal(_q.set(bx, by, bz), 'paint');
      this.areaDur = rnd(0.9, 2.2);
    } else {
      // everything nearby is ours: push toward the enemy side
      const n = this.randomNodeToward(this.sign * halfLen * 0.4);
      if (n >= 0) { this.setGoal(_q.set(nav.px[n], nav.py[n], nav.pz[n]), 'paint'); this.areaDur = 1; }
    }
  }

  randomNodeToward(xWant) {
    const nav = this.nav;
    let best = -1, bs = Infinity;
    for (let k = 0; k < 16; k++) {
      const i = Math.floor(Math.random() * nav.count);
      if (!(nav.reach[i] & this.teamBit) || nav.baseTeam[i]) continue;
      const s = Math.abs(nav.px[i] - xWant) + Math.abs(nav.pz[i] - this.lane) * 0.5 + Math.random() * 6;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }

  pickRefillGoal() {
    // nearest own-ink node (sampled around us), else back toward the base
    const nav = this.nav, p = this.p;
    const onOwn = p.grounded && p.groundInk === p.team;
    let best = -1, bd = Infinity;
    nav._near(p.position.x, p.position.z, 14, (i) => {
      if (!(nav.reach[i] & this.teamBit)) return;
      if (nav.inkAt(i) !== p.team) return;
      const d = Math.hypot(nav.px[i] - p.position.x, nav.pz[i] - p.position.z) + Math.abs(nav.py[i] - p.position.y) * 2;
      if (d >= bd) return;
      // standing right on it without being in our ink = the rim of a splat: look for a real pool
      if (!onOwn && d < 0.9) return;
      if (nav.inkFrac(i, 0.8, p.team) < 0.45) return;
      bd = d; best = i;
    });
    if (best >= 0) this.setGoal(_q.set(nav.px[best], nav.py[best], nav.pz[best]), 'refill');
    else this.setGoal(this.mode.basePos(p.team), 'refill');
  }

  pickRetreatGoal() {
    // after a respawn head out; when hurt fall back toward own turf / teammates
    const p = this.p;
    if (p.hp / p.maxHp >= 0.8) { this.pickPaintGoal(); return; }
    const nav = this.nav;
    const away = this.hurtBy?.position || this.target?.position || null;
    let best = -1, bs = -Infinity;
    nav._near(p.position.x, p.position.z, 12, (i) => {
      if (!(nav.reach[i] & this.teamBit) || nav.baseTeam[i] === (3 - this.teamBit)) return;
      let s = nav.inkAt(i) === p.team ? 3 : 0;
      s -= this.sign * nav.px[i] * 0.15;           // toward home
      if (away) s += Math.hypot(nav.px[i] - away.x, nav.pz[i] - away.z) * 0.35;
      s += Math.random();
      if (s > bs) { bs = s; best = i; }
    });
    if (best >= 0) this.setGoal(_q.set(nav.px[best], nav.py[best], nav.pz[best]), 'retreat');
  }

  plan() {
    const nav = this.nav, p = this.p;
    this.repathT = 1.8 + Math.random() * 0.6;
    const a = nav.nearest(p.position, 3.2);
    let b = nav.nearest(this.goal, 3, this.teamBit);
    if (b >= 0 && nav.baseTeam[b] === 3 - this.teamBit) b = -1;
    if (a < 0 || b < 0) {
      this.path = null; this.debug.pathFails++;
      this.failLog(a < 0 ? 'no-start' : 'no-goal');
      if (b < 0) this.hasGoal = false;
      return;
    }
    let avoid = null;
    if (this.avoid.size) {
      for (const [e, until] of this.avoid) if (until < this.S.time) this.avoid.delete(e);
      if (this.avoid.size) avoid = new Set(this.avoid.keys());
    }
    const path = nav.findPath(a, b, this.teamBit, avoid);
    this.debug.paths++;
    if (!path) { this.path = null; this.hasGoal = false; this.debug.pathFails++; this.failLog('no-path'); return; }
    this.path = path;
    this.pathIdx = path.length > 1 ? 1 : 0;
    this.pathGoalNode = b;
  }

  failLog(reason) {
    const p = this.p.position;
    const l = this.debug.fails || (this.debug.fails = []);
    if (l.length < 6) l.push(`${reason}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}:${this.state}${this.p.flying ? ':fly' : ''}${this.p.kit.special?.active ? ':sp' : ''}`);
  }

  /** Skip waypoints we can already walk straight to. */
  smoothPath() {
    const nav = this.nav, path = this.path, p = this.p, level = this.S.level;
    if (this.noSmoothT > 0) return;
    for (let k = 0; k < 3 && this.pathIdx + 1 < path.length; k++) {
      const cur = path[this.pathIdx], nxt = path[this.pathIdx + 1];
      const e = nav.edge(cur, nxt);
      if (e < 0 || nav.eKind[e] !== WALK) break;
      const prev = this.pathIdx > 0 ? path[this.pathIdx - 1] : cur;
      const ep = nav.edge(prev, cur);
      if (ep >= 0 && nav.eKind[ep] !== WALK) break;
      if (Math.abs(nav.py[nxt] - p.position.y) > 0.45) break;
      _t.set(p.position.x, p.position.y + 0.55, p.position.z);
      _e.set(nav.px[nxt], nav.py[nxt] + 0.55, nav.pz[nxt]);
      if (!level.lineOfSight(_t, _e)) break;
      // the straight line (and a body width either side) must have ground all the way
      if (!this.lineHasGround(_t, _e, nav.py[nxt])) break;
      this.pathIdx++;
    }
  }

  lineHasGround(a, b, yEnd) {
    const level = this.S.level;
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const nx = -dz / Math.max(1e-4, len), nz = dx / Math.max(1e-4, len);
    const n = Math.max(2, Math.ceil(len / 0.6));
    const y0 = this.p.position.y;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      for (const side of SIDES) {
        _q.set(a.x + dx * t + nx * side, Math.max(y0, yEnd) + 0.8, a.z + dz * t + nz * side);
        const g = level.raycast(_q, DOWN, 2.2, { staticOnly: true });
        if (!g || g.normal.y < 0.6 || g.point.y < Math.min(y0, yEnd) - 0.45) return false;
      }
    }
    return true;
  }

  onDropEdge() {
    if (!this.path || this.pathIdx <= 0) return false;
    const e = this.nav.edge(this.path[this.pathIdx - 1], this.path[this.pathIdx]);
    return e >= 0 && this.nav.eKind[e] === DROP;
  }

  /** Steer along the path. Returns false when there is nothing to follow (arrived / no path). */
  followPath(dt, speedMul = 1, noClimb = false) {
    const nav = this.nav, p = this.p, path = this.path;
    if (!path) { this.climb = null; return false; }
    while (this.pathIdx < path.length) {
      const n = path[this.pathIdx];
      const dxz = Math.hypot(nav.px[n] - p.position.x, nav.pz[n] - p.position.z);
      const dy = nav.py[n] - p.position.y;
      if (dxz < 0.75 && dy < 0.6 && dy > -1.5) this.pathIdx++;
      else break;
    }
    if (this.pathIdx >= path.length) { this.path = null; return false; }
    const n = path[this.pathIdx];
    const prev = this.pathIdx > 0 ? path[this.pathIdx - 1] : -1;
    const e = prev >= 0 ? nav.edge(prev, n) : -1;
    const kind = e >= 0 ? nav.eKind[e] : WALK;
    if (kind === CLIMB) {
      if (noClimb) { this.climb = null; return false; }
      this.climbActive = true;
      return this.stepClimb(dt, e, n);
    }
    this.pathDrop = kind === DROP;
    _v.set(nav.px[n] - p.position.x, 0, nav.pz[n] - p.position.z);
    const dxz = _v.length();
    _v.divideScalar(Math.max(1e-4, dxz));
    // blend toward the waypoint after next for smoother corners
    if (dxz < 1.4 && this.pathIdx + 1 < path.length && kind === WALK) {
      const n2 = path[this.pathIdx + 1];
      _e.set(nav.px[n2] - p.position.x, 0, nav.pz[n2] - p.position.z).normalize();
      _v.lerp(_e, 0.35).normalize();
    }
    if (kind === JUMP && dxz < 1.9 && p.grounded && nav.py[n] - p.position.y > 0.2) {
      // the weapon must be idle first, or dualies turn the jump into a dodge roll
      this.holdFireT = 0.2;
      if (!p.kit.main.firing) p.jumpBuffer = 0.15;
      this.swim = false;
    }
    // step off ledges at a walk so the landing stays close to the waypoint
    this.move.addScaledVector(_v, kind === DROP && dxz < 2.2 ? speedMul * 0.55 : speedMul);
    return true;
  }

  /** Paint a wall and swim up it (nav CLIMB edge). */
  stepClimb(dt, e, n) {
    const nav = this.nav, p = this.p, S = this.S;
    const w = nav.eExtra[e];
    if (!w) { this.pathIdx++; return true; }
    if (!this.climb || this.climb.e !== e) this.climb = { e, phase: 'approach', t: 0 };
    const c = this.climb;
    c.t += dt;
    if (c.stand == null) {
      // stand off the wall where the path's low node is (≤ 1.7 m): that spot is known ground, a
      // fixed 1.7 m could be out over the water
      const lo = this.pathIdx > 0 ? this.path[this.pathIdx - 1] : -1;
      const dLo = lo >= 0 ? (nav.px[lo] - w.px) * w.nx + (nav.pz[lo] - w.pz) * w.nz : 1.2;
      c.stand = Math.min(1.7, Math.max(0.7, dLo));
    }
    const baseX = w.px + w.nx * c.stand, baseZ = w.pz + w.nz * c.stand;
    const failed = () => {
      this.avoid.set(e, S.time + 25);
      this.climb = null;
      this.path = null;
      this.debug.climbFails++;
      // the goal is up there: pick another one instead of trying every face of the same block
      if (this.hasGoal && this.goal.y > p.position.y + 1) this.hasGoal = false;
      return false;
    };
    if (c.phase === 'approach') {
      _v.set(baseX - p.position.x, 0, baseZ - p.position.z);
      const d = _v.length();
      if (d < 0.5 || c.t > 4) { c.phase = 'paint'; c.t = 0; }
      else this.move.copy(_v.divideScalar(d));
      if (c.t > 4 && d > 2) return failed();
      return true;
    }
    if (c.phase === 'paint') {
      // sweep the aim up and down the wall while firing
      const h = w.top - p.position.y;
      const k = 0.5 + 0.5 * Math.sin(c.t * 5);
      this.aimWant.set(w.px - w.nx * 0.05, p.position.y + 0.3 + k * Math.max(0.5, h - 0.2), w.pz - w.nz * 0.05);
      this.weaponFire(p.ink > 4, 'wall', 4);
      this.climbAim = true;
      // face the wall squarely
      this.move.set(0, 0, 0);
      let ok = 0;
      for (const f of CLIMB_CHECK) {
        _t.set(w.px - w.nx * 0.02, p.position.y + 0.3 + f * Math.max(0.5, h - 0.2), w.pz - w.nz * 0.02);
        if (S.ink.inkAt(w.face, _t) === p.team) ok++;
      }
      if (ok === 3 || (ok >= 2 && c.t > 1.6)) { c.phase = 'swim'; c.t = 0; }
      else if (c.t > 3.5) return failed();
      return 'aim';
    }
    // swim into the wall and up
    this.climbSwim = true;
    this.swim = true;
    this.move.set(-w.nx, 0, -w.nz);
    this.aimWant.set(w.px, w.top, w.pz);
    this.climbAim = true;
    if (p.position.y > w.top - 0.35 && !p.climbing) {
      this.climb = null;
      this.pathIdx++;
      this.debug.climbs++;
      return true;
    }
    if (c.t > 4.5) return failed();
    return true;
  }

  // =============================================================================================
  // per-state steering
  stepPaint(dt) {
    const p = this.p, nav = this.nav;
    const inkF = p.ink / p.inkMax;
    const r = this.followPath(dt);
    if (r === 'aim') return true;
    if (this.climb) return false;
    const toGoal = this.hasGoal ? Math.hypot(this.goal.x - p.position.x, this.goal.z - p.position.z) : 0;
    const arrived = !r && (!this.hasGoal || toGoal < 2.6);
    if (!r && this.hasGoal && toGoal >= 2.6) {
      // no path yet: walk straight at it (plan() will catch up)
      _v.set(this.goal.x - p.position.x, 0, this.goal.z - p.position.z).normalize();
      this.move.copy(_v);
    }
    this.sweep += dt * 3.1;
    if (arrived) {
      // sweep the area around the goal in a breathing spiral
      this.areaT += dt;
      const a = this.sweep * 1.1;
      const rad = 1.4 + (Math.min(this.prof.paint, 5.5) - 1.4) * (0.5 + 0.5 * Math.sin(this.sweep * 0.7));
      this.aimWant.set(p.position.x + Math.cos(a) * rad, p.position.y + 0.1, p.position.z + Math.sin(a) * rad);
      if (this.prof.style === 'roll') {
        this.move.set(Math.cos(a), 0, Math.sin(a));
        this.aimWant.set(p.position.x + Math.cos(a) * 2, p.position.y, p.position.z + Math.sin(a) * 2);
      }
      this.weaponFire(inkF > 0.08, 'paint', rad);
      return true;
    }
    // travelling: swim through own ink, otherwise walk and paint ahead
    const onOwn = p.grounded && p.groundInk === p.team;
    const nextOwn = this.path && this.pathIdx < this.path.length && nav.inkAt(this.path[this.pathIdx]) === p.team;
    if (onOwn && nextOwn && toGoal > 5 && !this.climb) {
      this.swim = true;
      return false;
    }
    if (inkF < 0.1) { this.swim = onOwn; return false; }
    const md = _v.copy(this.move);
    if (md.lengthSq() < 0.01) md.copy(this.aimDir).setY(0);
    md.normalize();
    const side = Math.sin(this.sweep) * 0.6;
    const ahead = this.prof.style === 'roll' ? 1.6 : this.prof.paint * (0.55 + 0.45 * Math.abs(Math.cos(this.sweep * 0.5)));
    this.aimWant.set(
      p.position.x + (md.x * Math.cos(side) - md.z * Math.sin(side)) * ahead,
      p.position.y + (this.prof.style === 'roll' ? 0 : 0.05),
      p.position.z + (md.z * Math.cos(side) + md.x * Math.sin(side)) * ahead,
    );
    this.weaponFire(true, 'paint', ahead);
    return true;
  }

  stepRefill(dt) {
    const p = this.p;
    const r = this.followPath(dt);
    const onOwn = p.grounded && p.groundInk === p.team;
    if (onOwn || p.submerged) {
      this.swim = true;
      // circle slowly inside our ink so the ripples don't give us away... and keep refilling
      if (!r) this.move.multiplyScalar(0);
    } else if (!r && this.hasGoal) {
      _v.set(this.goal.x - p.position.x, 0, this.goal.z - p.position.z);
      if (_v.lengthSq() > 0.09) this.move.copy(_v.normalize());
      else if (this.goalKind === 'refill') this.hasGoal = false;   // the pool got painted over: find another
    }
  }

  stepRegroup(dt) {
    const p = this.p;
    this.followPath(dt);
    if (this.climb) return;
    const onOwn = p.grounded && p.groundInk === p.team;
    if (onOwn && this.move.lengthSq() > 0.1) this.swim = true;
  }

  stepFight(dt) {
    const p = this.p, t = this.target, D = this.D, S = this.S;
    if (!t || !t.alive) { this.target = null; return false; }
    const d = t.position.distanceTo(p.position);
    const visible = S.time - this.targetSeenT < 0.25;
    this.reactT -= dt;
    this.trackT += dt;
    this.errT -= dt;
    if (this.errT <= 0) this.rollError();

    // ---- movement ----
    if (!visible) {
      // go where we last saw them
      if (!this.followPath(dt)) {
        _v.set(this.lastSeen.x - p.position.x, 0, this.lastSeen.z - p.position.z);
        if (_v.lengthSq() > 1) this.move.copy(_v.normalize());
      }
    } else {
      const pref = this.prof.pref * (this.cls === 'charger' ? 1 : 1 / this.aggro);
      _v.set(t.position.x - p.position.x, 0, t.position.z - p.position.z).normalize();
      _e.set(-_v.z, 0, _v.x);
      if (d > pref + 1.5) this.move.addScaledVector(_v, 1);
      else if (d < pref - 1.5) this.move.addScaledVector(_v, -0.8);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rnd(0.5, 1.4); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      if (this.cls !== 'charger' && this.prof.style !== 'roll') this.move.addScaledVector(_e, this.strafeDir * D.strafe * 0.8);
      if (D.jump > 0 && p.grounded && Math.random() < D.jump * dt * 3 && this.safeJump(this.move)) p.jumpBuffer = 0.15;
      // dodge: short squid hop in own ink between bursts (hard bots)
      if (D.dodge && p.groundInk === p.team && this.dodgeT < -0.8 && Math.random() < D.dodge * dt) { this.dodgeT = 0.35; }
    }
    if (this.dodgeT > 0) { this.swim = true; return false; }

    // ---- aim: lead + error ----
    t.hitCenter(_hc);
    const main = p.kit.main;
    const speed = main.s?.speed ?? 26;
    const tof = Math.min(1.2, d / Math.max(8, speed));
    _t.copy(_hc).addScaledVector(t.velocity, tof * 0.9);
    // drop compensation for arcing shots
    const straight = main.s?.straight ?? 0.15;
    const g = main.s?.gravity ?? 0;
    if (g && tof > straight) _t.y += 0.5 * g * (tof - straight) ** 2 * 0.85;
    if (this.cls === 'slosher' || this.cls === 'roller') _t.y += Math.min(1.5, d * 0.06);
    // error shrinks while tracking but never below a floor; long-range one-shot weapons get extra wobble
    const errScale = D.aimErr * Math.max(D.errFloor ?? 0.4, 1 - this.trackT * D.track * 0.35) * (this.prof.style === 'charge' ? D.chargeErr ?? 1 : 1);
    _t.addScaledVector(this.errV, d * errScale);
    this.aimWant.copy(_t);
    const want = _w.subVectors(_t, this.eye).normalize();
    const off = this.aimDir.angleTo(want);
    const cone = D.fireCone + (t.hitRadius || 0.4) / Math.max(1, d);
    const inRange = d < main.range * 1.25 + 1;
    const shoot = visible && this.reactT <= 0 && off < cone * 1.6 && inRange && p.ink > 1;
    // chargers / splatlings keep the charge while tracking and only release on target
    const hold = this.prof.style === 'charge' || this.prof.style === 'spin' ? visible && inRange && this.reactT <= 0.3 && p.ink > 1 : shoot;
    this.weaponFire(hold, 'fight', d, off < cone);
    return true;
  }

  stepSpecial(dt, special) {
    const p = this.p;
    const t = this.target;
    if (t && t.alive) {
      t.hitCenter(_hc);
      this.aimWant.copy(_hc);
      _v.set(t.position.x - p.position.x, 0, t.position.z - p.position.z);
      const d = _v.length();
      if (d > 4) this.move.copy(_v.normalize()).multiplyScalar(0.8);
    } else {
      const flying = special?.active && special.drivesMovement;
      // waypoints are on the floor (a flyer never "arrives"); no wall climbing while a special runs
      if (!flying) this.followPath(dt, 1, true);
      if (this.hasGoal) this.aimWant.copy(this.goal);
      else this.aimWant.copy(p.position).add(_v.set(this.sign * 8, 0, 0));
      // flying specials (Ink Jet): with nothing to shoot, cruise toward the goal / the front
      if (flying) {
        if (this.hasGoal) _v.set(this.goal.x - p.position.x, 0, this.goal.z - p.position.z);
        if (!this.hasGoal || _v.lengthSq() < 9) _v.set(this.sign * 3, 0, (this.lane - p.position.z) * 0.15);
        this.move.copy(_v.normalize()).multiplyScalar(0.7);
        // rain shots on the floor ahead
        this.aimWant.copy(p.position).addScaledVector(this.move, 9).setY(p.position.y - 5);
      }
    }
    if (special?.active && special.drivesMovement) this.overGround();
    this.fire = !!special?.active && this.stateT > 0.2 && !!(t && t.alive || Math.random() < 0.5);
    return true;
  }

  /** While a special flies us around (Ink Jet), never drift out over water: the landing would be fatal. */
  overGround() {
    const p = this.p, level = this.S.level, sp = p.kit.special;
    const ending = sp.phase === 'land' || (sp.t != null && sp.s?.duration != null && sp.t > sp.s.duration - 1.8);
    _jp.copy(p.position).addScaledVector(this.move, ending ? 0.5 : 2.5);
    const g = level.raycast(_jp, DOWN, 60, { staticOnly: true });
    const here = level.raycast(p.position, DOWN, 60, { staticOnly: true });
    const safe = (h) => h && h.point.y > level.killY + 1.2 && h.normal.y > 0.5;
    if (safe(g) && (safe(here) || !ending)) return;
    // steer to the closest walkable waypoint instead
    const nav = this.nav;
    let n = nav.nearest(_jp.set(p.position.x, p.position.y - 5, p.position.z), 10, this.teamBit);
    if (n < 0) n = nav.nearest(_jp.set(p.position.x, 0, p.position.z), 25, this.teamBit);
    if (n < 0) { this.move.set(this.sign, 0, 0); return; }
    this.move.set(nav.px[n] - p.position.x, 0, nav.pz[n] - p.position.z);
    if (this.move.lengthSq() > 1e-4) this.move.normalize();
  }

  wantSpecial(special) {
    const p = this.p, id = p.kit.def.special;
    const t = this.target;
    const d = t && t.alive ? t.position.distanceTo(p.position) : Infinity;
    const ink = this.S.ink;
    if (id === 'tidal-slam') {
      if (d < 5) return true;
      if (p.grounded && p.groundFace >= 0 && ink.inkFraction(p.groundFace, p.position, 3, p.team) < 0.35 && !t) return Math.random() < 0.3;
      return false;
    }
    if (id === 'ink-storm') return (d > 5 && d < 22) || (!t && this.state === 'paint' && Math.random() < 0.15);
    if (id === 'missile-barrage') {
      if (d < 40) return true;
      for (const a of this.mode.teamOf(p.enemyTeam)) if (a.alive && a.position.distanceTo(p.position) < 35) { this.aimWant.copy(a.position); return Math.random() < 0.3; }
      return false;
    }
    if (id === 'ink-jet') return d < 24 || Math.random() < 0.08;
    return d < 20 || Math.random() < 0.1;
  }

  maybeSub() {
    const p = this.p, sub = p.kit.sub;
    if (!sub) return;
    const cost = sub.cost ?? 50;
    const id = p.kit.def.sub;
    const t = this.target;
    let aimAt = null;
    if (id === 'burst-bomb' || id === 'splash-bomb') {
      if (t && t.alive && this.state === 'fight' && p.ink >= cost + 10) {
        const d = t.position.distanceTo(p.position);
        if (d > 3.5 && d < 14 && Math.random() < this.D.subChance) aimAt = _q.copy(t.position).addScaledVector(t.velocity, 0.5);
      } else if (this.state === 'paint' && p.ink >= p.inkMax * 0.95 && Math.random() < this.D.subChance * 0.15) {
        aimAt = _q.copy(p.position).add(_v.set(this.sign * rnd(6, 11), 0, rnd(-4, 4)));
      }
    } else if (id === 'sprinkler') {
      if (this.state === 'paint' && p.ink >= p.inkMax * 0.9 && Math.random() < this.D.subChance * 0.2) aimAt = _q.copy(p.position).add(_v.set(this.sign * rnd(4, 8), 0, rnd(-3, 3)));
    } else if (id === 'ink-mine') {
      if ((this.state === 'paint' || this.state === 'regroup') && p.ink >= p.inkMax * 0.9 && Math.random() < this.D.subChance * 0.1) aimAt = _q.copy(p.position).add(_v.set(this.sign * 1.2, 0, 0));
    }
    if (!aimAt) { this.subCool = 0.5; return; }
    this.throwAt(aimAt, sub);
    p.subBuffer = 0.15;
    this.subCool = rnd(3.5, 7);
    this.debug.subs++;
  }

  /** Aim so a thrown sub lands near `pos` (solve the lob pitch numerically). */
  throwAt(pos, sub) {
    const p = this.p;
    const speed = sub.s?.speed ?? 16, lift = sub.s?.lift ?? 0.35, g = 24;
    _v.set(pos.x - p.position.x, 0, pos.z - p.position.z);
    const d = _v.length();
    _v.divideScalar(Math.max(1e-3, d));
    const dy = pos.y - (p.position.y + 1.25);
    let bestP = 0.2, bestE = Infinity;
    for (let th = -0.2; th <= 1.2; th += 0.05) {
      const lx = Math.cos(th), ly = Math.sin(th) + lift;
      const l = Math.hypot(lx, ly);
      const vh = (lx / l) * speed, vv = (ly / l) * speed;
      // y(t) = vv t - g/2 t² = dy  →  t = (vv + sqrt(vv² - 2 g dy)) / g
      const disc = vv * vv - 2 * g * dy;
      if (disc < 0) continue;
      const tt = (vv + Math.sqrt(disc)) / g;
      const err = Math.abs(vh * tt - d);
      if (err < bestE) { bestE = err; bestP = th; }
    }
    this.aimDir.set(_v.x * Math.cos(bestP), Math.sin(bestP), _v.z * Math.cos(bestP)).normalize();
    this.throwWant.copy(this.eye).addScaledVector(this.aimDir, 10);
    this.throwT = 0.1;
    p.aim.dir.copy(this.aimDir);
  }

  rollError() {
    this.errV.set(rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1));
    this.errT = rnd(0.35, 0.8);
  }

  /** Least ink worth fighting with: one useful shot of the main weapon. */
  shotInk() {
    const s = this.p.kit.main.s || {};
    if (this.cls === 'charger') return (s.fullInk ?? 18) * 0.5;
    if (this.cls === 'splatling') return (s.inkPerShot ?? 1.1) * 6;
    if (this.cls === 'roller') return s.flickInk ?? 8;
    if (this.cls === 'blaster') return 7;
    return 3;
  }

  /** Weapon-class specific trigger handling. ctx: 'paint' | 'fight' | 'wall' (inking a wall to climb). */
  weaponFire(want, ctx, dist, onTarget = true) {
    const p = this.p, main = p.kit.main;
    if (!want || p.ink < 1) { this.fire = false; return; }
    const style = this.prof.style;
    if (style === 'charge') {
      // the charge can never pass what the tank can pay for: release at that cap, never hold forever
      const s = main.s || {};
      const cap = Math.max(s.minInkFrac ?? 0.3, p.ink / (s.fullInk ?? 18)) - 0.02;
      const goal = Math.min(ctx === 'fight' ? (this.D === DIFFICULTY.easy ? 0.75 : 0.95) : 0.55, cap);
      if (this.releaseT > 0) { this.fire = false; return; }
      if ((main.charge || 0) >= goal && (onTarget || (cap < 0.9 && (main.charge || 0) >= cap))) { this.fire = false; this.releaseT = 0.12; return; }
      this.fire = true;
      return;
    }
    if (this.cls === 'brush' && (ctx === 'wall' || (ctx === 'fight' && dist > 2.2))) {
      // brushes only reach walls / distant targets with flicks: tap instead of holding into a dash
      this.tapT -= 1 / 60;
      if (this.tapT <= 0) { this.tapT = 0.24; this.fire = true; return; }
      this.fire = this.tapT > 0.21;
      return;
    }
    if (style === 'spin') {
      const goal = ctx === 'fight' ? 0.85 : 0.6;
      if (this.releaseT > 0) { this.fire = false; return; }
      if ((main.charge || 0) >= goal) { this.fire = false; this.releaseT = 0.06; return; }
      this.fire = true;
      return;
    }
    if (style === 'roll' && (ctx === 'wall' || (ctx === 'fight' && dist > 2.8))) {
      // flick: tap and let the swing finish
      this.tapT -= 1 / 60;
      if (this.tapT <= 0) { this.tapT = 0.5; this.fire = true; return; }
      this.fire = this.tapT > 0.48;
      return;
    }
    this.fire = true;
  }
}
