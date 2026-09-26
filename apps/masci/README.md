# Masci

Open `/apps/masci/` to view the animated tanuki terminal mask. The **create**
button opens the image converter at `/apps/masci/create.html`. No backend, installation, or image uploads
are required. The page exports plain text and the Python converter's
`{w, h, c, l}` glyph JSON format.

For a local preview, run this from the repository root:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000/apps/masci/ (use HTTP rather than opening the
HTML file directly, so the browser can load `tanuki_ascii.txt`).

Choose an image, adjust columns, background tolerance, or cell aspect, then
press **Convert image**. Background removal samples the corners, so images
with a flat background work best. Set tolerance to zero to keep the background.
Transparent pixels are removed. Fit to screen scales the drawing; Actual size
lets you scroll through its detail. JSON export is available for converted
images; the original sample only contains text.

`ascii_dense.py` remains the original command-line converter. The browser
version uses the same ramp, tone classes, and contrast normalization, with
area-weighted resizing and box-blur sharpening in place of Pillow's filters.
Results are approximate, not pixel-identical. Browser processing is limited
to 1600 pixels on the longest source edge and 600 output rows. Cropping remains
available through the Python script; crop browser inputs before selecting them.

The landing animation uses `tanuki.js` and `tanuki.css`, shared with
`Tanuki mask, terminal.html`. Motion follows elapsed time at the display refresh
rate, with smoothly scrolling rain. The falling rain heads deposit mask glyphs as they cross each cell, building
the image in staggered vertical trails over roughly five seconds. Deposited
glyphs stay visible; there is no timed fade or final bulk reveal. Click the artwork or press Space to pause;
press R to replay. Reduced-motion preferences show a static mask. Animation
pauses in background tabs, and resizing preserves the revealed mask.
