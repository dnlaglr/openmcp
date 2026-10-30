import { expect, test } from "vitest";

import { getRegistryServer, POPULAR } from "../../src/main/catalog/registry";
import { toCatalogEntry } from "../../src/main/catalog/launch";

test.each(POPULAR)("%s is still installable from the live registry", async (name) => {
  const entry = await getRegistryServer(name, "latest");

  expect(entry).not.toBeNull();
  expect(toCatalogEntry(entry!)).not.toBeNull();
});
