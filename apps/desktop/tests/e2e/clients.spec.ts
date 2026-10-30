import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { join } from "node:path";

import { launch, withDataDir } from "./app";

test("connects and disconnects Claude Code through its config file", () =>
  withDataDir(async (dataDir) => {
    const configDir = join(dataDir, "claude-config");
    const file = join(configDir, ".claude.json");
    mkdirSync(configDir);

    const app = await launch(dataDir, { CLAUDE_CONFIG_DIR: configDir });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Clients", exact: true }).click();

    const row = page.getByRole("row", { name: /Claude Code/ });
    await expect(row.getByText("Not connected")).toBeVisible();

    await row.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(row.getByText("Connected", { exact: true })).toBeVisible();
    await expect(row.getByText("New Claude Code sessions pick this up.")).toBeVisible();

    const entry = JSON.parse(readFileSync(file, "utf8")).mcpServers["openmcp-dev"];
    expect(entry).toMatchObject({ type: "http", url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/) });
    expect(entry.headers.Authorization).toMatch(/^Bearer \S+$/);

    await row.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(row.getByText("Not connected")).toBeVisible();
    expect(JSON.parse(readFileSync(file, "utf8")).mcpServers).toEqual({});
    expect(readdirSync(join(`${dataDir}-dev`, "client-backups", "claude-code"))).toHaveLength(1);

    await app.close();
  }));
