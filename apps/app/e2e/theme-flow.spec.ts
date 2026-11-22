import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const AMBER_DARK_PRIMARY = "oklch(0.9247 0.0524 66.1732)";

const rootToken = (page: Page, name: string) =>
  page.evaluate(
    (token) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(`--${token}`)
        .trim(),
    name
  );

const openThemes = async (page: Page) => {
  const search = page.getByRole("combobox", { name: "Search commands" });
  await search.fill("Themes");
  await expect(page.getByRole("option", { name: /^Themes/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await search.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Search themes" })
  ).toBeFocused();
};

const useTheme = async (page: Page, name: string) => {
  const search = page.getByRole("combobox", { name: "Search themes" });
  await search.fill(name);
  await expect(
    page.getByRole("option", { name: new RegExp(`^${name}`) })
  ).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page.getByText(`Using ${name}`)).toBeVisible();
};

test.describe("themes", () => {
  test("uses a built-in theme and keeps it across a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await openThemes(page);
    await useTheme(page, "Amber Dark");

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await rootToken(page, "primary")).toBe(AMBER_DARK_PRIMARY);

    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Search commands" })
    ).toBeVisible();
    expect(await rootToken(page, "primary")).toBe(AMBER_DARK_PRIMARY);
  });

  test("builds a theme token by token and applies it", async ({ page }) => {
    await page.goto("/");
    await openThemes(page);
    await page.keyboard.press("Meta+n");

    const name = page.getByRole("textbox", { exact: true, name: "Theme name" });
    await expect(name).toHaveValue("Conch Dark copy");
    await name.fill("Signal");
    await page
      .getByRole("textbox", { exact: true, name: "Selected row hex" })
      .fill("#ff0000");
    expect(await rootToken(page, "row-active")).toBe("#ff00001a");
    await page.keyboard.press("Meta+s");

    const saved = page.getByRole("option", { name: /^Signal/ });
    await expect(saved).toHaveAttribute("aria-selected", "true");
    await expect(saved).toContainText("Custom");
    await page.getByRole("combobox", { name: "Search themes" }).press("Enter");
    await expect(page.getByText("Using Signal")).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Search commands" })
    ).toBeVisible();
    expect(await rootToken(page, "row-active")).toBe("#ff00001a");
  });

  test("imports a theme file", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const source = getComputedStyle(document.documentElement);
      const names = [...document.documentElement.style]
        .filter((property) => property.startsWith("--"))
        .map((property) => property.slice(2));
      const tokens = Object.fromEntries(
        names.map((token) => [
          token,
          source.getPropertyValue(`--${token}`).trim(),
        ])
      );
      Object.assign(globalThis, {
        __conchThemeImport: JSON.stringify({
          appearance: "dark",
          name: "Shared",
          tokens,
          version: 1,
        }),
      });
    });
    await openThemes(page);
    await page.keyboard.press("Meta+o");

    await expect(page.getByText("Imported Shared")).toBeVisible();
    await expect(page.getByRole("option", { name: /^Shared/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
