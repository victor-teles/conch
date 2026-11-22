import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { WriteToggleRow } from "./write-toggle-row";

const setup = (answer: boolean) => {
  const { promise, resolve } = Promise.withResolvers<{ allowed: boolean }>();
  const setWriteActionsAllowed = vi.fn(() => promise);
  mockLauncherIpc({
    handlers: { listWritePermissions: () => [], setWriteActionsAllowed },
  });
  renderWithConnections(<WriteToggleRow id="analytics" kind="connection" />);
  return {
    answer: () => resolve({ allowed: answer }),
    setWriteActionsAllowed,
    toggle: page.getByRole("switch", { name: "Allow write actions" }),
  };
};

describe("writeToggleRow", () => {
  it("turns on only after bun's native dialog answers yes", async () => {
    const { answer, setWriteActionsAllowed, toggle } = setup(true);
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    expect(setWriteActionsAllowed).toHaveBeenCalledWith({
      allowed: true,
      id: "analytics",
      kind: "connection",
    });
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    await expect.element(toggle).toHaveAttribute("aria-busy", "true");
    answer();
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("stays off when the dialog is declined", async () => {
    const { answer, toggle } = setup(false);
    await toggle.click();
    answer();
    await expect.element(toggle).toHaveAttribute("aria-busy", "false");
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    await expect
      .element(
        page.getByText(
          "Saved actions can change data here. Every write asks you first."
        )
      )
      .toBeVisible();
  });

  it("reads an enabled permission", async () => {
    mockLauncherIpc({
      handlers: {
        listWritePermissions: () => [{ id: "analytics", kind: "connection" }],
      },
    });
    renderWithConnections(<WriteToggleRow id="analytics" kind="connection" />);
    await expect
      .element(page.getByRole("switch", { name: "Allow write actions" }))
      .toHaveAttribute("aria-checked", "true");
  });
});
