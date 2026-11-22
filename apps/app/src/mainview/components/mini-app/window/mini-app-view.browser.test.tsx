import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { MiniApp } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";
import { chargesRun, deskApp, ordersRun } from "@/test/mini-app-fixtures";

import { MiniAppView } from "./mini-app-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

interface Setup {
  app?: MiniApp | null;
  runMiniAppSource?: (payload: Record<string, unknown>) => unknown;
}

const defaultRun = (payload: Record<string, unknown>) =>
  payload.sourceName === "charges" ? chargesRun() : ordersRun();

const failOrders = (payload: Record<string, unknown>) => {
  if (payload.sourceName === "orders") {
    throw Object.assign(new Error("relation orders does not exist"), {
      code: "QUERY_FAILED",
    });
  }
  return chargesRun();
};

const setup = ({
  app = deskApp(),
  runMiniAppSource = defaultRun,
}: Setup = {}) => {
  const state = { app };
  const calls = {
    cancelMiniAppGeneration: vi.fn(),
    generateMiniApp: vi.fn(),
    runMiniAppSource: vi.fn(runMiniAppSource),
    saveMiniApp: vi.fn((payload: Record<string, unknown>) => {
      const draft = payload.draft as MiniApp;
      state.app = { ...deskApp(), ...draft, actions: deskApp().actions };
      return state.app;
    }),
    setMiniAppValues: vi.fn(() => state.app),
    stageMiniAppAction: vi.fn(),
    toggleLauncher: vi.fn(),
  };
  mockIpc({
    ...calls,
    getConnections: () => [],
    getLauncherHotkey: () => "Option+Shift+Space",
    getMiniApp: () => state.app,
    listHttpEndpoints: () => [],
    listMcpServers: () => [],
    listWritePermissions: () => [],
  });
  const screen = render(
    <AppProviders>
      <div style={{ width: 1100 }}>
        <MiniAppView appId="app-desk" />
      </div>
    </AppProviders>
  );
  return { calls, screen };
};

const sourcesRun = (calls: ReturnType<typeof setup>["calls"]) =>
  calls.runMiniAppSource.mock.calls.map(([payload]) => payload.sourceName);

const ready = async (screen: ReturnType<typeof setup>["screen"]) => {
  const charges = screen.getByRole("article", { name: "Failed charges" });
  await expect.element(charges.getByText("ch_2")).toBeVisible();
  return charges;
};

describe("miniAppView", () => {
  it("runs every source of the saved app when it opens", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    expect(sourcesRun(calls).toSorted()).toStrictEqual(["charges", "orders"]);
    expect(calls.runMiniAppSource).toHaveBeenCalledWith(
      expect.objectContaining({ target: { appId: "app-desk", kind: "saved" } })
    );
    expect(calls.generateMiniApp).not.toHaveBeenCalled();
    expect(screen.container).toMatchSnapshot();
  });

  it("says when the app is gone", async () => {
    const { screen } = setup({ app: null });
    await expect
      .element(screen.getByText("This app no longer exists."))
      .toBeVisible();
  });

  it("shows a failing source inside its card", async () => {
    const { screen } = setup({
      runMiniAppSource: failOrders,
    });
    const orders = screen.getByRole("article", { name: "Matching orders" });
    await expect.element(orders.getByRole("alert")).toBeVisible();
    expect(orders.element()).toMatchSnapshot();
  });

  it("re-runs only what an input touches and keeps the value", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    const before = calls.runMiniAppSource.mock.calls.length;
    const region = screen.getByRole("textbox", { name: "Region" });
    await region.fill("US");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => sourcesRun(calls).slice(before))
      .toStrictEqual(["orders"]);
    expect(calls.setMiniAppValues).toHaveBeenCalledWith({
      appId: "app-desk",
      values: expect.objectContaining({ "region:text": "US" }),
    });
    await expect.element(screen.getByTestId("filter-tint")).toBeInTheDocument();
  });

  it("stages a row action by run and row, never by its values", async () => {
    const { calls, screen } = setup();
    const charges = await ready(screen);
    await charges.getByText("ch_2").click();
    await charges.getByRole("button", { name: /Refund/u }).click();
    expect(calls.stageMiniAppAction).toHaveBeenCalledWith({
      actionId: "refund",
      appId: "app-desk",
      context: {
        rowIndex: 1,
        runId: expect.any(String),
        values: expect.objectContaining({ region: "EU" }),
      },
    });
    expect(JSON.stringify(calls.stageMiniAppAction.mock.calls)).not.toContain(
      "ch_2"
    );
  });

  it("stages an app action with the current inputs", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    await screen.getByRole("button", { name: "Copy region" }).click();
    expect(calls.stageMiniAppAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "copy-region",
        context: expect.objectContaining({ rowIndex: null, runId: "app" }),
      })
    );
  });

  it("refreshes the sources bun names after an action finishes", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    const before = calls.runMiniAppSource.mock.calls.length;
    emitIpcMessage("miniAppRefresh", {
      appId: "app-desk",
      sources: ["charges"],
    });
    await expect
      .poll(() => sourcesRun(calls).slice(before))
      .toStrictEqual(["charges"]);
  });

  it("forwards the launcher hotkey with this window's key", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Alt>}{Shift>} {/Shift}{/Alt}");
    expect(calls.toggleLauncher).toHaveBeenCalledWith({
      fromWindowKey: "app:app-desk",
    });
  });
});

describe("miniAppView editing", () => {
  it("moves and resizes a card from the keyboard in edit mode", async () => {
    const { calls, screen } = setup();
    const charges = await ready(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    await expect
      .element(screen.getByRole("button", { name: /Done/u }))
      .toBeVisible();
    (charges.element() as HTMLElement).focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect.poll(() => calls.saveMiniApp.mock.calls.length).toBe(1);
    const moved = calls.saveMiniApp.mock.calls[0]?.[0]?.draft as MiniApp;
    expect(moved.layout.elements.grid?.children).toStrictEqual([
      "orders",
      "charges",
    ]);
    (
      screen
        .getByRole("article", { name: "Failed charges" })
        .element() as HTMLElement
    ).focus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect.poll(() => calls.saveMiniApp.mock.calls.length).toBe(2);
    expect(JSON.stringify(calls.saveMiniApp.mock.calls[1]?.[0])).toContain(
      '"size":"wide"'
    );
  });

  it("removes an action in two presses", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    const remove = screen.getByRole("button", { name: "Remove Refund" });
    await remove.click();
    expect(calls.saveMiniApp).not.toHaveBeenCalled();
    await screen.getByRole("button", { name: "Confirm remove Refund" }).click();
    await expect.poll(() => calls.saveMiniApp.mock.calls.length).toBe(1);
    const saved = calls.saveMiniApp.mock.calls[0]?.[0]?.draft as MiniApp;
    expect(saved.actions.map((action) => action.id)).toStrictEqual([
      "copy-region",
    ]);
  });

  it("changes the app with a prompt, tinting what the patch replaced", async () => {
    const { calls, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}{Shift>}e{/Shift}{/Meta}");
    const field = screen.getByRole("textbox", { name: "Change Refund desk" });
    await field.fill("rename the heading");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.generateMiniApp.mock.calls.length).toBe(1);
    const request = calls.generateMiniApp.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      baseAppId: "app-desk",
      prompt: "rename the heading",
    });
    emitIpcMessage("miniAppGenEvent", {
      event: {
        ops: [
          {
            op: "replace",
            path: "/layout/elements/title",
            value: {
              children: [],
              props: { text: "Refunds today" },
              type: "Heading",
            },
          },
        ],
        type: "patch",
      },
      genId: request?.genId,
    });
    await expect
      .element(screen.getByRole("heading", { name: "Refunds today" }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("heading", { name: "Refund desk" }).last())
      .toBeVisible();
    expect(calls.saveMiniApp).not.toHaveBeenCalled();
  });
});
