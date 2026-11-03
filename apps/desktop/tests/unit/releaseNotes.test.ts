import { expect, test } from "vitest";

import { highlights } from "../../src/main/releaseNotes";

test("takes the first three bullet points from the release notes", () => {
  const html =
    "<h2>Changes</h2><ul><li>A new look</li><li>Live <code>Last active</code></li><li>Runtime checks</li><li>Fixes</li></ul>";

  expect(highlights(html)).toEqual(["A new look", "Live Last active", "Runtime checks"]);
  expect(highlights("## Changes\n- One\n* Two\nNot a bullet")).toEqual(["One", "Two"]);
  expect(highlights([{ note: "<ul><li>Faster &amp; smaller</li></ul>" }])).toEqual(["Faster & smaller"]);
  expect(highlights(null)).toEqual([]);
});
