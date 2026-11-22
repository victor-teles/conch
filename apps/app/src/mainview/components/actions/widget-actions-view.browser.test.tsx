import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { makeListed } from "@/test/action-fixtures";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { WidgetActionsView } from "./widget-actions-view";

const target = { columns: ["month"], context: null, widgetId: "w-revenue" };

describe("widgetActionsView", () => {
  it("edits on ↵ and deletes on a second ⌃X", async () => {
    const listed = [makeListed()];
    const deleteAction = vi.fn(() => {
      listed.pop();
      return null;
    });
    mockLauncherIpc({ handlers: { deleteAction, listActions: () => listed } });
    const onEdit = vi.fn();
    renderWithConnections(
      <WidgetActionsView onBack={vi.fn()} onEdit={onEdit} target={target} />
    );
    const list = page.getByRole("listbox", { name: "Actions" });
    await expect.element(list.getByText("Mark reviewed")).toBeVisible();
    expect(list.element()).toMatchSnapshot();
    list.element().focus();
    await userEvent.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: "a-review", widgetId: "w-revenue" })
    );
    await userEvent.keyboard("{Control>}x{/Control}");
    await expect
      .element(page.getByText("Press ⌃X again to delete"))
      .toBeVisible();
    await userEvent.keyboard("{Control>}x{/Control}");
    expect(deleteAction).toHaveBeenCalledWith({ actionId: "a-review" });
    await expect
      .element(
        page.getByText("No actions yet. Add one from the widget’s ⌘K menu.")
      )
      .toBeVisible();
  });
});
