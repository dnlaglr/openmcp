import { createServer, type AddressInfo, type Server } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { once } from "node:events";

import { launch, withDataDir } from "./app";

async function occupyPort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

const portOf = (server: Server) => (server.address() as AddressInfo).port;

async function choosePort(page: Page, port: number) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Port", { exact: true }).fill(String(port));
  await page.getByRole("button", { name: "Save port" }).click();
}

test("moves the gateway to the port chosen in Settings", () =>
  withDataDir(async (dataDir) => {
    const probe = await occupyPort();
    const port = portOf(probe);
    await new Promise((resolve) => probe.close(resolve));

    const app = await launch(dataDir);
    const page = await app.firstWindow();
    await choosePort(page, port);

    await expect(page.getByText(`Gateway on :${port}`)).toBeVisible();
    await expect(page.getByLabel("URL", { exact: true })).toHaveValue(`http://127.0.0.1:${port}/mcp`);
    expect((await fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST" })).status).toBe(401);
    await app.close();
  }));

test("says so when another app holds the port", () =>
  withDataDir(async (dataDir) => {
    const blocker = await occupyPort();
    const port = portOf(blocker);

    try {
      const app = await launch(dataDir);
      const page = await app.firstWindow();
      await choosePort(page, port);

      await expect(page.getByRole("alert")).toHaveText(
        `Port ${port} is in use by another app. Choose another port in Settings.`
      );
      await app.close();
    } finally {
      blocker.close();
    }
  }));
