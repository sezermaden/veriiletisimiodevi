# INKTIDE — Rise of the Murk

A single-player ink-splatting action adventure built on **three.js** (r186). Paint the town in your
colour, dive into your own ink as a squid, climb inked walls, and take the city of Tidehaven back
from Baron Murkwell's Murk Corps across a full story campaign. There is also a Turf Clash mode:
4v4 against bots, and whoever inks the most ground wins.

Everything is original: characters, story, levels, textures, models, music and sound are all
generated in code. There are no asset files, and no Nintendo names or art are used.

## Run

```bash
cd inktide
npm install            # only needed for the test tools (three.js is vendored in www/vendor)
npm run serve          # http://localhost:8080
```

Any static web server works; open `www/index.html` through it. WebGL2 is required.

Developer shortcuts: `?stage=w1-1` loads a stage directly, `&kit=longshot` sets the weapon kit,
`&q=low|medium|high|ultra` sets the quality preset, and `&god=1` makes the player invulnerable.

## Controls (all rebindable in Options ▸ Controls)

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move / look | WASD / mouse | Left / right stick |
| Fire | Left mouse | RT |
| Swim (squid form) | Shift (hold, toggle option) | LT |
| Jump | Space | A |
| Sub weapon | Right mouse | RB |
| Special | Q | LB / RS click |
| Interact | E | X |
| Map / super jump (Turf) | Tab | View |
| Recenter camera | R / middle mouse | Y |
| Pause | Esc / P | Menu |

## Tests

```bash
npm test                                   # every suite (headless Chromium + SwiftShader)
node test/feel.mjs                         # jump acceptance + camera stability, with negative controls
node test/mechanics.mjs                    # swim / climb / enemy-ink regression
node test/campaign.mjs [--negative]        # fresh save → all 15 stages → finale, gamepad only
node tools/validate-level.mjs --all        # route traversability + placement for every stage
node tools/perf.mjs [stageId …]            # draw calls, triangles, casters, JS step time per stage
node tools/make-uwp.mjs                    # stamp the Xbox/Windows UWP shell (build on Windows)
```

## Layout

```
www/                 the game (static)
  index.html         import map, fonts, boot screen
  src/engine/        renderer + post, input (kit contract), audio synth, settings, saves
  src/ink/           ink atlas painting (GPU) + per-face ink grid (CPU)
  src/world/         brushes → faces, level builder (BVH collision), environment, textures
  src/actors/        player controller, Squidkin model, materials
  src/weapons/       kits, mains, subs, specials, projectiles
  src/entities/      enemies, stage objects, NPCs, bosses (registry-driven)
  src/game/          app loop, session (fixed-step), aim camera, modes (story, turf, sandbox)
  src/story/         script, dialogue, cutscenes, motion comics, results
  src/turf/          bots, navigation, map, judging
  src/ui/            HUD and every menu screen
  src/levels/        stage definitions (story worlds, turf arenas, test rooms)
docs/                spec, architecture/contracts, story bible, concept mockups, screenshots
test/                automated suites
tools/               dev server, screenshot driver, level validator, key-art tool
StoreArt/            key-art drop folder + derived covers
```

See `docs/architecture.md` for the module contracts and `docs/spec-resolved.md` for design decisions.
