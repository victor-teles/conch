import { describe, expect, it, vi } from "vitest";

import { createNativeConfirm } from "./native-confirm.ts";

const request = {
  confirmLabel: "Allow",
  detail: "/opt/homebrew/bin/stripe-mcp --read-only",
  message: "Conch will start this command.",
  title: "Run a new MCP server?",
};

const setup = (response: number) => {
  const showMessageBox = vi.fn().mockResolvedValue({ response });
  const modal = { opened: 0 };
  const runModal = <T>(open: () => Promise<T>): Promise<T> => {
    modal.opened += 1;
    return open();
  };
  return {
    confirm: createNativeConfirm({ runModal, showMessageBox }),
    modal,
    showMessageBox,
  };
};

describe("confirmNative", () => {
  it("shows the exact detail with Cancel as the default and escape button", async () => {
    const { confirm, modal, showMessageBox } = setup(1);
    await expect(confirm(request)).resolves.toBeTruthy();
    expect(modal.opened).toBe(1);
    expect(showMessageBox).toHaveBeenCalledWith({
      buttons: ["Cancel", "Allow"],
      cancelId: 0,
      defaultId: 0,
      detail: request.detail,
      message: request.message,
      title: request.title,
      type: "warning",
    });
  });

  it("treats Cancel or a closed dialog as no", async () => {
    await expect(setup(0).confirm(request)).resolves.toBeFalsy();
    await expect(setup(-1).confirm(request)).resolves.toBeFalsy();
  });
});
