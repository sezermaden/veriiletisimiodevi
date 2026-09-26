// End-to-end campaign flow with a gamepad only: fresh save → title → main menu → story map →
// kit picker → every story stage in order (prologue/intro skipped, checkpoints, pearls and the
// postcard collected, the prism core shattered / the boss defeated) → results (rank, pearls,
// NEW KIT cards vs STAGE_META.unlockKit) → Continue → … → ending comic → credits → post-credits
// → main menu. Then: save contents, story-map badges, pause → quit, Turf Clash round trip.
// Logic runs in real time with rendering off (?render=0) so it finishes in minutes.
import { launch, report } from './harness.mjs';

// --negative: sabotage kit unlocks (save.unlockKit never succeeds) and stop after w1-2 — the
// results check must then FAIL on w1-2's missing NEW KIT card (proves the check can fail).
const NEG = process.argv.includes('--negative');
const only = process.argv.slice(2).find((a) => !a.startsWith('--')) || null;   // start from this stage id (debugging)
const h = await launch({ width: 1280, height: 720 });
await h.open('/?q=low&render=0', 5);

await h.page.evaluate(() => {
  const g = __game;
  const pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  g.input._injectPad(pad);
  const frames = (n) => new Promise((r) => { const f0 = g.frames; const f = () => (g.frames - f0 >= n ? r() : setTimeout(f, 4)); f(); });
  const until = async (fn, ms = 60000, what = 'condition') => {
    const t0 = performance.now();
    while (!fn()) {
      if (performance.now() - t0 > ms) throw new Error(`timeout waiting for ${what} (top=${g.ui.top?.constructor?.name}, session=${g.session?.opts?.stageId || null})`);
      await frames(1);
    }
  };
  const set = (b, v) => { pad.buttons[b].pressed = v; pad.buttons[b].value = v ? 1 : 0; };
  const press = async (b, hold = 3) => { set(b, true); await frames(hold); set(b, false); await frames(3); };
  const top = () => g.ui.top?.constructor?.name || null;
  window.__T = { g, pad, frames, until, set, press, top, A: 0, B: 1, MENU: 9 };
});

const log = [];
let ok = true;
const run = (name, fn) => h.page.evaluate(fn).then((r) => { log.push([name, r]); return r; }).catch((e) => ({ error: e.message }));

// ---- boot: fresh save → title → main menu → story map → kit picker → w1-1 --------------------
const boot = await run('boot', async () => {
  const { g, until, press, top, A } = __T;
  g.save.reset();
  const ui = await import('/src/ui/boot-ui.js');
  await ui.showTitle(g);
  await until(() => top() === 'TitleScreen', 10000, 'title');
  const seen = [top()];
  await __T.frames(30);
  await press(A); await until(() => top() === 'MainMenuScreen', 10000, 'main menu'); seen.push(top());
  await __T.frames(20);
  await press(A); await until(() => top() === 'StoryMapScreen', 10000, 'story map'); seen.push(top());
  await __T.frames(20);
  const focused = document.activeElement?.dataset?.id || document.querySelector('.node.focused, .node.is-focused, .node:focus')?.dataset?.id || null;
  await press(A); await until(() => top() === 'KitPickerScreen' || g.session, 10000, 'kit picker'); seen.push(top());
  await __T.frames(20);
  if (top() === 'KitPickerScreen') await press(A);
  // (a fresh save plays the prologue comic before the session starts: the stage loop skips it)
  await until(() => g.session?.started || top() === 'ComicScreen', 60000, 'w1-1 session / prologue');
  return { seen, focused, stage: g.session?.opts?.stageId, kit: g.session?.opts?.kit, prologue: top() === 'ComicScreen' };
});
ok &= report('fresh save → title → menu → map → kit picker → w1-1 with the pad only', !boot.error && boot.stage === 'w1-1', JSON.stringify(boot));

// ---- the story chain -------------------------------------------------------------------------
if (NEG) await h.page.evaluate(() => { __game.save.unlockKit = () => false; });
const order = await h.page.evaluate(async () => (await import('/src/story/script.js')).STAGE_ORDER);
const start = only ? order.indexOf(only) : 0;
if (only) {
  await h.page.evaluate(async (id) => {
    const { g } = __T; const ui = await import('/src/ui/boot-ui.js');
    g.save.setFlag('seenPrologue'); g.ui.clear(); g.endSession(); await ui.startStage(g, id);
  }, only);
}
for (let i = start; i < order.length; i++) {
  const id = order[i];
  const r = await h.page.evaluate(async (id) => {
    const { g, until, press, set, frames, top, A, B } = __T;
    const out = { id };
    // prologue comic (fresh save, w1-1; the session starts after it): hold B to skip it
    await until(() => top() === 'ComicScreen' || (g.session?.started && g.session.opts.stageId === id), 90000, `${id} session`);
    if (top() === 'ComicScreen') {
      out.prologue = true;
      set(B, true); await until(() => top() !== 'ComicScreen', 15000, 'prologue skip'); set(B, false); await frames(3);
    }
    await until(() => g.session?.started && g.session.opts.stageId === id && g.session.mode?.stageId === id, 90000, `${id} session`);
    const S = g.session, m = S.mode, p = S.player;
    // intro: tap B through the title card / conversation until the objective is set
    const t0 = performance.now();
    while (m.currentObjective === undefined) {
      if (performance.now() - t0 > 60000) throw new Error('intro never finished');
      if (m.inCutscene) await press(B, 2); else await frames(2);
    }
    out.objective = m.currentObjective;
    out.introSec = +((performance.now() - t0) / 1000).toFixed(1);
    // walk the level's checkpoints, pearls and postcard (teleport: routes are checked by validate-level)
    p.invulnerable = 1e9;                              // teleporting into enemy groups must not splat Kai
    // blocking story dialogue (trigger volumes) freezes the world: advance it with A like a player
    const settle = async () => {
      const t = performance.now();
      while (m.busy && performance.now() - t < 30000) await press(m.inCutscene ? B : A, 2);
      if (m.busy) throw new Error('dialogue never finished');
    };
    out.talks = 0;
    const visit = async (e) => {
      if (!p.alive) await until(() => p.alive, 10000, 'respawn');
      p.position.copy(e.position); p.position.y += 0.3; p.velocity.set(0, 0, 0);
      await frames(8);
      if (m.busy) { out.talks++; await settle(); }
    };
    const cps = S.entities.filter((e) => e.type === 'checkpoint');
    for (const e of cps) await visit(e);
    out.checkpoints = `${m.checkpoints}/${cps.length}`;
    const pearls = S.entities.filter((e) => e.type === 'pearl' && !e.collected).slice(0, 4);
    const p0 = S.pearls || 0;
    for (const e of pearls) await visit(e);
    out.pearls = (S.pearls || 0) - p0;
    const pc = S.entities.find((e) => e.type === 'postcard');
    if (pc) {
      await visit(pc);
      await until(() => top() === 'PostcardScreen' || m.postcard, 5000, `postcard (collected=${pc.collected} alive=${p.alive} busy=${m.busy} d=${p.position.distanceTo(pc.position).toFixed(2)})`);
      // first A flips the card to its handwritten back, the next one closes it
      for (let k = 0; k < 4 && top() === 'PostcardScreen'; k++) { await frames(30); await press(A); }
      await until(() => top() !== 'PostcardScreen', 8000, 'postcard close');
      out.postcard = !!m.postcard;
    }
    await frames(10);
    // the goal
    const boss = S.entities.find((e) => String(e.type || '').startsWith('boss-'));
    const core = S.entities.find((e) => e.type === 'prism-core');
    if (boss) {
      out.goal = boss.type;
      boss.startDefeat();
    } else if (core) {
      out.goal = 'prism-core';
      p.position.set(core.position.x, core.position.y, core.position.z + 3.5);
      const c = core.hitCenter(new (p.position.constructor)());
      let shots = 0;
      while (core.state === 'sealed' && shots < 200) {
        core.damage(40, { source: p, team: p.team, kind: 'main', point: c.clone().setZ(c.z + 0.4) });
        shots++;
        await frames(2);
        if (m.busy) { out.talks++; await settle(); }
      }
      out.shots = shots;
    } else throw new Error('no goal entity');
    // celebration → results (skip the outro chatter with B, never once the results are up)
    const t1 = performance.now();
    while (top() !== 'ResultsScreen') {
      if (performance.now() - t1 > 60000) throw new Error(`no results screen (top=${top()}, completed=${m.completed})`);
      if (m.inCutscene && m.completed && top() !== 'ResultsScreen') await press(B, 2); else await frames(2);
    }
    const scr = g.ui.top, res = scr.r;
    out.rank = res.rank; out.time = +res.time.toFixed(1); out.kit = res.kit; out.nextId = res.nextId; out.final = res.final;
    out.kitCard = !!scr.el.querySelector('[class*="kit"]') && /NEW KIT|UNLOCKED/i.test(scr.el.textContent);
    out.continueLabel = scr.el.querySelector('.sr-btn[data-a="continue"]')?.textContent.trim();
    // A during the tally fast-forwards it; the next A is Continue (autofocused)
    await frames(10);
    if (!scr.revealed) { await press(A); out.fastForward = !!scr.revealed; }
    await until(() => scr.revealed, 10000, 'results reveal');
    await frames(5);
    await press(A);
    return out;
  }, id).catch((e) => ({ id, error: e.message }));
  log.push([id, r]);
  const meta = await h.page.evaluate((id) => import('/src/story/script.js').then((m) => ({ kit: m.STAGE_META[id].unlockKit || null, next: m.nextStage(id) })), id);
  const kitOk = (r.kit || null) === meta.kit && (!meta.kit || r.kitCard);
  const pass = !r.error && kitOk && r.nextId === meta.next && (r.postcard !== false) && /^[SABC]$/.test(r.rank || '');
  ok &= report(`story ${id}`, pass, r.error || `goal=${r.goal} shots=${r.shots ?? '-'} cp=${r.checkpoints} pearls+${r.pearls} postcard=${r.postcard} rank=${r.rank} time=${r.time}s ff=${r.fastForward ?? '-'} kit=${r.kit}${r.kitCard ? '(card)' : ''} → ${r.continueLabel}:${r.nextId || (r.final ? 'finale' : '-')}`);
  if (r.error) break;
  if (NEG && id === 'w1-2') { await h.close(); console.log(ok ? 'negative control: the sabotage went unnoticed' : 'negative control: FAIL as expected'); process.exit(ok ? 0 : 1); }
}

// ---- finale: ending comic → credits → post-credits → main menu -------------------------------
const fin = await run('finale', async () => {
  const { g, until, set, frames, top, B } = __T;
  const seen = [];
  const t0 = performance.now();
  while (!(top() === 'MainMenuScreen' && !g.session)) {
    if (performance.now() - t0 > 120000) throw new Error(`finale stuck (top=${top()})`);
    const t = top();
    if (t && seen[seen.length - 1] !== t) seen.push(t);
    if (t === 'ComicScreen' || t === 'CreditsScreen') {
      set(B, true); await until(() => g.ui.top?.constructor?.name !== t || g.ui.top?.finished, 15000, `skip ${t}`); set(B, false); await frames(4);
    } else await frames(4);
  }
  seen.push(top());
  return { seen };
});
ok &= report('finale: ending → credits → post-credits → main menu', !fin.error && fin.seen?.includes('CreditsScreen') && fin.seen.filter((s) => s === 'ComicScreen').length >= 1 && fin.seen.at(-1) === 'MainMenuScreen', JSON.stringify(fin));

// ---- save + story map badges -----------------------------------------------------------------
const sv = await run('save', async () => {
  const { g, until, top, frames } = __T;
  const { STAGE_ORDER, STAGE_META } = await import('/src/story/script.js');
  const d = g.save.data;
  const kits = STAGE_ORDER.map((id) => STAGE_META[id].unlockKit).filter(Boolean);
  const ui = await import('/src/ui/boot-ui.js');
  ui.showStoryMap(g, 'w4-boss');
  await until(() => top() === 'StoryMapScreen', 10000, 'map');
  await frames(10);
  const nodes = [...document.querySelectorAll('.node[data-id]')];
  return {
    done: STAGE_ORDER.filter((id) => d.stages[id]?.done).length, total: STAGE_ORDER.length,
    postcards: STAGE_ORDER.filter((id) => d.stages[id]?.postcard).length,
    pearls: d.pearls, missingKits: kits.filter((k) => !d.unlockedKits.includes(k)),
    storyComplete: !!d.flags.storyComplete, cores: Object.keys(d.flags).filter((k) => k.startsWith('core:')).length,
    clearedNodes: nodes.filter((n) => /cleared/.test(n.className)).length, nodes: nodes.length,
    rankBadges: nodes.filter((n) => /^[SABC]$/.test(n.querySelector('.node-rank')?.textContent.trim() || '')).length,
  };
});
ok &= report('save: every stage done, kits unlocked, story complete', !sv.error && sv.done === sv.total && !sv.missingKits?.length && sv.storyComplete && sv.pearls > 0, JSON.stringify(sv));
ok &= report('story map shows every stage cleared with a rank badge', !sv.error && sv.clearedNodes === sv.total && sv.rankBadges === sv.total, `${sv.clearedNodes}/${sv.nodes} cleared, ${sv.rankBadges} rank badges`);

// ---- pause → quit returns to the story map ---------------------------------------------------
const pq = await run('pause-quit', async () => {
  const { g, until, press, frames, top, A, B, MENU } = __T;
  const ui = await import('/src/ui/boot-ui.js');
  g.ui.clear();
  await ui.startStage(g, 'w2-1', { retry: true });
  await until(() => g.session?.started && g.session.mode?.currentObjective !== undefined, 60000, 'w2-1 intro');
  await frames(10);
  await press(MENU); await until(() => top() === 'PauseScreen', 5000, 'pause');
  await frames(20);
  const items = [...g.ui.top.el.querySelectorAll('.rail-item')].map((e) => e.dataset.id);
  // D-pad down to QUIT, A, then D-pad over to "Quit" in the (danger: defaults to No) dialog, A
  for (let k = 0; k < 8 && !g.ui.top.el.querySelector('.rail-item.focused[data-id="quit"]'); k++) await press(13);
  const quitFound = !!g.ui.top.el.querySelector('.rail-item.focused[data-id="quit"]');
  await press(A);
  await until(() => top() === 'ConfirmScreen', 5000, 'quit confirm');
  await frames(10);
  const defNo = !!g.ui.top.el.querySelector('.btn-no.focused');
  for (let k = 0; k < 3 && !g.ui.top.el.querySelector('.btn-yes.focused'); k++) await press(14);
  await press(A);
  await until(() => top() === 'StoryMapScreen' && !g.session, 15000, 'story map after quit');
  const b = await (async () => { await frames(10); await press(B); await until(() => top() === 'MainMenuScreen', 5000, 'B → main menu'); return top(); })();
  return { items, quitFound, defaultNo: defNo, afterQuit: 'StoryMapScreen', afterB: b };
});
ok &= report('pause → quit (pad) → story map, B → main menu', !pq.error && pq.quitFound && pq.afterB === 'MainMenuScreen', JSON.stringify(pq));

// ---- Turf Clash: start, shortened match, results, back to the menu ---------------------------
const tf = await run('turf', async () => {
  const { g, until, press, frames, top, A } = __T;
  const ui = await import('/src/ui/boot-ui.js');
  const s = await ui.startStage(g, 'turf-pier', { difficulty: 'normal' });
  await until(() => g.session?.started && g.session.mode?.kind === 'turf' || g.session?.mode?.id === 'turf', 60000, 'turf session');
  const m = g.session.mode;
  await until(() => m.phase === 'play' || m.phase === 'battle' || m.phase === 'playing', 30000, 'turf start');
  await frames(120);
  const bots = g.session.actors.filter((a) => a.isBot).length;
  m.timeLeft = 3;
  await until(() => /Results/.test(top() || ''), 60000, 'turf results');
  const res = { result: m.result && JSON.stringify(m.result).slice(0, 120), top: top(), bots, s: !!s };
  await frames(90);
  const btns = [...g.ui.top.el.querySelectorAll('*')].filter((e) => /main menu/i.test(e.textContent.trim()) && e.children.length <= 2);
  btns[0]?.click();
  await frames(10);
  if (/Confirm|Dialog/.test(top() || '')) await press(A);
  await until(() => top() === 'MainMenuScreen' && !g.session, 15000, 'menu after turf');
  res.after = top();
  return res;
});
ok &= report('turf clash: 8-bot match → results → main menu', !tf.error && tf.after === 'MainMenuScreen' && tf.bots >= 7, JSON.stringify(tf));

const errs = await h.page.evaluate(() => __game.errors.slice());
if (errs.length) console.log('game errors:', errs.join('\n'));
if (h.errors.length) console.log('page errors:', h.errors.slice(0, 12).join('\n'));
ok &= report('no runtime errors across the whole campaign', !errs.length && !h.errors.length, `${errs.length} game, ${h.errors.length} page`);
await h.close();
process.exit(ok ? 0 : 1);
