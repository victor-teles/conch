// @vitest-environment node
import type { HttpEndpointConfig, McpServerConfig, Widget } from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { ConfirmRequest } from "./native-confirm.ts";

import {
  commandLine,
  createSourceSettingsService,
  mergeSecrets,
} from "./source-settings-service.ts";
import { fakeSources, STATUS_ENDPOINT } from "./test-fake-sources.ts";
import { STRIPE_SERVER } from "./test-mcp-fixture.ts";

const NOW = new Date("2026-11-21T10:00:00.000Z");
const SECRETS = [
  "sk_test_fixture_secret_9999",
  "status_secret_4242",
  "sk_new_secret_value_1234",
];

const widgetOn = (id: string, source: Widget["source"]): Widget => ({
  createdAt: "",
  id,
  lastRunAt: null,
  lastValues: {},
  name: `Widget ${id}`,
  params: [],
  prompt: "",
  source,
  spec: {
    formats: {},
    title: id,
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  updatedAt: "",
  version: 2,
  view: "table",
});

const WIDGETS = [
  widgetOn("a", {
    args: {},
    kind: "mcp",
    select: "$",
    serverId: "stripe",
    tool: "greet",
  }),
  widgetOn("b", {
    endpointId: "status",
    kind: "http",
    method: "GET",
    path: "/x",
    query: {},
    select: "$",
  }),
  widgetOn("c", {
    connectionId: "c1",
    database: null,
    dialect: "postgresql",
    kind: "sql",
    sqlTemplate: "select 1",
  }),
];

const COMMANDS = new Map([
  ["npx", "/opt/homebrew/bin/npx"],
  [STRIPE_SERVER.command, STRIPE_SERVER.command],
]);

const setup = (
  options: {
    approve?: boolean;
    servers?: McpServerConfig[];
    endpoints?: HttpEndpointConfig[];
  } = {}
) => {
  const sources = fakeSources({
    endpoints: options.endpoints,
    servers: options.servers,
  });
  const confirmations: ConfirmRequest[] = [];
  const invalidate = vi.spyOn(sources.mcp, "invalidate");
  let clock = 0;
  let ids = 0;
  const service = createSourceSettingsService({
    confirm: (request) => {
      confirmations.push(request);
      return Promise.resolve(options.approve ?? true);
    },
    elapsedMs: () => {
      clock += 43;
      return clock;
    },
    endpoints: sources.endpoints,
    listWidgets: vi.fn().mockResolvedValue(WIDGETS),
    mcp: sources.mcp,
    newId: () => {
      ids += 1;
      return `new-${ids}`;
    },
    now: () => NOW,
    probeHttp: (endpoint) => {
      const status = endpoint.baseUrl.includes("down") ? 503 : 200;
      return Promise.resolve(status);
    },
    resolveCommand: (command) => COMMANDS.get(command) ?? null,
    servers: sources.servers,
  });
  return { confirmations, invalidate, service, sources };
};

const stdioInput = {
  args: ["-y", "@stripe/mcp", "--tools=all"],
  command: "npx",
  env: [{ name: "STRIPE_KEY", value: "sk_new_secret_value_1234" }],
  name: "Stripe",
  transport: "stdio" as const,
};

describe("mCP server settings", () => {
  it("never returns a secret value", async () => {
    const { service } = setup();
    const responses = [
      await service.listMcpServers(),
      await service.saveMcpServer(stdioInput),
      await service.listHttpEndpoints(),
      await service.testMcpServer("stripe"),
      await service.listMcpTools("stripe"),
    ];
    const json = JSON.stringify(responses);
    for (const secret of SECRETS) {
      expect(json).not.toContain(secret);
    }
    expect(responses[0]).toMatchObject([
      {
        env: [{ hasValue: true, hint: "9999", name: "STRIPE_KEY" }],
        id: "stripe",
      },
    ]);
  });

  it("asks the system to confirm a new command line, resolved to an absolute path", async () => {
    const { confirmations, service, sources } = setup();
    const saved = await service.saveMcpServer(stdioInput);
    expect(confirmations).toStrictEqual([
      {
        confirmLabel: "Allow",
        detail: "/opt/homebrew/bin/npx -y @stripe/mcp --tools=all",
        message:
          "Conch will start this command whenever a widget reads from Stripe.",
        title: "Run this MCP server?",
      },
    ]);
    expect(saved).toMatchObject({
      command: "/opt/homebrew/bin/npx",
      id: "new-1",
    });
    expect(sources.servers.items.get("new-1")).toMatchObject({
      createdAt: NOW.toISOString(),
      env: { STRIPE_KEY: "sk_new_secret_value_1234" },
      readTools: [],
    });
  });

  it("saves nothing when the confirmation is declined", async () => {
    const { service, sources } = setup({ approve: false });
    await expect(service.saveMcpServer(stdioInput)).resolves.toBeNull();
    expect([...sources.servers.items.keys()]).toStrictEqual(["stripe"]);
  });

  it("keeps stored secrets and skips the dialog when only the name or env change", async () => {
    const { confirmations, invalidate, service, sources } = setup();
    await service.saveMcpServer({
      args: STRIPE_SERVER.args,
      command: STRIPE_SERVER.command,
      env: [
        { name: "STRIPE_KEY" },
        { name: "STRIPE_ACCOUNT", value: "acct_1" },
      ],
      id: "stripe",
      name: "Stripe (live)",
      transport: "stdio",
    });
    expect(confirmations).toStrictEqual([]);
    expect(sources.servers.items.get("stripe")).toMatchObject({
      env: {
        STRIPE_ACCOUNT: "acct_1",
        STRIPE_KEY: "sk_test_fixture_secret_9999",
      },
      name: "Stripe (live)",
    });
    expect(invalidate).toHaveBeenCalledWith("stripe");
  });

  it("confirms again when the command changes", async () => {
    const { confirmations, service } = setup();
    await service.saveMcpServer({
      args: ["--read-only", "--all"],
      command: STRIPE_SERVER.command,
      env: [{ name: "STRIPE_KEY" }],
      id: "stripe",
      name: "Stripe",
      transport: "stdio",
    });
    expect(confirmations.map((item) => item.detail)).toStrictEqual([
      "/opt/homebrew/bin/stripe-mcp --read-only --all",
    ]);
  });

  it("confirms a remote server's URL", async () => {
    const { confirmations, service } = setup();
    await service.saveMcpServer({
      headers: [{ name: "Authorization", value: "Bearer x" }],
      name: "Linear",
      transport: "http",
      url: "https://mcp.linear.app/mcp",
    });
    expect(confirmations[0]).toMatchObject({
      detail: "https://mcp.linear.app/mcp",
      title: "Connect to this MCP server?",
    });
  });

  it.each([
    [
      { ...stdioInput, command: "not-installed" },
      /Couldn't find not-installed/,
    ],
    [
      { ...stdioInput, env: [{ name: "NEW_KEY" }] },
      /Enter a value for NEW_KEY/,
    ],
    [
      {
        headers: [],
        name: "x",
        transport: "http" as const,
        url: "http://mcp.example.com",
      },
      /https/,
    ],
  ])("rejects invalid input %#", async (input, message) => {
    const { service } = setup();
    await expect(service.saveMcpServer(input)).rejects.toThrow(message);
  });

  it("reports which widgets used a deleted server", async () => {
    const { invalidate, service, sources } = setup();
    await expect(service.deleteMcpServer("stripe")).resolves.toStrictEqual({
      widgetNames: ["Widget a"],
    });
    expect(sources.servers.items.size).toBe(0);
    expect(invalidate).toHaveBeenCalledWith("stripe");
  });
});

describe("treat as read", () => {
  it("needs a native confirmation naming the tool", async () => {
    const { confirmations, service, sources } = setup();
    const server = await service.setMcpToolRead({
      read: true,
      serverId: "stripe",
      tool: "search_customers",
    });
    expect(confirmations[0]).toMatchObject({
      confirmLabel: "Treat as Read",
      title: "Treat “search_customers” as read?",
    });
    expect(confirmations[0]?.detail).toContain("Stripe › search_customers");
    expect(server?.readTools).toStrictEqual(["search_customers"]);
    expect(sources.servers.items.get("stripe")?.readTools).toStrictEqual([
      "search_customers",
    ]);
    const tools = await service.listMcpTools("stripe");
    expect(
      tools.find((tool) => tool.name === "search_customers")
    ).toMatchObject({
      markedRead: true,
      readEligible: true,
      readOnlyHint: null,
    });
  });

  it("changes nothing when declined, and unmarks without asking", async () => {
    const declined = setup({ approve: false });
    await expect(
      declined.service.setMcpToolRead({
        read: true,
        serverId: "stripe",
        tool: "refund_charge",
      })
    ).resolves.toBeNull();
    expect(
      declined.sources.servers.items.get("stripe")?.readTools
    ).toStrictEqual([]);

    const marked = setup({
      servers: [{ ...STRIPE_SERVER, readTools: ["search_customers"] }],
    });
    await marked.service.setMcpToolRead({
      read: false,
      serverId: "stripe",
      tool: "search_customers",
    });
    expect(marked.confirmations).toStrictEqual([]);
    expect(marked.sources.servers.items.get("stripe")?.readTools).toStrictEqual(
      []
    );
  });
});

describe("tests", () => {
  it("counts tools and read tools and remembers the result", async () => {
    const { service } = setup();
    await expect(service.testMcpServer("stripe")).resolves.toStrictEqual({
      latencyMs: 43,
      message: "Connected · 5 tools · 3 read",
      ok: true,
      readToolCount: 3,
      toolCount: 5,
    });
    const [server] = await service.listMcpServers();
    expect(server?.lastTest?.ok).toBeTruthy();
  });

  it("refuses to test a server that no longer exists", async () => {
    const { service } = setup();
    await expect(service.testMcpServer("missing")).rejects.toMatchObject({
      code: "SOURCE_MISSING",
    });
  });

  it("probes an HTTP endpoint's base URL", async () => {
    const { service } = setup({
      endpoints: [
        STATUS_ENDPOINT,
        { ...STATUS_ENDPOINT, baseUrl: "https://down.example.com", id: "down" },
      ],
    });
    await expect(service.testHttpEndpoint("status")).resolves.toMatchObject({
      message: "Connected · 200",
      ok: true,
    });
    await expect(service.testHttpEndpoint("down")).resolves.toMatchObject({
      message: "Status API answered 503.",
      ok: false,
    });
  });
});

describe("hTTP endpoint settings", () => {
  it("keeps the stored header value when the input leaves it out", async () => {
    const { service, sources } = setup();
    const saved = await service.saveHttpEndpoint({
      auth: { kind: "header", name: "Authorization" },
      baseUrl: "https://status.example.com/v2",
      id: "status",
      name: "Status",
    });
    expect(saved.auth).toStrictEqual({
      hasValue: true,
      hint: "4242",
      kind: "header",
      name: "Authorization",
    });
    expect(sources.endpoints.items.get("status")?.auth).toMatchObject({
      value: "Bearer status_secret_4242",
    });
  });

  it("drops the stored header when the endpoint moves to another origin", async () => {
    const { service, sources } = setup();
    await expect(
      service.saveHttpEndpoint({
        auth: { kind: "header", name: "Authorization" },
        baseUrl: "https://collector.attacker.example/v2",
        id: "status",
        name: "Status",
      })
    ).rejects.toThrow(/Enter a value for Authorization/);
    expect(sources.endpoints.items.get("status")?.baseUrl).toBe(
      "https://status.example.com/api"
    );
  });

  it.each([
    [{ kind: "header" as const, name: "X-New" }, /Enter a value for X-New/],
    [
      { kind: "header" as const, name: "Host", value: "x" },
      /sets this header itself/,
    ],
  ])("rejects bad auth %#", async (auth, message) => {
    const { service } = setup();
    await expect(
      service.saveHttpEndpoint({
        auth,
        baseUrl: "https://a.example.com",
        name: "A",
      })
    ).rejects.toThrow(message);
  });

  it("reports which widgets used a deleted endpoint", async () => {
    const { service } = setup();
    await expect(service.deleteHttpEndpoint("status")).resolves.toStrictEqual({
      widgetNames: ["Widget b"],
    });
  });
});

describe("helpers", () => {
  it("quotes command lines the way a shell would read them", () => {
    expect(commandLine("/usr/bin/env", ["node", "my server.js", "it's"])).toBe(
      "/usr/bin/env node 'my server.js' 'it'\\''s'"
    );
  });

  it("refuses a secret listed twice", () => {
    expect(() =>
      mergeSecrets(
        [
          { name: "A", value: "1" },
          { name: "A", value: "2" },
        ],
        {}
      )
    ).toThrow("A is listed twice.");
  });
});
