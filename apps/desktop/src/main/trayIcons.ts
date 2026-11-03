import type { Dot } from "./trayMenu";

export type Rgb = [number, number, number];

export const DOT_COLORS: Record<Dot, Rgb> = {
  running: [47, 179, 68],
  attention: [245, 165, 36],
  error: [229, 72, 77],
  stopped: [154, 163, 178]
};

// Premultiplied BGRA, the layout nativeImage.createFromBitmap reads. Edges are antialiased over one pixel.
export function disc(size: number, [r, g, b]: Rgb, radius = size * 0.3125, [cx, cy] = [size / 2, size / 2]) {
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(b * alpha);
      pixels[index + 1] = Math.round(g * alpha);
      pixels[index + 2] = Math.round(r * alpha);
      pixels[index + 3] = Math.round(255 * alpha);
    }
  }

  return pixels;
}

export function over(base: Buffer, top: Buffer) {
  const out = Buffer.alloc(base.length);
  for (let index = 0; index < base.length; index += 4) {
    const keep = 1 - top[index + 3] / 255;
    for (let channel = 0; channel < 4; channel++) {
      out[index + channel] = Math.round(top[index + channel] + base[index + channel] * keep);
    }
  }
  return out;
}

export const dim = (bitmap: Buffer, factor = 0.45) => Buffer.from(bitmap.map((value) => Math.round(value * factor)));
