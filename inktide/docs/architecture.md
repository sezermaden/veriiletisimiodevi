# INKTIDE — Architecture & Module Contracts

Everything runs from `www/` as native ES modules (import map in `index.html`: `three`,
`three/addons/…`, `three-mesh-bvh`). No bundler. `npm run serve` → http://localhost:8080.
Dev shortcuts: `?stage=<id>` boots straight into a stage, `&kit=<kitId>`, `&god=1`.

## Frame loop (never break this)

`game/app.js` runs one `requestAnimationFrame` loop:

```
input.update(dt) → (pause check) → ui.update(dt, input) → session.update(dt) → input.endFrame()
```

`game/session.js` `update(frameDt)`:
1. **Latch edge input once per frame** (`player.latchInput(input)`, `mode.latchInput`). Never call
   `input.justPressed()` inside a fixed step — at 60 Hz half the frames run zero steps and the
   press would be lost.
2. Fixed 60 Hz steps with the SNAP accumulator → `session.step(FIXED)`:
   `mode.step → player.step → entity.step (all) → projectiles.step → remove dead entities`.
3. Per frame: `camRig.update`, `player.render`, `entity.render`, `projectiles.render`, `fx.update`,
   `ink.flush` (GPU painting), `env.follow/update`, `mode.update`, `hud.update`, render.

Level-triggered reads (`input.isDown('fire')`, `input.move`) are fine inside steps.

## Coordinates & conventions

- Metres, +Y up. Player feet = `position`. Kid height ≈ 1.45 m, squid ≈ 0.5 m.
- Model yaw: meshes face **+Z** at yaw 0 (`rotation.y = Math.atan2(dir.x, dir.z)`).
- Camera yaw convention (kit rig): forward = `(-sin yaw, 0, -cos yaw)`.
- Teams: `TEAM_NONE 0`, `TEAM_HERO 1` (player / Alpha), `TEAM_MURK 2` (enemies / Bravo) from
  `ink/ink-system.js`. `session.ink.color(team)` → `THREE.Color`.

## Session API (what every module may use)

```
session.scene, session.camera, session.renderer, session.input, session.audio, session.events
session.ink          InkSystem   paint(pos, radius, team, normal, {source}) → m² gained
                                  inkAt(faceId, point) → team, inkFraction(face, p, r, team)
                                  coverage() → {a, b, total} (floor m²), onPaint(fn)
session.level        Level        raycast(origin, dir, far, {staticOnly}) → {point, normal, distance, faceId, face, dynamic}
                                  lineOfSight(a, b), groundBelow(p, far), collideCapsule(...)
                                  addDynamic(mesh, {owner, solid, tag}) → moving/toggle collider (owner.lastDelta carries riders)
                                  killY, bounds
session.player       Player       position, velocity, hp, maxHp, ink, inkMax, special, alive, form,
                                  submerged, team, enemyTeam, damage(amount, info), splat(), frozen,
                                  kit {main, sub, special, def}, setKit(id), model (SquidkinModel)
session.actors       [Actor]      everything hittable (player included)
session.entities     [Entity]
session.projectiles  Projectiles  spawn({...}) — see weapons/projectiles.js header
session.fx           Particles    burst, spray, ring, puff, explosion
session.hud          Hud          toast, hint('{fire} to shoot'), setObjective, bossBar(name, frac|null),
                                  turf(timeLeft, teamA, teamB), damageFlash, hitMarker, show(bool)
session.camRig       AimCamera    yaw, pitch, override = {position, target} for cutscenes, addTrauma
session.shake(pos, amount), session.flash(color, amount), session.setCheckpoint(pos, yaw)
session.pearls (int), session.time, session.mode, session.entity(id), session.addEntity(e)
session.events       emit/on: 'hit' {target, source, damage, point}, 'actorDefeated' {actor, by},
                     'playerSplatted', 'playerRespawned', 'special'
```

## Entities (`entities/base.js`)

```js
import { Entity, Actor, registerEntity } from '../entities/base.js';
class Glooper extends Actor {
  constructor(session, def) { super(session, def, { team: TEAM_MURK, hp: 80, hitRadius: 0.55, hitHeight: 1.1 }); ... }
  step(dt) { /* fixed-rate AI + physics */ }
  render(dt) { /* animation */ }
  onDamaged(amount, info) {}
  onDeath(info) { /* fx, drop pearls, then */ this.remove(); }
}
registerEntity('glooper', (s, d) => new Glooper(s, d));
```

`this.group` is added to the scene at `def.pos`, `def.yaw`. `this.remove()` → disposed after the
step. Register modules by importing them from `entities/index.js`.

## Weapons (`weapons/base.js`)

Kits (8), subs (4), specials (4) are listed in `KITS`, `SUB_INFO`, `SPECIAL_INFO`. Implement a
class and `registerMain('roller', Roller)` etc.; import it from `weapons/index.js`. A wielder is
anything with `session, team, position, velocity, yaw, grounded, aim {dir, point}, useInk(n),
ink, inkMax, model?, addSpecial(n), isPlayer`. Helpers: `muzzleOf`, `aimDir`, `inkExplosion`,
`makeGunModel`.

## Level definitions (`levels/*.js`, helpers in `levels/kit.js`)

Stages default-export `{ id, name, world, theme, music, waterY, killY, spawn:{pos,yaw}, brushes,
preInk, entities, objective, ... }`. Register the loader in `levels/index.js` (`STAGE_LOADERS`).
Brush types: `box`, `ramp`, `cyl`, `prism`, `stairs` (use `block/box/ramp/rampC/cyl/stairs/prism/
container/slab` helpers). Surfaces: concrete, tiles, asphalt, wood, metal, container, brick,
plaster, grate*, rubber, sand, grass, murk, glass*, sponge (*unpaintable). Themes (`world/
environment.js`): docks, heights, refinery, tower, arena, plaza.

## UI (`ui/screens.js`)

`ScreenManager` stack; `Screen` subclasses build DOM into `this.el`, use `this.button(el, fn)` for
focusable items (geometric focus via D-pad/stick/arrows, A/Enter accept, B/Esc back). A screen
with `blocksGame: true` pauses the running session. `app.onPause` must push the pause screen.
`ui/boot-ui.js` exports `showTitle(app)` and `modeFor(app, stageId)`.

## Audio (`engine/audio.js`)

`audio.sfx(name, {pos, volume, pitch})` — synth recipes registered with `registerSfx(name, fn)`.
`audio.blip(voice)` for dialogue gibberish. `audio.playMusic(id)` / `stopMusic()` are served by
`audio/music.js` (`export class MusicPlayer { constructor(audio); play(id, opts); stop(fade) }`).

## Saves & settings

`engine/save.js` (`save.data`, `completeStage`, `addPearls`, `unlockKit`, flags) and
`engine/settings.js` (`settings.get/set`, `INK_PALETTES`, `TURF_PALETTES`).

## Entity catalogue (contract between level authors and entity implementers)

All entities take `{ type, pos:[x,y,z], yaw?, id? }` plus the params below. Unknown params are
ignored. Missing optional params get sensible defaults. `group` lets triggers/barriers react to a
set of enemies.

### Enemies — `entities/enemies/` (team MURK, all paint Murk ink, drop pearls on defeat)
| type | role | params |
|---|---|---|
| `glooper` | basic ink-blaster grunt, patrols, strafes | `patrol:[[x,y,z],…]`, `aggro` (m, 16), `group` |
| `shield-glooper` | carries a front shield (only hit from sides/back/bombs) | same as glooper |
| `rollerbrute` | charges with a roller leaving a Murk lane | `aggro`, `group` |
| `buzzdrone` | flying bomber, hovers at `alt` and drops ink bombs | `alt` (4), `patrol`, `group` |
| `snipe-eel` | long-range charger sniper with a visible laser | `aggro` (30), `group` |
| `bomblob` | lobs splash bombs in arcs | `aggro` (20), `group` |
| `murk-turret` | static rotating turret | `aggro` (18), `rate`, `group` |
| `murk-pod` | spawner: releases gloopers until destroyed | `max` (3), `interval` (4), `spawn` ('glooper'), `group` |

### Stage objects — `entities/stage/`
| type | behaviour | params |
|---|---|---|
| `checkpoint` | beacon; touching it sets the respawn point | `yaw` |
| `prism-core` | stage goal capsule: shoot it open → `session.mode.complete()` | `hp` (60) |
| `pearl` | currency pickup (+1, magnetises when close) | — |
| `pearl-trail` | line of pearls | `to:[x,y,z]`, `count` |
| `postcard` | hidden lore collectible | `id`, `title`, `text` |
| `launchpad` | squid on it (press Jump) → launched on an arc to `target` | `target:[x,y,z]` |
| `sponge` | block that grows when inked with hero ink (platform), shrinks with Murk | `size:[w,h,d]` |
| `ink-rail` | rail activated by shooting its start; squid form rides it | `points:[[x,y,z],…]` |
| `switch` | shoot target; emits `session.events.emit('switch', id)` and opens gates `targets` | `targets:['gateId']` |
| `gate` | door/shutter that opens on switch, trigger event, or `openOn:'group:<g>'` (all enemies in group defeated) | `id`, `size:[w,h,d]`, `openOn` |
| `mover` | moving platform along `path` (pingpong), optional `activate:'ink'` (moves while inked) | `size`, `path`, `speed`, `wait`, `mat` |
| `murk-barrier` | purple energy wall that dissolves when `group` is cleared | `size`, `group` |
| `crate` | breakable crate, drops `pearls` | `size`, `pearls` |
| `balloon` | inflatable target; popping all balloons of `group` emits event `balloons:<group>` | `group` |
| `trigger` | invisible zone; once: `dialogue` (id or inline lines), `objective`, `hint`, `event`, `checkpoint:true` | `size:[w,h,d]`, `once` |
| `spring` | bounce pad | `power` |
| `decor` | non-gameplay dressing: `kind` ∈ lamp, barrel, crate-stack, bench, palm, bush, flowerpot, neon-sign, billboard, graffiti, crane, buoy, cone, antenna, pipe, vat, flag, railing, fence, speaker-tower, tire-stack, hydrant, vending, awning, satellite, chimney | `kind`, `scale`, `yaw`, `color`, `text` |

### NPCs — `entities/npc/`
`npc` `{ who: 'brine'|'pix'|'kid'|'shelly'|'otto'|'tilly', dialogue, idle:'wave'|'cheer' }` — talk with Interact.

### Bosses — `entities/bosses/`
`boss-grinder`, `boss-bucketeer`, `boss-serpent`, `boss-murkwell`. On defeat each emits
`session.events.emit('bossDefeated', {id})`; the story mode completes the stage.

## Story mode contract (`game/modes/story.js`)

Entities call these defensively (`session.mode?.dialogue?.(…)`):
- `mode.dialogue(idOrLines) → Promise` — lines `[{ who: 'brine', text: '…', mood? }]` or an id from
  `story/script.js`. Freezes the player, shows the dialogue box, voice blips per speaker.
- `mode.objective(text)`, `mode.addPearls(n)`, `mode.collectPostcard(id)`, `mode.checkpoint(pos, yaw)`
- `mode.complete(info)` — stage clear sequence → results screen → save + unlocks.
- `mode.cutscene(async (cs) => { await cs.camera(pos, target, secs); await cs.say(lines); … })`
Speakers: `brine` (Commodore Brine, mantis-shrimp veteran), `pix` (Pix, jellyfish DJ/hacker, radio),
`kai` (the player), `murkwell` (Baron Murkwell, anglerfish tycoon), `dredge` (Foreman Dredge,
Murkwell's lieutenant), `shelly` (armory hermit crab), `otto` & `tilly` (sea-otter turf judges).
