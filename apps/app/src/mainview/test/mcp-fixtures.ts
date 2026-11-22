import type {
  McpActivity,
  McpAuditEntry,
  RedactedMcpSettings,
} from "@/lib/ipc";

export const makeMcpSettings = (
  overrides: Partial<RedactedMcpSettings> = {}
): RedactedMcpSettings => ({
  clients: [],
  enabled: false,
  exposedConnectionIds: [],
  listening: false,
  rowLimit: 100,
  socketPath: "~/.config/conch/run/mcp.sock",
  startError: null,
  tokenPreview: "conch_…a1b2",
  version: 1,
  ...overrides,
});

export const LOCAL_9_41 = new Date(2026, 10, 21, 9, 41).toISOString();

export const makeAuditEntry = (
  overrides: Partial<McpAuditEntry> = {}
): McpAuditEntry => ({
  at: LOCAL_9_41,
  client: { name: "claude-code", version: "2.1.0" },
  code: null,
  connectionId: "conn-analytics",
  durationMs: 1240,
  id: "audit-1",
  outcome: "ok",
  question: "Revenue by region",
  rowCount: 27,
  sql: "SELECT region, sum(amount) FROM orders GROUP BY region",
  tool: "ask",
  widgetId: null,
  ...overrides,
});

export const makeActivity = (
  overrides: Partial<McpActivity> = {}
): McpActivity => ({
  client: "Claude Code",
  connectionName: "analytics",
  id: "call-1",
  startedAt: "2026-11-21T09:41:00.000Z",
  tool: "ask",
  ...overrides,
});
