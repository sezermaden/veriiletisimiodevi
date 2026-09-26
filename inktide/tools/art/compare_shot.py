#!/usr/bin/env python3
"""compare_shot.py — does the implemented screen actually look like the concept?

"Looks close" is not verifiable, so this measures the three things that make a screen read as the
same design, and produces a side-by-side you can judge at a glance:

  1. palette match   — do the implemented colours come from the concept's palette?
  2. layout match    — is the visual weight in the same places? (coarse 6x4 block luminance)
  3. safe area       — does anything important sit outside the TV-safe 5% margin?

It is a guide, not a gate: a concept is an illustration and the screen is a real UI, so 100% is
neither achievable nor desirable. Under ~55% overall usually means the implementation drifted.

Usage:
  python3 art/compare_shot.py --concept concept.png --shot menu-1080.png --out compare.png
"""
import argparse, json, os


def load(path, size=(768, 432)):
    from PIL import Image
    return Image.open(path).convert('RGB').resize(size)


def blocks(im, cols=6, rows=4):
    w, h = im.size
    out = []
    for r in range(rows):
        for c in range(cols):
            tile = im.crop((c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows))
            px = list(tile.getdata())
            n = len(px)
            lum = sum(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in px) / n / 255
            out.append(lum)
    return out


def palette(im, k=8):
    from collections import Counter
    q = Counter()
    for r, g, b in im.getdata():
        q[(r >> 5, g >> 5, b >> 5)] += 1
    return [((r * 32 + 16, g * 32 + 16, b * 32 + 16), n) for (r, g, b), n in q.most_common(k)]


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--concept', required=True)
    ap.add_argument('--shot', required=True)
    ap.add_argument('--out', default='compare.png')
    ap.add_argument('--json')
    a = ap.parse_args()
    from PIL import Image, ImageDraw

    ca, sa = load(a.concept), load(a.shot)

    # 1) palette: how much of the shot's colour mass exists in the concept
    cp, sp = palette(ca), palette(sa)
    total = sum(n for _, n in sp) or 1
    matched = sum(n for c, n in sp if any(dist(c, cc) < 90 for cc, _ in cp))
    pal_score = matched / total

    # 2) layout: correlation of block luminance
    ba, bs = blocks(ca), blocks(sa)
    mean_a, mean_s = sum(ba) / len(ba), sum(bs) / len(bs)
    cov = sum((x - mean_a) * (y - mean_s) for x, y in zip(ba, bs))
    va = sum((x - mean_a) ** 2 for x in ba) ** 0.5
    vs = sum((y - mean_s) ** 2 for y in bs) ** 0.5
    layout_score = (cov / (va * vs) + 1) / 2 if va and vs else 0.0     # -1..1 -> 0..1

    # 3) safe area: bright/high-contrast content in the outer 5% of the shot
    w, h = sa.size
    mx, my = int(w * 0.05), int(h * 0.05)
    edge = []
    for box in [(0, 0, w, my), (0, h - my, w, h), (0, 0, mx, h), (w - mx, 0, w, h)]:
        tile = sa.crop(box)
        px = list(tile.getdata())
        edge += [0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in px]
    inner = sa.crop((mx, my, w - mx, h - my))
    ipx = [0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in inner.getdata()]
    edge_mean = sum(edge) / max(1, len(edge))
    inner_mean = sum(ipx) / max(1, len(ipx))
    safe_ok = edge_mean <= inner_mean * 1.15          # edges should not be busier than the middle

    overall = 0.45 * pal_score + 0.45 * layout_score + 0.10 * (1 if safe_ok else 0)

    # side-by-side with the block grid drawn on, so a human can see WHERE it diverges
    W, H = ca.size
    canvas = Image.new('RGB', (W * 2 + 24, H + 64), (14, 16, 20))
    canvas.paste(ca, (0, 40)); canvas.paste(sa, (W + 24, 40))
    d = ImageDraw.Draw(canvas)
    d.text((8, 12), 'KONSEPT', fill=(200, 210, 225))
    d.text((W + 32, 12), 'UYGULAMA', fill=(200, 210, 225))
    for i, (x, y) in enumerate([(c, r) for r in range(4) for c in range(6)]):
        diff = abs(ba[i] - bs[i])
        if diff > 0.18:                                # mark blocks that diverge visibly
            x0, y0 = W + 24 + x * W // 6, 40 + y * H // 4
            d.rectangle([x0, y0, x0 + W // 6, y0 + H // 4], outline=(224, 86, 77), width=2)
    d.text((8, H + 46), f'palet {pal_score*100:.0f}%   yerlesim {layout_score*100:.0f}%   '
                        f'guvenli alan {"OK" if safe_ok else "TASIYOR"}   toplam {overall*100:.0f}%',
           fill=(230, 232, 238))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or '.', exist_ok=True)
    canvas.save(a.out)

    res = {'palette': round(pal_score, 3), 'layout': round(layout_score, 3),
           'safe_area_ok': safe_ok, 'overall': round(overall, 3), 'image': a.out}
    if a.json:
        json.dump(res, open(a.json, 'w'), indent=1)
    print(f'palet {pal_score*100:.0f}% | yerlesim {layout_score*100:.0f}% | '
          f'guvenli alan {"OK" if safe_ok else "TASIYOR"} | toplam {overall*100:.0f}%')
    print(f'yan yana gorsel: {a.out}  (kirmizi kareler = konseptten sapan bolgeler)')
    if overall < 0.55:
        print('UYARI: uygulama konseptten belirgin sapiyor — kirmizi karelere bak')


if __name__ == '__main__':
    main()
