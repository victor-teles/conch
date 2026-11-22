// @vitest-environment node
import type { ConnectionPoolManager } from "@conch/drivers";
import type { McpSource, ParamDef, Source } from "@conch/rpc";

import { describe, expect, it } from "vitest";

import type { FakeSourceOptions } from "./test-fake-sources.ts";

import { MCP_TOOLS_TTL_MS } from "./mcp-clients.ts";
import { createSourceRunner, NOT_READ_ONLY_TOOL } from "./source-runner.ts";
import { fakeSources, STATUS_ENDPOINT } from "./test-fake-sources.ts";
import { STRIPE_SERVER } from "./test-mcp-fixture.ts";

const NOW = new Date(2026, 10, 18, 9, 0);

const STATUS: ParamDef = {
  default: "needs_response",
  label: "Status",
  name: "status",
  options: ["needs_response", "won"],
  type: "select",
};

const PERIOD: ParamDef = {
  default: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
};

const LIMIT: ParamDef = {
  default: 10,
  label: "Limit",
  name: "limit",
  type: "number",
};

const mcp = (overrides: Partial<McpSource> = {}): McpSource => ({
  args: {
    limit: { $param: "limit" },
    period: { $param: "period" },
    status: { $param: "status" },
  },
  kind: "mcp",
  select: "$.data[*]",
  serverId: "stripe",
  tool: "list_disputes",
  ...overrides,
});

const setup = (options: FakeSourceOptions = {}) => {
  const sources = fakeSources(options);
  const runner = createSourceRunner({
    fetchJson: sources.fetchJson,
    httpEndpoints: sources.endpoints,
    mcp: sources.mcp,
    mcpServers: sources.servers,
    pools: {} as ConnectionPoolManager,
  });
  const run = (
    source: Source,
    params: ParamDef[] = [STATUS, PERIOD, LIMIT],
    values = {}
  ) =>
    runner.run(
      { now: NOW, params, source, values },
      new AbortController().signal
    );
  return { run, runner, sources };
};

describe("mCP sources", () => {
  it("binds typed values into the call and turns the result into rows", async () => {
    const { run, sources } = setup();
    const { compiled, result } = await run(mcp(), undefined, {
      limit: 5,
      status: "won",
    });

    expect(sources.fixture.calls).toStrictEqual([
      {
        args: {
          limit: 5,
          period: { from: "2026-07-01", to: "2026-10-01" },
          status: "won",
        },
        tool: "list_disputes",
      },
    ]);
    expect(result.rows).toStrictEqual([[450, "dp_2", "won"]]);
    expect(compiled).toStrictEqual({
      args: {
        limit: 5,
        period: { from: "2026-07-01", to: "2026-10-01" },
        status: "won",
      },
      kind: "mcp",
      server: "Stripe",
      tool: "list_disputes",
    });
    expect(JSON.stringify(compiled)).not.toContain("sk_test_fixture_secret");
  });

  it.each(["refund_charge", "search_customers"])(
    "refuses %s because the server doesn't call it read-only",
    async (tool) => {
      const { run, sources } = setup();
      await expect(run(mcp({ args: {}, tool }), [])).rejects.toMatchObject({
        code: "TOOL_NOT_READ_ONLY",
        message: NOT_READ_ONLY_TOOL,
      });
      expect(sources.fixture.calls).toStrictEqual([]);
    }
  );

  it("runs an unannotated tool the user marked Treat as read", async () => {
    const { run } = setup({
      servers: [{ ...STRIPE_SERVER, readTools: ["search_customers"] }],
    });
    const { result } = await run(
      mcp({ args: { q: "ada" }, select: "$[*]", tool: "search_customers" }),
      []
    );
    expect(result.rows).toStrictEqual([["ada@example.com"]]);
  });

  it("refuses the next run once the server stops calling the tool read-only", async () => {
    const { run, sources } = setup();
    await run(mcp());
    sources.fixture.state.listReadOnly = false;
    sources.clock.now += MCP_TOOLS_TTL_MS;
    sources.mcp.invalidate("stripe");
    await expect(run(mcp())).rejects.toMatchObject({
      code: "TOOL_NOT_READ_ONLY",
    });
    expect(sources.fixture.calls).toHaveLength(1);
  });

  it.each([
    [mcp({ serverId: "gone" }), "SOURCE_MISSING"],
    [mcp({ tool: "vanished" }), "TOOL_MISSING"],
    [mcp({ args: {}, tool: "greet" }), "SOURCE_NOT_DATA"],
    [mcp({ args: {}, tool: "broken" }), "SOURCE_FAILED"],
    [mcp({ select: "$.nothing" }), "SOURCE_EMPTY"],
  ])("explains a failing call %#", async (source, code) => {
    const { run } = setup();
    await expect(run(source)).rejects.toMatchObject({ code });
  });

  it("stops when the run is cancelled", async () => {
    const { runner } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runner.run(
        {
          now: NOW,
          params: [STATUS, PERIOD, LIMIT],
          source: mcp(),
          values: {},
        },
        controller.signal
      )
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
  });
});

describe("hTTP sources", () => {
  const http: Source = {
    endpointId: "status",
    kind: "http",
    method: "GET",
    path: "/incidents/{{status}}",
    query: { since: { $param: "period", part: "from" }, state: "open" },
    select: "$.incidents[*]",
  };

  it("builds the URL from typed values and never shows the auth header", async () => {
    const { run, sources } = setup();
    const { compiled, result } = await run(http, [STATUS, PERIOD], {
      status: "won",
    });
    const url =
      "https://status.example.com/api/incidents/won?since=2026-07-01&state=open";
    expect(sources.requests).toStrictEqual([{ endpoint: "Status API", url }]);
    expect(compiled).toStrictEqual({
      endpoint: "Status API",
      kind: "http",
      url,
    });
    expect(JSON.stringify(compiled)).not.toContain("status_secret");
    expect(result.rows).toStrictEqual([[1, "open"]]);
  });

  it("refuses a missing endpoint", async () => {
    const { run } = setup({ endpoints: [] });
    await expect(run(http, [STATUS, PERIOD])).rejects.toMatchObject({
      code: "SOURCE_MISSING",
    });
  });
});

describe("check and proposal targets", () => {
  it("accepts a readable call and refuses a write tool", async () => {
    const { runner } = setup();
    await expect(
      runner.check(mcp(), [STATUS, PERIOD, LIMIT], NOW)
    ).resolves.toBeUndefined();
    await expect(
      runner.check(mcp({ args: {}, tool: "refund_charge" }), [], NOW)
    ).rejects.toMatchObject({ code: "TOOL_NOT_READ_ONLY" });
  });

  it("checks that an HTTP call builds with the defaults", async () => {
    const { runner } = setup();
    await expect(
      runner.check(
        {
          endpointId: "status",
          kind: "http",
          method: "GET",
          path: "/x/{{status}}",
          query: {},
          select: "$",
        },
        [{ ...STATUS, default: "..", options: [".."] }],
        NOW
      )
    ).rejects.toMatchObject({ code: "SOURCE_BAD_URL" });
  });

  it("describes a server's tools with their eligibility", async () => {
    const { runner } = setup();
    const target = await runner.proposalTarget({ id: "stripe", type: "mcp" });
    expect(target).toMatchObject({
      kind: "mcp",
      tools: [
        { name: "list_disputes", readEligible: true },
        { name: "refund_charge", readEligible: false },
        { name: "search_customers", readEligible: false },
        { name: "greet", readEligible: true },
        { name: "broken", readEligible: true },
      ],
    });
    await expect(
      runner.proposalTarget({ id: "status", type: "http" })
    ).resolves.toStrictEqual({
      baseUrl: STATUS_ENDPOINT.baseUrl,
      endpointId: "status",
      kind: "http",
      name: "Status API",
    });
  });
});
