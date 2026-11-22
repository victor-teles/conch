import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { ActionOutcome, ListedAction } from "@/lib/ipc";

import { WidgetRunView } from "@/components/widgets/widget-run-view";
import { makeListed, sqlPreview } from "@/test/action-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { wait } from "@/test/wait";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { CONFIRM_ENABLE_MS } from "./confirm-sheet/use-enabled-after";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const tableWidget = makeWidget({
  spec: { ...makeWidget().spec, view: { kind: "table" } },
  view: "table",
});

const linkAction = makeListed(
  {
    bind: { month: { column: "month", from: "row" } },
    id: "a-link",
    label: "Open month",
    target: {
      baseUrl: "https://admin.example.com",
      kind: "open-url",
      path: "/months/{{month}}",
      query: {},
    },
  },
  "external"
);

const widgetAction = makeListed(
  { id: "a-widget", label: "Close period", scope: "widget" },
  "write"
);

const setup = (listed: ListedAction[] = [makeListed()]) => {
  const calls = {
    discardActionToken: vi.fn(() => null),
    executeAction: vi.fn(
      (): ActionOutcome => ({
        affectedRows: 1,
        durationMs: 42,
        ok: true,
        summary: "1 row changed",
      })
    ),
    prepareAction: vi.fn(() => sqlPreview()),
  };
  mockLauncherIpc({
    connections: [makeConnection({ id: "analytics", name: "analytics" })],
    handlers: {
      ...calls,
      cancelWidgetRun: () => null,
      listActions: () => listed,
      listWidgets: () => [tableWidget],
      runWidget: () => runResult(),
    },
  });
  renderWithConnections(
    <div data-testid="run-harness" style={{ height: 640, width: 760 }}>
      <WidgetRunView
        initialValues={{}}
        onAddToBoard={vi.fn()}
        onClose={vi.fn()}
        onEditAction={vi.fn()}
        onEditInputs={vi.fn()}
        onManageActions={vi.fn()}
        onOpenSources={vi.fn()}
        onWatch={vi.fn()}
        widgetId={tableWidget.id}
      />
    </div>
  );
  return { calls, screen: page.getByTestId("run-harness") };
};

const rows = (screen: ReturnType<typeof setup>["screen"]) =>
  screen.getByRole("grid", { name: "Result rows" }).getByRole("row");

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("row selection with %s", (_label, isReduced) => {
  it("selects with a click and moves with the arrows", async () => {
    reduced.value = isReduced;
    const { screen } = setup();
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    const body = rows(screen);
    await body.nth(2).click();
    await expect.element(body.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByTestId("row-selection")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(body.nth(3)).toHaveAttribute("aria-selected", "true");
    await expect.element(body.nth(3)).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await expect.element(body.nth(1)).toHaveAttribute("aria-selected", "true");
  });
});

describe("row actions", () => {
  it("lists row actions, the built-in copies, then widget actions", async () => {
    reduced.value = false;
    const { screen } = setup([makeListed(), linkAction, widgetAction]);
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await rows(screen).nth(1).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const menu = screen.getByRole("menu", {
      name: "Actions for Revenue by region",
    });
    await expect.element(menu).toBeVisible();
    const labels = menu
      .getByRole("menuitem")
      .elements()
      .slice(0, 6)
      .map((item) => item.textContent);
    expect(labels).toStrictEqual([
      "Mark reviewedWrites to analytics · at most 1 row",
      "Open monthWrites to analytics · at most 1 row",
      "Copy Value",
      "Copy Row as JSON",
      "Close periodWrites to analytics · at most 1 row",
      "Copy SQL⌘C",
    ]);
    expect(menu.element()).toMatchSnapshot();
  });

  it("shows only widget actions without a selected row", async () => {
    const { screen } = setup([makeListed(), widgetAction]);
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await screen.getByRole("button", { name: "Run" }).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const menu = screen.getByRole("menu");
    await expect
      .element(menu.getByRole("menuitem", { name: /Close period/ }))
      .toBeVisible();
    expect(
      menu.getByRole("menuitem", { name: /Mark reviewed/ }).query()
    ).toBeNull();
  });

  it("opens the row menu on right-click", async () => {
    const { screen } = setup();
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await rows(screen).nth(2).click({ button: "right" });
    await expect
      .element(screen.getByRole("menuitem", { name: /Mark reviewed/ }))
      .toBeVisible();
    await expect
      .element(rows(screen).nth(2))
      .toHaveAttribute("aria-selected", "true");
  });

  it("prepares a write by row reference and runs it only on ⌘↵ with the token", async () => {
    const { calls, screen } = setup();
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await rows(screen).nth(2).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Mark reviewed/ }).click();
    await expect
      .element(screen.getByRole("alertdialog", { name: "Mark reviewed" }))
      .toBeVisible();
    expect(calls.prepareAction).toHaveBeenCalledWith({
      actionId: "a-review",
      context: {
        rowIndex: 1,
        runId: expect.any(String),
        values: { period: "lastQuarter", region: "Europe" },
      },
    });
    await userEvent.keyboard("{Enter}");
    expect(calls.executeAction).not.toHaveBeenCalled();
    await rows(screen).nth(2).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Mark reviewed/ }).click();
    await wait(CONFIRM_ENABLE_MS + 50);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByText("Write completed: 1 row changed"))
      .toBeInTheDocument();
    expect(calls.executeAction).toHaveBeenCalledWith({
      token: "tok0000000000000000001",
    });
    expect(calls.discardActionToken).toHaveBeenCalledWith({
      token: "tok0000000000000000001",
    });
  });

  it("runs a link without a sheet and reports it in the footer", async () => {
    const { calls, screen } = setup([linkAction]);
    calls.prepareAction.mockReturnValue(
      sqlPreview({
        bound: [],
        compiled: { kind: "open-url", url: "https://admin.example.com/x" },
        effect: "external",
      })
    );
    calls.executeAction.mockReturnValue({
      durationMs: 3,
      ok: true,
      summary: "Opened in browser",
    });
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await rows(screen).nth(1).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Open month/ }).click();
    await expect.element(screen.getByText("Opened in browser")).toBeVisible();
    expect(screen.getByRole("alertdialog").query()).toBeNull();
  });

  it("shows why a write can't be prepared", async () => {
    const { calls, screen } = setup();
    calls.prepareAction.mockImplementation(() => {
      throw Object.assign(
        new Error("Run the widget again to act on its rows."),
        {
          code: "RUN_EXPIRED",
        }
      );
    });
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await rows(screen).nth(1).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Mark reviewed/ }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Run the widget again to act on its rows.");
  });
});
