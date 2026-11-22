import type { DatabaseConnection } from "@conch/core";
import type { McpAuditEntry, McpOutcome, McpTool } from "@conch/rpc";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { DbError } from "@conch/core";

import type { ActivityStart } from "./activity.ts";
import type { AskLocks, ClientLimits } from "./limits.ts";

import { scrubSecrets, toolText } from "./mcp-policy.ts";

export interface ClientIdentity {
  name: string;
  version: string;
}

export interface CallDeps {
  client(): ClientIdentity;
  limits: ClientLimits;
  askLocks: AskLocks;
  audit(entry: McpAuditEntry): Promise<void>;
  activity: { start(start: ActivityStart): () => void };
  now(): Date;
}

export class ToolError extends Error {
  readonly code: string;
  readonly sql: string | null;

  constructor(code: string, message: string, sql: string | null = null) {
    super(message);
    this.code = code;
    this.sql = sql;
  }
}

export const NOT_FOUND_MESSAGE =
  "No exposed connection or widget matches that name or id. Call list_connections or list_widgets.";

export const notFound = (): ToolError =>
  new ToolError("NOT_FOUND", NOT_FOUND_MESSAGE);

export const ambiguous = (candidates: readonly string[]): ToolError =>
  new ToolError(
    "AMBIGUOUS",
    `More than one match. Use one of these ids: ${candidates.join(", ")}.`
  );

export interface CallAudit {
  connectionId: string | null;
  widgetId: string | null;
  question: string | null;
  sql: string | null;
  rowCount: number | null;
}

export interface CallContext {
  signal: AbortSignal;
  audit: CallAudit;
  target(connection: DatabaseConnection): void;
  askLock(connection: DatabaseConnection): () => void;
}

export interface ToolSuccess {
  connectionName: string | null;
  payload: Record<string, unknown>;
}

const DB_CODES: Record<string, string> = {
  CONNECTION_MISSING: "NOT_FOUND",
  QUERY_CANCELLED: "CANCELLED",
  QUERY_TIMEOUT: "TIMEOUT",
  WIDGET_NOT_FOUND: "NOT_FOUND",
};

const PASSTHROUGH = new Set([
  "INVALID_INPUT",
  "NOT_READ_ONLY",
  "UNSUPPORTED_ENGINE",
  "NO_AI_SETTINGS",
  "AMBIGUOUS",
  "LIMITED",
  "NOT_FOUND",
  "CANCELLED",
  "TIMEOUT",
]);

const toToolError = (error: unknown): ToolError => {
  if (error instanceof ToolError) {
    return error;
  }
  const db = DbError.fromUnknown(error);
  const mapped = DB_CODES[db.code];
  if (mapped) {
    return new ToolError(mapped, db.message);
  }
  return new ToolError(
    PASSTHROUGH.has(db.code) ? db.code : "QUERY_FAILED",
    db.message
  );
};

const abortedCode = (
  client: AbortSignal,
  merged: AbortSignal
): "CANCELLED" | "TIMEOUT" | null => {
  if (client.aborted) {
    return "CANCELLED";
  }
  return merged.aborted ? "TIMEOUT" : null;
};

const ABORT_MESSAGES = {
  CANCELLED: "The call was cancelled.",
  TIMEOUT: "The call took too long and was stopped.",
};

const outcomeOf = (code: string): McpOutcome => {
  switch (code) {
    case "CANCELLED": {
      return "cancelled";
    }
    case "LIMITED": {
      return "limited";
    }
    case "NOT_FOUND":
    case "AMBIGUOUS": {
      return "denied";
    }
    default: {
      return "error";
    }
  }
};

const errorResult = (error: ToolError, message: string): CallToolResult => ({
  content: [
    {
      text: JSON.stringify({
        code: error.code,
        message,
        ...(error.sql ? { sql: error.sql } : {}),
      }),
      type: "text",
    },
  ],
  isError: true,
});

const clip = (text: string | null, max: number): string | null =>
  text === null ? null : text.slice(0, max);

export const LIMITED_MESSAGE =
  "Too many calls at once. Wait a moment and try again.";

const askBusy = (connection: DatabaseConnection): ToolError =>
  new ToolError(
    "LIMITED",
    `Another agent question is running on ${connection.name}. Try again when it finishes.`
  );

export const createToolCalls = (deps: CallDeps) => {
  const record = async (
    tool: McpTool,
    started: number,
    audit: CallAudit,
    outcome: McpOutcome,
    code: string | null
  ): Promise<void> => {
    const at = deps.now();
    try {
      await deps.audit({
        at: at.toISOString(),
        client: {
          name: deps.client().name.slice(0, 100),
          version: deps.client().version.slice(0, 50),
        },
        code,
        connectionId: audit.connectionId,
        durationMs: Math.max(0, at.getTime() - started),
        id: crypto.randomUUID(),
        outcome,
        question: clip(audit.question, 500),
        rowCount: audit.rowCount,
        sql: clip(audit.sql, 4000),
        tool,
        widgetId: audit.widgetId,
      });
    } catch (error) {
      console.error(`[mcp] could not audit ${tool}: ${String(error)}`);
    }
  };

  return async (
    tool: McpTool,
    clientSignal: AbortSignal,
    timeoutMs: number | null,
    body: (context: CallContext) => Promise<ToolSuccess>
  ): Promise<CallToolResult> => {
    const started = deps.now().getTime();
    const audit: CallAudit = {
      connectionId: null,
      question: null,
      rowCount: null,
      sql: null,
      widgetId: null,
    };
    const release = deps.limits.acquire();
    if (!release) {
      await record(tool, started, audit, "limited", "LIMITED");
      return errorResult(new ToolError("LIMITED", ""), LIMITED_MESSAGE);
    }
    const signal =
      timeoutMs === null
        ? clientSignal
        : AbortSignal.any([clientSignal, AbortSignal.timeout(timeoutMs)]);
    const tracked: {
      connection: DatabaseConnection | null;
      end: () => void;
    } = {
      connection: null,
      end: deps.activity.start({
        client: deps.client().name,
        connectionName: null,
        tool,
      }),
    };
    const context: CallContext = {
      askLock(target) {
        const unlock = deps.askLocks.tryLock(target.id);
        if (!unlock) {
          throw askBusy(target);
        }
        return unlock;
      },
      audit,
      signal,
      target(target) {
        if (tracked.connection) {
          return;
        }
        tracked.connection = target;
        audit.connectionId = target.id;
        tracked.end();
        tracked.end = deps.activity.start({
          client: deps.client().name,
          connectionName: target.name,
          tool,
        });
      },
    };
    try {
      const success = await body(context);
      await record(tool, started, audit, "ok", null);
      return {
        content: [
          {
            text: toolText(success.connectionName, success.payload),
            type: "text",
          },
        ],
        structuredContent: success.payload,
      };
    } catch (error) {
      const aborted = abortedCode(clientSignal, signal);
      const failure = aborted
        ? new ToolError(aborted, ABORT_MESSAGES[aborted])
        : toToolError(error);
      audit.sql ??= failure.sql;
      await record(tool, started, audit, outcomeOf(failure.code), failure.code);
      return errorResult(
        failure,
        scrubSecrets(failure.message, tracked.connection)
      );
    } finally {
      tracked.end();
      release();
    }
  };
};

export type RunToolCall = ReturnType<typeof createToolCalls>;
