import type { DatabaseConnection } from "@conch/core";
import type { HttpEndpointConfig } from "@conch/rpc";

import { DbError } from "@conch/core";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedCall } from "./action-executor.ts";

import { clippedResponse, createActionExecutor } from "./action-executor.ts";

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const connection = { id: "pg", name: "analytics" } as DatabaseConnection;
const endpoint = {
  auth: { kind: "none" },
  baseUrl: "https://api.example.com",
  createdAt: "",
  id: "e1",
  name: "Support",
  updatedAt: "",
} satisfies HttpEndpointConfig;

const setup = () => {
  const pool = {
    dialect: "postgresql" as const,
    execute: vi.fn(),
    executeWrite: vi.fn(() => resolved({ affectedRows: 1 })),
  };
  const opened: string[] = [];
  const deps = {
    callTool: vi.fn(
      (): Promise<unknown> =>
        resolved({
          content: [{ text: '{"refund":"re_1"}', type: "text" }],
        })
    ),
    elapsedMs: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142),
    findConnection: vi.fn(() =>
      resolved<DatabaseConnection | null>(connection)
    ),
    httpEndpoint: vi.fn(() => resolved<HttpEndpointConfig | null>(endpoint)),
    openUrl: vi.fn((url: string) => {
      opened.push(url);
      return Promise.resolve();
    }),
    openWritablePool: vi.fn(() =>
      resolved({ pool: pool as never, schema: "public" })
    ),
    requestJson: vi.fn(() => resolved({ body: { ok: 1 }, status: 201 })),
  };
  return { deps, executor: createActionExecutor(deps), opened, pool };
};

const sqlCall: ResolvedCall = {
  connectionId: "pg",
  database: null,
  kind: "sql",
  maxAffectedRows: 1,
  params: ["shipped", 2],
  statement: "UPDATE orders SET status = $1 WHERE id = $2",
};

const signal = () => new AbortController().signal;

describe("action executor", () => {
  it("runs SQL through the guarded write path with the row limit", async () => {
    const { executor, pool } = setup();
    await expect(executor.run(sqlCall, signal())).resolves.toStrictEqual({
      affectedRows: 1,
      durationMs: 42,
      ok: true,
      summary: "1 row changed",
    });
    expect(pool.executeWrite).toHaveBeenCalledWith(
      sqlCall.statement,
      ["shipped", 2],
      { maxAffectedRows: 1, schema: "public", signal: expect.any(AbortSignal) }
    );
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("reports a rolled-back write as a failed outcome", async () => {
    const { executor, pool } = setup();
    pool.executeWrite.mockRejectedValue(
      new DbError("TOO_MANY_ROWS", "Nothing was changed.")
    );
    await expect(executor.run(sqlCall, signal())).resolves.toMatchObject({
      code: "TOO_MANY_ROWS",
      ok: false,
    });
  });

  it("refuses a pool without guarded writes", async () => {
    const { deps, executor } = setup();
    deps.openWritablePool.mockResolvedValue({
      pool: { dialect: "clickhouse", execute: vi.fn() } as never,
      schema: "default",
    });
    await expect(executor.run(sqlCall, signal())).resolves.toMatchObject({
      code: "WRITES_UNSUPPORTED",
      ok: false,
    });
  });

  it("calls an MCP tool and returns its parsed response", async () => {
    const { deps, executor } = setup();
    const outcome = await executor.run(
      { args: { charge: "ch_1" }, kind: "mcp", serverId: "s", tool: "refund" },
      signal()
    );
    expect(outcome).toMatchObject({
      ok: true,
      response: { refund: "re_1" },
      summary: "refund finished",
    });
    expect(deps.callTool).toHaveBeenCalledWith(
      "s",
      "refund",
      { charge: "ch_1" },
      expect.any(AbortSignal)
    );
  });

  it("reports a tool error", async () => {
    const { deps, executor } = setup();
    deps.callTool.mockResolvedValue({
      content: [{ text: "card declined", type: "text" }],
      isError: true,
    });
    await expect(
      executor.run(
        { args: {}, kind: "mcp", serverId: "s", tool: "refund" },
        signal()
      )
    ).resolves.toMatchObject({
      code: "TOOL_ERROR",
      message: "card declined",
      ok: false,
    });
  });

  it("sends an HTTP request with its body", async () => {
    const { deps, executor } = setup();
    const outcome = await executor.run(
      {
        body: { a: 1 },
        endpointId: "e1",
        kind: "http",
        method: "POST",
        url: "https://api.example.com/x",
      },
      signal()
    );
    expect(outcome).toMatchObject({ ok: true, status: 201 });
    expect(deps.requestJson).toHaveBeenCalledWith(
      endpoint,
      {
        body: { a: 1 },
        method: "POST",
        url: new URL("https://api.example.com/x"),
      },
      expect.any(AbortSignal)
    );
  });

  it("opens a link", async () => {
    const { executor, opened } = setup();
    await expect(
      executor.run({ kind: "open-url", url: "https://a.com/1" }, signal())
    ).resolves.toMatchObject({ ok: true, summary: "Opened in browser" });
    expect(opened).toStrictEqual(["https://a.com/1"]);
  });

  it("reports a missing target", async () => {
    const { deps, executor } = setup();
    deps.findConnection.mockResolvedValue(null);
    await expect(executor.run(sqlCall, signal())).resolves.toMatchObject({
      code: "TARGET_MISSING",
      ok: false,
    });
  });

  it("clips a long response to 16 KB", () => {
    const long = "x".repeat(20_000);
    expect(String(clippedResponse(long))).toHaveLength(16_384);
    expect(clippedResponse(null)).toBeNull();
    expect(clippedResponse({ a: 1 })).toStrictEqual({ a: 1 });
  });
});
