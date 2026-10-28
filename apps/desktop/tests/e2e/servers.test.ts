import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { createDatabase } from "@openmcp/database";
import { getSecret } from "@openmcp/secrets";

import { addCustomServer, deleteServer } from "../../src/main/servers";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/database/migrations", import.meta.url));

test("round-trips a server's secret through the OS keyring", () => {
  const db = createDatabase({ path: ":memory:", migrationsFolder });
  const server = addCustomServer(db, { name: "everything", command: "npx", args: [], env: {}, secrets: { API_KEY: "e2e-secret" }, autostart: false });

  try {
    expect(getSecret(`server:${server.id}:API_KEY`)).toBe("e2e-secret");
  } finally {
    deleteServer(db, server.id);
  }

  expect(getSecret(`server:${server.id}:API_KEY`)).toBeNull();
});
