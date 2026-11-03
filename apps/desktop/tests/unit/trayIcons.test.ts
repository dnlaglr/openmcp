import { expect, test } from "vitest";

import { dim, disc, over } from "../../src/main/trayIcons";

const pixel = (bitmap: Buffer, size: number, x: number, y: number) => [
  ...bitmap.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)
];

test("draws an opaque disc with a clear border, in BGRA", () => {
  const red = disc(16, [255, 0, 0]);
  expect(pixel(red, 16, 8, 8)).toEqual([0, 0, 255, 255]);
  expect(pixel(red, 16, 0, 0)).toEqual([0, 0, 0, 0]);
});

test("lays one bitmap over another and dims", () => {
  const base = disc(4, [0, 0, 255], 4);
  const badge = disc(4, [255, 0, 0], 2, [3, 3]);

  expect(pixel(over(base, badge), 4, 3, 3)).toEqual([0, 0, 255, 255]);
  expect(pixel(over(base, badge), 4, 0, 0)).toEqual(pixel(base, 4, 0, 0));
  expect(pixel(dim(base, 0.5), 4, 1, 1)).toEqual([128, 0, 0, 128]);
});
