import { describe, expect, it, vi } from "vitest";

import type { CommandHandlers } from "@/test/ipc-mock";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeMcpSettings } from "@/test/mcp-fixtures";

import { AgentsSettingRow } from "./agents-setting-row";

const setup = (handlers: CommandHandlers) => {
  mockLauncherIpc({
    connections: [
      makeConnection(),
      makeConnection({ id: "conn-billing", name: "billing" }),
    ],
    handlers,
  });
  const onOpen = vi.fn();
  const screen = renderWithConnections(<AgentsSettingRow onOpen={onOpen} />);
  return { onOpen, screen };
};

describe("agentsSettingRow", () => {
  it("reads off and opens the agents view", async () => {
    const { onOpen, screen } = setup({
      getMcpSettings: () => makeMcpSettings(),
    });

    const button = screen.getByRole("button", { name: "Open Agents (MCP)" });
    await expect.element(button).toHaveTextContent("Off");
    await button.click();

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("counts exposed connections that still exist", async () => {
    const { screen } = setup({
      getMcpSettings: () =>
        makeMcpSettings({
          enabled: true,
          exposedConnectionIds: ["conn-analytics", "conn-billing", "gone"],
        }),
    });

    await expect
      .element(screen.getByRole("button", { name: "Open Agents (MCP)" }))
      .toHaveTextContent("On · 2 connections");
  });

  it("still opens when the settings could not be read", async () => {
    const { screen } = setup({
      getMcpSettings: vi.fn().mockRejectedValue(new Error("Locked")),
    });

    await expect
      .element(screen.getByRole("button", { name: "Open Agents (MCP)" }))
      .toHaveTextContent("Open");
  });
});
