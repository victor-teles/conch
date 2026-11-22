import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const ipcCalls = (page: Page, name: string) =>
  page.evaluate(
    (wanted) =>
      (
        globalThis as unknown as { __conchIpcLog: IpcCall[] }
      ).__conchIpcLog.filter((call) => call.name === wanted),
    name
  );

const openLink = (page: Page, url: string) =>
  page.evaluate(
    (link) =>
      (
        globalThis as unknown as { __conchOpenLink: (url: string) => void }
      ).__conchOpenLink(link),
    url
  );

const seedWorkspace = async (page: Page) => {
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
    const widget = {
      connectionId: "analytics",
      createdAt: "2026-11-01T00:00:00.000Z",
      database: null,
      dialect: "postgresql",
      id: "w-revenue",
      lastRunAt: null,
      lastValues: {},
      name: "Revenue by region",
      params: [
        {
          default: "Europe",
          label: "Region",
          name: "region",
          options: ["Asia Pacific", "Europe", "North America"],
          type: "select",
        },
      ],
      prompt: "revenue by region",
      spec: {
        formats: {},
        insight: "Europe grew every month.",
        subtitle: "Last quarter",
        title: "Monthly recurring revenue",
        version: 2,
        view: {
          kind: "chart",
          mark: "line",
          stacked: false,
          x: "month",
          y: ["mrr"],
        },
      },
      sqlTemplate:
        "select month, sum(mrr) as mrr from revenue where region = {{region}} group by 1",
      updatedAt: "2026-11-01T00:00:00.000Z",
      view: "line",
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
    localStorage.setItem("conch-widgets", JSON.stringify([widget]));
  });
};

test.describe("conch:// links", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspace(page);
    await page.goto("/");
    await expect(
      page.getByRole("combobox", { name: "Search commands" })
    ).toBeVisible();
  });

  test("an ask link stages the question and asks only on Enter", async ({
    page,
  }) => {
    await openLink(page, "conch://ask?q=revenue%20by%20region&conn=analytics");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await expect(search).toHaveValue("revenue by region");
    await expect(page.getByText("From link")).toBeVisible();
    expect(await ipcCalls(page, "ask")).toHaveLength(0);

    await search.press("Enter");
    await expect.poll(async () => (await ipcCalls(page, "ask")).length).toBe(1);
    expect((await ipcCalls(page, "ask"))[0]?.payload).toMatchObject({
      connectionId: "analytics",
      prompt: "revenue by region",
    });
  });

  test("a widget link with values stages the pills and runs only on Enter", async ({
    page,
  }) => {
    await openLink(page, "conch://widget/w-revenue?region=North%20America");

    const region = page.getByRole("combobox", { name: "Region" });
    await expect(region).toHaveValue("North America");
    expect(await ipcCalls(page, "runWidget")).toHaveLength(0);

    await region.press("Escape");
    await region.press("Enter");
    await expect
      .poll(async () => (await ipcCalls(page, "runWidget")).length)
      .toBe(1);
    expect((await ipcCalls(page, "runWidget"))[0]?.payload).toMatchObject({
      values: { region: "North America" },
      widgetId: "w-revenue",
    });
    expect(await ipcCalls(page, "ask")).toHaveLength(0);
  });

  test("a widget link with only its id runs it", async ({ page }) => {
    await openLink(page, "conch://widget/w-revenue");
    await expect(
      page.getByRole("region", { name: "Revenue by region" })
    ).toBeVisible();
    expect(await ipcCalls(page, "runWidget")).toHaveLength(1);
  });

  test("a link it does not understand shows a notice", async ({ page }) => {
    await openLink(page, "conch://nope");
    await expect(
      page.getByText("That link isn't one Conch understands.")
    ).toBeVisible();
  });

  test("a link to a missing board says so", async ({ page }) => {
    await openLink(page, "conch://board/missing");
    await expect(page.getByText("That board no longer exists.")).toBeVisible();
  });
});
