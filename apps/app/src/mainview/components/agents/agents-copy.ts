import type { McpAuditEntry, RedactedMcpSettings } from "@/lib/ipc";

import { formatCount, formatDuration } from "@/lib/format-metrics";

const CLIENT_LABELS: Readonly<Record<string, string>> = {
  "claude-ai": "Claude Desktop",
  "claude-code": "Claude Code",
  cursor: "Cursor",
  "cursor-vscode": "Cursor",
};

export const clientLabel = (name: string): string =>
  CLIENT_LABELS[name.toLowerCase()] ?? (name.trim() || "Unknown client");

const joinNames = (names: readonly string[]): string => {
  if (names.length <= 2) {
    return names.join(" and ");
  }
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

export const agentsStatusLine = (
  settings: RedactedMcpSettings,
  saving: boolean
): string => {
  if (!settings.enabled) {
    return saving ? "Turning off…" : "Off";
  }
  if (settings.startError) {
    return "Couldn't start";
  }
  if (!settings.listening) {
    return "Starting…";
  }
  const names = [
    ...new Set(settings.clients.map((client) => clientLabel(client.name))),
  ];
  return names.length > 0
    ? `Listening · ${joinNames(names)} connected`
    : "Listening";
};

export const agentsSummary = (
  settings: RedactedMcpSettings,
  exposedCount: number
): string => {
  if (!settings.enabled) {
    return "Off";
  }
  return exposedCount === 1
    ? "On · 1 connection"
    : `On · ${exposedCount} connections`;
};

const OUTCOME_LABELS: Record<McpAuditEntry["outcome"], string> = {
  cancelled: "cancelled",
  denied: "denied",
  error: "failed",
  limited: "limited",
  ok: "ok",
};

export const isQuietOutcome = (outcome: McpAuditEntry["outcome"]): boolean =>
  outcome === "ok" || outcome === "cancelled";

const resultPart = (entry: McpAuditEntry): string | null => {
  if (entry.outcome !== "ok") {
    return OUTCOME_LABELS[entry.outcome];
  }
  if (entry.rowCount === null) {
    return null;
  }
  return entry.rowCount === 1 ? "1 row" : `${formatCount(entry.rowCount)} rows`;
};

const isPresent = (part: string | null): part is string =>
  part !== null && part.length > 0;

export const auditTime = (at: string): string =>
  new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export const auditLine = (
  entry: McpAuditEntry,
  connectionName: string | null
): string =>
  [
    auditTime(entry.at),
    clientLabel(entry.client.name),
    entry.tool,
    connectionName,
    resultPart(entry),
    formatDuration(entry.durationMs),
  ]
    .filter(isPresent)
    .join(" · ");
