import type * as NodeOs from "node:os";

import { describe, expect, it, vi } from "vitest";

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => "/fake/home" },
    homedir: () => "/fake/home",
  };
});

const {
  actionsAuditPath,
  actionsPath,
  appDir,
  configPath,
  connectionsPath,
  historyDir,
  historyPath,
  httpEndpointsPath,
  keyPath,
  mcpAuditPath,
  mcpRunDir,
  mcpServersPath,
  mcpSettingsPath,
  tabsPath,
  themesPath,
  writePermissionsPath,
} = await import("./paths.ts");

const ROOT = "/fake/home/.config/conch";

describe("paths", () => {
  it.each([
    ["appDir", () => appDir(), ROOT],
    ["configPath", () => configPath(), `${ROOT}/conch.json`],
    ["connectionsPath", () => connectionsPath(), `${ROOT}/connections.json`],
    ["keyPath", () => keyPath(), `${ROOT}/.key`],
    ["historyDir", () => historyDir(), `${ROOT}/history`],
    ["mcpSettingsPath", () => mcpSettingsPath(), `${ROOT}/mcp.enc`],
    ["mcpAuditPath", () => mcpAuditPath(), `${ROOT}/mcp-audit.enc`],
    ["mcpRunDir", () => mcpRunDir(), `${ROOT}/run`],
    ["actionsPath", () => actionsPath(), `${ROOT}/actions.enc`],
    [
      "writePermissionsPath",
      () => writePermissionsPath(),
      `${ROOT}/write-permissions.enc`,
    ],
    ["actionsAuditPath", () => actionsAuditPath(), `${ROOT}/actions-audit.enc`],
    ["mcpServersPath", () => mcpServersPath(), `${ROOT}/mcp-servers.enc`],
    ["themesPath", () => themesPath(), `${ROOT}/themes.enc`],
    [
      "httpEndpointsPath",
      () => httpEndpointsPath(),
      `${ROOT}/http-endpoints.enc`,
    ],
  ])("%s returns the expected path", (_name, builder, expected) => {
    expect(builder()).toBe(expected);
  });

  it("builds per-connection tabs path", () => {
    expect(tabsPath("conn-1")).toBe(`${ROOT}/tabs/conn-1.json`);
  });

  it("builds per-connection history path", () => {
    expect(historyPath("conn-1")).toBe(`${ROOT}/history/conn-1.jsonl`);
  });
});
