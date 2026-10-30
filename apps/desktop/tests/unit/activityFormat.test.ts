import { describe, expect, test } from "vitest";

import { formatDuration, formatWhen } from "../../src/renderer/features/activity/activityFormat";
import { formatTime } from "../../src/renderer/features/servers/serverDetails";

describe("formatDuration", () => {
  test.each([
    [null, "—"],
    [0, "0 ms"],
    [412, "412 ms"],
    [1000, "1.0 s"],
    [1234, "1.2 s"],
    [60_000, "1m 0s"],
    [123_000, "2m 3s"]
  ])("formats %s ms as %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("formatWhen", () => {
  const now = new Date(2026, 9, 29, 15, 0, 0);

  test("shows only the time for calls made today", () => {
    const at = new Date(2026, 9, 29, 14, 3, 22);

    expect(formatWhen(at, now)).toBe(formatTime(at));
  });

  test("shows the date, without seconds, for older calls", () => {
    const text = formatWhen(new Date(2026, 9, 27, 14, 3, 22), now);

    expect(text).toContain("27");
    expect(text).not.toContain("22");
  });
});
