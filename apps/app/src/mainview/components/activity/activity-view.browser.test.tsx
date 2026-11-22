import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { ActionActivityPage } from "@/lib/ipc";

import { makeActivity } from "@/test/action-fixtures";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { ActivityEntryView } from "./activity-entry-view";
import { ActivityView } from "./activity-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const secondsAgo = (seconds: number): string =>
  new Date(Date.now() - seconds * 1000).toISOString();

const POPULATED: ActionActivityPage = {
  activity: [
    makeActivity({ at: secondsAgo(10) }),
    makeActivity({
      actionLabel: "Refund charge",
      at: secondsAgo(20),
      effect: "write",
      executionId: "x2",
      outcome: {
        code: "TOOL_ERROR",
        durationMs: 9,
        message: "Card declined",
        ok: false,
      },
      status: "failed",
      targetName: "Stripe",
    }),
    makeActivity({
      actionLabel: "Open month",
      at: secondsAgo(30),
      effect: "external",
      executionId: "x3",
      targetName: "admin.example.com",
    }),
  ],
  integrity: { archived: 0, entries: 6, ok: true },
};

const setup = (page_: ActionActivityPage) => {
  mockLauncherIpc({ handlers: { listActionActivity: () => page_ } });
  const onOpen = vi.fn();
  renderWithConnections(
    <div data-testid="activity" style={{ height: 476, width: 760 }}>
      <ActivityView onBack={vi.fn()} onOpen={onOpen} />
    </div>
  );
  return { onOpen, screen: page.getByTestId("activity") };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("activityView with %s", (_label, isReduced) => {
  it("lists runs by day with a verified log", async () => {
    reduced.value = isReduced;
    const { screen } = setup(POPULATED);
    await expect.element(screen.getByText("Log verified")).toBeVisible();
    await expect.element(screen.getByText("Today")).toBeVisible();
    await expect.element(screen.getByRole("option")).toHaveLength(3);
    expect(screen.element()).toMatchSnapshot();
  });
});

describe("activityView", () => {
  it("shows the empty state", async () => {
    reduced.value = false;
    const { screen } = setup({
      activity: [],
      integrity: { archived: 0, entries: 0, ok: true },
    });
    await expect
      .element(
        screen.getByText(
          "No actions yet. Writes and links you run appear here."
        )
      )
      .toBeVisible();
    expect(screen.element()).toMatchSnapshot();
  });

  it("names the first broken link of the chain", async () => {
    const { screen } = setup({
      ...POPULATED,
      integrity: { archived: 0, brokenAt: 3, entries: 6, ok: false },
    });
    await expect
      .element(screen.getByText("Log broken at entry 4"))
      .toHaveClass("text-danger-ink");
    expect(screen.element()).toMatchSnapshot();
  });

  it("filters on label and target and opens an entry", async () => {
    const { onOpen, screen } = setup(POPULATED);
    await screen
      .getByRole("textbox", { name: "Filter activity" })
      .fill("stripe");
    await expect.element(screen.getByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("x2");
  });
});

describe("activityEntryView", () => {
  it("shows the compiled call, values, outcome and duration", async () => {
    reduced.value = false;
    mockLauncherIpc({ handlers: { listActionActivity: () => POPULATED } });
    renderWithConnections(
      <div data-testid="entry" style={{ height: 560, width: 760 }}>
        <ActivityEntryView executionId="x1" onBack={vi.fn()} />
      </div>
    );
    const screen = page.getByTestId("entry");
    await expect.element(screen.getByText("1 row changed")).toBeVisible();
    await expect.element(screen.getByText("42 ms")).toBeVisible();
    await expect
      .element(screen.getByRole("region", { name: "Statement" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("table", { name: "Bound values" }))
      .toBeVisible();
  });

  it("says when the entry is gone", async () => {
    mockLauncherIpc({ handlers: { listActionActivity: () => POPULATED } });
    renderWithConnections(
      <ActivityEntryView executionId="gone" onBack={vi.fn()} />
    );
    await expect
      .element(page.getByText("This entry is no longer in the log."))
      .toBeVisible();
  });
});
