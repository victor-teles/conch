import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

const seedConnectionWithAi = async (page: Page) => {
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

const search = (page: Page) =>
  page.getByRole("combobox", { name: "Search commands" });

test.describe("root results", () => {
  test("ranks matches under the Ask row and still asks on Enter", async ({
    page,
  }) => {
    await seedConnectionWithAi(page);
    await page.goto("/");

    await search(page).fill("sett");
    const ask = page.getByRole("option", { name: /Ask analytics/ });
    await expect(ask).toHaveAttribute("aria-selected", "true");
    const results = page.getByRole("group", { name: /^Results/ });
    await expect(
      results.getByRole("option", { name: /Settings.*Command/ })
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Use “sett” with…" })
    ).toBeVisible();

    await search(page).press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Ask a question" })
    ).toBeVisible();
  });

  test("sends a query that matched nothing to History", async ({ page }) => {
    await seedConnectionWithAi(page);
    await page.goto("/");

    await search(page).fill("qwertyzzz");
    await page.getByRole("option", { name: /Search History/ }).click();
    await expect(
      page.getByRole("combobox", { name: "Search history" })
    ).toHaveValue("qwertyzzz");
  });

  test("keeps an abandoned New Connection form as a draft", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("No databases yet")).toBeVisible();

    await search(page).press("Enter");
    await expect(
      page.getByRole("heading", { name: "New Connection" })
    ).toBeVisible();
    await page.getByLabel("Host").fill("db.internal");
    await page.keyboard.press("Escape");

    const draft = page.getByRole("option", { name: /New Connection/ });
    await expect(draft).toContainText("db.internal");
    await expect(draft).toHaveAttribute("aria-selected", "true");
    await search(page).press("Enter");
    await expect(page.getByLabel("Host")).toHaveValue("db.internal");
  });
});
