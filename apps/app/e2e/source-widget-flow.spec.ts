import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: unknown;
}

const seedWorkspace = async (page: Page) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) {
      return;
    }
    sessionStorage.setItem("seeded", "1");
    const stamp = "2026-11-18T09:00:00.000Z";
    localStorage.setItem(
      "conch-connections",
      JSON.stringify([
        {
          createdAt: stamp,
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
      "conch-widgets",
      JSON.stringify([
        {
          connectionId: "analytics",
          createdAt: stamp,
          database: null,
          dialect: "postgresql",
          id: "w-users",
          lastRunAt: null,
          lastValues: {},
          name: "Total users",
          params: [],
          prompt: "",
          spec: {
            formats: {},
            title: "Total users",
            version: 1,
            view: { kind: "table" },
          },
          sqlTemplate: "select count(*) from users",
          updatedAt: stamp,
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

const ipcNames = (page: Page) =>
  page.evaluate(() =>
    (
      (globalThis as unknown as { __conchIpcLog?: IpcCall[] }).__conchIpcLog ??
      []
    ).map((call) => call.name)
  );

const addToBoard = async (page: Page, widgetName: string) => {
  const root = page.getByRole("combobox", { name: "Search commands" });
  await root.fill(widgetName);
  const row = page.getByRole("option", { name: new RegExp(widgetName) });
  await row.hover();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await root.press("Meta+k");
  await page.getByRole("menuitem", { name: "Add to Board…" }).click();
};

test.describe("source widget flow", () => {
  test("connects an MCP server, builds a widget from a read tool and boards it next to SQL", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedWorkspace(page);
    await page.goto("/");

    const root = page.getByRole("combobox", { name: "Search commands" });
    await expect(root).toBeFocused();
    await page.keyboard.press("Meta+,");
    await page.getByRole("button", { name: "Add MCP Server" }).click();
    await page
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill("Stripe (stub)");
    await page.getByRole("textbox", { name: "Command" }).fill("npx");
    await page
      .getByRole("textbox", { name: "Arguments" })
      .fill("-y\n@stripe/mcp");
    await page.keyboard.press("Meta+t");
    await expect(
      page.getByText(/Connected · 3 tools · 1 read · \d+ ms/)
    ).toBeVisible();
    const tools = page.getByRole("list", { name: "Tools" });
    await expect(
      tools.locator('[data-tool="list_disputes"]').getByText("Read-only")
    ).toBeVisible();
    await expect(
      tools.locator('[data-tool="refund_charge"]').getByText("Read-only")
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Treat refund_charge as read" })
    ).not.toBeChecked();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(
      page.getByRole("button", { name: "Edit Stripe (stub)" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await root.fill("new widget from a source");
    await root.press("Enter");
    const picker = page.getByRole("combobox", { name: "Search sources" });
    await picker.fill("stripe");
    await picker.press("Enter");

    const describe = page.getByRole("textbox", { name: "Describe the widget" });
    await describe.fill("open disputes by status");
    await describe.press("Enter");
    await expect(page.getByRole("combobox", { name: "Tool" })).toHaveValue(
      "list_disputes"
    );
    await expect(page.getByRole("list", { name: "Inputs" })).toContainText(
      "Status"
    );
    await page.keyboard.press("Meta+Enter");
    const preview = page.getByRole("region", {
      name: "open disputes by status",
    });
    await expect(preview).toContainText("dp_1A");
    await page.keyboard.press("Meta+s");
    await page.getByRole("textbox", { name: "Name" }).fill("Open disputes");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Saved · ⌥↵ to run")).toBeVisible();
    const authoring = (await ipcNames(page)).length;

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("combobox", { name: "Search sources" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(root).toBeVisible();
    await root.fill("open disputes");
    await expect(
      page.getByRole("option", { name: /Open disputes/ })
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Stripe (stub) · MCP" })
    ).toBeVisible();
    await root.press("Tab");
    const status = page.getByRole("combobox", { name: "Status" });
    await expect(status).toBeFocused();
    await status.fill("won");
    await expect(page.getByRole("option", { name: "won" })).toBeVisible();
    await status.press("Enter");
    const card = page.getByRole("region", { name: "Open disputes" });
    await expect(card).toContainText("dp_1C");
    await expect(card).not.toContainText("dp_1A");

    await page.keyboard.press("Escape");
    await addToBoard(page, "Open disputes");
    const boards = page.getByRole("combobox", { name: "Search boards" });
    await boards.press("Enter");
    await page.getByRole("textbox", { name: "Board name" }).fill("Ops");
    const opened = page.context().waitForEvent("page");
    await page.keyboard.press("Enter");
    const boardId = new URL((await opened).url()).hash.replace("#/board/", "");
    await addToBoard(page, "Total users");
    await page.getByRole("option", { name: /Ops/ }).click();

    const runs = (await ipcNames(page)).slice(authoring);
    expect(runs).toContain("runWidget");
    expect(runs).not.toContain("ask");
    expect(runs).not.toContain("proposeSourceWidget");
    expect(runs).not.toContain("proposeWidgetParams");

    const beforeBoard = (await ipcNames(page)).length;
    await page.goto(`/#/board/${boardId}`);
    await expect(page.getByRole("heading", { name: "Ops" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText("MCP", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").first()).toContainText("dp_1C");
    const boardCalls = (await ipcNames(page)).slice(beforeBoard);
    expect(boardCalls).toContain("runWidget");
    expect(boardCalls).not.toContain("ask");
    expect(boardCalls).not.toContain("proposeSourceWidget");

    expect(errors).toStrictEqual([]);
  });
});
