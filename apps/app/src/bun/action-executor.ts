import type {
  BindValue,
  DatabaseConnection,
  GuardedWrite,
  Pool,
} from "@conch/core";
import type {
  ActionOutcome,
  HttpActionMethod,
  HttpEndpointConfig,
} from "@conch/rpc";

import {
  DbError,
  supportsGuardedWrites,
  WRITE_STATEMENT_TIMEOUT_MS,
} from "@conch/core";
import { MAX_ACTION_RESPONSE_CHARS, rowsPhrase } from "@conch/rpc";

import type { JsonReply, JsonRequest } from "./http-fetch.ts";

import { ToolCallResult } from "./mcp-clients.ts";

export const ACTION_TIMEOUT_MS = 30_000;
const SQL_TIMEOUT_MS = WRITE_STATEMENT_TIMEOUT_MS + 5000;
const MAX_ERROR_CHARS = 300;

// The one shape bun runs; it is compiled and hashed at prepare time.
export type ResolvedCall =
  | { kind: "open-url"; url: string }
  | {
      kind: "sql";
      connectionId: string;
      database: string | null;
      statement: string;
      params: BindValue[];
      maxAffectedRows: number;
    }
  | {
      kind: "mcp";
      serverId: string;
      tool: string;
      args: Record<string, unknown>;
    }
  | {
      kind: "http";
      endpointId: string;
      method: HttpActionMethod;
      url: string;
      body: unknown;
    };

export interface WritablePool {
  pool: Pool & GuardedWrite;
  schema: string | null;
}

export interface ActionExecutorDeps {
  openWritablePool(
    connection: DatabaseConnection,
    database: string | null
  ): Promise<WritablePool>;
  findConnection(id: string): Promise<DatabaseConnection | null>;
  callTool(
    serverId: string,
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<unknown>;
  httpEndpoint(id: string): Promise<HttpEndpointConfig | null>;
  requestJson(
    endpoint: HttpEndpointConfig,
    request: JsonRequest,
    signal: AbortSignal
  ): Promise<JsonReply>;
  openUrl(url: string): Promise<void>;
  elapsedMs(): number;
}

export const writesUnavailable = (): DbError =>
  new DbError(
    "WRITES_UNSUPPORTED",
    "Write actions aren't available for this database."
  );

const missing = (what: string): DbError =>
  new DbError("TARGET_MISSING", `${what} no longer exists.`);

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

// The outcome shows at most 16 KB of what came back, as data.
export const clippedResponse = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_ACTION_RESPONSE_CHARS
    ? clip(text, MAX_ACTION_RESPONSE_CHARS)
    : value;
};

const parsedText = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const toolResponse = (raw: unknown): unknown => {
  const result = ToolCallResult.safeParse(raw);
  if (!result.success) {
    return raw;
  }
  if (result.data.structuredContent !== undefined) {
    return result.data.structuredContent;
  }
  const texts = result.data.content.flatMap((item) =>
    item.type === "text" && item.text !== undefined ? [item.text] : []
  );
  return texts.length === 1 ? parsedText(texts[0] ?? "") : texts.join("\n");
};

const toolError = (raw: unknown): string | null => {
  const result = ToolCallResult.safeParse(raw);
  if (!result.data?.isError) {
    return null;
  }
  const text = result.data.content.find((item) => item.type === "text")?.text;
  return clip(text?.trim() || "The tool reported an error.", MAX_ERROR_CHARS);
};

type Success = Omit<Extract<ActionOutcome, { ok: true }>, "durationMs">;

export const createActionExecutor = (deps: ActionExecutorDeps) => {
  const runSql = async (
    call: Extract<ResolvedCall, { kind: "sql" }>,
    signal: AbortSignal
  ): Promise<Success> => {
    const connection = await deps.findConnection(call.connectionId);
    if (!connection) {
      throw missing("This action's connection");
    }
    const { pool, schema } = await deps.openWritablePool(
      connection,
      call.database
    );
    if (!supportsGuardedWrites(pool)) {
      throw writesUnavailable();
    }
    const { affectedRows } = await pool.executeWrite(
      call.statement,
      call.params,
      {
        maxAffectedRows: call.maxAffectedRows,
        schema,
        signal: AbortSignal.any([signal, AbortSignal.timeout(SQL_TIMEOUT_MS)]),
      }
    );
    return {
      affectedRows,
      ok: true,
      summary: `${rowsPhrase(affectedRows)} changed`,
    };
  };

  const runMcp = async (
    call: Extract<ResolvedCall, { kind: "mcp" }>,
    signal: AbortSignal
  ): Promise<Success> => {
    const raw = await deps.callTool(
      call.serverId,
      call.tool,
      call.args,
      signal
    );
    const error = toolError(raw);
    if (error) {
      throw new DbError("TOOL_ERROR", error);
    }
    return {
      ok: true,
      response: clippedResponse(toolResponse(raw)),
      summary: `${call.tool} finished`,
    };
  };

  const runHttp = async (
    call: Extract<ResolvedCall, { kind: "http" }>,
    signal: AbortSignal
  ): Promise<Success> => {
    const endpoint = await deps.httpEndpoint(call.endpointId);
    if (!endpoint) {
      throw missing("This action's endpoint");
    }
    const reply = await deps.requestJson(
      endpoint,
      { body: call.body, method: call.method, url: new URL(call.url) },
      signal
    );
    return {
      ok: true,
      response: clippedResponse(reply.body),
      status: reply.status,
      summary: `${call.method} answered ${reply.status}`,
    };
  };

  const dispatch = async (
    call: ResolvedCall,
    signal: AbortSignal
  ): Promise<Success> => {
    switch (call.kind) {
      case "open-url": {
        await deps.openUrl(call.url);
        return { ok: true, summary: "Opened in browser" };
      }
      case "sql": {
        return await runSql(call, signal);
      }
      case "mcp": {
        return await runMcp(call, signal);
      }
      case "http": {
        return await runHttp(call, signal);
      }
      default: {
        throw new Error(`Unknown call ${call satisfies never}`);
      }
    }
  };

  return {
    async run(call: ResolvedCall, signal: AbortSignal): Promise<ActionOutcome> {
      const started = deps.elapsedMs();
      const duration = () => Math.round(deps.elapsedMs() - started);
      try {
        const outcome = await dispatch(
          call,
          AbortSignal.any([signal, AbortSignal.timeout(ACTION_TIMEOUT_MS)])
        );
        return { ...outcome, durationMs: duration() };
      } catch (error) {
        const failure = DbError.fromUnknown(error, "ACTION_FAILED");
        return {
          code: failure.code,
          durationMs: duration(),
          message: clip(failure.message, MAX_ERROR_CHARS),
          ok: false,
        };
      }
    },
  };
};

export type ActionExecutor = ReturnType<typeof createActionExecutor>;
