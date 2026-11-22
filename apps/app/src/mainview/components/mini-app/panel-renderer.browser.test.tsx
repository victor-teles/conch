import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { PanelElement } from "@/lib/ipc";

import { chargesRun, deskDraft } from "@/test/mini-app-fixtures";

import type { PanelControls } from "./panel-controls";
import type { RenderedLayout } from "./panel-renderer";

import { ElementBoundary } from "./elements/element-boundary";
import {
  createMiniAppStore,
  dispatchSource,
  setInputs,
} from "./mini-app-state";
import { INERT_CONTROLS, PanelControlsProvider } from "./panel-controls";
import { PanelRenderer } from "./panel-renderer";

const layoutOf = (): RenderedLayout => deskDraft().layout;

const controls = (overrides: Partial<PanelControls> = {}): PanelControls => ({
  ...INERT_CONTROLS,
  actionOf: (id) =>
    id === "copy-region"
      ? { effect: "read", id, label: "Copy region" }
      : { effect: "write", id, label: "Refund" },
  ...overrides,
});

const freshStore = () =>
  createMiniAppStore({ inputs: { region: "EU" }, sources: {} });

const renderPanel = (
  layout: RenderedLayout,
  store = freshStore(),
  panelControls = controls(),
  reducedMotion: "always" | "never" = "never"
) =>
  render(
    <MotionConfig reducedMotion={reducedMotion}>
      <div style={{ width: 960 }}>
        <PanelControlsProvider controls={panelControls}>
          <PanelRenderer layout={layout} store={store} />
        </PanelControlsProvider>
      </div>
    </MotionConfig>
  );

describe("panelRenderer", () => {
  it("walks the layout from its root", async () => {
    const screen = renderPanel(layoutOf());
    await expect
      .element(screen.getByRole("heading", { name: "Refund desk" }))
      .toBeVisible();
    await expect.element(screen.getByText("Only EU charges.")).toBeVisible();
    await expect
      .element(screen.getByRole("article", { name: "Failed charges" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Copy region" }))
      .toBeVisible();
  });

  it("draws nothing without a root and tolerates missing children", async () => {
    const empty = renderPanel({ elements: {}, root: null });
    expect(empty.container.textContent).toBe("");
    const partial: RenderedLayout = {
      elements: {
        main: {
          children: ["title", "later"],
          props: { direction: "vertical", gap: "s" },
          type: "Stack",
        },
        title: { children: [], props: { text: "Soon" }, type: "Heading" },
      },
      root: "main",
    };
    const screen = renderPanel(partial);
    await expect
      .element(screen.getByRole("heading", { name: "Soon" }))
      .toBeVisible();
  });

  it("shows a skeleton titled with the card until its source lands", async () => {
    const store = freshStore();
    const screen = renderPanel(layoutOf(), store);
    const charges = screen.getByRole("article", { name: "Failed charges" });
    await expect.element(charges.getByTestId("ask-skeleton")).toBeVisible();
    dispatchSource(store, "charges", {
      runId: "run-1",
      type: "start",
      values: {},
    });
    dispatchSource(store, "charges", {
      outcome: chargesRun(),
      runId: "run-1",
      type: "success",
    });
    await expect.element(charges.getByText("ch_2")).toBeVisible();
    expect(
      screen
        .getByRole("article", { name: "Matching orders" })
        .getByTestId("ask-skeleton")
        .query()
    ).not.toBeNull();
  });

  it("shows and hides an element as its condition changes", async () => {
    const store = freshStore();
    const screen = renderPanel(layoutOf(), store, controls(), "always");
    await expect.element(screen.getByText("Only EU charges.")).toBeVisible();
    setInputs(store, { region: "US" });
    await expect
      .poll(() => screen.getByText("Only EU charges.").query())
      .toBeNull();
  });

  it("keeps siblings mounted when an element is removed or added", async () => {
    const screen = renderPanel(layoutOf(), freshStore(), controls(), "always");
    const before = screen
      .getByRole("heading", { name: "Refund desk" })
      .element();
    const { note: _note, ...rest } = layoutOf().elements;
    const extra: PanelElement = {
      children: [],
      props: { text: "New part" },
      type: "Note",
    };
    screen.rerender(
      <MotionConfig reducedMotion="always">
        <div style={{ width: 960 }}>
          <PanelControlsProvider controls={controls()}>
            <PanelRenderer
              layout={{
                elements: {
                  ...rest,
                  extra,
                  main: {
                    children: ["title", "grid", "extra", "copy"],
                    props: { direction: "vertical", gap: "m" },
                    type: "Stack",
                  },
                },
                root: "main",
              }}
              store={freshStore()}
            />
          </PanelControlsProvider>
        </div>
      </MotionConfig>
    );
    await expect.element(screen.getByText("New part")).toBeVisible();
    await expect
      .poll(() => screen.getByText("Only EU charges.").query())
      .toBeNull();
    expect(screen.getByRole("heading", { name: "Refund desk" }).element()).toBe(
      before
    );
  });

  it("offers the row's actions once a row is selected, by run and index", async () => {
    const store = freshStore();
    dispatchSource(store, "charges", {
      runId: "run-1",
      type: "start",
      values: {},
    });
    dispatchSource(store, "charges", {
      outcome: chargesRun(),
      runId: "run-1",
      type: "success",
    });
    const runAction = vi.fn();
    const screen = renderPanel(layoutOf(), store, controls({ runAction }));
    const charges = screen.getByRole("article", { name: "Failed charges" });
    await charges.getByText("ch_2").click();
    await charges.getByRole("button", { name: /Refund/u }).click();
    expect(runAction).toHaveBeenCalledWith("refund", {
      rowIndex: 1,
      runId: "run-1",
      source: "charges",
    });
  });

  it("runs an app action from its button, unless actions are locked", async () => {
    const runAction = vi.fn();
    const screen = renderPanel(
      layoutOf(),
      freshStore(),
      controls({ runAction })
    );
    await screen.getByRole("button", { name: "Copy region" }).click();
    expect(runAction).toHaveBeenCalledWith("copy-region", null);

    const locked = vi.fn();
    const preview = renderPanel(
      layoutOf(),
      freshStore(),
      controls({
        actionsLocked: "Save the app to use its actions.",
        runAction: locked,
      })
    );
    const button = preview.getByRole("button", { name: "Copy region" }).last();
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await button.click({ force: true });
    expect(locked).not.toHaveBeenCalled();
  });

  it("marks write actions and shows a failing source inline", async () => {
    const store = freshStore();
    dispatchSource(store, "orders", { runId: "r", type: "start", values: {} });
    dispatchSource(store, "orders", {
      failure: {
        code: "QUERY_FAILED",
        message: "relation orders does not exist",
      },
      runId: "r",
      type: "failure",
    });
    const retry = vi.fn();
    const screen = renderPanel(layoutOf(), store, controls({ retry }));
    const orders = screen.getByRole("article", { name: "Matching orders" });
    await expect
      .element(orders.getByRole("alert"))
      .toHaveTextContent("relation orders does not exist");
    await orders.getByRole("button", { name: "Retry" }).click();
    expect(retry).toHaveBeenCalledWith("orders");
  });

  it("shows a repairing source dimmed with its line", async () => {
    const store = freshStore();
    dispatchSource(store, "orders", { runId: "r", type: "start", values: {} });
    dispatchSource(store, "orders", {
      failure: { code: "REPAIRING", message: "column missing" },
      runId: "r",
      type: "failure",
    });
    const screen = renderPanel(layoutOf(), store);
    await expect.element(screen.getByText("Fixing this query…")).toBeVisible();
  });
});

const loopStack = (children: string[]): PanelElement => ({
  children,
  props: { direction: "vertical", gap: "s" },
  type: "Stack",
});

describe("panelRenderer with a broken spec", () => {
  it("draws an error in place of an element that contains itself", async () => {
    const screen = renderPanel({
      elements: { a: loopStack(["a"]) },
      root: "a",
    });
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("This part couldn’t be shown.");
  });

  it("stops a two-element loop and repeats only once", async () => {
    const screen = renderPanel({
      elements: {
        a: loopStack(["b", "b"]),
        b: loopStack(["a"]),
      },
      root: "a",
    });
    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("alert").all()).toHaveLength(1);
  });

  it("cuts a walk deeper than the panel allows", async () => {
    const elements = {
      a: loopStack(["b"]),
      b: loopStack(["c"]),
      c: loopStack(["d"]),
      d: loopStack(["e"]),
      e: loopStack(["f"]),
      f: loopStack([]),
    };
    const screen = renderPanel({ elements, root: "a" });
    await expect.element(screen.getByText("e", { exact: true })).toBeVisible();
  });
});

function Broken(): never {
  throw new Error("boom");
}

describe("elementBoundary", () => {
  it("contains a failing element and names it", async () => {
    const error = vi.spyOn(console, "error").mockReturnValue();
    const screen = render(
      <div>
        <ElementBoundary elementKey="orders-card">
          <Broken />
        </ElementBoundary>
        <p>Still here</p>
      </div>
    );
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("This part couldn’t be shown.");
    await expect.element(screen.getByText("orders-card")).toBeVisible();
    await expect.element(screen.getByText("Still here")).toBeVisible();
    error.mockRestore();
  });
});
