import { expect, test, type ElectronApplication } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type * as keyring from "@napi-rs/keyring";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { databaseContents, launch, withDataDir } from "./app";
import { serveHttpFixture } from "./fixtures/httpServer";

const secretValue = `e2e-catalog-${randomUUID()}`;

// Read inside the app that wrote the secret: macOS prompts any other process for keychain access, hanging CI.
const inKeychain = (electronApp: ElectronApplication, value = secretValue) =>
  electronApp.evaluate(({ app }, secret) => {
    const { createRequire } = process.getBuiltinModule("node:module");
    const { findCredentials }: typeof keyring = createRequire(`${app.getAppPath()}/package.json`)("@napi-rs/keyring");

    return findCredentials("openmcp").some((credential) => credential.password === secret);
  }, value);

// A path identifier makes npx fail locally, so the test never downloads or runs a package from npm.
const entry = (name: string, version = "1.0.0", workspace = false) => ({
  server: {
    name,
    title: `E2E ${name.split("/")[1]}`,
    description: "A fixture server for end-to-end tests.",
    version,
    packages: [
      {
        registryType: "npm",
        identifier: "./openmcp-e2e-missing",
        version,
        transport: { type: "stdio" },
        environmentVariables: [
          { name: "E2E_TOKEN", description: "Fixture token", isRequired: true, isSecret: true },
          ...(workspace ? [{ name: "E2E_WORKSPACE", isRequired: true }] : [])
        ]
      }
    ]
  },
  _meta: { "io.modelcontextprotocol.registry/official": { status: "active", isLatest: true } }
});

const REMOTE = "io.github.openmcp/e2e-remote";

const remoteEntry = (url: string) => ({
  server: {
    name: REMOTE,
    title: "E2E e2e-remote",
    description: "A remote fixture server for end-to-end tests.",
    version: "1.0.0",
    remotes: [
      {
        type: "streamable-http",
        url,
        headers: [{ name: "Authorization", value: "Bearer {token}", isRequired: true, isSecret: true }]
      }
    ]
  },
  _meta: { "io.modelcontextprotocol.registry/official": { status: "active", isLatest: true } }
});

type Registry = { url: string; server: Server; setLatest: (version: string) => void; requireWorkspace: () => void };

function serveRegistry(remoteUrl?: string): Promise<Registry> {
  let latest = "1.0.0";
  let workspace = false;
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://registry");
    const detail = /^\/v0\.1\/servers\/([^/]+)\/versions\/([^/]+)$/.exec(pathname);
    const version = !detail || detail[2] === "latest" ? latest : decodeURIComponent(detail[2]);
    const list = pathname === "/v0.1/servers" && {
      servers: [entry("io.github.openmcp/e2e-server", latest), ...(remoteUrl ? [remoteEntry(remoteUrl)] : [])],
      metadata: { count: remoteUrl ? 2 : 1 }
    };
    const name = detail && decodeURIComponent(detail[1]);
    const remote = name === REMOTE && remoteUrl ? remoteEntry(remoteUrl) : null;
    const body = name ? (remote ?? entry(name, version, workspace && version !== "1.0.0")) : list;

    response.writeHead(body ? 200 : 404, { "content-type": "application/json" }).end(JSON.stringify(body || {}));
  });
  server.unref();

  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v0.1`,
        server,
        setLatest: (version) => void (latest = version),
        requireWorkspace: () => void (workspace = true)
      })
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
    expect(await inKeychain(app)).toBe(true);

    await page.getByRole("button", { name: "Remove e2e" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No servers yet")).toBeVisible();
    expect(await inKeychain(app)).toBe(false);
    await app.close();
    registry.server.close();
  }));

test("updates an installed registry server in place and keeps its secret", () =>
  withDataDir(async (dataDir) => {
    const registry = await serveRegistry();
    const app = await launch(dataDir, { OPENMCP_REGISTRY_URL: registry.url });
    const page = await app.firstWindow();
    const dialog = page.getByRole("dialog");
    const update = dialog.getByRole("button", { name: /^Update( and restart)?$/ });

    await page.getByRole("button", { name: "Catalog", exact: true }).click();
    await page.getByLabel("Search servers").fill("e2e");
    await page.getByRole("button", { name: "Install E2E e2e-server" }).click();
    await dialog.getByLabel("E2E_TOKEN").fill(secretValue);
    // 1.1.0 is published while the dialog is open, so the check that runs after install finds it.
    registry.setLatest("1.1.0");
    await dialog.getByRole("button", { name: "Install", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Update to v1.1.0" })).toBeVisible();

    await page.getByRole("button", { name: "Open in Servers" }).click();
    await page.getByRole("button", { name: "Update available" }).click();
    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
    await page.getByRole("button", { name: "Update to v1.1.0" }).click();
    await expect(dialog.getByText("v1.0.0 → v1.1.0")).toBeVisible();
    await expect(dialog.getByLabel("E2E_TOKEN")).toBeHidden();

    // The publisher edits 1.1.0 after the check, so the swap is refused and the dialog reopens as a form.
    registry.requireWorkspace();
    await update.click();
    await expect(
      dialog.getByText("This update changes the server's settings. Open it again to review them.")
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Update to v1.1.0" }).click();
    await expect(dialog.getByLabel("E2E_TOKEN")).toHaveAttribute(
      "placeholder",
      "Stored in your keychain. Leave blank to keep."
    );
    await update.click();
    await expect(dialog.getByText("Enter a value for E2E_WORKSPACE")).toBeVisible();
    await dialog.getByLabel("E2E_WORKSPACE").fill("team");
    await update.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Updates" })).toBeHidden();

    await page.getByRole("button", { name: "Servers", exact: true }).click();
    await expect(page.getByRole("cell", { name: "npx -y ./openmcp-e2e-missing@1.1.0" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Catalog", exact: true })).toBeVisible();
    expect(await inKeychain(app)).toBe(true);

    await page.getByRole("button", { name: "Remove e2e" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No servers yet")).toBeVisible();
    await app.close();
    registry.server.close();
  }));

test("installs a remote-only registry server and connects to it", () =>
  withDataDir(async (dataDir) => {
    const remote = await serveHttpFixture(secretValue);
    const registry = await serveRegistry(remote.url);
    const app = await launch(dataDir, { OPENMCP_REGISTRY_URL: registry.url });
    const page = await app.firstWindow();

    await page.getByRole("button", { name: "Catalog", exact: true }).click();
    await page.getByLabel("Search servers").fill("e2e");
    await page.getByRole("button", { name: "Install E2E e2e-remote" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(remote.url)).toBeVisible();
    await dialog.getByLabel("token", { exact: true }).fill(secretValue);
    await dialog.getByRole("button", { name: "Install", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Open in Servers" }).click();
    await expect(page.getByRole("cell", { name: "Running", exact: true })).toBeVisible();
    expect(databaseContents(dataDir)).not.toContain(secretValue);
    expect(await inKeychain(app, `Bearer ${secretValue}`)).toBe(true);

    await page.getByRole("button", { name: "Remove e2e-remote" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No servers yet")).toBeVisible();
    expect(await inKeychain(app, `Bearer ${secretValue}`)).toBe(false);
    await app.close();
    registry.server.close();
    await remote.stop();
  }));
