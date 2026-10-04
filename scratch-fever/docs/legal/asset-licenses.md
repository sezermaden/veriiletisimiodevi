# Asset provenance and licences — Scratch Fever

Everything the player sees and hears is generated in code at runtime or at build time. There is
no `.pak`, no asset-library selection and no third-party art, audio or font file in the package.

| Category | Source | Licence | Notes |
|---|---|---|---|
| 3D geometry (counter, dispenser, cards, coins, bot, brush) | three.js primitives, `src/game/ticket3d.js` | project | — |
| Textures (felt, ticket faces, foil) | Canvas 2D, procedural | project | regenerated per ticket |
| Symbol icons (18) | Canvas paths, `src/game/symbols.js` | project | — |
| Particles, rings, flashes, prize numbers | `engine/fx.js` (kit) | project | — |
| Sound effects and music (3 tracks) | Web Audio synthesis, `engine/audio.js` | project | no samples |
| Fonts | system stack (Segoe UI / Segoe UI Black on Windows and Xbox) | OS | no font files shipped |
| Wordmark, covers, icons | rendered from CSS in Chromium (`tools/cover.mjs`, `tools/make-icons.mjs`) | project | — |
| Store screenshots | captured from the game (`tools/shots.mjs`) | project | — |
| three.js r169 | `www/vendor/three.module.js` + addons | MIT | © 2010-2024 three.js authors |

Buckets as the asset skill reports them: **restricted 0 · attribution_required 0 · commercial_ok 1
(three.js, MIT) · unknown 0.** Nothing needs reconciling against purchase records because no
purchased pack was used.

The name *Scratch Fever* and all copy are original. The game does not reproduce any symbol, ticket
name, character or text from *Scritchy Scratchy* or any other title.
