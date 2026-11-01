import { expect, test } from "vitest";

import { mergePresence, settle, type Present } from "../../src/renderer/lib/presence";

const key = (item: string) => item;
const list = (entries: [string, Present<string>["presence"]][]) =>
  entries.map(([item, presence]) => ({ item, key: item, presence }));

test("shows the first render without animating it", () => {
  expect(mergePresence([], ["a", "b"], key, true)).toEqual(
    list([
      ["a", "present"],
      ["b", "present"]
    ])
  );
});

test("marks new items as entering", () => {
  const before = list([["a", "present"]]);
  expect(mergePresence(before, ["a", "b"], key, false)).toEqual(
    list([
      ["a", "present"],
      ["b", "entering"]
    ])
  );
});

test("keeps removed items in place while they exit", () => {
  const before = list([
    ["a", "present"],
    ["b", "present"],
    ["c", "present"]
  ]);
  expect(mergePresence(before, ["a", "c"], key, false)).toEqual(
    list([
      ["a", "present"],
      ["b", "exiting"],
      ["c", "present"]
    ])
  );
});

test("settles: exiting items go, entering ones stay", () => {
  expect(
    settle(
      list([
        ["a", "entering"],
        ["b", "exiting"]
      ])
    )
  ).toEqual(list([["a", "present"]]));
});
