import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { SheetState } from "@/components/actions/action-run-reducer";

import { httpPreview, mcpPreview, sqlPreview } from "@/test/action-fixtures";
import { wait } from "@/test/wait";

import { ConfirmSheet } from "./confirm-sheet";
import { CONFIRM_ENABLE_MS } from "./use-enabled-after";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const renderSheet = (state: SheetState) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const onClosed = vi.fn();
  const screen = render(
    <div style={{ height: 480, position: "relative", width: 760 }}>
      <ConfirmSheet
        onClose={onClose}
        onClosed={onClosed}
        onConfirm={onConfirm}
        state={state}
      />
    </div>
  );
  return { onClose, onClosed, onConfirm, screen };
};

const confirm = (preview = sqlPreview()): SheetState => ({
  phase: "confirm",
  preview,
});

describe.each([
  ["full motion", false, "slide"],
  ["reduced motion", true, "fade"],
])("confirmSheet with %s", (_label, isReduced, motion) => {
  it("is a modal alert that starts on Cancel and slides or fades in", async () => {
    reduced.value = isReduced;
    const { screen } = renderSheet(confirm());
    const dialog = screen.getByRole("alertdialog", { name: "Mark reviewed" });
    await expect.element(dialog).toHaveAttribute("aria-modal", "true");
    await expect
      .element(screen.getByRole("button", { name: /Cancel/ }))
      .toHaveFocus();
    expect(
      dialog.element().querySelector<HTMLElement>("[data-motion]")?.dataset
        .motion
    ).toBe(motion);
  });
});

const failed = (code: string, message: string): SheetState => ({
  failure: { code, message },
  label: "Mark reviewed",
  phase: "failed",
  preview: null,
});
describe("confirmSheet", () => {
  it("names the connection in warning ink with its environment and every bound value", async () => {
    reduced.value = false;
    const { screen } = renderSheet(confirm());
    await expect
      .element(screen.getByText("analytics"))
      .toHaveClass("text-warning-ink");
    await expect.element(screen.getByText("prod")).toBeVisible();
    await expect.element(screen.getByText("· at most 1 row")).toBeVisible();
    const values = screen.getByRole("table", { name: "Bound values" });
    await expect.element(values.getByText("2026-02-01")).toBeVisible();
    await expect.element(values.getByText("row.month")).toBeVisible();
    await expect.element(values.getByText("literal")).toBeVisible();
    await expect
      .element(screen.getByRole("region", { name: "Statement" }))
      .toHaveTextContent("UPDATE revenue SET status = $1 WHERE month = $2");
    expect(screen.container).toMatchSnapshot();
  });

  it("cancels on ↵ from Cancel and never confirms on ↵", async () => {
    const { onClose, onConfirm, screen } = renderSheet(confirm());
    await wait(CONFIRM_ENABLE_MS + 50);
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledOnce();
    screen.getByTestId("confirm-write").element().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignores ⌘↵ for its first 600 ms, then confirms", async () => {
    const { onConfirm } = renderSheet(confirm());
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onConfirm).not.toHaveBeenCalled();
    await wait(CONFIRM_ENABLE_MS + 50);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("confirms on a real click once enabled", async () => {
    const { onConfirm, screen } = renderSheet(confirm());
    const button = screen.getByTestId("confirm-write");
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await wait(CONFIRM_ENABLE_MS + 50);
    await expect.element(button).toHaveAttribute("aria-disabled", "false");
    await button.click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes on Esc and keeps Tab inside", async () => {
    const { onClose, screen } = renderSheet(confirm());
    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    const dialog = screen.getByRole("alertdialog").element();
    expect(dialog.contains(document.activeElement)).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns focus when it closes", () => {
    const { onClosed, screen } = renderSheet(confirm());
    screen.unmount();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("shows an MCP call with its tool and arguments", async () => {
    const { screen } = renderSheet(confirm(mcpPreview()));
    await expect.element(screen.getByText("refund_charge")).toBeVisible();
    await expect
      .element(screen.getByText("Stripe"))
      .toHaveClass("text-warning-ink");
    await expect
      .element(screen.getByRole("region", { name: "Arguments" }))
      .toHaveTextContent('"charge": "ch_3NqK"');
    expect(screen.container).toMatchSnapshot();
  });

  it("shows an HTTP request with its method, address and body", async () => {
    const { screen } = renderSheet(confirm(httpPreview()));
    await expect.element(screen.getByText("POST")).toBeVisible();
    await expect
      .element(screen.getByText("api.example.com/v1/tickets/42/close"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("region", { name: "Body" }))
      .toHaveTextContent('"reason": "resolved"');
    expect(screen.container).toMatchSnapshot();
  });

  it("shows the running state", async () => {
    const { screen } = renderSheet({ phase: "running", preview: sqlPreview() });
    await expect.element(screen.getByText("Running…")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("announces a completed write and copies the outcome with ⌘C", async () => {
    const { screen } = renderSheet({
      outcome: {
        affectedRows: 1,
        durationMs: 42,
        ok: true,
        summary: "1 row changed",
      },
      phase: "outcome",
      preview: sqlPreview(),
    });
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Write completed: 1 row changed");
    await expect
      .element(screen.getByText("1 row changed · 42 ms"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Done/ }))
      .toBeVisible();
    await userEvent.keyboard("{Meta>}c{/Meta}");
    expect(screen.container).toMatchSnapshot();
  });

  const tooMany =
    "The write would change 3 rows; this action allows at most 1. Nothing was changed.";

  it.each<[string, string, SheetState]>([
    [
      "TOO_MANY_ROWS",
      tooMany,
      {
        outcome: {
          code: "TOO_MANY_ROWS",
          durationMs: 3,
          message: tooMany,
          ok: false,
        },
        phase: "outcome",
        preview: sqlPreview(),
      },
    ],
    [
      "RUN_EXPIRED",
      "Run the widget again to act on its rows.",
      failed("RUN_EXPIRED", "Run the widget again to act on its rows."),
    ],
    [
      "WRITES_NOT_ALLOWED",
      "Write actions are off for analytics. Turn on Allow write actions in its settings.",
      failed(
        "WRITES_NOT_ALLOWED",
        "Write actions are off for analytics. Turn on Allow write actions in its settings."
      ),
    ],
    [
      "WRITES_UNSUPPORTED",
      "Write actions aren't available for this database.",
      failed(
        "WRITES_UNSUPPORTED",
        "Write actions aren't available for this database."
      ),
    ],
  ])("explains %s", async (code, message, state) => {
    const { screen } = renderSheet(state);
    await expect.element(screen.getByRole("alert")).toHaveTextContent(message);
    await expect.element(screen.getByText(code)).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
