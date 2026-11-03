import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type * as keyring from "@napi-rs/keyring";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { databaseContents, launch, withDataDir } from "./app";
import { serveHttpFixture } from "./fixtures/httpServer";

const secretValue = `e2e-catalog-${randomUUID()}`;

const row = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const details = (page: Page, name: string) => page.getByRole("complementary", { name: `${name} details` });
const openDetails = (page: Page, name: string) =>
  row(page, name)
    .getByRole("button", { name: `Show details for ${name}` })
    .click();

async function openMenu(page: Page, name: string, item: string) {
  await page
    .getByRole("button", { name: `More actions for ${name}` })
    .first()
    .click();
  await page.getByRole("menuitem", { name: item }).click();
  // Focus returns to the trigger only once the menu has faded out.
  await expect(page.getByRole("menu")).toHaveCount(0);
}

async function remove(page: Page, name: string) {
  await openMenu(page, name, "Remove…");
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
}

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

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("e2e");
    await expect(sheet.getByText("npx -y ./openmcp-e2e-missing@1.0.0")).toBeVisible();

    await sheet.getByRole("button", { name: "Install", exact: true }).click();
    await expect(sheet.getByText("Enter a value for E2E_TOKEN")).toBeVisible();

    await sheet.getByLabel("E2E_TOKEN").fill(secretValue);
    await sheet.getByRole("button", { name: "Install", exact: true }).click();
    await expect(sheet.getByText("Saved e2e")).toBeVisible();
    // npx takes a while to give up on the missing package on a cold machine.
    await expect(sheet.getByText("Couldn’t start", { exact: true })).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole("button", { name: "Fix settings" }).click();
    await expect(details(page, "e2e")).toContainText("npx -y ./openmcp-e2e-missing@1.0.0");
    await expect(details(page, "e2e")).toContainText("MCP Registry · v1.0.0");
    expect(databaseContents(dataDir)).not.toContain(secretValue);
    expect(await inKeychain(app)).toBe(true);

    await remove(page, "e2e");
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
    // The "Updated" toast is a dialog too, so the update sheet is found by name.
    const sheet = page.getByRole("dialog");
    const updateSheet = page.getByRole("dialog", { name: "Update “e2e”" });
    const update = updateSheet.getByRole("button", { name: /^Update( and restart)?$/ });
    const updateButton = page.getByRole("button", { name: "Update E2E e2e-server to v1.1.0" });

    await page.getByRole("button", { name: "Catalog", exact: true }).click();
    await page.getByLabel("Search servers").fill("e2e");
    await page.getByRole("button", { name: "Install E2E e2e-server" }).click();
    await sheet.getByLabel("E2E_TOKEN").fill(secretValue);
    // 1.1.0 is published while the sheet is open, so the check that runs after install finds it.
    registry.setLatest("1.1.0");
    await sheet.getByRole("button", { name: "Install", exact: true }).click();
    await expect(sheet.getByText("Saved e2e")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await updateButton.click();
    await expect(updateSheet.getByText("v1.0.0 → v1.1.0")).toBeVisible();
    await expect(updateSheet.getByLabel("E2E_TOKEN")).toBeHidden();

    // The publisher edits 1.1.0 after the check, so the swap is refused and the sheet reopens as a form.
    registry.requireWorkspace();
    await update.click();
    await expect(
      updateSheet.getByText("This update changes the server's settings. Open it again to review them.")
    ).toBeVisible();
    await updateSheet.getByRole("button", { name: "Cancel" }).click();
    await expect(updateSheet).toBeHidden();

    await updateButton.click();
    await expect(updateSheet.getByLabel("E2E_TOKEN")).toHaveAttribute(
      "placeholder",
      "Stored in your keychain. Leave blank to keep."
    );
    await update.click();
    await expect(updateSheet.getByText("Enter a value for E2E_WORKSPACE")).toBeVisible();
    await updateSheet.getByLabel("E2E_WORKSPACE").fill("team");
    await update.click();
    await expect(updateSheet).toBeHidden();
    await expect(updateButton).toBeHidden();

    await page.getByRole("button", { name: "Servers", exact: true }).click();
    await openDetails(page, "e2e");
    await expect(details(page, "e2e")).toContainText("npx -y ./openmcp-e2e-missing@1.1.0");
    await expect(details(page, "e2e")).toContainText("MCP Registry · v1.1.0");
    expect(await inKeychain(app)).toBe(true);

    await remove(page, "e2e");
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

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(remote.url)).toBeVisible();
    await sheet.getByLabel(/^token/).fill(secretValue);
    await sheet.getByRole("button", { name: "Install", exact: true }).click();
    await sheet.getByRole("button", { name: "Open in Servers" }).click();
    await expect(row(page, "e2e-remote")).toContainText("Running");
    expect(databaseContents(dataDir)).not.toContain(secretValue);
    expect(await inKeychain(app, `Bearer ${secretValue}`)).toBe(true);

    await remove(page, "e2e-remote");
    await expect(page.getByText("No servers yet")).toBeVisible();
    expect(await inKeychain(app, `Bearer ${secretValue}`)).toBe(false);
    await app.close();
    registry.server.close();
    await remote.stop();
  }));
