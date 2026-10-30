import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

import { databaseContents, launch, withDataDir } from "./app";

const fixture = join(__dirname, "fixtures/stdioServer.mts");
const secretValue = "e2e-ui-secret-value";

async function fillAddServerDialog(page: Page, server: { name: string; command: string; args: string }) {
  await page.getByRole("button", { name: "Add Server" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(server.name);
  await dialog.getByLabel("Command").fill(server.command);
  await dialog.getByLabel("Arguments").fill(server.args);
  return dialog;
}

test("adds a custom server that survives a restart and keeps its secret out of the database", () =>
  withDataDir(async (dataDir) => {
    let app = await launch(dataDir);
    let page = await app.firstWindow();

    const dialog = await fillAddServerDialog(page, {
      name: "everything",
      command: "npx",
      args: "-y\n@modelcontextprotocol/server-everything"
    });
    await dialog.getByRole("button", { name: "Add variable" }).click();
    await dialog.getByLabel("Variable name").fill("API_KEY");
    await dialog.getByLabel("Value").fill(secretValue);
    await dialog.getByRole("switch", { name: "Secret" }).click();
    await dialog.getByRole("button", { name: "Add server" }).click();

    await expect(page.getByRole("cell", { name: "everything", exact: true })).toBeVisible();
    await app.close();

    app = await launch(dataDir);
    page = await app.firstWindow();
    await expect(page.getByRole("cell", { name: "everything", exact: true })).toBeVisible();
    expect(databaseContents(dataDir)).not.toContain(secretValue);

    await page.getByRole("button", { name: "Remove everything" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No servers yet")).toBeVisible();
    await app.close();
  }));

test("starts a server, shows what it exposes and its logs, then stops it", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const dialog = await fillAddServerDialog(page, { name: "fixture", command: "node", args: fixture });
    await dialog.getByRole("button", { name: "Add server" }).click();

    await page.getByRole("button", { name: "Start fixture" }).click();
    await expect(page.getByRole("cell", { name: "Running", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "fixture", exact: true }).click();
    const details = page.getByRole("dialog");
    await details.getByText("echo", { exact: true }).click();
    await expect(details.getByText("Echoes back the input.")).toBeVisible();

    await details.getByRole("tab", { name: /Logs/ }).click();
    await expect(details.getByText(/fixture ready/)).toBeVisible();

    await details.getByRole("button", { name: "Stop fixture" }).click();
    await expect(details.getByRole("button", { name: "Start fixture" })).toBeVisible();
    await app.close();
  }));
