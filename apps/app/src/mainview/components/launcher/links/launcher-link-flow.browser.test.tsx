import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { Widget } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { LauncherPanel } from "@/components/launcher/launcher-panel";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import { makeWidget, runResult } from "@/test/widget-fixtures";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "c-analytics", name: "analytics" });
const warehouse = makeConnection({ id: "c-warehouse", name: "Warehouse" });

const AI_READY = {
  baseUrl: null,
  hasKey: true,
  keyHint: "abcd",
  model: null,
  provider: "anthropic",
};

interface SetupOptions {
  ai?: boolean;
  widgets?: () => Widget[] | Promise<Widget[]>;
}

const setup = ({
  ai = true,
  widgets = () => [makeWidget()],
}: SetupOptions = {}) => {
  const calls = {
    ask: vi.fn(() => null),
    connectToDatabase: vi.fn(() => null),
    runWidget: vi.fn(() => runResult()),
  };
  const store = mockLauncherIpc({
    connections: [analytics, warehouse],
    handlers: {
      ...calls,
      getActiveConnection: () =>
        store.active ?? { connectionId: analytics.id, database: null },
      getAiSettings: () => (ai ? AI_READY : null),
      listWidgets: widgets,
      markConnectionUsed: () => null,
    },
  });
  return { calls, store };
};

const renderLauncher = () =>
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );

const search = () => page.getByRole("combobox", { name: "Search commands" });
const marker = () =>
  document.querySelector<HTMLElement>('[data-slot="link-marker"]');
const footerStatus = () =>
  document.querySelector<HTMLElement>('[data-slot="footer-status"]');
const inputRow = () => search().element().closest(".h-14");

const stageAsk = (prompt: string, connection: string | null) =>
  emitIpcMessage("launcherNavigate", {
    view: { connection, kind: "ask-draft", prompt },
  });

describe("an ask link", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("stages the text and the named connection without asking", async () => {
    const { calls, store } = setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    stageAsk("revenue by region", "warehouse");

    await expect.element(search()).toHaveValue("revenue by region");
    await expect
      .element(
        page.getByRole("img", { name: "Connection for this ask: Warehouse" })
      )
      .toBeVisible();
    await expect.element(page.getByText("From link")).toBeVisible();
    await expect
      .element(page.getByRole("option", { name: /Ask Warehouse/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(
        page.getByText(
          "From a link: ask Warehouse “revenue by region”. Press Return to ask."
        )
      )
      .toBeInTheDocument();
    expect(inputRow()).toMatchSnapshot();
    expect(calls.ask).not.toHaveBeenCalled();
    expect(store.active).toBeNull();
  });

  it("switches to the named connection and asks it on ↵", async () => {
    const { calls, store } = setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    stageAsk("revenue by region", "warehouse");
    await expect
      .element(page.getByRole("option", { name: /Ask Warehouse/ }))
      .toHaveAttribute("aria-selected", "true");
    expect(store.active).toBeNull();

    await search().click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => calls.ask.mock.calls.length).toBe(1);
    expect(calls.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: warehouse.id,
        database: null,
        prompt: "revenue by region",
      })
    );
    expect(calls.connectToDatabase).toHaveBeenCalledOnce();
    expect(store.active).toStrictEqual({
      connectionId: warehouse.id,
      database: warehouse.database,
    });
  });

  it("asks the active connection when the link names one that is not here", async () => {
    const { calls } = setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    stageAsk("revenue by region", "prod");

    await expect
      .element(page.getByText("No connection named “prod”"))
      .toBeVisible();
    await expect
      .element(page.getByRole("option", { name: /Ask analytics/ }))
      .toBeVisible();
    expect(footerStatus()).toMatchSnapshot();

    await search().click();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.ask.mock.calls.length).toBe(1);
    expect(calls.ask).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: analytics.id })
    );
    expect(calls.connectToDatabase).not.toHaveBeenCalled();
  });

  it("falls back to the AI setup row when no AI is configured", async () => {
    const { calls } = setup({ ai: false });
    renderLauncher();
    await expect.element(search()).toBeVisible();

    stageAsk("zzqx spend", null);

    await expect
      .element(page.getByRole("option", { name: /Set up an AI provider/ }))
      .toBeVisible();
    await expect.element(page.getByText("From link")).toBeVisible();
    expect(calls.ask).not.toHaveBeenCalled();
  });

  it("drops the marker once the text is edited", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    stageAsk("revenue by region", null);
    await expect.element(page.getByText("From link")).toBeVisible();

    await search().fill("revenue by region now");

    await expect.element(search()).toHaveValue("revenue by region now");
    await expect.poll(marker).toBeNull();
  });

  it("drops the marker with Escape", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    stageAsk("revenue by region", null);
    await expect.element(page.getByText("From link")).toBeVisible();

    await search().click();
    await userEvent.keyboard("{Escape}");

    await expect.element(search()).toHaveValue("");
    await expect.poll(marker).toBeNull();
  });

  it("replaces an earlier link: the last one wins", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    stageAsk("first", null);
    stageAsk("second", "warehouse");
    await expect.element(search()).toHaveValue("second");
    await expect
      .element(page.getByRole("option", { name: /Ask Warehouse/ }))
      .toBeVisible();
  });

  it.each([
    ["full motion", false, "spring"],
    ["reduced motion", true, "instant"],
  ])("reveals the marker with %s", async (_label, isReduced, motion) => {
    reduced.value = isReduced;
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    stageAsk("revenue by region", null);
    await expect.poll(() => marker()?.dataset.motion).toBe(motion);
  });

  it("applies a link sent before the launcher mounted, once its data loads", async () => {
    setup();
    stageAsk("cold start", "warehouse");
    renderLauncher();

    await expect.element(search()).toHaveValue("cold start");
    await expect
      .element(page.getByRole("option", { name: /Ask Warehouse/ }))
      .toHaveAttribute("aria-selected", "true");
  });
});

describe("a widget link", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("runs the widget when the link carries only its id", async () => {
    const { calls } = setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: { kind: "widget-run", widgetId: "w-revenue" },
    });

    await expect
      .element(page.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();
    expect(calls.runWidget).toHaveBeenCalledOnce();
  });

  it("stages link values in the pills, lists what it ignored, and runs on ↵", async () => {
    const { calls } = setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: {
        kind: "widget-args",
        values: { foo: "1", region: "North America" },
        widgetId: "w-revenue",
      },
    });

    const region = page.getByRole("combobox", { name: "Region" });
    await expect.element(region).toHaveValue("North America");
    await expect
      .element(page.getByText("Ignored from link: foo."))
      .toBeVisible();
    expect(footerStatus()).toMatchSnapshot();
    expect(calls.runWidget).not.toHaveBeenCalled();

    await region.click();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.runWidget.mock.calls.length).toBe(1);
    expect(calls.runWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { period: "lastQuarter", region: "North America" },
        widgetId: "w-revenue",
      })
    );
  });

  it("closes the pills and the notice with Escape", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherNavigate", {
      view: {
        kind: "widget-args",
        values: { foo: "1" },
        widgetId: "w-revenue",
      },
    });
    await expect
      .element(page.getByText("Ignored from link: foo."))
      .toBeVisible();
    const region = page.getByRole("combobox", { name: "Region" });
    await expect.element(region).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    await expect.element(region).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Escape}");

    await expect.element(search()).toBeVisible();
    await expect
      .element(page.getByText("Ignored from link: foo."))
      .not.toBeInTheDocument();
  });

  it("says when the widget no longer exists", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: { kind: "widget-args", values: { region: "EU" }, widgetId: "gone" },
    });

    await expect
      .element(page.getByText("That widget no longer exists."))
      .toBeVisible();
    expect(footerStatus()).toMatchSnapshot();
    await expect.element(search()).toBeVisible();
  });

  it("waits for widgets that are still loading", async () => {
    const pending = Promise.withResolvers<Widget[]>();
    const { calls } = setup({ widgets: () => pending.promise });
    renderLauncher();
    await expect.element(search()).toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: {
        kind: "widget-args",
        values: { region: "Asia Pacific" },
        widgetId: "w-revenue",
      },
    });
    await expect.element(search()).toBeVisible();
    expect(page.getByText("That widget no longer exists.").query()).toBeNull();

    pending.resolve([makeWidget()]);
    await expect
      .element(page.getByRole("combobox", { name: "Region" }))
      .toHaveValue("Asia Pacific");
    expect(calls.runWidget).not.toHaveBeenCalled();
  });
});

describe("a link notice", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("flashes in the footer and clears itself", async () => {
    setup();
    renderLauncher();
    await expect.element(search()).toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: {
        kind: "notice",
        message: "That link isn't one Conch understands.",
      },
    });

    await expect
      .element(page.getByText("That link isn't one Conch understands."))
      .toBeVisible();
    expect(footerStatus()).toMatchSnapshot();
    await expect
      .poll(
        () => page.getByText("That link isn't one Conch understands.").query(),
        {
          timeout: 4500,
        }
      )
      .toBeNull();
  });

  it("leaves another view for the root", async () => {
    setup();
    renderLauncher();
    emitIpcMessage("launcherNavigate", { view: "settings" });
    await expect
      .element(page.getByRole("heading", { name: "Settings" }))
      .toBeVisible();

    emitIpcMessage("launcherNavigate", {
      view: { kind: "notice", message: "That board no longer exists." },
    });

    await expect.element(search()).toBeVisible();
    await expect
      .element(page.getByText("That board no longer exists."))
      .toBeVisible();
  });
});
