import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: Record<string, unknown>;
}

const seed = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "conch-connections",
      JSON.stringify([
        {
          createdAt: "2026-11-19T09:00:00.000Z",
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
        },
      ])
    );
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
    localStorage.setItem(
      "conch-write-permissions",
      JSON.stringify(["connection:analytics"])
    );
  });
};

const calls = (page: Page, name: string): Promise<IpcCall[]> =>
  page.evaluate(
    (method) =>
      (
        (globalThis as unknown as { __conchIpcLog?: IpcCall[] })
          .__conchIpcLog ?? []
      ).filter((call) => call.name === method),
    name
  );

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

test.describe("mini-app flow", () => {
  test("builds a refund desk, saves it reviewed, opens it and runs a confirmed refund", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seed(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("refund desk");
    const build = page.getByRole("option", { name: /Build an app/ });
    await build.hover();
    await expect(build).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");

    const heading = page.getByRole("heading", { name: "Refund desk" });
    const charges = page.getByRole("article", { name: "Failed charges" });
    const amounts = page.getByRole("article", { name: "Refund amounts" });
    await expect(heading).toBeVisible();
    await expect(charges).toBeVisible();
    await expect(amounts).toBeVisible();
    await expect(page.getByText("Ready · ⌘S to save").first()).toBeVisible();
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h2, article")].map((node) =>
        node.tagName === "H2"
          ? node.textContent
          : node.getAttribute("aria-label")
      )
    );
    expect(order).toStrictEqual([
      "Refund desk",
      "Failed charges",
      "Matching orders",
      "Refund amounts",
    ]);
    expect(await calls(page, "executeAction")).toHaveLength(0);

    await page.keyboard.press("Meta+s");
    const review = page.getByRole("region", { name: "Review the app" });
    await expect(review).toBeVisible();
    await review.getByRole("checkbox", { name: /I reviewed this/ }).check();
    await page.keyboard.press("Meta+Enter");
    await expect(page.getByText("Saved · ↵ to open")).toBeVisible();
    const saved = await calls(page, "saveMiniApp");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.payload.reviewedActionIds).toStrictEqual(["refund"]);

    const opened = page.context().waitForEvent("page");
    await page.keyboard.press("Enter");
    const app = await opened;
    await app.waitForLoadState();
    expect(new URL(app.url()).hash).toMatch(/^#\/app\//u);
    const appErrors = collectErrors(app);

    const appCharges = app.getByRole("article", { name: "Failed charges" });
    await expect(appCharges.getByText("ch_1043")).toBeVisible();
    await expect(
      app.getByRole("article", { name: "Matching orders" })
    ).toBeVisible();
    const before = (await calls(app, "runMiniAppSource")).length;

    const region = app.getByRole("textbox", { name: "Region" });
    await region.fill("US");
    await region.press("Enter");
    await expect
      .poll(async () =>
        (await calls(app, "runMiniAppSource"))
          .slice(before)
          .map((call) => call.payload.sourceName)
      )
      .toStrictEqual(["orders"]);
    expect(await calls(app, "generateMiniApp")).toHaveLength(0);

    await appCharges.getByText("ch_1043").click();
    await appCharges.getByRole("button", { name: /Refund/ }).click();
    const sheet = page.getByRole("alertdialog", { name: "Refund" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("table", { name: "Bound values" })
    ).toContainText("ch_1043");
    expect(await calls(page, "executeAction")).toHaveLength(0);
    await page.waitForTimeout(700);
    await page.keyboard.press("Meta+Enter");
    await expect(sheet.getByText("1 row changed · 42 ms")).toBeVisible();
    expect(await calls(page, "executeAction")).toHaveLength(1);

    await page.keyboard.press("Escape");
    // A stage that lands while a confirm sheet is still closing is dropped.
    await expect(sheet).toBeHidden();
    await appCharges.getByText("ch_1042").click();
    await appCharges.getByRole("button", { name: /Refund/ }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    expect(await calls(page, "executeAction")).toHaveLength(1);
    expect(await calls(page, "generateMiniApp")).toHaveLength(1);
    expect(errors).toStrictEqual([]);
    expect(appErrors).toStrictEqual([]);
  });

  test("explains a build that can't produce a working app", async ({
    page,
  }) => {
    await seed(page);
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "Search commands" })
      .fill("a broken thing");
    const build = page.getByRole("option", { name: /Build an app/ });
    await build.hover();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(
        "Couldn't build a working app from that. Try naming the data you want."
      )
    ).toBeVisible();
    await expect(
      page.getByText(/relation "orderz" does not exist/)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  });
});
