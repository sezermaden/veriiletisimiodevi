// Audio regression suite.
//   static (Node): every song compiles cleanly; every music id / theme / sfx name referenced in
//                  www/src resolves (a typo like music: 'finale' silently played the menu loop).
//   runtime (headless Chromium): every track, sfx and ambience bed plays without exceptions,
//                  voices and timers are released after stop, an offline render stays below 1.0.
import fs from 'node:fs';
import path from 'node:path';
import { launch, report, root } from './harness.mjs';

const SRC = path.join(root, 'www/src');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(SRC);
const text = Object.fromEntries(files.map((f) => [path.relative(SRC, f), fs.readFileSync(f, 'utf8')]));
const scan = (re) => { const out = new Map(); for (const [f, s] of Object.entries(text)) for (const m of s.matchAll(re)) { if (!out.has(m[1])) out.set(m[1], new Set()); out.get(m[1]).add(f); } return out; };

let ok = true;
// ---------------------------------------------------------------- static
const { compileSong } = await import(path.join(SRC, 'audio/compose.js'));
const { TRACKS, ALIASES } = await import(path.join(SRC, 'audio/tracks.js'));
const { AMBIENCE_THEMES } = await import(path.join(SRC, 'audio/ambience.js'));
const warns = [];
for (const id of Object.keys(TRACKS)) {
  try { compileSong(id, TRACKS[id], (m) => warns.push(m)); } catch (e) { warns.push(`${id}: ${e.message}`); }
}
ok &= report(`${Object.keys(TRACKS).length} music tracks compile without notation warnings`, !warns.length, warns.slice(0, 3).join('; '));

const musicIds = new Map([...scan(/\bmusic:\s*['"]([\w-]+)['"]/g), ...scan(/playMusic\??\.?\(\s*['"]([\w-]+)['"]/g), ...scan(/\.music\(\s*['"]([\w-]+)['"]/g)]);
const badMusic = [...musicIds].filter(([id]) => !TRACKS[id] && !ALIASES[id]);
ok &= report(`${musicIds.size} music ids referenced in src resolve to a track or alias`, !badMusic.length, badMusic.map(([id, f]) => `${id} (${[...f].join(', ')})`).join('; '));

const themes = scan(/\btheme:\s*['"]([\w-]+)['"]/g);
const badThemes = [...themes].filter(([id]) => !AMBIENCE_THEMES.includes(id) && id !== 'menu');
ok &= report(`${themes.size} stage themes have an ambience bed`, !badThemes.length, badThemes.map(([id]) => id).join(', '));

const registered = new Set(scan(/registerSfx\(\s*['"]([\w-]+)['"]/g).keys());
const usedSfx = new Map([...scan(/\.sfx\??\.?\(\s*['"]([\w-]+)['"]/g), ...scan(/Sound\.play\(\s*['"]([\w-]+)['"]/g)]);
const badSfx = [...usedSfx].filter(([n]) => !registered.has(n));
ok &= report(`${usedSfx.size} sfx names referenced in src are registered (${registered.size} recipes)`, !badSfx.length, badSfx.map(([n, f]) => `${n} (${[...f].join(', ')})`).join('; '));

// ---------------------------------------------------------------- runtime
const h = await launch({ width: 320, height: 180 });
const warnings = [];
h.page.on('console', (m) => { if (m.type() === 'warning' && /\[music\]|^sfx |ambience/.test(m.text()) && !m.text().includes('unknown track id')) warnings.push(m.text()); });
const html = '<!doctype html><html><head><script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/","three-mesh-bvh":"./vendor/three-mesh-bvh.module.js"}}</script></head><body></body></html>';
await h.page.route('**/__audio.html', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await h.page.goto(h.base + '/__audio.html');
const REG = files.map((f) => path.relative(path.join(root, 'www'), f)).filter((f) => /registerSfx\(/.test(fs.readFileSync(path.join(root, 'www', f), 'utf8')) && !f.endsWith('engine/audio.js'));
const rt = await h.page.evaluate(async ({ REG }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { audio, sfxNames } = await import('/src/engine/audio.js');
  const out = { errors: [] };
  for (const m of REG) { try { await import('/' + m); } catch (e) { out.errors.push('import ' + m + ': ' + e.message); } }
  const { TRACKS } = await import('/src/audio/tracks.js');
  const { AMBIENCE_THEMES } = await import('/src/audio/ambience.js');
  audio.playMusic('docks');                   // before init: must be held, not lost
  audio.ambience('docks');
  audio.init();
  await audio.ctx.resume();
  for (let i = 0; i < 100 && !(audio.music && audio.amb); i++) await sleep(50);
  const M = audio.music;
  await sleep(200);
  out.held = M?.currentTrack === 'docks' && audio.amb?.current === 'docks';
  out.state = audio.ctx.state;
  for (const id of Object.keys(TRACKS).concat(['menu'])) {
    try { audio.playMusic(id, { fadeIn: 0.05 }); } catch (e) { out.errors.push(id + ': ' + e.message); }
    await sleep(250);
  }
  audio.setMusicIntensity(1);
  await sleep(500);
  const names = sfxNames();
  audio.setListener({ x: 0, y: 0, z: 0 }, 0);
  for (const n of names) {
    try { audio.sfx(n, { volume: 0.3 }); audio.sfx(n, { pos: { x: 6, y: 0, z: -14 }, volume: 0.3, throttle: 0 }); } catch (e) { out.errors.push('sfx ' + n + ': ' + e.message); }
    await sleep(12);
  }
  for (const th of AMBIENCE_THEMES.concat(['menu', null])) { try { audio.ambience(th); } catch (e) { out.errors.push('ambience ' + th + ': ' + e.message); } await sleep(200); }
  audio.stopMusic(0.3);
  await sleep(4500);
  out.after = { current: M.current, fading: M.fading.length, timer: !!M._timer, voices: M.kit.active, amb: audio.amb.current, ambTimer: !!audio.amb._timer, ambOld: audio.amb.old.length };
  out.musicErrors = M.errors.slice(0, 5);
  out.recipes = names.length;
  // offline render: the densest loop at full intensity through the real scheduler
  const { MusicPlayer } = await import('/src/audio/music.js');
  const SR = 44100, dur = 8;
  const ctx = new OfflineAudioContext(2, SR * dur, SR);
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  const mp = new MusicPlayer({ ctx, musicBus: bus });
  mp.play('turf-final', { fadeIn: 0.05, intensity: 1 });
  const q = 128 / SR;
  for (let t = 0.1; t < dur - 0.05; t += 0.1) ctx.suspend(Math.round(t / q) * q).then(() => { mp._tick(); ctx.resume(); });
  const buf = await ctx.startRendering();
  mp.dispose();
  let peak = 0, sum = 0;
  for (let c = 0; c < 2; c++) for (const x of buf.getChannelData(c)) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
  out.offline = { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / (2 * buf.length))).toFixed(1), errors: mp.errors.slice(0, 3) };
  return out;
}, { REG }).catch((e) => ({ errors: ['evaluate: ' + e.message] }));

ok &= report('calls made before init() are held and applied', !!rt.held, `ctx ${rt.state}`);
ok &= report(`every track, ${rt.recipes} sfx and every ambience bed play without exceptions`, !rt.errors.length && !rt.musicErrors?.length && !warnings.length && !h.errors.length,
  [...rt.errors, ...(rt.musicErrors || []), ...warnings, ...h.errors].slice(0, 4).join('; '));
const a = rt.after || {};
ok &= report('stop releases voices, timers and ambience scenes', a.current === null && a.fading === 0 && !a.timer && a.voices === 0 && a.amb === null && !a.ambTimer && a.ambOld === 0, JSON.stringify(a));
ok &= report('offline render of turf-final @ intensity 1 is loud but never clips', rt.offline && rt.offline.peak < 1 && rt.offline.rmsDb > -30 && !rt.offline.errors.length, JSON.stringify(rt.offline));
await h.close();
process.exit(ok ? 0 : 1);
