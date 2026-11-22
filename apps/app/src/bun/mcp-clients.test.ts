// @vitest-environment node
import type { McpServerConfig } from "@conch/rpc";

import { describe, expect, it, vi } from "vitest";

import type { McpConnection } from "./mcp-clients.ts";

import {
  createMcpClientManager,
  MAX_SOURCE_BYTES,
  MCP_IDLE_MS,
  MCP_TOOLS_TTL_MS,
  toolResultJson,
} from "./mcp-clients.ts";
import { createFixtureMcp, STRIPE_SERVER } from "./test-mcp-fixture.ts";
import { wait } from "./test-wait.ts";

const store = (servers: McpServerConfig[] = [STRIPE_SERVER]) => {
  const items = new Map(servers.map((server) => [server.id, server]));
  return {
    get: (id: string) => {
      const settled = items.get(id) ?? null;
      return Promise.resolve(settled);
    },
    items,
  };
};

type TimerHandle = ReturnType<typeof setTimeout>;

// Real handles that never fire on their own; tests fire them by hand.
const manualTimers = () => {
  const pending = new Map<TimerHandle, { run: () => void; ms: number }>();
  return {
    clearTimer: (handle: TimerHandle) => {
      clearTimeout(handle);
      pending.delete(handle);
    },
    fire: () => {
      for (const [handle, timer] of pending) {
        pending.delete(handle);
        clearTimeout(handle);
        timer.run();
      }
    },
    pending,
    setTimer: (run: () => void, ms: number): TimerHandle => {
      const handle = setTimeout(run, 2_147_483_647);
      handle.unref();
      pending.set(handle, { ms, run });
      return handle;
    },
  };
};

const setup = () => {
  const fixture = createFixtureMcp();
  const clock = { now: 0 };
  const timers = manualTimers();
  const servers = store();
  const manager = createMcpClientManager({
    clearTimer: timers.clearTimer,
    connect: fixture.connect,
    now: () => clock.now,
    servers,
    setTimer: timers.setTimer,
  });
  return { clock, fixture, manager, servers, timers };
};

describe("toolResultJson", () => {
  it("prefers structured content", () => {
    expect(
      toolResultJson({
        content: [{ text: "ignored", type: "text" }],
        structuredContent: { data: [1] },
      })
    ).toStrictEqual({ data: [1] });
  });

  it("parses a single JSON text item", () => {
    expect(
      toolResultJson({ content: [{ text: '[{"a":1}]', type: "text" }] })
    ).toStrictEqual([{ a: 1 }]);
  });

  it.each([
    [{ content: [{ text: "Hello there", type: "text" }] }],
    [
      {
        content: [
          { text: "[1]", type: "text" },
          { text: "[2]", type: "text" },
        ],
      },
    ],
    [{ content: [{ data: "aGk=", mimeType: "image/png", type: "image" }] }],
    [{ content: [] }],
  ])("refuses prose and other content %#", (raw) => {
    expect(() => toolResultJson(raw)).toThrow(
      "This tool returned text, not data."
    );
  });

  it("reports tool errors clipped to 300 characters", () => {
    expect(() =>
      toolResultJson({
        content: [{ text: "x".repeat(400), type: "text" }],
        isError: true,
      })
    ).toThrow(/^x{299}…$/);
    expect(() => toolResultJson({ content: [], isError: true })).toThrow(
      "The tool reported an error."
    );
  });

  it("refuses results over 5 MB", () => {
    const huge = { structuredContent: { blob: "x".repeat(MAX_SOURCE_BYTES) } };
    expect(() => toolResultJson(huge)).toThrow(
      "The tool returned more than 5 MB."
    );
  });
});

describe("createMcpClientManager", () => {
  it("lists tools with annotations and caches them for a minute", async () => {
    const { clock, fixture, manager } = setup();
    const tools = await manager.listTools("stripe");
    expect(
      tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint])
    ).toStrictEqual([
      ["list_disputes", true],
      ["refund_charge", false],
      ["search_customers", undefined],
      ["greet", true],
      ["broken", true],
    ]);
    expect(tools[0]).toMatchObject({
      description: "List disputes by status.",
      inputSchema: {
        properties: { status: { type: "string" } },
        type: "object",
      },
      title: null,
    });

    fixture.state.listReadOnly = false;
    manager.invalidate("other");
    await manager.listTools("stripe");
    expect(fixture.connects()).toBe(1);

    clock.now += MCP_TOOLS_TTL_MS;
    manager.invalidate("stripe");
    const fresh = await manager.listTools("stripe");
    expect(fresh[0]?.annotations?.readOnlyHint).toBeFalsy();
    expect(fixture.connects()).toBe(2);
  });

  it("passes arguments through as typed JSON", async () => {
    const { fixture, manager } = setup();
    const raw = await manager.callTool(
      "stripe",
      "list_disputes",
      {
        limit: 5,
        period: { from: "2026-01-01", to: "2026-02-01" },
        status: "won",
      },
      new AbortController().signal
    );
    expect(fixture.calls).toStrictEqual([
      {
        args: {
          limit: 5,
          period: { from: "2026-01-01", to: "2026-02-01" },
          status: "won",
        },
        tool: "list_disputes",
      },
    ]);
    expect(toolResultJson(raw)).toMatchObject({ data: [{ id: "dp_2" }] });
  });

  it("refuses servers that no longer exist", async () => {
    const { manager } = setup();
    await expect(manager.listTools("gone")).rejects.toMatchObject({
      code: "SOURCE_MISSING",
    });
  });

  it("closes idle clients after five minutes and reconnects on demand", async () => {
    const { fixture, manager, timers } = setup();
    await manager.listTools("stripe");
    expect([...timers.pending.values()].map((timer) => timer.ms)).toStrictEqual(
      [MCP_IDLE_MS]
    );
    timers.fire();
    await manager.listTools("stripe");
    expect(fixture.connects()).toBe(2);
    manager.closeAll();
    await manager.listTools("stripe");
    expect(fixture.connects()).toBe(3);
  });

  it("runs at most two calls per server at once", async () => {
    let active = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const connection: McpConnection = {
      callTool: async () => {
        active += 1;
        peak = Math.max(peak, active);
        const release = Promise.withResolvers<void>();
        releases.push(release.resolve);
        await release.promise;
        active -= 1;
        return { structuredContent: {} };
      },
      close: vi.fn().mockResolvedValue(null),
      listTools: () => {
        const settled: unknown[] = [];
        return Promise.resolve(settled);
      },
    };
    const timers = manualTimers();
    const manager = createMcpClientManager({
      clearTimer: timers.clearTimer,
      connect: vi.fn().mockResolvedValue(connection),
      now: () => 0,
      servers: store(),
      setTimer: timers.setTimer,
    });
    const { signal } = new AbortController();
    const calls = [1, 2, 3, 4].map(() =>
      manager.callTool("stripe", "list_disputes", {}, signal)
    );
    await wait(0);
    expect(active).toBe(2);
    for (let round = 0; round < 4; round += 1) {
      releases.shift()?.();
      await wait(0);
    }
    await Promise.all(calls);
    expect(peak).toBe(2);
  });

  it("retries a server whose connection failed", async () => {
    const fixture = createFixtureMcp();
    const timers = manualTimers();
    const manager = createMcpClientManager({
      clearTimer: timers.clearTimer,
      connect: vi
        .fn<(server: McpServerConfig) => Promise<McpConnection>>()
        .mockRejectedValueOnce(new Error("spawn ENOENT"))
        .mockImplementation(fixture.connect),
      now: () => 0,
      servers: store(),
      setTimer: timers.setTimer,
    });
    await expect(manager.listTools("stripe")).rejects.toMatchObject({
      code: "SOURCE_FAILED",
      message: "Stripe: spawn ENOENT",
    });
    await expect(manager.listTools("stripe")).resolves.toHaveLength(5);
  });
});
