# Propworks — resolved spec

Source request (Turkish, paraphrased): *build a game like Garry's Mod on three.js with the same
mechanics and look, single-player, a complete game (not a demo) with a story from start to end,
polished graphics, animations and effects, full gamepad + mouse + keyboard support, in English.*

## What was built

| Area | Delivered |
|---|---|
| Core loop | Grab / freeze / weld / build with physics tools; use the constructions to solve puzzles and fights |
| Camera | First person (third-person orbit camera in the Rover) |
| Story | 5 chapters, ~25 checkpointed sections, voiced (TTS) + subtitled dialogue, lore terminals, boss, ending + credits |
| Sandbox | 4 maps (gm_foundry, gm_flatland, gm_proving_grounds*, gm_core*), everything unlocked. *unlocked by the story |
| Physics Gun | grab at hit point, push/pull, rotate with 45° snap, freeze in mid-air, unfreeze contraption, curved beam |
| Tool Gun | 18 tools: Weld, Axis, Ball Socket, Rope, Elastic, No-Collide, Balloon, Thruster, Wheel, Hoverball, Dynamite, Lamp, Remover, Weight, Duplicator, Colour, Material, Ignite |
| Weapons | Crowbar, Gravity Gun, 9mm Pistol, SMG, Shotgun, Frag Grenade (+ Physics Gun, Tool Gun) |
| Spawn menu | Props (60, 4 categories, rendered spawn icons), Entities, Weapons, NPCs, Vehicles, tool list + option panel |
| Context menu | freeze, gravity, collisions, ignite, remove, undo, noclip, flashlight |
| NPCs | Citizen, Mannequin (ragdoll), Null, Null Brute, Null Drone, boss "The Unrendered"; limb-grabbable ragdolls |
| World | brush levels, water with buoyancy, doors, lifts, buttons, triggers, breakable wood/glass/melons, fire, chain explosions |
| Input | keyboard + mouse (rebindable), gamepad (every screen, spawn menu, context menu), rumble |
| Platform | UWP shell (PC + Xbox), single-file build, 10-foot UI with 5% safe area |

## Assumptions (decided without asking — correct any of these)

- **ASSUMPTION-01 — "identical look and mechanics" means the *style and feel*, not the IP.** Mechanics
  (physgun, toolgun, spawn/context menus, undo, noclip, weld/rope/thrusters…) and the Source-era
  look (dev grid textures, HL2-style amber HUD, missing-texture checkerboard) are recreated. No
  Valve/Facepunch models, textures, names, logos or sounds are used; every asset is original and
  procedurally generated.
- **ASSUMPTION-02 — name:** *Propworks* (placeholder until you pick one).
- **ASSUMPTION-03 — story:** original — a Builder inside the Workshop simulation, WREN the research
  engine, the corrupted Archive, the Nulls (un-rendered previous Builders) and The Unrendered.
- **ASSUMPTION-04 — no painted key art yet.** The Higgsfield account had 0.65 credits, not enough
  for a generation, so Gate 1 was skipped. The main menu uses a live 3D map (as the genre does).
  `StoreArt/KeyArt/` + `npm run covers` are ready for art to be dropped in; covers made meanwhile
  are labelled **placeholders built from screenshots**.
- **ASSUMPTION-05 — asset library not used.** The Kanuni asset library (`D:\2026\AssetLibrary`) is
  not reachable from this cloud container, so every model, texture, sound and the music are
  procedural. Characters are procedural mannequins with procedural animation. Swapping in
  library characters later is a per-NPC change in `world/npc.js` (`buildHumanoid`).
- **ASSUMPTION-06 — voice:** WREN is voiced with the platform text-to-speech (Windows ships
  voices); it can be switched off in Options ▸ Audio. Subtitles are always available.
- **ASSUMPTION-07 — difficulty:** Easy / Normal / Hard scale damage taken and enemy health.
- **ASSUMPTION-08 — Partner Center identity is a placeholder** (`CN=00000000-…`, `PLACEHOLDER.Propworks`).
  Replace in `Propworks/Package.appxmanifest` before packaging.
- **ASSUMPTION-09 — gamepad map:** LS move · RS look · A jump · B crouch · X reload/unfreeze · Y use
  (hold + RS rotates a held object) · RT primary · LT secondary/freeze · RB/LB next/prev weapon ·
  D-pad push/pull (holding) or contraption channels 1–4 · VIEW tap spawn menu / hold undo ·
  R3 context menu · MENU pause.
