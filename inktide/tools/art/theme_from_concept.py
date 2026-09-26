#!/usr/bin/env python3
"""theme_from_concept.py — turn a chosen concept image into a usable UI theme.

The point of the concept step is that every game should look like itself. That only holds if the
implementation inherits the concept's actual colours instead of a developer's memory of them, so
this reads the pixels and writes the tokens the UI is built from.

What it extracts:
  - a background / surface / accent / text palette, sampled by REGION rather than globally
    (a menu concept is dark on the left and bright on the right; one global average is mud)
  - contrast checks against WCAG-ish ratios, because 10-foot TV reading is unforgiving
  - a tint colour for the greyscale UI set (feeds tools/tint.py in the asset library)
  - a type scale sized for a 10-foot layout

Usage:
  python3 art/theme_from_concept.py --image concept.png --out game/src/theme.css
  python3 art/theme_from_concept.py --image concept.png --out theme.css --json theme.json
"""
import argparse, colorsys, json, os
from collections import Counter


def load(path, max_side=720):
    from PIL import Image
    im = Image.open(path).convert('RGB')
    if max(im.size) > max_side:
        r = max_side / max(im.size)
        im = im.resize((int(im.width * r), int(im.height * r)))
    return im


def quantize(im, k=6):
    """Dominant colours by coarse binning — stable and dependency-free."""
    q = Counter()
    for r, g, b in im.getdata():
        q[(r >> 4, g >> 4, b >> 4)] += 1
    out = []
    for (rr, gg, bb), n in q.most_common(k * 4):
        c = (rr * 16 + 8, gg * 16 + 8, bb * 16 + 8)
        if all(dist(c, o[0]) > 60 for o in out):     # keep them visually distinct
            out.append((c, n))
        if len(out) >= k:
            break
    return out


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hexs(c):
    return '#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in c)


def sat(c):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
    return s, l, h


def shift(c, dl=0.0, ds=0.0):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l + dl)), max(0, min(1, s + ds)))
    return (r * 255, g * 255, b * 255)


def analyse(im):
    w, h = im.size
    regions = {
        'menu': im.crop((0, int(h * 0.15), int(w * 0.42), int(h * 0.9))),   # where menu items live
        'stage': im.crop((int(w * 0.45), 0, w, h)),                          # the art side
        'bottom': im.crop((0, int(h * 0.86), w, h)),                         # prompt bar
    }
    pal = {k: quantize(v, 5) for k, v in regions.items()}

    menu_colors = [c for c, _ in pal['menu']]
    # background = darkest, most common colour in the menu region
    bg = min(menu_colors, key=lum)
    # Text is the colour you READ, not the brightest thing on screen. Thin type covers few
    # pixels, so it often misses the dominant-colour list entirely and the highlight colour wins
    # instead — which is how UIs end up with orange body text. Prefer a desaturated, legible
    # candidate; if the concept has none, synthesise one from the background.
    readable = [c for c in menu_colors if sat(c)[0] < 0.35 and contrast(c, bg) >= 4.5]
    if readable:
        text = max(readable, key=lambda c: contrast(c, bg))
    else:
        base = (245, 247, 252) if lum(bg) < 0.35 else (16, 18, 24)
        text = base
    # accent = the most saturated colour anywhere, since that is what the eye reads as "the game"
    everything = [c for r in pal.values() for c, _ in r]
    accent = max(everything, key=lambda c: sat(c)[0] * (0.4 + lum(c)))
    # accent and text must never collapse into each other: highlight stops meaning anything
    if dist(accent, text) < 60:
        text = (245, 247, 252) if lum(bg) < 0.35 else (16, 18, 24)
    # surface sits between background and text — panels, cards
    surface = shift(bg, dl=+0.08)
    surface2 = shift(bg, dl=+0.15)
    muted = shift(text, dl=-0.22, ds=-0.25)

    return {
        'bg': bg, 'surface': surface, 'surface2': surface2,
        'text': text, 'muted': muted, 'accent': accent,
        'accent_dim': shift(accent, dl=-0.14),
        'accent_bright': shift(accent, dl=+0.12, ds=+0.05),
        'palette': {k: [hexs(c) for c, _ in v] for k, v in pal.items()},
    }


CSS = '''/* GENERATED from the chosen concept image by art/theme_from_concept.py.
   Every UI component reads these variables; no component hard-codes a colour, so re-running
   this against a different concept restyles the whole game. Sizes are 10-foot values:
   a TV is watched from ~3 m, so the smallest readable text is around 24 px at 1080p. */
:root {{
  /* colour */
  --bg:            {bg};
  --surface:       {surface};
  --surface-2:     {surface2};
  --text:          {text};
  --text-muted:    {muted};
  --accent:        {accent};
  --accent-dim:    {accent_dim};
  --accent-bright: {accent_bright};
  --focus:         {accent_bright};
  --danger:        #e0564d;
  --success:       #5ac57f;

  /* type — clamp() so 1080p and 4K both read correctly */
  --font-display: '{display_font}', system-ui, sans-serif;
  --font-ui:      '{ui_font}', system-ui, sans-serif;
  --step--1: clamp(18px, 1.15vw, 26px);
  --step-0:  clamp(24px, 1.55vw, 34px);   /* body / menu items */
  --step-1:  clamp(32px, 2.1vw,  46px);
  --step-2:  clamp(44px, 3.0vw,  66px);
  --step-3:  clamp(64px, 4.4vw,  96px);   /* game title */

  /* spacing and TV safe area (5% each side is the console guideline) */
  --safe-x: 5vw;
  --safe-y: 5vh;
  --gap-s: 0.6rem;
  --gap-m: 1.2rem;
  --gap-l: 2.4rem;

  /* interaction */
  --focus-ring: 4px;
  --radius: 14px;
  --hit-min: 64px;          /* minimum focusable height at 10 feet */
  --anim-fast: 120ms;
  --anim-slow: 260ms;
}}

/* Focus must be visible across the room — this is the single most important 10-foot rule. */
:where(button, [role="menuitem"], [tabindex]):focus-visible {{
  outline: var(--focus-ring) solid var(--focus);
  outline-offset: 3px;
}}
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', required=True, help='chosen concept image')
    ap.add_argument('--out', required=True, help='theme.css to write')
    ap.add_argument('--json', help='also write the raw analysis')
    ap.add_argument('--display-font', default='Anton')
    ap.add_argument('--ui-font', default='Open Sans')
    a = ap.parse_args()

    im = load(a.image)
    t = analyse(im)
    css = CSS.format(
        bg=hexs(t['bg']), surface=hexs(t['surface']), surface2=hexs(t['surface2']),
        text=hexs(t['text']), muted=hexs(t['muted']), accent=hexs(t['accent']),
        accent_dim=hexs(t['accent_dim']), accent_bright=hexs(t['accent_bright']),
        display_font=a.display_font, ui_font=a.ui_font)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(css)

    c_text = contrast(t['text'], t['bg'])
    c_accent = contrast(t['accent'], t['bg'])
    report = {
        'tokens': {k: hexs(v) for k, v in t.items() if k != 'palette'},
        'regions': t['palette'],
        'contrast': {'text_on_bg': round(c_text, 2), 'accent_on_bg': round(c_accent, 2)},
        'tint_for_ui_set': hexs(t['accent']),
        'warnings': [],
    }
    if c_text < 7:
        report['warnings'].append(
            f'text/background contrast {c_text:.1f}:1 — under 7:1 is hard to read across a room; '
            'lighten --text or darken --bg')
    if c_accent < 3:
        report['warnings'].append(
            f'accent/background contrast {c_accent:.1f}:1 — the focus ring will not read on a TV')
    if a.json:
        json.dump(report, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'theme.css -> {a.out}')
    for k in ('bg', 'surface', 'text', 'accent'):
        print(f'  --{k:<9} {hexs(t[k])}')
    print(f'  metin/zemin kontrast {c_text:.1f}:1 | vurgu/zemin {c_accent:.1f}:1')
    print(f'  UI setini tint\'lemek icin: python3 tools/tint.py --color "{hexs(t["accent"])}" ...')
    for w in report['warnings']:
        print('  UYARI:', w)


if __name__ == '__main__':
    main()
