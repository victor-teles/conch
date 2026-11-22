import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { isConfirmSheetOpen } from "@/components/actions/confirm-sheet/sheet-presence";
import { CONFIRM_ENABLE_MS } from "@/components/actions/confirm-sheet/use-enabled-after";
import { sqlPreview } from "@/test/action-fixtures";
import { mockIpc } from "@/test/ipc-mock";
import { deskApp } from "@/test/mini-app-fixtures";
import { wait } from "@/test/wait";

import { MiniAppActionView } from "./mini-app-action-view";
import { MiniAppNameView } from "./mini-app-name-view";

const request = {
  actionId: "refund",
  appId: "app-desk",
  context: { rowIndex: 1, runId: "run-1", values: {} },
};

const setup = (prepare: () => unknown) => {
  const calls = {
    discardActionToken: vi.fn(),
    executeAction: vi.fn(() => ({
      affectedRows: 1,
      durationMs: 42,
      ok: true,
      summary: "1 row changed",
    })),
    prepareMiniAppAction: vi.fn(prepare),
  };
  mockIpc(calls);
  const onBack = vi.fn();
  const screen = render(
    <div style={{ height: 520, position: "relative", width: 760 }}>
      <MiniAppActionView onBack={onBack} request={request} />
    </div>
  );
  return { calls, onBack, screen };
};

describe("miniAppActionView", () => {
  it("prepares the staged action once and stops at the confirm sheet for a write", async () => {
    const { calls, screen } = setup(() => sqlPreview());
    const sheet = screen.getByRole("alertdialog", { name: "Mark reviewed" });
    await expect.element(sheet).toBeVisible();
    expect(calls.prepareMiniAppAction).toHaveBeenCalledOnce();
    expect(calls.prepareMiniAppAction).toHaveBeenCalledWith(request);
    expect(calls.executeAction).not.toHaveBeenCalled();
  });

  it("runs the write only on ⌘↵ in the sheet", async () => {
    const { calls, screen } = setup(() => sqlPreview());
    await expect
      .element(screen.getByRole("alertdialog", { name: "Mark reviewed" }))
      .toBeVisible();
    await wait(CONFIRM_ENABLE_MS + 50);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => calls.executeAction.mock.calls.length).toBe(1);
    expect(calls.executeAction.mock.calls[0]).toStrictEqual([
      { token: sqlPreview().token },
    ]);
  });

  it("goes back without running anything when the sheet is cancelled", async () => {
    const { calls, onBack, screen } = setup(() => sqlPreview());
    await expect
      .element(screen.getByRole("alertdialog", { name: "Mark reviewed" }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => onBack.mock.calls.length).toBeGreaterThan(0);
    expect(calls.executeAction).not.toHaveBeenCalled();
  });

  it("holds a link staged from a window until one press in the launcher", async () => {
    const { calls, screen } = setup(() => ({
      ...sqlPreview(),
      compiled: {
        kind: "open-url",
        url: "https://admin.example.com/o/7?tab=refunds",
      },
      effect: "external",
      label: "Open order",
    }));
    const open = screen.getByRole("button", { name: "Open Link ↵" });
    await expect.element(open).toHaveFocus();
    await expect
      .element(
        screen.getByText("https://admin.example.com/o/7?tab=refunds").first()
      )
      .toBeVisible();
    await wait(200);
    expect(calls.executeAction).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.executeAction.mock.calls.length).toBe(1);
  });

  it("drops a held link on Esc without running it", async () => {
    const { calls, onBack, screen } = setup(() => ({
      ...sqlPreview(),
      compiled: { kind: "open-url", url: "https://admin.example.com/o/7" },
      effect: "external",
    }));
    await expect
      .element(screen.getByRole("button", { name: "Open Link ↵" }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledOnce();
    expect(calls.discardActionToken).toHaveBeenCalledOnce();
    expect(calls.executeAction).not.toHaveBeenCalled();
  });

  it("marks its confirm sheet as open for the launcher", async () => {
    const { screen } = setup(() => sqlPreview());
    await expect
      .element(screen.getByRole("alertdialog", { name: "Mark reviewed" }))
      .toBeVisible();
    expect(isConfirmSheetOpen()).toBeTruthy();
    screen.unmount();
    expect(isConfirmSheetOpen()).toBeFalsy();
  });

  it("shows why an action can't be prepared", async () => {
    const { screen } = setup(() => {
      throw Object.assign(new Error("This action no longer exists."), {
        code: "ACTION_NOT_FOUND",
      });
    });
    await expect
      .element(screen.getByText("This action no longer exists.").first())
      .toBeVisible();
  });
});

describe("miniAppNameView", () => {
  it("renames the app without touching its sources or actions", async () => {
    const saveMiniApp = vi.fn((_payload: Record<string, unknown>) =>
      deskApp({ name: "Refunds" })
    );
    mockIpc({ saveMiniApp });
    const onDone = vi.fn();
    const screen = render(
      <MiniAppNameView app={deskApp()} onBack={vi.fn()} onDone={onDone} />
    );
    const field = screen.getByRole("textbox", { name: "Name" });
    await field.fill("Refunds");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => onDone.mock.calls.length).toBe(1);
    expect(saveMiniApp.mock.calls[0]?.[0]).toMatchObject({
      draft: {
        actions: [{ id: "refund" }, { id: "copy-region" }],
        name: "Refunds",
      },
    });
  });
});
