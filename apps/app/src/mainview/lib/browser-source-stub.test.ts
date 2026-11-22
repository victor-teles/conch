import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSourceEmulator,
  STUB_ENDPOINT_NAME,
} from "./browser-source-stub";

const NOW = new Date(2026, 10, 18, 9, 0);

const setup = () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  return createSourceEmulator(() => NOW);
};

const settle = async <T>(promise: Promise<T>): Promise<T> => {
  await vi.runAllTimersAsync();
  return promise;
};

// Real timers, so the rejection is awaited as soon as it is created.
const refuses = async (start: () => Promise<unknown>, code: string) => {
  vi.useRealTimers();
  await expect(start()).rejects.toMatchObject({ code });
};

const STDIO = {
  args: ["-y", "@stripe/mcp"],
  command: "npx",
  env: [{ name: "STRIPE_KEY", value: "sk_test_abcdef123456" }],
  name: "Stripe (stub)",
  transport: "stdio" as const,
};

describe("browser source stub", () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("starts with the status endpoint and stores servers without secret values", () => {
    const stub = setup();
    expect(stub.listHttpEndpoints().map((item) => item.name)).toStrictEqual([
      STUB_ENDPOINT_NAME,
    ]);
    const saved = stub.saveMcpServer({ server: STDIO });
    expect(saved).toMatchObject({
      command: "/opt/homebrew/bin/npx",
      env: [{ hasValue: true, hint: "3456", name: "STRIPE_KEY" }],
    });
    expect(localStorage.getItem("conch-mcp-servers")).not.toContain("sk_test");
    const kept = stub.saveMcpServer({
      server: { ...STDIO, env: [{ name: "STRIPE_KEY" }], id: saved.id },
    });
    expect(kept).toMatchObject({ env: [{ hint: "3456" }] });
  });

  it("tests a server and lists one read tool, one write tool and one unmarked tool", async () => {
    const stub = setup();
    const { id } = stub.saveMcpServer({ server: STDIO });
    await expect(
      settle(stub.testMcpServer({ serverId: id }))
    ).resolves.toMatchObject({
      message: "Connected · 3 tools · 1 read",
      ok: true,
    });
    expect(
      stub
        .listMcpTools({ serverId: id })
        .map((tool) => [tool.name, tool.readEligible])
    ).toStrictEqual([
      ["list_disputes", true],
      ["refund_charge", false],
      ["search_customers", false],
    ]);
    stub.setMcpToolRead({ read: true, serverId: id, tool: "search_customers" });
    expect(stub.listMcpTools({ serverId: id })[2]).toMatchObject({
      markedRead: true,
      readEligible: true,
    });
    expect(stub.listMcpServers()[0]?.lastTest?.ok).toBeTruthy();
  });

  it("proposes and previews disputes by status, refusing write tools", async () => {
    const stub = setup();
    const { id } = stub.saveMcpServer({ server: STDIO });
    const proposal = await settle(
      stub.proposeSourceWidget({
        prompt: "open disputes",
        target: { id, type: "mcp" },
      })
    );
    expect(proposal).toMatchObject({
      draft: { source: { tool: "list_disputes" } },
    });
    const preview = await settle(
      stub.previewSource({
        params: [
          {
            default: "won",
            label: "Status",
            name: "status",
            options: ["won"],
            type: "select",
          },
        ],
        source: {
          args: { status: { $param: "status" } },
          kind: "mcp",
          select: "$.data[*]",
          serverId: id,
          tool: "list_disputes",
        },
        values: {},
      })
    );
    expect(preview.result.rowCount).toBe(1);
    expect(preview.compiled).toMatchObject({
      args: { status: "won" },
      kind: "mcp",
    });
    await expect(
      settle(
        stub.proposeSourceWidget({
          prompt: "refunds",
          target: { id, type: "mcp" },
        })
      )
    ).resolves.toHaveProperty("error");
    await refuses(
      () =>
        stub.run(
          {
            args: {},
            kind: "mcp",
            select: "$",
            serverId: id,
            tool: "refund_charge",
          },
          [],
          {}
        ),
      "TOOL_NOT_READ_ONLY"
    );
  });

  it("runs HTTP GETs under the endpoint and forgets deleted sources", async () => {
    const stub = setup();
    const outcome = await settle(
      stub.run(
        {
          endpointId: "status-stub",
          kind: "http",
          method: "GET",
          path: "/incidents",
          query: { state: "open" },
          select: "$.incidents[*]",
        },
        [],
        {}
      )
    );
    expect(outcome.compiled).toStrictEqual({
      endpoint: STUB_ENDPOINT_NAME,
      kind: "http",
      url: "https://status.example.com/api/incidents?state=open",
    });
    expect(outcome.result.rowCount).toBe(1);
    await expect(
      settle(stub.testHttpEndpoint({ endpointId: "status-stub" }))
    ).resolves.toMatchObject({ ok: true });
    stub.deleteHttpEndpoint({ endpointId: "status-stub" });
    expect(stub.listHttpEndpoints()).toStrictEqual([]);
    await refuses(
      () =>
        stub.proposeSourceWidget({
          prompt: "x",
          target: { id: "gone", type: "http" },
        }),
      "SOURCE_MISSING"
    );
  });

  it("saves endpoints and keeps the stored header", () => {
    const stub = setup();
    const saved = stub.saveHttpEndpoint({
      endpoint: {
        auth: { kind: "header", name: "X-Key", value: "abcdefghijkl9999" },
        baseUrl: "https://a.example.com",
        name: "A",
      },
    });
    expect(saved.auth).toStrictEqual({
      hasValue: true,
      hint: "9999",
      kind: "header",
      name: "X-Key",
    });
    const again = stub.saveHttpEndpoint({
      endpoint: {
        auth: { kind: "header", name: "X-Key" },
        baseUrl: "https://a.example.com",
        id: saved.id,
        name: "A",
      },
    });
    expect(again.auth).toMatchObject({ hint: "9999" });
    expect(
      stub.saveHttpEndpoint({
        endpoint: {
          auth: { kind: "none" },
          baseUrl: "https://b.example.com",
          name: "B",
        },
      }).auth
    ).toStrictEqual({ kind: "none" });
    stub.deleteMcpServer({ serverId: "none" });
  });
});
