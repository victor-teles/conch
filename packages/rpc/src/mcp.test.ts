import { describe, expect, it } from "vitest";

import type { McpActivity } from "./mcp.ts";

import {
  McpAuditEntry,
  McpSettings,
  McpSettingsUpdate,
  mcpActivityPhrase,
  mcpTokenPreview,
} from "./mcp.ts";

const VALID_TOKEN = `${"a".repeat(39)}b1-_`;

const settings = (overrides: Partial<McpSettings> = {}) => ({
  enabled: false,
  exposedConnectionIds: [],
  rowLimit: 100,
  token: VALID_TOKEN,
  version: 1,
  ...overrides,
});

const entry = (overrides: Partial<McpAuditEntry> = {}) => ({
  at: "2026-11-21T09:41:00.000Z",
  client: { name: "Claude Code", version: "2.1.0" },
  code: null,
  connectionId: "c1",
  durationMs: 1200,
  id: "e1",
  outcome: "ok",
  question: "revenue by region",
  rowCount: 27,
  sql: "SELECT 1",
  tool: "ask",
  widgetId: null,
  ...overrides,
});

describe("mcpSettings", () => {
  it("accepts a 43-character base64url token", () => {
    expect(McpSettings.safeParse(settings()).success).toBeTruthy();
  });

  it.each([
    ["too short", VALID_TOKEN.slice(1)],
    ["too long", `${VALID_TOKEN}a`],
    ["not base64url", `${VALID_TOKEN.slice(1)}+`],
  ])("rejects a token that is %s", (_label, token) => {
    expect(McpSettings.safeParse(settings({ token })).success).toBeFalsy();
  });

  it.each([9, 501, 10.5])("rejects row limit %s", (rowLimit) => {
    expect(McpSettings.safeParse(settings({ rowLimit })).success).toBeFalsy();
  });

  it("rejects another version", () => {
    expect(
      McpSettings.safeParse({ ...settings(), version: 2 }).success
    ).toBeFalsy();
  });

  it("never lets an update carry a token", () => {
    const parsed = McpSettingsUpdate.parse({ enabled: true, token: "x" });
    expect(parsed).toStrictEqual({ enabled: true });
  });
});

describe("mcpAuditEntry", () => {
  it("parses a call record", () => {
    expect(McpAuditEntry.safeParse(entry()).success).toBeTruthy();
  });

  it.each([
    ["an unknown tool", { tool: "query" }],
    ["an unknown outcome", { outcome: "maybe" }],
    ["a negative duration", { durationMs: -1 }],
    ["a long question", { question: "q".repeat(501) }],
  ])("rejects %s", (_label, overrides) => {
    expect(
      McpAuditEntry.safeParse({ ...entry(), ...overrides }).success
    ).toBeFalsy();
  });
});

const activity = (overrides: Partial<McpActivity> = {}): McpActivity => ({
  client: "Claude Code",
  connectionName: "analytics",
  id: "a1",
  startedAt: "2026-11-21T09:41:00.000Z",
  tool: "ask",
  ...overrides,
});

describe("mcpActivityPhrase", () => {
  it("names the client, the tool and the connection", () => {
    expect(mcpActivityPhrase(activity())).toBe(
      "Claude Code is asking analytics"
    );
    expect(mcpActivityPhrase(activity({ tool: "run_widget" }))).toBe(
      "Claude Code is running a widget on analytics"
    );
  });

  it("leaves the connection out of listing calls", () => {
    expect(mcpActivityPhrase(activity({ tool: "list_widgets" }))).toBe(
      "Claude Code is listing widgets"
    );
    expect(
      mcpActivityPhrase(
        activity({ connectionName: null, tool: "describe_schema" })
      )
    ).toBe("Claude Code is reading a schema");
  });
});

describe("mcpTokenPreview", () => {
  it("shows only the last four characters", () => {
    expect(mcpTokenPreview(VALID_TOKEN)).toBe("conch_…b1-_");
  });
});
