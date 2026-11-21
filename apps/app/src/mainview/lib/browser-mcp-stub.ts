import type {
  McpActivity,
  McpAuditEntry,
  McpSettingsUpdate,
  RedactedMcpSettings,
} from "@conch/rpc";

import { DEFAULT_MCP_ROW_LIMIT, MCP_SETTINGS_VERSION } from "@conch/rpc";

const PREVIEW_SUFFIXES = ["a1b2", "k7q4", "z9m3", "p2x8"];
const MINUTE_MS = 60_000;

interface McpEmulatorOptions {
  now: () => Date;
  onActivity: (active: McpActivity[]) => void;
}

const minutesAgo = (now: Date, minutes: number): string =>
  new Date(now.getTime() - minutes * MINUTE_MS).toISOString();

const seedAudit = (now: Date): McpAuditEntry[] => {
  const base = {
    client: { name: "claude-code", version: "2.1.0" },
    code: null,
    question: null,
    sql: null,
    widgetId: null,
  };
  return [
    {
      ...base,
      at: minutesAgo(now, 2),
      connectionId: "analytics",
      durationMs: 1240,
      id: "audit-ask",
      outcome: "ok",
      question: "Revenue by region this quarter",
      rowCount: 27,
      sql: "SELECT region, sum(amount) AS revenue FROM orders GROUP BY region",
      tool: "ask",
    },
    {
      ...base,
      at: minutesAgo(now, 9),
      code: "QUERY_FAILED",
      connectionId: "analytics",
      durationMs: 310,
      id: "audit-error",
      outcome: "error",
      rowCount: null,
      tool: "describe_schema",
    },
    {
      ...base,
      at: minutesAgo(now, 14),
      client: { name: "cursor", version: "1.4.2" },
      code: "LIMITED",
      connectionId: null,
      durationMs: 0,
      id: "audit-limited",
      outcome: "limited",
      rowCount: null,
      tool: "list_connections",
    },
  ];
};

const initialSettings = (): RedactedMcpSettings => ({
  clients: [],
  enabled: false,
  exposedConnectionIds: [],
  listening: false,
  rowLimit: DEFAULT_MCP_ROW_LIMIT,
  socketPath: "~/.config/conch/run/mcp.sock",
  startError: null,
  tokenPreview: `conch_…${PREVIEW_SUFFIXES[0]}`,
  version: MCP_SETTINGS_VERSION,
});

export const createMcpEmulator = ({ now, onActivity }: McpEmulatorOptions) => {
  const state = {
    audit: seedAudit(now()),
    rotations: 0,
    settings: initialSettings(),
  };

  Object.defineProperty(globalThis, "__conchEmitMcpActivity", {
    configurable: true,
    value: onActivity,
  });

  return {
    clearMcpAudit: () => {
      state.audit = [];
    },
    copyMcpClientConfig: () => null,
    getMcpSettings: () => state.settings,
    listMcpAudit: ({ limit }: { limit?: number } = {}) =>
      state.audit.slice(0, limit ?? state.audit.length),
    rotateMcpToken: () => {
      state.rotations += 1;
      const suffix =
        PREVIEW_SUFFIXES[state.rotations % PREVIEW_SUFFIXES.length];
      state.settings = {
        ...state.settings,
        clients: [],
        tokenPreview: `conch_…${suffix}`,
      };
      return state.settings;
    },
    saveMcpSettings: (update: McpSettingsUpdate) => {
      const current = state.settings;
      const enabled = update.enabled ?? current.enabled;
      state.settings = {
        ...current,
        clients: enabled ? current.clients : [],
        enabled,
        exposedConnectionIds:
          update.exposedConnectionIds ?? current.exposedConnectionIds,
        listening: enabled,
        rowLimit: update.rowLimit ?? current.rowLimit,
      };
      return state.settings;
    },
  };
};
