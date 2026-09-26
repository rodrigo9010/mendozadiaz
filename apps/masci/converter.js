/* Browser counterpart to ascii_dense.py. Canvas resampling and a box blur
   approximate Pillow's BOX resize and UnsharpMask; output is not pixel-identical. */
'use strict';
const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

function imageToGlyphs(image, cols, tolerance, aspect) {
  // Bound processing memory for large photos, retaining enough detail for the grid.
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const rows = Math.max(1, Math.min(600, Math.round(height / width * cols / aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return pixelsToGlyphs(pixels, width, height, cols, rows, tolerance);
}

function pixelsToGlyphs(pixels, width, height, cols, rows, tolerance) {
  const cornerX = Math.min(2, width - 1), cornerY = Math.min(2, height - 1);
  const corners = [[cornerX, cornerY], [width - 1 - cornerX, cornerY],
    [cornerX, height - 1 - cornerY], [width - 1 - cornerX, height - 1 - cornerY]];
  const bg = [0, 0, 0];
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) bg[c] += pixels[i + c] / 4;
  }
  const count = width * height;
  const mask = new Uint8Array(count), luminance = new Float32Array(count);
  const histogram = new Uint32Array(256);
  let foreground = 0;
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const distance = Math.hypot(pixels[p] - bg[0], pixels[p + 1] - bg[1], pixels[p + 2] - bg[2]);
    mask[i] = pixels[p + 3] >= 128 && distance >= tolerance ? 1 : 0;
    luminance[i] = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / 3;
    if (mask[i]) { histogram[Math.round(luminance[i])]++; foreground++; }
  }
  let median = 0, cumulative = 0;
  for (; median < 255; median++) {
    cumulative += histogram[median];
    if (cumulative >= foreground / 2) break;
  }
  // Fill the removed background before sharpening to avoid bright edge halos.
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) luminance[i] = median;
      sum += luminance[i];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
    }
  }
  const size = cols * rows;
  const tones = new Float64Array(size), warmth = new Float64Array(size);
  const coverage = new Float64Array(size);
  // Area-weighted sampling preserves thin edges and fractional cell coverage.
  for (let cy = 0; cy < rows; cy++) {
    const top = cy * height / rows, bottom = (cy + 1) * height / rows;
    for (let cx = 0; cx < cols; cx++) {
      const left = cx * width / cols, right = (cx + 1) * width / cols;
      const cell = cy * cols + cx, area = (right - left) * (bottom - top);
      for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
        for (let x = Math.floor(left); x < Math.ceil(right); x++) {
          const weight = (Math.min(right, x + 1) - Math.max(left, x)) *
            (Math.min(bottom, y + 1) - Math.max(top, y)) / area;
          const i = y * width + x, p = i * 4;
          const x0 = Math.max(0, x - 6), x1 = Math.min(width, x + 7);
          const y0 = Math.max(0, y - 6), y1 = Math.min(height, y + 7);
          const blurred = (integral[y1 * stride + x1] - integral[y0 * stride + x1] -
            integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
          const delta = luminance[i] - blurred;
          tones[cell] += Math.max(0, Math.min(255, luminance[i] + (Math.abs(delta) > 2 ? delta * 1.3 : 0))) * weight;
          warmth[cell] += Math.max(0, Math.min(255, (pixels[p] - pixels[p + 2]) * 2)) * weight;
          coverage[cell] += mask[i] * weight;
        }
      }
    }
  }
  const inside = Array.from(tones).filter((_, i) => coverage[i] >= .5).sort((a, b) => a - b);
  const lo = inside[Math.floor((inside.length - 1) * .02)] ?? 0;
  const hi = inside[Math.floor((inside.length - 1) * .995)] ?? 255;
  const classes = [], levels = [], lines = [];
  for (let y = 0; y < rows; y++) {
    let c = '', l = '', t = '';
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (coverage[i] < .5) { c += '0'; l += '0'; t += ' '; continue; }
      const v = Math.pow(Math.max(0, Math.min(1, hi > lo ? (tones[i] - lo) / (hi - lo) : tones[i] / 255)), .75);
      let k = v < .08 ? 4 : v < .38 ? 3 : v < .72 ? 2 : 1;
      if (k === 1 && warmth[i] > 90) k = 5;
      c += k; l += Math.min(9, Math.floor(v * 10));
      t += v >= .08 ? RAMP[Math.floor(v * (RAMP.length - 1))] : ' ';
    }
    classes.push(c); levels.push(l); lines.push(t.trimEnd());
  }
  return {text: lines.join('\n') + '\n', data: {w: cols, h: rows, c: classes, l: levels}};
}
