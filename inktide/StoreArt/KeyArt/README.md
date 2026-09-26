# Key art drop folder

Drop exactly these files here (any of .png / .jpg / .webp):

| file | aspect | used for |
|---|---|---|
| `hero-16x9.*` | 16:9, ≥ 1920×1080 | menu backdrop, Store hero, 16:9 covers |
| `poster-2x3.*` | 2:3, ≥ 1080×1620 | Store poster / box art |
| `box-1x1.*` | 1:1, ≥ 1080×1080 | square tiles, icons |

Then run from the project root:

```bash
node tools/keyart.mjs            # writes StoreArt/Covers/* and www/art/menu-backdrop.webp
python3 tools/art/theme_from_concept.py --image StoreArt/KeyArt/hero-16x9.png --out docs/concept/theme-keyart.css
```

The game works without these files (the menu uses a live 3D diorama). When
`www/art/menu-backdrop.webp` exists the title screen layers it behind the logo.

Why the drop folder: Higgsfield images live on a CDN that this build environment cannot
download, so a person drops the three chosen files here once and the tool derives everything.
Prompt used / to use (nano_banana_pro, 16:9, NO text, NO logo, NO watermark):
"Vibrant stylised game key art: a squid-kid hero with a glossy tangerine squid-mantle cap and
tentacle hair, big expressive eyes, chunky sneakers, mid-leap over a sun-drenched harbour plaza,
firing a toy-like ink blaster that splashes thick glossy tangerine ink across concrete and shipping
containers; violet 'Murk' ink creeping in from the right where tar-blob grunts with glowing visors
advance; lighthouse and colourful city skyline in the background, dramatic sunset sky, empty sky in
the upper third for a title. Saturated colours, soft rim light, playful street-culture graffiti
details. NO text, NO logo, NO watermark. Not Splatoon, no Inklings or Octolings."
