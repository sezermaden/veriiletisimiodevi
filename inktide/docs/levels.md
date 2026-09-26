
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
| 4-2 Gray Heart | back door → intake (barrier `shield`) → pressure deck (CP1: belts + vents) → piston hall (climb pipe, pistons, CP2, `sw-shutter` → `g-shutter`, sponge bridge) → coolant loop (CP3, rail; secret pylon postcard) → west gallery (CP4, spring stash, balloon gate) → Heart bridge (reversed belt, Rollerbrute, turret pylons, barrier `heart`) → Tide Core | `w4-2.engine`, `w4-2.heart`, `w4-2.pa` | 23 | 41 (+crates, balloon) |

Screenshots: `docs/shots/w3-1-*.png`, `w3-2-*`, `w3-3-*`, `w4-1-*`, `w4-2-*`.

### Adversarial playtest pass (W3/W4)

Every stage was driven end to end in headless Chromium with the real controller (a scripted bot
that presses keys and ticks `__game`; teleports only for rescues after a bot-caused failure or for
isolated re-tests). All five reach the Prism Core and complete; every checkpoint fires on the
natural path; `playtest` shots are `docs/shots/<id>-pt*.png`. What the pass found and changed:

- **Checkpoints sat 3-9 m off the path** (7 of 18 were within reach of the route; 0 of 3 in 3-1 fired in the sim). All now
  stand 1-2 m beside the line the player walks, with `radius: 2.4`; landings from rails and pads
  (3-2 CP2, 4-2 CP4) were measured and the flags moved to where players actually land.
- **Climbs blocked by protruding trims.** The unpaintable band on Tank 9 (3-2) and on Vat D (3-3)
  and Vat D's overhanging rim cap stopped the squid mid-climb. Bands are now `collide: false`
  (visual only) and the rim cap is flush. Tank 9's ledge is 2.5 m wide (was 1.5) so the upper
  tank can be painted to its rim from the ledge (from the old 1.5 m ledge the climb stalled).
- **Sequence breaks closed** (convention: walls that frame a barrier/gate must be unpaintable or
  unreachable): 3-1 intake façade, gallery gate frame, Main Line north wall and capsule passage
  walls are `paint: false`; 3-2 Snipe Eel perch is unpaintable (a leap off it cleared the maze exit);
  3-3 gets a second `rim` barrier along the terrace front (a squid leap from the rim reached the
  terrace — verified in sim); 4-2 gets glass on the intake's south edge, a longer glass run beside
  the shutter and a 9.5 m Heart barrier (a kid jump round the 5 m one landed on the Heart), and the
  turret pylons are unpaintable.
- **4-1**: the gust-ledge break is 2.5 m (a 3.0 m break needed a frame-perfect kid jump); the west
  rail is slower (12) and ends heading east at the SW corner with a low parapet — before, the
  fly-off dumped the player into the sponge gap every time. Gondola dwell 2.6 s (was 1.6).
- **Sponges** in 4-1/4-2 sit higher (small top ~1 m under the walkway) so they can be seen and
  inked from the edge; full sponges stand 0.6 m proud, like 3-3's (a hop onto each).
- **Readability**: signs moved off climb faces (Main Line tower, Tank 9, Vat D, Line 1 post, 4-2
  boiler stack); props moved off the narrow 4-1 ledges (and made solid); the 3-3 mover hint now
  says what actually drives it (riding it); 3-1 objectives no longer stay on "Ride Line 1" through
  the control deck and gallery; the secret 4-2 pylon is wide enough for its return pad.

Notes for designers: belts DO carry enemies (the 4-2 Heart belt delivers its Rollerbrute and
Shield Glooper to the dodge bays); launch pads auto-charge only on clean hero ink — after a fight
leaves Murk on the pad, players press Jump (the pad's hint says so).

## World 1–2 story stages (w1-1 … w2-3)

Shared helpers: `levels/w1/docks-kit.js` (piers on pilings, quays with a paintable top slab and an
unpaintable body, container stacks, warehouses, fishing boat and cargo-ship set pieces) and
`levels/w2/heights-kit.js` (rooftop `building()` = unpaintable scenery body + paintable roof cap and
optional climbable facade band, parapets, AC units, water towers, the street canyon at y -30 and a
lit skyline ring). Scenery brushes use `collide:false, paint:false` so they cost no ink-atlas space.

Conventions used in all six stages
- Path runs toward -Z (the backdrop lighthouse sits ahead-left). Spawn yaw PI.
- Every DIALOGUE id of the stage has a trigger at the matching spot, in script order
  (w1-1 plays `w1-1.checkpoint` just before the first flag instead of at the end).
- Gates that must not be bypassed sit where the only way around is water/void, or behind glass /
  grate (unpaintable, so no climbing) walls taller than a squid leap (1.95 m).
- `route` tags: `mover` is also used for sponge-assisted segments; `rail`/`launch` for rails and pads.
- Docks: waterY -1.6, killY -3.2 (a fall is a quick splat). Heights: water off, killY -12.

| id | theme / look | checkpoints | enemies | placed pearls | hidden postcard |
|---|---|---|---|---|---|
| w1-1 First Splash | docks, sunny | 3 | 10 Gloopers | 57 | jetty behind the low container, west side of the loading bay |
| w1-2 Container Crossing | docks, overcast (themeOverride) | 3 | 14 Gloopers, 3 Shield, 2 Rollerbrutes | 42 (+crates) | yellow "duck container" on the canal edge of the crate yard |
| w1-3 Crane Climb | docks, sunset (themeOverride) | 3 | 10 Gloopers, 1 Shield, 2 Snipe Eels | 43 (+crates) | top of Crane A's counterweight (east counter-jib) |
| w2-1 Rooftop Rush | heights | 3 | 5 Buzzdrones, 6 Gloopers, 2 Shield | 40 | tomato terrace, squid leap off R2's east parapet |
| w2-2 Skatepark Sprawl | heights | 3 | 5 Bomblobs, 6 Gloopers, 2 Rollerbrutes, 1 Shield | 34 (+balloons, crates) | crate-sealed alcove at the west end of the halfpipe flat |
| w2-3 Neon Gardens | heights, night (themeOverride) | 3 | 7 Gloopers, 2 Shield, 2 Turrets, 2 Bomblobs, 1 Buzzdrone | 35 | hedge-maze pocket, south-west corner of the Turret Terrace |

Traversal notes (verified in headless sims, see the final report of the level pass)
- Squid leaps are designed for *height*, not distance: every required leap is a ≤2.5 m gap with a
  1.5 m rise (w1-1 alley, w2-1 R2→R3, w2-1 tomato terrace, w2-2 halfpipe vert). With the current
  controller a squid leap only carries ~3–4 m while forward is held (air control pulls horizontal
  speed toward `hopSpeed` 2.3 m/s once airborne), far short of the 7.8 m measured with no input.
- Bounce pads use `push` toward their target ledge and `power` 18 where the ledge is 5+ m high.
- Rails end 0.5 m above the landing roof; the w1-3 lift is `activate:'ink'` and starts 0.3 m above the
  deck so the player stands on the lift, not the deck.
