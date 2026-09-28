# Propworks — build report (Gate 2)

## Verification

All tests run headless (Chromium + SwiftShader). `npm test` runs every one of them.

| Test | Result | Negative control (before the fix / buggy path) |
|---|---|---|
| Kit input/camera contract (`test/input.mjs`), run against the shipped `www/engine` files | 16/16 | — (kit suite) |
| Jump acceptance at 60 Hz (dt 0.0163 / 0.0170) | 12/12 | legacy (edge read inside the step): 12/12. At 60 Hz it only loses a press on a rare zero-step frame, so 60 Hz is not used as the control. |
| Jump acceptance at 144 Hz | 12/12 | legacy: **6/12**. The test does see the bug. |
| Rover camera: worst boom-length change per frame | 0.94 m | legacy unsmoothed boom: **4.96 m**. Threshold 2.0 m, chosen between the two measurements. |
| Camera never collapses / flies away | min 2.27 m, max 7.60 m | — |
| Layout, 9 screens × 5 shapes (1080p, 1440p, 4K, 16:10, 21:9): focus present, hit size ≥ `--hit-min`, 5% safe area, clipping, no page scroll | 45/45 | the spawn menu failed the safe-area check before it was moved to the safe-area tokens |
| Gamepad reachability, as a BFS over the focus graph on every screen | all reachable | — |
| Memory: foundry ⇄ flatland reloads (measured after cleanup) | no geometry accumulation; textures +1 per reload (small residual, tracked) | before `disposeTree`: **+124 geometries per map load** |
| Story bot: plays ch1 → ch5 to the credits | 5/5 chapters, progress saved | ch5 used to stall when two pylons fell in one explosion (fixed) |
| Store listing field limits | all within limits | — |

## Bugs found and fixed during verification

- **Player sank through floors on long frames.** The player and the world stepped from separate accumulators, so the character controller read a stale collider. They now advance in lockstep.
- **Physics Gun could not grab** anything while the player was sinking (the same bug as above).
- **Missed pylon kills in chapter 5.** The story waited on an event, and a second pylon falling in the same frame was lost. It now waits on a count.
- **GPU resources leaked on every map load.** Viewmodels, NPC bodies, orbs and the boss were never disposed. `disposeTree` now frees them, while shared catalogue resources are marked and left alone.
- **Shader recompiles on every flash.** Flash lights, the physgun beam light, the flashlight and lamps were toggled with `.visible`, which changes the light count and makes every material's shader recompile. They now stay in the scene and switch intensity instead.
- **Negative frame delta.** rAF can report a time earlier than boot; `dt` is now clamped at 0.
- **Frame loop could die.** One exception inside a frame stopped the `requestAnimationFrame` loop. The next frame is now scheduled first and errors are logged.

## Asset provenance

| Category | Source |
|---|---|
| Textures: dev grids, concrete, metal, wood, crate, grass, sand, checker, barrels, signs | procedural canvas painting at boot (`render/textures.js`) |
| Props (60) | procedural geometry (`world/props.js`) |
| Characters, NPCs, boss | procedural mannequin rig with procedural animation (`world/npc.js`) |
| Weapons, viewmodels | procedural (`weapons/viewmodels.js`) |
| Sound effects | Web Audio synthesis (`core/audio.js`) |
| Music | generative Web Audio score (`core/music.js`) |
| Dialogue voice | platform text-to-speech |
| Engine | three.js 0.186 (MIT), Rapier 0.21 (Apache-2.0) |
| Kanuni asset library | **not used** — unreachable from the build container (see ASSUMPTION-05) |
| Painted key art | **none yet** — the Higgsfield balance was 0.65 credits (see ASSUMPTION-04) |

## Sizes

- `Propworks/www`: 8.1 MB, most of it `vendor/` (three.js and Rapier with inlined WASM).
- Single-file build (`npm run bundle`): about 5.2 MB.

## Store art status

- `StoreArt/Screenshots/`: 7 gameplay shots at 1920×1080.
- `StoreArt/Logo/`: wordmark rendered in Chromium (wide, stacked, mark).
- `StoreArt/Covers/` and `Assets/` (75 icons) are **placeholders built from screenshots** until key art is added to `StoreArt/KeyArt/`.

## What still needs Windows

`.msixupload` packaging (open `Propworks.sln`, build Release | x64, run `tools\Make-StoreUpload.ps1`).
Before packaging, replace the placeholder Partner Center identity in `Package.appxmanifest`.
