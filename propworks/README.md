# Propworks

A story-driven physics sandbox built on **three.js** + **Rapier**, packaged as a UWP app for
Windows PC and Xbox. Grab anything with the Physics Gun, weld it, float it, drive it — then
use all of it to escape a simulation that is un-rendering itself.

Everything (textures, models, sounds, music) is generated procedurally at runtime; the game
ships no binary assets.

## Run it

```bash
npm install
npm run vendor      # copies three.js + Rapier into Propworks/www/vendor (no symlinks)
npm run serve       # http://localhost:8080
```

`npm run bundle` builds a single self-contained `Propworks/dist/Propworks.html`.

## Modes

- **Story** — five chapters: *Boot Sequence*, *Tools of the Trade*, *Moving Parts*,
  *Missing Textures*, *The Unrendered*. Checkpoints autosave; *Continue* resumes.
- **Sandbox** — gm_foundry, gm_flatland (+ gm_proving_grounds and gm_core after the story).
  Everything unlocked: 60 props, 18 tools, 8 weapons, NPCs, ragdolls, the Rover.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move / look | WASD / mouse | Left / right stick |
| Jump · crouch · sprint · walk | Space · Ctrl · Shift · Alt | A · B · L3 |
| Primary / secondary fire | LMB / RMB | RT / LT |
| Use · reload / unfreeze | E · R | Y · X |
| Rotate held object | hold E + mouse (Shift snaps 45°) | hold Y + right stick |
| Push / pull held object | mouse wheel | D-pad up / down |
| Weapons | 1–6, mouse wheel | RB / LB |
| Spawn menu · undo | Q · Z | VIEW tap · VIEW hold |
| Context menu | C | R3 |
| Noclip · flashlight | V · F | context menu |
| Contraption channels 1–6 | Num 8/2/4/6/5/0 or I/K/J/L/U/O | D-pad (1–4) |
| Pause | Esc / P | MENU |

Keyboard bindings are rebindable in **Controls**.

## Tests

```bash
npm test                # everything below
npm run test:input      # the kit's 16 input/camera assertions, against the shipped engine files
npm run test:feel       # jump acceptance at 60/144 Hz + vehicle camera stability, with negative controls
npm run test:layout     # 9 screens x 5 resolutions: focus, hit size, safe area, clipping, gamepad reachability
npm run test:memory     # map reloads do not accumulate GPU resources
npm run test:story      # plays all five chapters to the credits (FROM=ch3 to start later)
npm run test:listing    # Store listing field limits
```

## Store art and packaging

- `Propworks/StoreArt/KeyArt/` — drop painted key art here (see its README), then
  `npm run logo && npm run covers && npm run icons -- --source Propworks/StoreArt/Covers/box-1080.png`.
- `npm run shots` — Store screenshots from real gameplay.
- Packaging (`.msixupload`) needs Windows: open `Propworks.sln`, build Release | x64, then
  `tools\Make-StoreUpload.ps1`. Replace the placeholder identity in `Package.appxmanifest` first.

See `docs/spec-resolved.md` for decisions and assumptions.
