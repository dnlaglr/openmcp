import { createServer, type Server } from "node:http";
import { findCredentials } from "@napi-rs/keyring";
import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { databaseContents, launch, withDataDir } from "./app";

const secretValue = `e2e-catalog-${randomUUID()}`;
const inKeychain = () => findCredentials("openmcp").some((credential) => credential.password === secretValue);

// A path identifier makes npx fail locally, so the test never downloads or runs a package from npm.
const entry = (name: string) => ({
  server: {
    name,
    title: `E2E ${name.split("/")[1]}`,
    description: "A fixture server for end-to-end tests.",
    version: "1.0.0",
    packages: [
      {
        registryType: "npm",
        identifier: "./openmcp-e2e-missing",
        version: "1.0.0",
        transport: { type: "stdio" },
        environmentVariables: [{ name: "E2E_TOKEN", description: "Fixture token", isRequired: true, isSecret: true }]
      }
    ]
  },
  _meta: { "io.modelcontextprotocol.registry/official": { status: "active", isLatest: true } }
});

function serveRegistry(): Promise<{ url: string; server: Server }> {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://registry");
    const detail = /^\/v0\.1\/servers\/([^/]+)\/versions\/[^/]+$/.exec(pathname);
    const list = pathname === "/v0.1/servers" && {
      servers: [entry("io.github.openmcp/e2e-server")],
      metadata: { count: 1 }
    };
    const body = detail ? entry(decodeURIComponent(detail[1])) : list;

    response.writeHead(body ? 200 : 404, { "content-type": "application/json" }).end(JSON.stringify(body || {}));
  });
  server.unref();

  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v0.1`, server })
    )
  );
}

test("installs a registry server with its secret in the keychain and opens it in Servers", () =>
  withDataDir(async (dataDir) => {
    const registry = await serveRegistry();
    const app = await launch(dataDir, { OPENMCP_REGISTRY_URL: registry.url });
    const page = await app.firstWindow();

    await page.getByRole("button", { name: "Catalog", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Popular" })).toBeVisible();
    await expect(page.getByText("E2E playwright-mcp", { exact: true })).toBeVisible();

    await page.getByLabel("Search servers").fill("e2e");
    await expect(page.getByRole("heading", { name: "Popular" })).toBeHidden();
    await page.getByRole("button", { name: "Install E2E e2e-server" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("e2e");
    await expect(dialog.getByText("npx -y ./openmcp-e2e-missing@1.0.0")).toBeVisible();

    await dialog.getByRole("button", { name: "Install", exact: true }).click();
    await expect(dialog.getByText("Enter a value for E2E_TOKEN")).toBeVisible();

    await dialog.getByLabel("E2E_TOKEN").fill(secretValue);
    await dialog.getByRole("button", { name: "Install", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Open in Servers" }).click();
    await expect(page.getByRole("cell", { name: "e2e", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Catalog", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "npx -y ./openmcp-e2e-missing@1.0.0" })).toBeVisible();
    expect(databaseContents(dataDir)).not.toContain(secretValue);
    expect(inKeychain()).toBe(true);

    await page.getByRole("button", { name: "Remove e2e" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No servers yet")).toBeVisible();
    expect(inKeychain()).toBe(false);
    await app.close();
    registry.server.close();
  }));
