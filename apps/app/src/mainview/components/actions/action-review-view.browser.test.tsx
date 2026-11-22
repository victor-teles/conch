import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { makeListed, sqlPreview } from "@/test/action-fixtures";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { ActionReviewView } from "./action-review-view";

const listed = makeListed();
const draft = {
  bind: listed.action.bind,
  label: listed.action.label,
  scope: listed.action.scope,
  target: listed.action.target,
};

const declined = () =>
  Object.assign(
    new Error("Not saved. The action needs your approval to write."),
    {
      code: "REVIEW_DECLINED",
    }
  );

const setup = (saveAction: () => unknown) => {
  const { token: _token, expiresAt: _expiresAt, ...review } = sqlPreview();
  const calls = {
    reviewAction: vi.fn(() => review),
    saveAction: vi.fn(saveAction),
  };
  mockLauncherIpc({ handlers: calls });
  const onSaved = vi.fn();
  renderWithConnections(
    <div data-testid="review" style={{ height: 560, width: 760 }}>
      <ActionReviewView
        onBack={vi.fn()}
        onSaved={onSaved}
        target={{
          context: { rowIndex: null, runId: "r1", values: {} },
          draft,
          widgetId: "w-revenue",
        }}
      />
    </div>
  );
  return { calls, onSaved, screen: page.getByTestId("review") };
};

describe("actionReviewView", () => {
  it("shows the confirm sheet's body with a sampled row", async () => {
    const { calls, screen } = setup(() => listed);
    await expect
      .element(screen.getByRole("table", { name: "Bound values" }))
      .toBeVisible();
    expect(calls.reviewAction).toHaveBeenCalledWith({
      context: { rowIndex: 0, runId: "r1", values: {} },
      draft,
      widgetId: "w-revenue",
    });
    expect(screen.element()).toMatchSnapshot();
  });

  it("stays open with Not saved when the native review is declined", async () => {
    const { onSaved, screen } = setup(() => {
      throw declined();
    });
    await expect
      .element(screen.getByRole("table", { name: "Bound values" }))
      .toBeVisible();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.element(screen.getByText("Not saved")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("returns to the widget once saved", async () => {
    const { calls, onSaved, screen } = setup(() => listed);
    await expect
      .element(screen.getByRole("table", { name: "Bound values" }))
      .toBeVisible();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => onSaved.mock.calls.length).toBe(1);
    expect(calls.saveAction).toHaveBeenCalledWith({
      draft,
      widgetId: "w-revenue",
    });
  });
});
