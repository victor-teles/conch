import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: unknown;
}

const seedTableWidget = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const stamp = "2026-11-19T09:00:00.000Z";
    localStorage.setItem(
      "conch-connections",
      JSON.stringify([
        {
          createdAt: stamp,
          database: "analytics",
          environment: "prod",
          host: "localhost",
          id: "analytics",
          lastConnectedAt: null,
          name: "analytics",
          password: "",
          pinned: false,
          port: 5432,
          type: "postgresql",
          username: "postgres",
        },
      ])
    );
    localStorage.setItem(
      "conch-widgets",
      JSON.stringify([
        {
          createdAt: stamp,
          id: "w-regions",
          lastRunAt: null,
          lastValues: {},
          name: "Revenue by month",
          params: [],
          prompt: "revenue by region",
          source: {
            connectionId: "analytics",
            database: null,
            dialect: "postgresql",
            kind: "sql",
            sqlTemplate:
              "select month, region, sum(mrr) as mrr from revenue group by 1, 2",
          },
          spec: {
            formats: {},
            title: "Revenue by month",
            version: 2,
            view: { kind: "table" },
          },
          updatedAt: stamp,
          version: 2,
          view: "table",
        },
      ])
    );
  });
};

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

const ipcCalls = (page: Page, name: string): Promise<IpcCall[]> =>
  page.evaluate(
    (method) =>
      (
        (globalThis as unknown as { __conchIpcLog: IpcCall[] }).__conchIpcLog ??
        []
      ).filter((call) => call.name === method),
    name
  );

test.describe("action flow", () => {
  test("enables writes, adds a reviewed row action, runs it on row 2 and finds it in Activity", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedTableWidget(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("analytics");
    await expect(
      page.getByRole("option", { name: /analytics/ }).first()
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const allow = page.getByRole("switch", { name: "Allow write actions" });
    await expect(allow).toHaveAttribute("aria-checked", "false");
    await allow.click();
    await expect(allow).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    await search.fill("Revenue by month");
    await page.keyboard.press("Enter");
    const grid = page.getByRole("grid", { name: "Result rows" });
    await expect(grid).toBeVisible();

    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: "Add Action…" }).click();
    await page.getByRole("textbox", { name: "Label" }).fill("Mark reviewed");
    await page
      .getByRole("textbox", { name: "Statement" })
      .fill("UPDATE revenue SET status = {{status}} WHERE region = {{region}}");
    await page
      .getByRole("combobox", { name: "Value for region" })
      .selectOption("row:region");
    await page
      .getByRole("combobox", { name: "Value for status" })
      .selectOption("literal");
    await page
      .getByRole("textbox", { name: "Text for status" })
      .fill("reviewed");
    await page.keyboard.press("Meta+Enter");

    await expect(
      page.getByRole("heading", { name: "Review “Mark reviewed”" })
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Bound values" })
    ).toContainText("reviewed");
    await page.keyboard.press("Meta+Enter");

    await expect(grid).toBeVisible();
    const row = grid.getByRole("row").nth(2);
    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: /Mark reviewed/ }).click();

    const sheet = page.getByRole("alertdialog", { name: "Mark reviewed" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("analytics", { exact: true })).toBeVisible();
    await expect(
      sheet.getByRole("table", { name: "Bound values" })
    ).toContainText("Europe");
    await page.keyboard.press("Enter");
    await expect(sheet).toBeHidden();
    expect(await ipcCalls(page, "executeAction")).toHaveLength(0);

    await row.click();
    await page.keyboard.press("Meta+k");
    await page.getByRole("menuitem", { name: /Mark reviewed/ }).click();
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(700);
    await page.keyboard.press("Meta+Enter");
    await expect(sheet.getByText("1 row changed · 42 ms")).toBeVisible();

    const executed = await ipcCalls(page, "executeAction");
    expect(executed).toHaveLength(1);
    expect(Object.keys(executed[0]?.payload as object)).toStrictEqual([
      "token",
    ]);
    const prepared = await ipcCalls(page, "prepareAction");
    expect(JSON.stringify(prepared.at(-1)?.payload)).not.toContain("UPDATE");
    expect(JSON.stringify(prepared.at(-1)?.payload)).not.toContain("Europe");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await search.fill("Activity");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Log verified")).toBeVisible();
    await expect(
      page.getByRole("option", { name: /Mark reviewed/ })
    ).toBeVisible();
    expect(errors).toStrictEqual([]);
  });
});
