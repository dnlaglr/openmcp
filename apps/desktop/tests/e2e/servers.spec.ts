import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

import { databaseContents, launch, withDataDir } from "./app";
import { serveOAuthFixture } from "./fixtures/oauthServer";
import { serveHttpFixture } from "./fixtures/httpServer";

const fixture = join(__dirname, "fixtures/stdioServer.mts");
const secretValue = "e2e-ui-secret-value";

async function openAddSheet(page: Page, kind: "Local command…" | "Remote URL…") {
  await page.getByRole("button", { name: "Add server" }).click();
  await page.getByRole("menuitem", { name: kind }).click();
  return page.getByRole("dialog");
}

async function addLocal(page: Page, server: { name: string; command: string; args: string }) {
  const sheet = await openAddSheet(page, "Local command…");
  await sheet.getByLabel("Name", { exact: true }).fill(server.name);
  await sheet.getByLabel("Command").fill(server.command);
  await sheet.getByLabel("Arguments").fill(server.args);
  return sheet;
}

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

test("adds a custom server that survives a restart and keeps its secret out of the database", () =>
  withDataDir(async (dataDir) => {
    let app = await launch(dataDir);
    let page = await app.firstWindow();

    const sheet = await addLocal(page, { name: "everything", command: "node", args: fixture });
    await sheet.getByRole("button", { name: "Add variable" }).click();
    await sheet.getByLabel("Variable name").fill("API_KEY");
    await sheet.getByLabel("Value").fill(secretValue);
    await sheet.getByRole("button", { name: "Keep in the keychain" }).click();
    await sheet.getByRole("button", { name: "Add server" }).click();

    await expect(row(page, "everything")).toBeVisible();
    await app.close();

    app = await launch(dataDir);
    page = await app.firstWindow();
    await expect(row(page, "everything")).toBeVisible();
    expect(databaseContents(dataDir)).not.toContain(secretValue);

    await remove(page, "everything");
    await expect(page.getByRole("heading", { name: "Set up OpenMCP" })).toBeVisible();
    await app.close();
  }));

test("starts a server, shows what it exposes and its logs, then stops it", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const sheet = await addLocal(page, { name: "fixture", command: "node", args: fixture });
    await sheet.getByRole("button", { name: "Add server" }).click();
    await expect(row(page, "fixture")).toContainText("Running");

    await openDetails(page, "fixture");
    const inspector = details(page, "fixture");
    await inspector.getByRole("tab", { name: /Tools/ }).click();
    await inspector.getByText("echo", { exact: true }).click();
    await expect(inspector.getByText("Echoes back the input.")).toBeVisible();

    await inspector.getByRole("tab", { name: "Logs" }).click();
    await expect(inspector.getByText(/fixture ready/)).toBeVisible();

    await inspector.getByRole("button", { name: "Stop fixture" }).click();
    await expect(inspector.getByRole("button", { name: "Start fixture" })).toBeVisible();
    await app.close();
  }));

test("edits a running server, then restarts it under its new name with its stored secret kept", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const add = await addLocal(page, { name: "fixture", command: "node", args: fixture });
    await add.getByRole("button", { name: "Add variable" }).click();
    await add.getByLabel("Variable name").fill("FIXTURE_TOOL");
    await add.getByLabel("Value").fill("kept_tool");
    await add.getByRole("button", { name: "Keep in the keychain" }).click();
    await add.getByRole("button", { name: "Add server" }).click();
    await expect(row(page, "fixture")).toContainText("Running");

    // Sheets are found by name: the toasts are dialogs too.
    await openMenu(page, "fixture", "Edit…");
    const edit = page.getByRole("dialog", { name: "Edit “fixture”" });
    await expect(edit.getByLabel("Value")).toHaveAttribute("placeholder", "Kept in keychain · type to replace");
    await edit.getByLabel("Name", { exact: true }).fill("renamed");
    await edit.getByRole("button", { name: "Save and restart" }).click();
    await expect(edit).toBeHidden();

    await openMenu(page, "renamed", "Edit…");
    const reopened = page.getByRole("dialog", { name: "Edit “renamed”" });
    await expect(reopened.getByLabel("Name", { exact: true })).toHaveValue("renamed");
    await reopened.getByRole("button", { name: "Cancel" }).click();
    await expect(reopened).toBeHidden();

    await openDetails(page, "renamed");
    const inspector = details(page, "renamed");
    await inspector.getByRole("tab", { name: "Logs" }).click();
    await expect(inspector.getByText(/^Starting node /)).toHaveCount(2);
    await expect(inspector.getByText("Running", { exact: true })).toBeVisible();
    await inspector.getByRole("tab", { name: /Tools/ }).click();
    await expect(inspector.getByText("kept_tool", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();

    await remove(page, "renamed");
    await expect(page.getByRole("heading", { name: "Set up OpenMCP" })).toBeVisible();
    await app.close();
  }));

const remoteToken = "e2e-remote-ui-token";

test("adds a remote server with a secret header, connects to it and keeps the key out of the database", () =>
  withDataDir(async (dataDir) => {
    const remote = await serveHttpFixture(remoteToken);
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const sheet = await openAddSheet(page, "Remote URL…");
    await sheet.getByLabel("Name", { exact: true }).fill("remote");
    await sheet.getByLabel("URL").fill(remote.url);
    await sheet.getByRole("button", { name: "Add header" }).click();
    await sheet.getByLabel("Header name").fill("Authorization");
    await sheet.getByLabel("Value").fill(`Bearer ${remoteToken}`);
    await sheet.getByRole("button", { name: "Add server" }).click();

    await expect(row(page, "remote")).toContainText(remote.url);
    await expect(row(page, "remote")).toContainText("Running");
    expect(databaseContents(dataDir)).not.toContain(remoteToken);

    await openDetails(page, "remote");
    const inspector = details(page, "remote");
    await inspector.getByRole("tab", { name: /Tools/ }).click();
    await expect(inspector.getByText("remote_echo", { exact: true })).toBeVisible();
    await inspector.getByRole("tab", { name: "Overview" }).click();
    await expect(inspector.getByText(remote.url, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await remove(page, "remote");
    await expect(page.getByRole("heading", { name: "Set up OpenMCP" })).toBeVisible();
    await app.close();
    await remote.stop();
  }));

test("signs in to a remote server through the browser, then signs out and back in", () =>
  withDataDir(async (dataDir) => {
    const remote = await serveOAuthFixture();
    const app = await launch(dataDir);
    // Stands in for the system browser: follows /authorize's redirect to OpenMCP's loopback callback.
    await app.evaluate(({ shell }) => {
      shell.openExternal = async (url: string) => void (await fetch(url));
    });
    const page = await app.firstWindow();

    const sheet = await openAddSheet(page, "Remote URL…");
    await sheet.getByLabel("Name", { exact: true }).fill("oauth");
    await sheet.getByLabel("URL").fill(remote.url);
    await sheet.getByRole("switch", { name: "Start when OpenMCP launches" }).click();
    await sheet.getByRole("button", { name: "Add server" }).click();

    await expect(row(page, "oauth")).toContainText("Running");
    for (const token of remote.issued) expect(databaseContents(dataDir)).not.toContain(token);

    await openDetails(page, "oauth");
    await openMenu(page, "oauth", "Sign out");
    const inspector = details(page, "oauth");
    await expect(inspector.getByText("Needs sign-in")).toBeVisible();
    await expect(inspector.getByText("Sign in to use oauth")).toBeVisible();
    await expect.poll(() => remote.revoked.length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();

    await row(page, "oauth").getByRole("button", { name: "Sign in to oauth" }).click();
    await expect(row(page, "oauth")).toContainText("Running");
    // Sign-out forgets the registration too, so signing back in registers again.
    expect(remote.registrations()).toBe(2);

    await remove(page, "oauth");
    await expect(page.getByRole("heading", { name: "Set up OpenMCP" })).toBeVisible();
    await app.close();
    await remote.stop();
  }));

test("removing the selected server closes its details", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const sheet = await addLocal(page, { name: "fixture", command: "node", args: fixture });
    await sheet.getByRole("button", { name: "Add server" }).click();
    await openDetails(page, "fixture");
    await expect(details(page, "fixture")).toBeVisible();

    await remove(page, "fixture");
    await expect(details(page, "fixture")).toBeHidden();
    await expect(page.getByRole("complementary", { name: /details$/ })).toHaveCount(0);
    await app.close();
  }));

test("the autostart switch doesn’t restart a running server", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const sheet = await addLocal(page, { name: "fixture", command: "node", args: fixture });
    await sheet.getByRole("button", { name: "Add server" }).click();
    await expect(row(page, "fixture")).toContainText("Running");

    await openDetails(page, "fixture");
    const inspector = details(page, "fixture");
    const autostart = inspector.getByRole("switch", { name: "Start when OpenMCP launches" });
    await autostart.click();
    await expect(autostart).toBeChecked();

    await inspector.getByRole("tab", { name: "Logs" }).click();
    await expect(inspector.getByText(/^Starting node /)).toHaveCount(1);
    await expect(row(page, "fixture")).toContainText("Running");
    await app.close();
  }));
