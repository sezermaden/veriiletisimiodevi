# Key art drop folder

Drop the chosen painted key art here with exactly these names (PNG, JPG or WEBP):

| File | Aspect | Used for |
|---|---|---|
| `hero-16x9.*` | 16:9, ≥ 1920×1080 | Store hero, 16:9 covers, menu backdrop option |
| `poster-2x3.*` | 2:3, ≥ 1440×2160 | 720×1080 poster art (required for games) |
| `box-1x1.*` | 1:1, ≥ 1080×1080 | 1080×1080 box art (required), tile icons |

Then run:

```bash
npm run logo      # renders the wordmark with the real font (Chromium, never SVG text)
npm run covers    # composites art + wordmark into every Store size
npm run icons -- --source Propworks/StoreArt/Covers/box-1080.png
```

If a file is missing, `covers` falls back to an in-game screenshot for that shape and
says so — those are placeholders, not concept art.
