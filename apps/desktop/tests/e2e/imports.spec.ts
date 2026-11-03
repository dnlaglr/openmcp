import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { join } from "node:path";

import { databaseContents, launch, withDataDir } from "./app";

const fixture = join(__dirname, "fixtures/stdioServer.mts");
const secretValue = "e2e-import-secret-value";

test("moves a server out of Claude Code's config into OpenMCP", () =>
  withDataDir(async (dataDir) => {
    const configDir = join(dataDir, "claude-config");
    const file = join(configDir, ".claude.json");
    const echo = { type: "stdio", command: "node", args: [fixture], env: { API_KEY: secretValue } };
    const notes = { command: "node", args: ["${HOME}/notes.js"] };
    const projects = { "/work": { mcpServers: { local: { command: "node" } } } };
    mkdirSync(configDir);
    writeFileSync(file, JSON.stringify({ numStartups: 3, mcpServers: { echo, notes }, projects }, null, 2));

    const app = await launch(dataDir, { CLAUDE_CONFIG_DIR: configDir });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Agents", exact: true }).click();

    const prompt = page.getByText(/^Found \d+ servers? in .*Claude Code/);
    await expect(prompt).toBeVisible();
    await page.getByRole("button", { name: "Review servers" }).click();

    const sheet = page.getByRole("dialog");
    const claude = sheet.getByRole("group", { name: "Claude Code" });
    await expect(claude.getByRole("checkbox", { name: "echo" })).toBeChecked();
    await expect(claude.getByRole("checkbox", { name: "notes" })).toBeDisabled();
    await expect(claude.getByText("It uses ${…} placeholders, which OpenMCP can't fill in.")).toBeVisible();
    await expect(claude.getByRole("checkbox", { name: "local" })).toHaveCount(0);

    // Real agents on this machine show up too; leave their configs alone.
    for (const group of await sheet.getByRole("group").all()) {
      if ((await group.locator("legend").textContent()) === "Claude Code") continue;
      for (const box of await group.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
    }

    await sheet.getByRole("button", { name: "Import 1 server" }).click();
    await expect(page.getByText("Moved 1 server into OpenMCP")).toBeVisible();
    await expect(prompt).toHaveCount(0);

    const config = JSON.parse(readFileSync(file, "utf8"));
    expect(config).toEqual({
      numStartups: 3,
      mcpServers: { "openmcp-dev": expect.objectContaining({ type: "http" }), notes },
      projects
    });
    expect(readdirSync(join(`${dataDir}-dev`, "client-backups", "claude-code"))).toHaveLength(1);
    expect(databaseContents(dataDir)).not.toContain(secretValue);

    await page.getByRole("button", { name: "Servers", exact: true }).click();
    const row = page.getByRole("group", { name: "echo", exact: true });
    await expect(row).toContainText("Running");

    await row.getByRole("button", { name: "More actions for echo" }).click();
    await page.getByRole("menuitem", { name: "Remove…" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(row).toHaveCount(0);
    await app.close();
  }));
