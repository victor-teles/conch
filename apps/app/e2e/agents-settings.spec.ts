import type { Page } from "@playwright/test";

import { expect, test } from "@playwright/test";

interface IpcCall {
  name: string;
  payload: unknown;
}

const TOKEN_SHAPE = /[A-Za-z0-9_-]{43}/;

const seedConnection = async (page: Page) => {
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

const ipcCalls = (page: Page, name: string) =>
  page.evaluate(
    (method) =>
      (
        (globalThis as unknown as { __conchIpcLog: IpcCall[] }).__conchIpcLog ??
        []
      ).filter((call) => call.name === method),
    name
  );

test.describe("agents (MCP) settings", () => {
  test("turns on, exposes a connection, copies a config and shows activity", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedConnection(page);
    await page.goto("/");

    const search = page.getByRole("combobox", { name: "Search commands" });
    await search.fill("sett");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const open = page.getByRole("button", { name: "Open Agents (MCP)" });
    await expect(open).toContainText("Off");
    await open.click();
    await expect(
      page.getByRole("heading", { name: "Agents (MCP)" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Listening", { exact: true })).toBeVisible();

    const expose = page.getByRole("checkbox", {
      name: "Let agents read analytics",
    });
    await expect(expose).toHaveAttribute("aria-checked", "false");
    await expose.click();
    await expect(expose).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByText("Agents can read everything this connection can.")
    ).toBeVisible();
    expect(await ipcCalls(page, "saveMcpSettings")).toContainEqual({
      name: "saveMcpSettings",
      payload: { exposedConnectionIds: ["analytics"] },
    });

    const copy = page.getByRole("button", { name: "Copy Claude Code config" });
    await copy.click();
    await expect(copy).toContainText("Copied");
    expect(await ipcCalls(page, "copyMcpClientConfig")).toEqual([
      { name: "copyMcpClientConfig", payload: { client: "claude-code" } },
    ]);
    expect(await page.locator("body").innerText()).not.toMatch(TOKEN_SHAPE);

    await page.getByRole("button", { name: "Open agent activity" }).click();
    const calls = page.getByRole("listbox", { name: "Agent calls" });
    await expect(calls.getByRole("option")).toHaveCount(3);
    await expect(calls).toContainText("Revenue by region this quarter");
    await expect(calls).toContainText("limited");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(search).toBeVisible();

    await page.evaluate(() => {
      (
        globalThis as unknown as {
          __conchEmitMcpActivity: (active: unknown[]) => void;
        }
      ).__conchEmitMcpActivity([
        {
          client: "Claude Code",
          connectionName: "analytics",
          id: "call-1",
          startedAt: new Date().toISOString(),
          tool: "ask",
        },
      ]);
    });
    await expect(
      page.getByText("Claude Code is asking analytics")
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
