// Story mode: one story stage (normal or boss). Implements the mode contract of
// docs/architecture.md → "Story mode contract":
//
//   start(session)            title card, prologue (first w1-1), intro dialogue, music, objective
//   latchInput(session, input) dialogue advance / skip (once per frame, never in a fixed step)
//   update(session, dt)        drives the story director (dialogue typewriter, tweens, camera)
//   dialogue(idOrLines, opts) → Promise      objective(text)      addPearls(n)
//   collectPostcard(id, def)   checkpoint(pos, yaw)   respawnPoint(session)
//   cutscene(async (cs) => …)  complete(info) → celebration → results → save + unlocks
//
// Boss stages complete on session.events 'bossDefeated'. Optional boss hook: emitting
// 'bossPhase' { phase } plays DIALOGUE['<stage>.phase<n>'] as radio chatter.
import * as THREE from 'three';
import { STAGE_META, POSTCARDS, DIALOGUE, nextStage, worldOf, resolveLines } from '../../story/script.js';
import { Director, heroInkHex, EASE } from '../../story/director.js';
import { Cutscene } from '../../story/cutscene.js';
import { showTitleCard, flashObjective, bouncePearls, banner } from '../../story/overlays.js';
import { ResultsScreen, computeRank, RANK_BONUS } from '../../story/results-screen.js';
import { PostcardScreen } from '../../story/postcard-screen.js';
import { save } from '../../engine/save.js';
import '../../story/sfx.js';

const _up = new THREE.Vector3(0, 1, 0);

async function bootUI() {
  try { return await import('../../ui/boot-ui.js'); } catch (e) { console.warn('story: boot-ui unavailable', e); return null; }
}

export class StoryMode {
  /**
   * @param {App} app
   * @param {string} stageId  story stage id (w1-1 … w4-boss); drives script, par, unlocks
   * @param {object} opts     retry (short intro), skipIntro, noPrologue
   */
  constructor(app, stageId, opts = {}) {
    this.app = app;
    this.stageId = stageId;
    this.opts = opts;
    this.id = 'story';
    this.kind = 'story';
    this.meta = STAGE_META[stageId] || { world: 0, num: '', title: stageId, subtitle: '', objective: '', intro: [], outro: [], par: 240, music: null };
    this.title = this.meta.title;
    this.deaths = 0;
    this.pearls = 0;
    this.postcard = null;
    this.completed = false;
    this.checkpointPos = null;
    this.checkpointYaw = 0;
    this.checkpoints = 0;
    this.session = null;
    this.director = null;
    this._introStarted = false;
    this._slowmo = 0;
    this._card = null;
  }

  get busy() { return !!this.director?.busy; }
  get inCutscene() { return !!this.director?.cutscene; }

  // ---- lifecycle -----------------------------------------------------------------------------
  async start(session) {
    this.session = session;
    const d = this.director = new Director(session);
    // nobody moves until the intro sequence has run (it starts on the first update)
    d.hold('intro', ['freeze', 'hud', 'pause', 'time', 'letterbox']);
    session.hud?.setObjective?.('');
    session.events.on('playerSplatted', () => this._onSplat());
    session.events.on('bossDefeated', (e) => this._onBossDefeated(e || {}));
    session.events.on('bossPhase', (e) => this._onBossPhase(e || {}));
    if (this.stageId === 'w1-1' && !save.flag('seenPrologue') && !this.opts.noPrologue) {
      try {
        const { playPrologue } = await import('../../story/comic.js');
        await playPrologue(this.app, { overFade: true });
      } catch (e) { console.warn('story: prologue failed', e); }
      save.setFlag('seenPrologue');
    }
    if (this.meta.music) session.audio?.playMusic?.(this.meta.music);
  }

  latchInput(session, input) {
    this.director?.latch(input);
  }

  step(session, dt) {
    void session; void dt;
  }

  update(session, dt) {
    if (!this._introStarted) {
      this._introStarted = true;
      this._runIntro().catch((e) => { console.error('story intro', e); this.director.releaseNow('intro'); this.objective(this.meta.objective); });
    }
    if (this._slowmo > 0) {
      this._slowmo -= dt;
      if (!this.director.held('time')) session.timeScale = this._slowmo > 0 ? 0.3 : 1;
    }
    this.director.update(dt);
  }

  dispose(session) {
    void session;
    this._card?.el?.remove();
    this.director?.dispose();
  }

  // ---- intro ---------------------------------------------------------------------------------
  async _runIntro() {
    const S = this.session, d = this.director, m = this.meta;
    const cs = new Cutscene(d, { letterbox: true, freezeWorld: true, blendBack: 0 }).begin();
    d.releaseNow('intro');
    // whatever goes wrong in the presentation, the cutscene must end or Kai stays frozen forever
    try {
      const world = worldOf(this.stageId);
      // establishing sweep: high and behind → the gameplay camera
      const gp = d.gameplayPose();
      const back = gp.pos.clone().sub(gp.target).setY(0);
      if (back.lengthSq() < 1e-4) back.set(0, 0, 1);
      back.normalize();
      const p0 = gp.pos.clone().addScaledVector(back, 5.5).addScaledVector(_up, 3.4);
      const t0 = S.player.position.clone().addScaledVector(_up, 1.1);
      cs.cut(p0, t0);
      const sweep = cs.camera(gp.pos, gp.target, 2.7, 'inOut');
      this._card = showTitleCard({
        world: world ? `World ${world.id} · ${world.name}` : '',
        worldColor: world?.color,
        num: m.num, title: m.title, subtitle: m.subtitle, boss: !!m.boss, ink: heroInkHex(S),
      });
      S.audio?.sfx?.('story_sting', { volume: 0.8 });
      S.player.model?.emote?.('wave', 1.6);
      await cs.wait(2.5);
      this._card.close();
      await sweep;
      // intro conversation (a boss stage points the camera at the boss while it talks)
      if (!this.opts.retry && !this.opts.skipIntro && m.intro?.length && !cs.skipping) {
        const boss = m.boss ? this.session.entities.find((e) => e.type === m.boss || String(e.type || '').startsWith('boss-')) : null;
        if (boss) {
          const bp = new THREE.Vector3();
          if (boss.hitCenter) boss.hitCenter(bp); else bp.copy(boss.position).addScaledVector(_up, 2);
          const dir = bp.clone().sub(S.player.position).setY(0);
          const dist = dir.length();
          if (dist < 1e-2) dir.set(0, 0, -1); else dir.divideScalar(dist);
          // push in toward the boss (arenas start it ~20 m away, where it reads as a speck), then
          // pull the camera back in front of any wall between it and the boss
          const back = Math.min(Math.max(8, dist * 0.45), dist + 3.2);
          const cam = bp.clone().addScaledVector(dir, -back);
          cam.y = Math.max(S.player.position.y + 2.4, bp.y + 0.4);
          const ray = cam.clone().sub(bp);
          const len = ray.length();
          const hit = len > 1e-3 ? S.level?.raycast?.(bp, ray.divideScalar(len), len, { staticOnly: true }) : null;
          if (hit && hit.distance > 2) cam.copy(bp).addScaledVector(ray, hit.distance - 0.6);
          await cs.camera(cam, bp, 1.6, 'inOut');
        }
        await cs.say(m.intro);
        if (boss && !cs.skipping) await cs.returnCamera(0.8);
      }
    } finally {
      this._card?.close();
      d.releaseCam();
      await cs.end();
    }
    if (this.director.disposed) return;
    this.objective(m.objective);
    S.hud?.toast?.(m.boss ? 'FIGHT!' : 'GO!', 'big');
    S.audio?.sfx?.('go', { volume: 0.7 });
    S.events.emit('storyIntroDone', { stageId: this.stageId });
  }

  // ---- contract ------------------------------------------------------------------------------
  /** Play a conversation (array or DIALOGUE id). { radio: true } → non-blocking chatter. */
  dialogue(idOrLines, opts = {}) {
    if (!this.director) return Promise.resolve({ skipped: true });
    return this.director.say(idOrLines, opts);
  }

  /** Non-blocking radio chatter (bosses and mid-fight banter use this). */
  radio(idOrLines) { return this.dialogue(idOrLines, { radio: true }); }

  objective(text) {
    const S = this.session;
    if (!S?.hud) return;
    this.currentObjective = text || '';
    S.hud.setObjective(this.currentObjective);
    if (text) flashObjective(S.hud);
  }

  addPearls(n = 1) {
    const S = this.session;
    if (!S) return;
    S.pearls = (S.pearls || 0) + n;
    this.pearls += n;
    bouncePearls(S.hud);
  }

  collectPostcard(id, def = {}) {
    const base = POSTCARDS[id] || POSTCARDS[this.stageId] || {};
    const card = { id: id || this.stageId, title: def.title || base.title, text: def.text || base.text, from: def.from || base.from };
    const first = !this.postcard;
    this.postcard = card;
    const already = !!save.stage(this.stageId)?.postcard;
    this.app.ui.push(new PostcardScreen(this.app, card, {
      countCurrent: !already && first,
      onClose: () => { if (first) this.dialogue('generic.postcard', { radio: true }); },
    }));
  }

  checkpoint(pos, yaw = 0) {
    if (pos) { this.checkpointPos = (this.checkpointPos || new THREE.Vector3()).copy(pos); this.checkpointYaw = yaw ?? 0; }
    this.checkpoints++;
    banner('CHECKPOINT!', 'checkpoint');
    if (this.checkpoints === 1 || Math.random() < 0.35) {
      const ids = ['generic.checkpoint', 'generic.checkpoint2', 'generic.checkpoint3'];
      this.dialogue(ids[(this.checkpoints - 1) % ids.length], { radio: true });
    }
  }

  respawnPoint(session) {
    if (this.checkpointPos) return { pos: this.checkpointPos, yaw: this.checkpointYaw };
    return session.spawnPoint;
  }

  /** Run a scripted scene: await mode.cutscene(async (cs) => { … }, { freezeWorld, letterbox }). */
  async cutscene(fn, opts = {}) {
    const cs = new Cutscene(this.director, opts).begin();
    try { await fn(cs); } catch (e) { console.error('story cutscene', e); } finally { await cs.end(); }
    return cs;
  }

  // ---- events --------------------------------------------------------------------------------
  _onSplat() {
    if (this.completed) return;
    this.deaths++;
    if (this.deaths === 1 || Math.random() < 0.3) {
      const ids = ['generic.splatted', 'generic.splatted2', 'generic.splatted3'];
      const id = ids[(this.deaths - 1) % ids.length];
      this.director.wait(1.4).then(() => { if (!this.completed) this.dialogue(id, { radio: true }); });
    }
  }

  _onBossPhase(e) {
    const id = `${this.stageId}.phase${e.phase}`;
    if (DIALOGUE[id]) this.dialogue(id, { radio: true });
  }

  _onBossDefeated(e) {
    if (this.completed || this._bossDown) return;
    this._bossDown = true;
    const S = this.session;
    S.player.invulnerable = Math.max(S.player.invulnerable, 99);
    this.director.hold('bossdown', ['freeze', 'pause']);
    this._slowmo = 1.3;
    S.flash?.('#ffffff', 0.7);
    S.audio?.duck?.(0.25, 2);
    this.director.wait(1.6).then(() => this.complete({ reason: 'boss', ...e }));
  }

  // ---- stage clear ---------------------------------------------------------------------------
  async complete(info = {}) {
    // (a disposed director means the stage was quit: never save a clear for it)
    if (this.completed || !this.director || this.director.disposed) return;
    this.completed = true;
    const S = this.session, d = this.director, m = this.meta, app = this.app;
    this.clearTime = S.time;
    this._slowmo = 0;
    S.timeScale = 1;
    d.dialogue.clear();
    let result;
    try {
      result = this._saveResults(info);       // save first: quitting mid-celebration keeps progress
    } catch (e) {
      console.error('story save', e);
      result = {
        stageId: this.stageId, meta: m, world: worldOf(this.stageId), time: this.clearTime, par: m.par || 240, pearls: S.pearls || 0,
        deaths: this.deaths, postcard: this.postcard, rank: 'C', prevRank: null, newBest: false, bonus: 0, total: save.data.pearls,
        kit: null, nextId: nextStage(this.stageId), final: this.stageId === 'w4-boss', reason: info.reason || null,
      };
    }
    const cs = new Cutscene(d, { letterbox: true, blendBack: 0, freezeWorld: true }).begin();
    d.releaseNow('bossdown');
    // The celebration is presentation only: if any of it throws, the results screen must still
    // appear (it is the only way out of a cleared stage).
    try {
      const pl = S.player;
      pl.invulnerable = 999;
      this._poseForCelebration(pl);
      S.audio?.playMusic?.('victory');                    // one-shot fanfare (crossfades out the stage track)
      pl.model?.emote?.('cheer', 60);
      // confetti in the hero ink
      const ink = S.ink.color(pl.team);
      let burstT = 0;
      const center = pl.position.clone();
      const confetti = d.tween(2.4, (k, dt) => {
        burstT -= dt || 0;
        if (burstT <= 0 && k < 1) {
          burstT = 0.28;
          const p = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 2.2 + Math.random(), (Math.random() - 0.5) * 3));
          S.fx.burst(p, _up, Math.random() < 0.5 ? ink : '#ffffff', 14, 5, { size: 0.07 });
          S.fx.ring(center.clone().setY(center.y + 0.05), _up, ink, 1.6 + Math.random(), 0.5);
        }
      }, { ease: EASE.linear, skip: () => cs.skipping });
      S.ink.paint(center, 2.4, pl.team, _up, { source: 'level' });
      // orbit in front of Kai: model faces +Z at yaw 0 → the front is angle = yaw
      const yaw = pl.yaw;
      await cs.orbit(center, { radius: (k) => 3.6 - k * 0.9, height: 1.25, from: yaw - 1.1, to: yaw + 0.35, secs: 3.4, lookHeight: 0.95, ease: 'sine', lookSide: 1.15 });
      await confetti;
      if (m.outro?.length && !cs.skipping) await cs.say(m.outro);
    } catch (e) {
      console.error('story clear sequence', e);
    }
    if (d.disposed || app.session !== S) return;        // quit while celebrating
    cs.letterbox(false);
    S.events.emit('storyComplete', { stageId: this.stageId, result });
    S.audio?.playMusic?.('results', { fadeIn: 1.5 });
    try {
      app.ui.push(new ResultsScreen(app, result, {
        onContinue: () => this._continue(result),
        onMap: () => this._toMap(),
        onRetry: () => this._retry(),
      }));
    } catch (e) {
      // never strand a frozen Kai on a cleared stage: fall back to the map (progress is saved)
      console.error('story results', e);
      this._toMap();
    }
  }

  /** The celebration freezes the world, so put Kai on their feet first: alive, in kid form, on
   *  the ground (an airborne or swimming Kai would otherwise hang mid-jump / stay a squid). */
  _poseForCelebration(pl) {
    const S = this.session;
    if (!pl.alive) {
      S.respawnPlayer();
      const sp = this.respawnPoint(S);
      if (sp?.pos) pl.position.copy(sp.pos);
    }
    pl.kit?.special?.end?.();
    if (pl.form !== 'kid' && typeof pl._changeForm === 'function') pl._changeForm('kid');
    pl.submerged = false;
    pl.climbing = false;
    pl.velocity.set(0, 0, 0);
    const g = S.level?.groundBelow?.(pl.position, 12);
    if (g && g.normal.y > 0.5) pl.position.y = g.point.y;
  }

  _saveResults(info) {
    const id = this.stageId, m = this.meta, S = this.session;
    const prev = save.stage(id);
    const time = this.clearTime;
    const par = m.par || 240;
    const rank = computeRank(time, par, this.deaths);
    const bonus = RANK_BONUS[rank] || 0;
    const pearls = S.pearls || 0;
    save.addPearls(pearls + bonus);
    let kit = null;
    if (m.unlockKit && save.unlockKit(m.unlockKit)) kit = m.unlockKit;
    save.completeStage(id, { time, postcard: !!this.postcard, pearlsFound: pearls, rank });
    if (m.core) save.setFlag(`core:${m.core}`);
    if (m.boss && m.world) save.setFlag(`world${m.world + 1}Unlocked`);
    if (id === 'w1-boss') save.setFlag('turfRecommended');
    if (id === 'w4-boss') save.setFlag('storyComplete');
    return {
      stageId: id, meta: m, world: worldOf(id), time, par, pearls, deaths: this.deaths, postcard: this.postcard,
      rank, prevRank: prev?.rank || null, prevBest: prev?.bestTime || null, newBest: !prev?.bestTime || time < prev.bestTime,
      bonus, total: save.data.pearls, kit, nextId: nextStage(id), final: id === 'w4-boss', reason: info.reason || null,
    };
  }

  async _continue(result) {
    const app = this.app;
    if (result.final) return this._finale();
    const next = result.nextId;
    if (!next) return this._toMap();
    const ui = await bootUI();
    if (ui?.startStage) return ui.startStage(app, next);
    app.ui.clear();
    app.endSession();
  }

  async _toMap() {
    const app = this.app;
    const ui = await bootUI();
    await app.fade(true, 250);
    app.ui.clear();
    app.endSession();
    try {
      if (ui?.showStoryMap) await ui.showStoryMap(app, this.stageId);
      else if (ui?.showMainMenu) await ui.showMainMenu(app);
      else if (ui?.showTitle) await ui.showTitle(app);
    } finally { app.fade(false, 300); }
  }

  async _retry() {
    const app = this.app;
    const ui = await bootUI();
    if (ui?.startStage) return ui.startStage(app, this.stageId, { retry: true });
    return app.startSession({ stageId: this.session?.opts?.stageId || this.stageId, mode: new StoryMode(app, this.stageId, { retry: true }) });
  }

  /** After the final boss: ending comic → credits → post-credits tease → menus. */
  async _finale() {
    const app = this.app;
    await app.fade(true, 500);
    app.ui.clear();
    app.endSession(true);
    const comic = await import('../../story/comic.js');
    await comic.playEnding(app, { overFade: true });          // leaves the fade on
    const ui = await bootUI();
    const toMenu = async () => {
      try {
        if (ui?.showMainMenu) await ui.showMainMenu(app);
        else if (ui?.showTitle) await ui.showTitle(app);
      } finally { app.fade(false, 400); }
    };
    if (ui?.showCredits) {
      app.fade(false, 300);
      const r = ui.showCredits(app, { fromEnding: true });
      if (r && typeof r.then === 'function') {
        await r;
        await app.fade(true, 300);
        await comic.playPostCredits(app, { overFade: true });
        await toMenu();
      }
      return;
    }
    await comic.playCredits(app, { overFade: true });
    await comic.playPostCredits(app, { overFade: true });
    await toMenu();
  }
}

/** Convenience for menus: a StoryMode for a stage id (or null when it isn't a story stage). */
export function storyModeFor(app, stageId, opts) {
  return STAGE_META[stageId] ? new StoryMode(app, stageId, opts) : null;
}

export { resolveLines };
