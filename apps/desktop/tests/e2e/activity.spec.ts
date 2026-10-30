import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

import { databaseContents, launch, withDataDir } from "./app";

const fixture = join(__dirname, "fixtures/stdioServer.mts");
const marker = "e2e-activity-argument";

async function startAgent(page: Page, server: string) {
  await page.getByRole("button", { name: "Add Server" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(server);
  await dialog.getByLabel("Command").fill("node");
  await dialog.getByLabel("Arguments").fill(fixture);
  await dialog.getByRole("button", { name: "Add server" }).click();
  await page.getByRole("button", { name: `Start ${server}` }).click();
  await expect(page.getByRole("cell", { name: "Running", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Token", { exact: true })).not.toHaveValue("");
  const url = await page.getByLabel("URL", { exact: true }).inputValue();
  const token = await page.getByLabel("Token", { exact: true }).inputValue();

  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByText("No calls in the last 24 hours")).toBeVisible();

  const client = new Client({ name: "e2e-agent", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    })
  );
  await expect.poll(async () => (await client.listTools()).tools.map((tool) => tool.name)).toContain(`${server}__echo`);

  return client;
}

test("shows calls as they happen, drills into a server, and keeps arguments out of the database", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();

    const client = await startAgent(page, "fixture");

    const breakdown = page.getByRole("table").first();
    const trail = page.getByRole("table").last();

    await client.callTool({ name: "fixture__echo", arguments: { message: marker } });
    await expect(trail.getByRole("row", { name: /echo/ })).toContainText("OK");

    await client.callTool({ name: "fixture__missing", arguments: {} }).catch(() => undefined);
    await expect(trail.getByRole("row", { name: /fixture__missing/ })).toContainText("Unavailable");
    await expect(page.locator("dd").first()).toHaveText("2");
    await expect(page.locator("dd").nth(1)).toContainText(/50\s?%/);

    await expect(breakdown.getByRole("row", { name: /No server/ })).toBeVisible();
    await expect(breakdown.getByRole("button", { name: "No server" })).toHaveCount(0);

    await breakdown.getByRole("button", { name: "fixture", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Breakdown" })).toContainText("fixture");
    await expect(breakdown.getByRole("button", { name: "echo", exact: true })).toBeVisible();
    await expect(trail.getByRole("row")).toHaveCount(2);

    await page.getByRole("button", { name: "All servers" }).click();
    await page.getByRole("switch", { name: "Failures only" }).click();
    await expect(trail.getByRole("row")).toHaveCount(2);
    await expect(trail).toContainText("fixture__missing");

    await client.close();
    await app.close();
    expect(databaseContents(dataDir)).not.toContain(marker);
  }));

test("keeps long names inside a narrow window", () =>
  withDataDir(async (dataDir) => {
    const server = `fixture_${"long".repeat(40)}`;
    const app = await launch(dataDir);
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));

    const client = await startAgent(page, server);
    await client.callTool({ name: `${server}__echo`, arguments: { message: "hi" } });

    const breakdown = page.getByRole("table").first();
    const label = breakdown.getByRole("button", { name: server });
    await expect(label).toHaveAttribute("title", server);

    const [button, cell] = await Promise.all([label.boundingBox(), breakdown.getByRole("cell").first().boundingBox()]);
    expect(button!.x + button!.width).toBeLessThanOrEqual(cell!.x + cell!.width);
    expect(await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")).toBe(0);

    await client.close();
    await app.close();
  }));
