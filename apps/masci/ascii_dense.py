#!/usr/bin/env python3
"""Dense image-to-glyph converter.
Removes a flat background (sampled from the corners), boosts local contrast,
and writes a grid of tone classes + luminance, plus a plain ASCII text version.

usage: python ascii_dense.py IMAGE [--cols 180] [--crop x0 y0 x1 y1]
                             [--bg-tol 28] [--aspect 2.0] [--out fig.json] [--txt out.txt]
requires: pillow, numpy
"""
import argparse, json
import numpy as np
from PIL import Image, ImageFilter

RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"

def main():
    p = argparse.ArgumentParser()
    p.add_argument("image")
    p.add_argument("--cols", type=int, default=180)
    p.add_argument("--crop", type=int, nargs=4)
    p.add_argument("--bg-tol", type=float, default=28)
    p.add_argument("--aspect", type=float, default=2.0, help="cell height / width")
    p.add_argument("--out", default="fig.json")
    p.add_argument("--txt", default="out.txt")
    a = p.parse_args()

    im = Image.open(a.image).convert("RGB")
    if a.crop:
        im = im.crop(tuple(a.crop))
    px = np.asarray(im).astype(float)
    corners = np.array([px[2, 2], px[2, -3], px[-3, 2], px[-3, -3]]).mean(0)
    bg = np.linalg.norm(px - corners, axis=2) < a.bg_tol

    # local contrast boost, background zeroed so edges do not glow
    L = px.mean(2)
    # fill background with the subject's median tone before sharpening (no edge halo)
    Limg = Image.fromarray(np.where(bg, np.median(L[~bg]), L).astype("uint8"))
    Limg = Limg.filter(ImageFilter.UnsharpMask(radius=6, percent=130, threshold=2))
    warm = Image.fromarray(np.clip((px[..., 0] - px[..., 2]) * 2, 0, 255).astype("uint8"))

    cols = a.cols
    rows = int(round(im.height / (im.width / cols) / a.aspect))
    Ls = np.asarray(Limg.resize((cols, rows), Image.BOX)).astype(float)
    Ws = np.asarray(warm.resize((cols, rows), Image.BOX)).astype(float)
    Ms = np.asarray(Image.fromarray((~bg * 255).astype("uint8")).resize((cols, rows), Image.BOX)) / 255

    inside = Ls[Ms > 0.5]
    lo, hi = np.percentile(inside, 2), np.percentile(inside, 99.5)
    V = np.clip((Ls - lo) / (hi - lo), 0, 1) ** 0.75

    cls, lum, txt = [], [], []
    for y in range(rows):
        c = l = t = ""
        for x in range(cols):
            if Ms[y, x] < 0.5:
                c += "0"; l += "0"; t += " "; continue
            v = V[y, x]
            if v < 0.08:   k = 4          # holes: eyes, nostrils, mouth
            elif v < 0.38: k = 3          # dark lacquer
            elif v < 0.72: k = 2          # mid tones
            else:          k = 1          # highlights, teeth
            if k == 1 and Ws[y, x] > 90:
                k = 5                     # warm highlights (teeth, gums)
            c += str(k); l += str(min(9, int(v * 10)))
            t += RAMP[int(v * (len(RAMP) - 1))] if v >= 0.08 else " "
        cls.append(c); lum.append(l); txt.append(t.rstrip())
    json.dump({"w": cols, "h": rows, "c": cls, "l": lum}, open(a.out, "w"), separators=(",", ":"))
    open(a.txt, "w").write("\n".join(txt) + "\n")
    print(f"{cols} x {rows} cells -> {a.out}, {a.txt}")

if __name__ == "__main__":
    main()
