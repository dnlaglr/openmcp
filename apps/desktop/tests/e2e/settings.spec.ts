import { expect, test } from "@playwright/test";

import { launch, withDataDir } from "./app";

test("dark appearance survives a restart", () =>
  withDataDir(async (dataDir) => {
    let app = await launch(dataDir);
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");
    await app.close();

    app = await launch(dataDir);
    page = await app.firstWindow();
    expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");
    expect(
      (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor())).toLowerCase()
    ).toBe("#0b1018");
    // Playwright emulates a light scheme unless told not to.
    await page.emulateMedia({ colorScheme: null });
    expect(await page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")).toBe(true);
    await app.close();
  }));
