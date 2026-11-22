import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const seedDemoWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const connection = {
      createdAt: "2026-11-01T00:00:00.000Z",
      database: "analytics",
      host: "localhost",
      id: "analytics",
      lastConnectedAt: null,
      name: "analytics",
      password: "",
      pinned: false,
      port: 5432,
      type: "postgresql",
      username: "postgres",
    };
    localStorage.setItem("conch-connections", JSON.stringify([connection]));
    localStorage.setItem(
      "conch-active-connection",
      JSON.stringify({ connectionId: "analytics", database: null })
    );
    localStorage.setItem(
      "conch-ai-settings",
      JSON.stringify({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      })
    );
  });
};

test.describe("root row actions", () => {
  test("filters a recent ask's actions and copies its SQL", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedDemoWorkspace(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("Revenue by region");
    await search.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Monthly recurring revenue by region" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await search.fill("");

    const recent = page
      .getByRole("group", { name: "Recent" })
      .getByRole("option", { name: /Revenue by region/ });
    await expect(recent).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("contentinfo")).toContainText("Actions");

    await search.press("Meta+k");
    await expect(
      page.getByRole("menu", { name: "Actions for Revenue by region" })
    ).toBeVisible();
    const filter = page.getByRole("textbox", { name: "Filter actions" });
    await expect(filter).toBeFocused();
    await filter.fill("copy sql");
    await expect(page.getByRole("menuitem")).toHaveCount(1);
    await filter.press("Enter");

    await expect(page.getByRole("contentinfo")).toContainText("Copied the SQL");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.toLowerCase()).toContain("select");
  });
});
