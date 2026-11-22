import type { McpServerConfig } from "@conch/rpc";

import { DbError } from "@conch/core";
import { z } from "zod";

import type { TimerHandle } from "./widget-scheduler.ts";

export const MCP_CALL_TIMEOUT_MS = 30_000;
export const MCP_TOOLS_TTL_MS = 60_000;
export const MCP_IDLE_MS = 5 * 60_000;
export const MCP_MAX_CONCURRENT = 2;
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_ERROR_CHARS = 300;

const ToolListing = z.object({
  annotations: z
    .object({ readOnlyHint: z.boolean().optional() })
    .nullish()
    .transform((value) => value ?? null),
  description: z
    .string()
    .optional()
    .transform((value) => (value ?? "").slice(0, 2000)),
  inputSchema: z.unknown(),
  name: z.string().min(1).max(128),
  title: z
    .string()
    .nullish()
    .transform((value) => value?.slice(0, 200) ?? null),
});
export type McpToolInfo = z.infer<typeof ToolListing>;

const ContentItem = z.object({ text: z.string().optional(), type: z.string() });

export const ToolCallResult = z.object({
  content: z.array(ContentItem).default([]),
  isError: z.boolean().optional(),
  structuredContent: z.unknown().optional(),
});
export type ToolCallResult = z.infer<typeof ToolCallResult>;

export interface McpConnection {
  listTools(signal: AbortSignal): Promise<unknown[]>;
  callTool(
    tool: string,
    args: Record<string, unknown>,
    options: { signal: AbortSignal; timeoutMs: number }
  ): Promise<unknown>;
  close(): Promise<void>;
}

export type McpConnect = (server: McpServerConfig) => Promise<McpConnection>;

export interface McpClientManagerDeps {
  servers: { get(id: string): Promise<McpServerConfig | null> };
  connect: McpConnect;
  now(): number;
  setTimer(run: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
}

interface Slot {
  connection: Promise<McpConnection>;
  tools: { at: number; list: McpToolInfo[] } | null;
  active: number;
  waiting: (() => void)[];
  idle: TimerHandle | null;
}

export const sourceMissing = (): DbError =>
  new DbError(
    "SOURCE_MISSING",
    "This widget's source no longer exists. Open Sources settings to add it again."
  );

const clipped = (text: string): string =>
  text.length > MAX_ERROR_CHARS
    ? `${text.slice(0, MAX_ERROR_CHARS - 1)}…`
    : text;

export const failedToReach = (name: string, error: unknown): DbError => {
  if (error instanceof DbError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new DbError("SOURCE_FAILED", clipped(`${name}: ${message}`));
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const serializedSize = (value: unknown): number =>
  JSON.stringify(value ?? null).length;

// structuredContent wins; otherwise the tool must answer with exactly one
// text item that parses as JSON, because prose can't become rows.
export const toolResultJson = (raw: unknown): unknown => {
  const result = ToolCallResult.parse(raw);
  if (result.isError) {
    const text = result.content.find((item) => item.type === "text")?.text;
    throw new DbError(
      "SOURCE_FAILED",
      clipped(text?.trim() || "The tool reported an error.")
    );
  }
  if (serializedSize(raw) > MAX_SOURCE_BYTES) {
    throw new DbError("SOURCE_TOO_LARGE", "The tool returned more than 5 MB.");
  }
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }
  const [only, ...rest] = result.content;
  const parsed =
    only?.type === "text" && rest.length === 0 && only.text !== undefined
      ? parseJson(only.text)
      : undefined;
  if (parsed === undefined) {
    throw new DbError("SOURCE_NOT_DATA", "This tool returned text, not data.");
  }
  return parsed;
};

const closeQuietly = async (pending: Promise<McpConnection>): Promise<void> => {
  try {
    const connection = await pending;
    await connection.close();
  } catch (error) {
    console.warn(`[mcp-clients] close failed: ${String(error)}`);
  }
};

export const createMcpClientManager = (deps: McpClientManagerDeps) => {
  const { setTimer, clearTimer } = deps;
  const slots = new Map<string, Slot>();

  const drop = (serverId: string): void => {
    const slot = slots.get(serverId);
    if (!slot) {
      return;
    }
    slots.delete(serverId);
    if (slot.idle) {
      clearTimer(slot.idle);
    }
    closeQuietly(slot.connection);
  };

  const scheduleIdle = (serverId: string, slot: Slot): void => {
    if (slot.idle) {
      clearTimer(slot.idle);
    }
    slot.idle = setTimer(() => {
      if (slots.get(serverId) === slot && slot.active === 0) {
        drop(serverId);
      }
    }, MCP_IDLE_MS);
  };

  const slotFor = async (
    serverId: string
  ): Promise<{ slot: Slot; server: McpServerConfig }> => {
    const server = await deps.servers.get(serverId);
    if (!server) {
      drop(serverId);
      throw sourceMissing();
    }
    let slot = slots.get(serverId);
    if (!slot) {
      const connection = deps.connect(server);
      slot = { active: 0, connection, idle: null, tools: null, waiting: [] };
      slots.set(serverId, slot);
    }
    return { server, slot };
  };

  const withSlot = async <T>(
    serverId: string,
    work: (
      connection: McpConnection,
      slot: Slot,
      server: McpServerConfig
    ) => Promise<T>
  ): Promise<T> => {
    const { slot, server } = await slotFor(serverId);
    while (slot.active >= MCP_MAX_CONCURRENT) {
      const turn = Promise.withResolvers<void>();
      slot.waiting.push(turn.resolve);
      await turn.promise;
    }
    slot.active += 1;
    try {
      const connection = await slot.connection;
      return await work(connection, slot, server);
    } catch (error) {
      if (!(error instanceof DbError)) {
        drop(serverId);
      }
      throw failedToReach(server.name, error);
    } finally {
      slot.active -= 1;
      slot.waiting.shift()?.();
      if (slots.get(serverId) === slot) {
        scheduleIdle(serverId, slot);
      }
    }
  };

  return {
    callTool: (
      serverId: string,
      tool: string,
      args: Record<string, unknown>,
      signal: AbortSignal
    ): Promise<unknown> =>
      withSlot(serverId, (connection) =>
        connection.callTool(tool, args, {
          signal,
          timeoutMs: MCP_CALL_TIMEOUT_MS,
        })
      ),

    closeAll(): void {
      for (const serverId of slots.keys()) {
        drop(serverId);
      }
    },

    invalidate: drop,

    listTools: (serverId: string): Promise<McpToolInfo[]> =>
      withSlot(serverId, async (connection, slot) => {
        if (slot.tools && deps.now() - slot.tools.at < MCP_TOOLS_TTL_MS) {
          return slot.tools.list;
        }
        const raw = await connection.listTools(
          AbortSignal.timeout(MCP_CALL_TIMEOUT_MS)
        );
        const list = raw.flatMap((item) => {
          const parsed = ToolListing.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        });
        slot.tools = { at: deps.now(), list };
        return list;
      }),
  };
};

export type McpClientManager = ReturnType<typeof createMcpClientManager>;
