import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { _electron as electron, expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appDir = join(__dirname, "../..");
const secretValue = "e2e-ui-secret-value";

const launch = (dataDir: string) => electron.launch({ args: [appDir, `--user-data-dir=${dataDir}`] });

function databaseContents(dataDir: string) {
  const files = ["openmcp.db", "openmcp.db-wal"].map((file) => join(`${dataDir}-dev`, file)).filter(existsSync);
  return files.map((file) => readFileSync(file, "latin1")).join("");
}

test("adds a custom server that survives a restart and keeps its secret out of the database", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "openmcp-e2e-"));

  try {
    let app = await launch(dataDir);
    let page = await app.firstWindow();

    await page.getByRole("button", { name: "Add Server" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("everything");
    await dialog.getByLabel("Command").fill("npx");
    await dialog.getByLabel("Arguments").fill("-y\n@modelcontextprotocol/server-everything");
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
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(`${dataDir}-dev`, { recursive: true, force: true });
  }
});
