import { z } from "zod";

export const MCP_SETTINGS_VERSION = 1;
export const MCP_ROW_LIMITS = [50, 100, 250, 500] as const;
export const DEFAULT_MCP_ROW_LIMIT = 100;
export const MAX_MCP_EXPOSED = 200;

export const McpToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const McpSettings = z.object({
  enabled: z.boolean(),
  exposedConnectionIds: z
    .array(z.string().min(1).max(200))
    .max(MAX_MCP_EXPOSED),
  rowLimit: z.number().int().min(10).max(500),
  token: McpToken,
  version: z.literal(MCP_SETTINGS_VERSION),
});
export type McpSettings = z.infer<typeof McpSettings>;

export const McpSettingsUpdate = z.object({
  enabled: z.boolean().optional(),
  exposedConnectionIds: z
    .array(z.string().min(1).max(200))
    .max(MAX_MCP_EXPOSED)
    .optional(),
  rowLimit: z.number().int().min(10).max(500).optional(),
});
export type McpSettingsUpdate = z.infer<typeof McpSettingsUpdate>;

export interface McpClientInfo {
  name: string;
  version: string;
  connectedAt: string;
}

export type RedactedMcpSettings = Omit<McpSettings, "token"> & {
  tokenPreview: string;
  listening: boolean;
  startError: string | null;
  socketPath: string;
  clients: McpClientInfo[];
};

export const MCP_TOOLS = [
  "list_connections",
  "describe_schema",
  "ask",
  "list_widgets",
  "run_widget",
] as const;
export const McpTool = z.enum(MCP_TOOLS);
export type McpTool = z.infer<typeof McpTool>;

export const MCP_OUTCOMES = [
  "ok",
  "error",
  "denied",
  "cancelled",
  "limited",
] as const;
export type McpOutcome = (typeof MCP_OUTCOMES)[number];

export const McpAuditEntry = z.object({
  at: z.string(),
  client: z.object({ name: z.string().max(100), version: z.string().max(50) }),
  code: z.string().max(60).nullable(),
  connectionId: z.string().nullable(),
  durationMs: z.number().int().min(0),
  id: z.string(),
  outcome: z.enum(MCP_OUTCOMES),
  question: z.string().max(500).nullable(),
  rowCount: z.number().int().min(0).nullable(),
  sql: z.string().max(4000).nullable(),
  tool: McpTool,
  widgetId: z.string().nullable(),
});
export type McpAuditEntry = z.infer<typeof McpAuditEntry>;

export const MAX_MCP_AUDIT_LIST = 1000;

export const ListMcpAuditRequest = z.object({
  limit: z.number().int().min(1).max(MAX_MCP_AUDIT_LIST).optional(),
});

export interface McpActivity {
  id: string;
  client: string;
  tool: McpTool;
  connectionName: string | null;
  startedAt: string;
}

export const MCP_CLIENT_KINDS = ["claude-code", "cursor", "json"] as const;
export const McpClientKind = z.enum(MCP_CLIENT_KINDS);
export type McpClientKind = z.infer<typeof McpClientKind>;

const TOOL_PHRASES: Record<McpTool, { on: string | null; alone: string }> = {
  ask: { alone: "asking a question", on: "asking" },
  describe_schema: { alone: "reading a schema", on: "reading the schema of" },
  list_connections: { alone: "listing connections", on: null },
  list_widgets: { alone: "listing widgets", on: null },
  run_widget: { alone: "running a widget", on: "running a widget on" },
};

export const mcpActivityPhrase = (activity: McpActivity): string => {
  const { on, alone } = TOOL_PHRASES[activity.tool];
  return on && activity.connectionName
    ? `${activity.client} is ${on} ${activity.connectionName}`
    : `${activity.client} is ${alone}`;
};

export const mcpTokenPreview = (token: string): string =>
  `conch_…${token.slice(-4)}`;
