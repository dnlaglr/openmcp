import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

import { databaseContents, launch, withDataDir } from "./app";

const fixture = join(__dirname, "fixtures/stdioServer.mts");
const marker = "e2e-activity-argument";

async function startAgent(page: Page, server: string) {
  await page.getByRole("button", { name: "Add server" }).click();
  await page.getByRole("menuitem", { name: "Local command…" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name", { exact: true }).fill(server);
  await sheet.getByLabel("Command").fill("node");
  await sheet.getByLabel("Arguments").fill(fixture);
  await sheet.getByRole("button", { name: "Add server" }).click();
  await expect(page.getByRole("group", { name: server, exact: true })).toContainText("Running");

  const { url, token } = (await page.evaluate("window.api.invoke('gateway:connection')")) as {
    url: string;
    token: string;
  };

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

test("shows calls as they happen, filters by server, and keeps arguments out of the database", () =>
  withDataDir(async (dataDir) => {
    const app = await launch(dataDir);
    const page = await app.firstWindow();
    const client = await startAgent(page, "fixture");

    const log = page.getByRole("region", { name: "Calls" });
    const topServers = page.getByRole("region", { name: "Top servers" });
    const entry = (name: RegExp) => log.getByRole("listitem").filter({ hasText: name });

    await client.callTool({ name: "fixture__echo", arguments: { message: marker } });
    await expect(entry(/echo/)).toContainText("OK");

    await client.callTool({ name: "fixture__missing", arguments: {} }).catch(() => undefined);
    await expect(entry(/fixture__missing/)).toContainText("Unavailable");
    await expect(page.getByRole("definition").first()).toHaveText("2");
    await expect(page.getByRole("definition").nth(1)).toContainText(/50\s?%/);
    await expect(page.getByRole("img", { name: "2 calls in the last 24 hours, 1 failed" })).toBeVisible();

    await expect(topServers.getByText("No server")).toBeVisible();
    await expect(topServers.getByRole("button", { name: /No server/ })).toHaveCount(0);

    await topServers.getByRole("button", { name: /^fixture/ }).click();
    await expect(page.getByRole("button", { name: "Remove the server filter" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Top tools in fixture" }).getByRole("button", { name: /^echo/ })
    ).toBeVisible();
    await expect(log.getByRole("listitem")).toHaveCount(1);

    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "Failed", exact: true }).click();
    await expect(log.getByRole("listitem")).toHaveCount(1);
    await entry(/fixture__missing/)
      .getByRole("button")
      .click();
    await expect(log.getByText("No running server offers this call. Check the Servers page.")).toBeVisible();

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

    const topServers = page.getByRole("region", { name: "Top servers" });
    const name = topServers.getByTitle(server);
    await expect(name).toBeVisible();

    const [label, row] = await Promise.all([name.boundingBox(), topServers.getByRole("button").first().boundingBox()]);
    expect(label!.x + label!.width).toBeLessThanOrEqual(row!.x + row!.width);
    expect(await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")).toBe(0);

    await client.close();
    await app.close();
  }));
