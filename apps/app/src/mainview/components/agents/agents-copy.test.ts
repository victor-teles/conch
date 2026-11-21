import { describe, expect, it } from "vitest";

import { makeAuditEntry, makeMcpSettings } from "@/test/mcp-fixtures";

import {
  agentsStatusLine,
  agentsSummary,
  auditLine,
  clientLabel,
  isQuietOutcome,
} from "./agents-copy";

const client = (name: string) => ({
  connectedAt: "2026-11-21T09:00:00.000Z",
  name,
  version: "1",
});

describe("clientLabel", () => {
  it("names known clients and keeps unknown ones", () => {
    expect(clientLabel("claude-code")).toBe("Claude Code");
    expect(clientLabel("Cursor")).toBe("Cursor");
    expect(clientLabel("zed")).toBe("zed");
    expect(clientLabel(" ")).toBe("Unknown client");
  });
});

describe("agentsStatusLine", () => {
  it("covers off, starting, error and listening", () => {
    expect(agentsStatusLine(makeMcpSettings(), false)).toBe("Off");
    expect(agentsStatusLine(makeMcpSettings(), true)).toBe("Turning off…");
    expect(agentsStatusLine(makeMcpSettings({ enabled: true }), true)).toBe(
      "Starting…"
    );
    expect(
      agentsStatusLine(
        makeMcpSettings({ enabled: true, startError: "socket in use" }),
        false
      )
    ).toBe("Couldn't start");
    expect(
      agentsStatusLine(
        makeMcpSettings({ enabled: true, listening: true }),
        false
      )
    ).toBe("Listening");
  });

  it("names connected clients once each", () => {
    const one = makeMcpSettings({
      clients: [client("claude-code"), client("claude-code")],
      enabled: true,
      listening: true,
    });
    const three = makeMcpSettings({
      clients: [client("claude-code"), client("cursor"), client("zed")],
      enabled: true,
      listening: true,
    });

    expect(agentsStatusLine(one, false)).toBe(
      "Listening · Claude Code connected"
    );
    expect(agentsStatusLine(three, false)).toBe(
      "Listening · Claude Code, Cursor and zed connected"
    );
  });
});

describe("agentsSummary", () => {
  it("reads off or the exposed count", () => {
    expect(agentsSummary(makeMcpSettings(), 3)).toBe("Off");
    const on = makeMcpSettings({ enabled: true });
    expect(agentsSummary(on, 1)).toBe("On · 1 connection");
    expect(agentsSummary(on, 2)).toBe("On · 2 connections");
  });
});

describe("auditLine", () => {
  it("joins time, client, tool, connection, rows and duration", () => {
    expect(auditLine(makeAuditEntry(), "analytics")).toBe(
      "9:41 AM · Claude Code · ask · analytics · 27 rows · 1.2 s"
    );
  });

  it("names the outcome instead of rows when the call did not succeed", () => {
    const entry = makeAuditEntry({
      durationMs: 0,
      outcome: "limited",
      rowCount: null,
      tool: "list_connections",
    });
    expect(auditLine(entry, null)).toBe(
      "9:41 AM · Claude Code · list_connections · limited · 0 ms"
    );
    expect(
      auditLine(makeAuditEntry({ outcome: "error", rowCount: null }), null)
    ).toContain("failed");
    expect(auditLine(makeAuditEntry({ rowCount: 1 }), null)).toContain(
      "1 row ·"
    );
    expect(auditLine(makeAuditEntry({ rowCount: null }), null)).not.toContain(
      "rows"
    );
  });

  it("treats ok and cancelled as quiet outcomes", () => {
    expect(isQuietOutcome("ok")).toBeTruthy();
    expect(isQuietOutcome("cancelled")).toBeTruthy();
    expect(isQuietOutcome("denied")).toBeFalsy();
  });
});
