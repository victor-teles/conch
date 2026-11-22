import type { TabularResult } from "@conch/core/client";
import type {
  CardSpec,
  CompiledSource,
  ExternalSource,
  HttpEndpointInput,
  McpServerInput,
  McpToolSummary,
  ParamDef,
  ParamValues,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  RedactedSecret,
  SetMcpToolReadRequest,
  SourcePreviewResult,
  SourceProposal,
  SourceTarget,
  SourceTestResult,
} from "@conch/rpc";

import { bindArgs, buildRequestUrl, toTabular } from "@conch/core/client";
import {
  CARD_SPEC_VERSION,
  isReadEligible,
  paramValueSchema,
  sourceParamProblems,
  toTemplateValue,
} from "@conch/rpc";

const SERVERS_KEY = "conch-mcp-servers";
const ENDPOINTS_KEY = "conch-http-endpoints";
const RUN_MS = 380;
const TEST_MS = 520;
const PROPOSE_MS = 900;

export const STUB_SERVER_NAME = "Stripe (stub)";
export const STUB_ENDPOINT_NAME = "Status API (stub)";

const DISPUTES = [
  {
    amount: 1200,
    created: "2026-11-02T10:00:00Z",
    id: "dp_1A",
    reason: "fraudulent",
    status: "needs_response",
  },
  {
    amount: 840,
    created: "2026-11-05T14:30:00Z",
    id: "dp_1B",
    reason: "product_not_received",
    status: "needs_response",
  },
  {
    amount: 450,
    created: "2026-10-28T09:15:00Z",
    id: "dp_1C",
    reason: "duplicate",
    status: "won",
  },
  {
    amount: 2100,
    created: "2026-10-19T16:45:00Z",
    id: "dp_1D",
    reason: "fraudulent",
    status: "lost",
  },
  {
    amount: 310,
    created: "2026-11-11T08:05:00Z",
    id: "dp_1E",
    reason: "subscription_canceled",
    status: "under_review",
  },
];

const INCIDENTS = [
  {
    component: "API",
    id: 412,
    opened: "2026-11-18T06:12:00Z",
    state: "open",
    title: "Elevated latency",
  },
  {
    component: "Webhooks",
    id: 409,
    opened: "2026-11-14T21:40:00Z",
    state: "resolved",
    title: "Delayed deliveries",
  },
  {
    component: "Dashboard",
    id: 401,
    opened: "2026-11-02T12:00:00Z",
    state: "resolved",
    title: "Login errors",
  },
];

type StubTool = Omit<McpToolSummary, "markedRead" | "readEligible"> & {
  respond: (args: Record<string, unknown>) => unknown;
};

const STUB_TOOLS: StubTool[] = [
  {
    description: "List disputes, newest first. Filter by status.",
    inputSchema: {
      properties: {
        limit: { maximum: 100, type: "number" },
        status: {
          enum: ["needs_response", "under_review", "won", "lost"],
          type: "string",
        },
      },
      type: "object",
    },
    name: "list_disputes",
    readOnlyHint: true,
    respond: ({ status, limit }) => ({
      data: DISPUTES.filter(
        (item) => status === undefined || item.status === status
      ).slice(0, typeof limit === "number" ? limit : 100),
      has_more: false,
    }),
    title: "List disputes",
  },
  {
    description: "Refund a charge, fully or in part.",
    inputSchema: {
      properties: { amount: { type: "number" }, charge: { type: "string" } },
      type: "object",
    },
    name: "refund_charge",
    readOnlyHint: false,
    respond: () => ({ refunded: true }),
    title: "Refund a charge",
  },
  {
    description: "Search customers by email or name.",
    inputSchema: { properties: { query: { type: "string" } }, type: "object" },
    name: "search_customers",
    readOnlyHint: null,
    respond: ({ query }) => [
      { email: `${String(query ?? "ada")}@example.com`, name: "Ada Lovelace" },
    ],
    title: null,
  },
];

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code, name: "DbError" });

const wait = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

const read = <T>(key: string, fallback: T[]): T[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

// The stub keeps only the redacted shape; secret values never reach storage.
const redactRows = (
  rows: readonly { name: string; value?: string }[],
  current: readonly RedactedSecret[]
): RedactedSecret[] =>
  rows.map((row) => {
    const kept = current.find((item) => item.name === row.name);
    if (row.value === undefined && kept) {
      return kept;
    }
    const value = row.value ?? "";
    return {
      hasValue: value.length > 0,
      hint: value.length >= 12 ? value.slice(-4) : null,
      name: row.name,
    };
  });

const redactOne = (
  row: { name: string; value?: string },
  current: readonly RedactedSecret[]
): RedactedSecret =>
  redactRows([row], current)[0] ?? {
    hasValue: false,
    hint: null,
    name: row.name,
  };

const DEFAULT_ENDPOINT: RedactedHttpEndpoint = {
  auth: { hasValue: true, hint: "9f2c", kind: "header", name: "Authorization" },
  baseUrl: "https://status.example.com/api",
  createdAt: "2026-11-01T00:00:00.000Z",
  id: "status-stub",
  lastTest: null,
  name: STUB_ENDPOINT_NAME,
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const inferSpec = (result: TabularResult, prompt: string): CardSpec => {
  const numeric = result.columns.filter(
    (column) => column.typeName === "NUMERIC"
  );
  const [only] = numeric;
  return {
    formats: {},
    title: prompt.trim() || "Source preview",
    version: CARD_SPEC_VERSION,
    view:
      result.rowCount === 1 && numeric.length === 1 && only
        ? { kind: "kpi", value: only.name }
        : { kind: "table" },
  };
};

const valuesFor = (
  params: readonly ParamDef[],
  raw: Record<string, unknown>
): ParamValues =>
  Object.fromEntries(
    params.map((param) => {
      const parsed = paramValueSchema(param).safeParse(
        param.fixed ? param.default : (raw[param.name] ?? param.default)
      );
      if (!parsed.success) {
        throw failure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
        );
      }
      return [param.name, parsed.data];
    })
  );

export const createSourceEmulator = (now: () => Date = () => new Date()) => {
  const servers = () => read<RedactedMcpServer>(SERVERS_KEY, []);
  const endpoints = () =>
    read<RedactedHttpEndpoint>(ENDPOINTS_KEY, [DEFAULT_ENDPOINT]);

  const requireServer = (id: string) => {
    const server = servers().find((item) => item.id === id);
    if (!server) {
      throw failure(
        "SOURCE_MISSING",
        "This widget's source no longer exists. Open Sources settings to add it again."
      );
    }
    return server;
  };
  const requireEndpoint = (id: string) => {
    const endpoint = endpoints().find((item) => item.id === id);
    if (!endpoint) {
      throw failure(
        "SOURCE_MISSING",
        "This widget's source no longer exists. Open Sources settings to add it again."
      );
    }
    return endpoint;
  };

  const toolsOf = (server: RedactedMcpServer): McpToolSummary[] =>
    STUB_TOOLS.map(({ respond: _respond, ...tool }) => ({
      ...tool,
      markedRead: server.readTools.includes(tool.name),
      readEligible: isReadEligible(
        {
          annotations: { readOnlyHint: tool.readOnlyHint ?? undefined },
          name: tool.name,
        },
        server
      ),
    }));

  const updateServer = (
    id: string,
    change: (server: RedactedMcpServer) => RedactedMcpServer
  ) => {
    const next = servers().map((server) =>
      server.id === id ? change(server) : server
    );
    write(SERVERS_KEY, next);
    return next.find((server) => server.id === id) ?? null;
  };
  const updateEndpoint = (
    id: string,
    change: (endpoint: RedactedHttpEndpoint) => RedactedHttpEndpoint
  ) => {
    const next = endpoints().map((endpoint) =>
      endpoint.id === id ? change(endpoint) : endpoint
    );
    write(ENDPOINTS_KEY, next);
    return next.find((endpoint) => endpoint.id === id) ?? null;
  };

  const run = async (
    source: ExternalSource,
    params: readonly ParamDef[],
    values: ParamValues
  ): Promise<{ result: TabularResult; compiled: CompiledSource }> => {
    const bound = Object.fromEntries(
      params.map((param) => [
        param.name,
        toTemplateValue(param, values[param.name] ?? param.default, now()),
      ])
    );
    await wait(RUN_MS);
    if (source.kind === "http") {
      const endpoint = requireEndpoint(source.endpointId);
      const url = buildRequestUrl(
        endpoint.baseUrl,
        source.path,
        source.query,
        bound
      );
      const state = url.searchParams.get("state");
      const json = {
        incidents: INCIDENTS.filter((item) => !state || item.state === state),
      };
      return {
        compiled: {
          endpoint: endpoint.name,
          kind: "http",
          url: url.toString(),
        },
        result: { ...toTabular(json, source.select), executionTimeMs: 212 },
      };
    }
    const server = requireServer(source.serverId);
    const tool = toolsOf(server).find((item) => item.name === source.tool);
    if (!tool) {
      throw failure(
        "TOOL_MISSING",
        `${server.name} no longer has a tool named ${source.tool}.`
      );
    }
    if (!tool.readEligible) {
      throw failure(
        "TOOL_NOT_READ_ONLY",
        "This tool can change data, so it can't feed a widget."
      );
    }
    const args = Object.fromEntries(
      Object.entries(source.args).map(([key, value]) => [
        key,
        bindArgs(value, bound),
      ])
    );
    const json = STUB_TOOLS.find((item) => item.name === tool.name)?.respond(
      args
    );
    return {
      compiled: { args, kind: "mcp", server: server.name, tool: tool.name },
      result: { ...toTabular(json, source.select), executionTimeMs: 164 },
    };
  };

  const proposal = (target: SourceTarget, prompt: string): SourceProposal => {
    if (target.type === "http") {
      requireEndpoint(target.id);
      return {
        draft: {
          params: [
            {
              default: "open",
              label: "State",
              name: "state",
              options: ["open", "resolved"],
              type: "select",
            },
          ],
          source: {
            endpointId: target.id,
            kind: "http",
            method: "GET",
            path: "/incidents",
            query: { state: { $param: "state" } },
            select: "$.incidents[*]",
          },
        },
      };
    }
    requireServer(target.id);
    if (!/dispute/i.test(prompt)) {
      return {
        error:
          "Couldn't find a read tool for that. Pick the tool by hand below.",
      };
    }
    return {
      draft: {
        params: [
          {
            default: "needs_response",
            label: "Status",
            name: "status",
            options: ["needs_response", "under_review", "won", "lost"],
            type: "select",
          },
        ],
        source: {
          args: { limit: 20, status: { $param: "status" } },
          kind: "mcp",
          select: "$.data[*]",
          serverId: target.id,
          tool: "list_disputes",
        },
      },
    };
  };

  return {
    deleteHttpEndpoint: ({ endpointId }: { endpointId: string }) => {
      write(
        ENDPOINTS_KEY,
        endpoints().filter((item) => item.id !== endpointId)
      );
      return { widgetNames: [] };
    },
    deleteMcpServer: ({ serverId }: { serverId: string }) => {
      write(
        SERVERS_KEY,
        servers().filter((item) => item.id !== serverId)
      );
      return { widgetNames: [] };
    },
    listHttpEndpoints: () => endpoints(),
    listMcpServers: () => servers(),
    listMcpTools: ({ serverId }: { serverId: string }) =>
      toolsOf(requireServer(serverId)),

    previewSource: async (request: {
      source: ExternalSource;
      params: ParamDef[];
      values: Record<string, unknown>;
      prompt?: string;
    }): Promise<SourcePreviewResult> => {
      const [problem] = sourceParamProblems({
        params: request.params,
        source: request.source,
      });
      if (problem) {
        throw failure("INVALID_TEMPLATE", problem);
      }
      const values = valuesFor(request.params, request.values);
      const { compiled, result } = await run(
        request.source,
        request.params,
        values
      );
      return {
        compiled,
        result,
        spec: inferSpec(result, request.prompt ?? ""),
        values,
      };
    },

    proposeSourceWidget: async ({
      target,
      prompt,
    }: {
      target: SourceTarget;
      prompt: string;
    }) => {
      await wait(PROPOSE_MS);
      return proposal(target, prompt);
    },

    run,

    saveHttpEndpoint: ({ endpoint }: { endpoint: HttpEndpointInput }) => {
      const stamp = now().toISOString();
      const existing = endpoints().find((item) => item.id === endpoint.id);
      const current = existing?.auth.kind === "header" ? [existing.auth] : [];
      const auth: RedactedHttpEndpoint["auth"] =
        endpoint.auth.kind === "header"
          ? { kind: "header", ...redactOne(endpoint.auth, current) }
          : { kind: "none" };
      const saved: RedactedHttpEndpoint = {
        auth,
        baseUrl: endpoint.baseUrl,
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? crypto.randomUUID(),
        lastTest: null,
        name: endpoint.name,
        updatedAt: stamp,
      };
      write(ENDPOINTS_KEY, [
        ...endpoints().filter((item) => item.id !== saved.id),
        saved,
      ]);
      return saved;
    },

    saveMcpServer: ({ server }: { server: McpServerInput }) => {
      const stamp = now().toISOString();
      const existing = servers().find((item) => item.id === server.id);
      const base = {
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? crypto.randomUUID(),
        lastTest: null,
        name: server.name,
        readTools: existing?.readTools ?? [],
        updatedAt: stamp,
      };
      const saved: RedactedMcpServer =
        server.transport === "stdio"
          ? {
              ...base,
              args: server.args,
              command: server.command.startsWith("/")
                ? server.command
                : `/opt/homebrew/bin/${server.command}`,
              env: redactRows(
                server.env,
                existing?.transport === "stdio" ? existing.env : []
              ),
              transport: "stdio",
            }
          : {
              ...base,
              headers: redactRows(
                server.headers,
                existing?.transport === "http" ? existing.headers : []
              ),
              transport: "http",
              url: server.url,
            };
      write(SERVERS_KEY, [
        ...servers().filter((item) => item.id !== saved.id),
        saved,
      ]);
      return saved;
    },

    setMcpToolRead: ({ serverId, tool, read: marked }: SetMcpToolReadRequest) =>
      updateServer(serverId, (server) => ({
        ...server,
        readTools: marked
          ? [...new Set([...server.readTools, tool])]
          : server.readTools.filter((name) => name !== tool),
      })),

    testHttpEndpoint: async ({
      endpointId,
    }: {
      endpointId: string;
    }): Promise<SourceTestResult> => {
      requireEndpoint(endpointId);
      await wait(TEST_MS);
      const result = { latencyMs: 92, message: "Connected · 200", ok: true };
      updateEndpoint(endpointId, (endpoint) => ({
        ...endpoint,
        lastTest: result,
      }));
      return result;
    },

    testMcpServer: async ({
      serverId,
    }: {
      serverId: string;
    }): Promise<SourceTestResult> => {
      const server = requireServer(serverId);
      await wait(TEST_MS);
      const tools = toolsOf(server);
      const readToolCount = tools.filter((tool) => tool.readEligible).length;
      const result = {
        latencyMs: 86,
        message: `Connected · ${tools.length} tools · ${readToolCount} read`,
        ok: true,
        readToolCount,
        toolCount: tools.length,
      };
      updateServer(serverId, (current) => ({ ...current, lastTest: result }));
      return result;
    },
  };
};

export type SourceEmulator = ReturnType<typeof createSourceEmulator>;
