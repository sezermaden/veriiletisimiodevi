
## World 3 — Murk Refinery & World 4 — Murkwell Tower (w3-1 … w4-2)

Shared kits (stage-local, registered on import — same contract as `entities/stage/*`):

- `levels/w3/refinery-kit.js` — entities `steam-vent` (timed scalding column: idle → warning
  lamps/hiss → blast that deals `dps` and blows the player up/out), `conveyor` (belt; a dynamic
  collider whose `lastDelta` is the belt motion, `stopOn`/`startOn` specs, visual `cargo`),
  `sludge-pool` (glowing Murk liquid that splats on contact; `lake: true` replaces the stage
  water — pair with `water: false`). Brush helpers `island`, `hpipe` (flat-sided, 45°-chamfered
  horizontal pipe: climb the sides, walk the top), `vatRing`, `catwalk` (grate), `beltBed`, `tank`, `lake`.
- `levels/w4/tower-kit.js` — entities `wind-gust` (periodic shove along `dir`; climbing or being
  submerged shelters you, and zones leave the strip next to the wall out), `fall-guard` (splat a
  fall of `drop` m below the active checkpoint), `glow` (unlit energy conduits / core rings).
  Brush helpers `facade` (dark unpaintable skin + glass bands), `ledge`, `pillar`.

| Stage | Route (checkpoints) | Teaches (DIALOGUE ids, in order) | Enemies | Pearls |
|---|---|---|---|---|
| 3-1 Sludge Lines | dock → intake yard (barrier `yard`) → CP1 → Line 1 hall: forward belt, cross belt, reversed belt stopped by `sw-line1` → control deck (CP2, barrier `line1`) → steam gallery (3 vent chokes) → Main Line (CP3): clear `main`, climb tower, `sw-main` stops the ring belts and opens `g-core` | `w3-1.pods`, `w3-1.conveyor`, `w3-1.vent` | 18 | 51 (+crates) |
| 3-2 Pipe Dream | pipe yard (3 pipes to ink & climb) → trunk-main bridge → Tank 1 (CP1) → 60 m ink rail (secret pad → postcard island) → junction (CP2) → 3-row grate maze with pearl trails (barrier `maze`) → Tank 9 plaza (CP3) → climb 7 m + 6 m (CP4) → barrier `top` → launch to the capsule | `w3-2.pipes`, `w3-2.rail`, `w3-2.lost` | 16 | 60 |
| 3-3 Vat Valley | catwalk over Vat A → sponge stones over Vat B (CP1) → ink-powered platform over Vat C (CP2) → climb Vat D, rim crew (barrier `rim`), launch → Serpent terrace (CP3, barrier `final`), capsule on a pier over the Serpent's vat. Hidden ledge behind Vat D = postcard | `w3-3.vats`, `w3-3.sponge`, `w3-3.pa` | 19 | 41 |
| 4-1 The Ascent | plaza → climb terrace wall (CP1) → east gust ledge + 3 m break → NE corner (CP2) → gondola to 37 (CP3) → west ledge → ink rail round the SW corner (drop off early for the secret balcony + postcard) → sponge gap in gusts (CP4) → crew ledge (barrier `crew`) → service door (Dredge conversation opens it) → capsule | `w4-1.storm`, `w4-1.halfway`, `w4-1.pa`, `w4-1.dredge` | 17 | 38 |
| 4-2 Gray Heart | back door → intake (barrier `shield`) → pressure deck (CP1: belts + vents) → piston hall (climb pipe, pistons, CP2, `sw-shutter` → `g-shutter`, sponge bridge) → coolant loop (CP3, rail; secret pylon postcard) → west gallery (CP4, spring stash, balloon gate) → Heart bridge (reversed belt, Rollerbrute, turret pylons, barrier `heart`) → Tide Core | `w4-2.engine`, `w4-2.heart`, `w4-2.pa` | 23 | 44 |

Screenshots: `docs/shots/w3-1-*.png`, `w3-2-*`, `w3-3-*`, `w4-1-*`, `w4-2-*`.
