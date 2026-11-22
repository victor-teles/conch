import type {
  MiniAppGenInput,
  MiniAppGenPorts,
  SourceCatalog,
} from "@conch/agent";
import type { Source } from "@conch/rpc";
import type {
  MiniAppDraft,
  MiniAppGenEvent,
  MiniAppGenEventMessage,
} from "@conch/rpc/mini-app";

import { catalogBlock } from "@conch/agent";
import { MINI_APP_VERSION } from "@conch/rpc/mini-app";
import { describe, expect, it, vi } from "vitest";

import type { CatalogDeps } from "./mini-app-catalog.ts";

import { buildGenerationCatalog } from "./mini-app-catalog.ts";
import {
  createMiniAppGenService,
  KEPT_DRAFTS,
} from "./mini-app-gen-service.ts";
import { wait } from "./test-wait.ts";

const waitFor = async (ready: () => boolean): Promise<void> => {
  for (let tries = 0; tries < 100 && !ready(); tries += 1) {
    await wait(2);
  }
};

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const rejected = (error: Error): Promise<never> => {
  const failure = error;
  return Promise.reject(failure);
};

const draft = (name: string): MiniAppDraft => ({
  actions: [],
  description: "",
  inputOptions: {},
  inputs: [],
  layout: {
    elements: { main: { children: [], props: {}, type: "Grid" } },
    root: "main",
  },
  name,
  prompt: name,
  refresh: "off",
  refreshAfter: {},
  sources: {},
  values: {},
  version: MINI_APP_VERSION,
});

const catalog: SourceCatalog = {
  connection: {
    database: null,
    dialect: "postgresql",
    id: "pg",
    name: "Shop",
    redact: { customPatterns: [], enabled: false },
    schema: { schemas: [] },
  },
  httpEndpoints: [],
  mcpServers: [
    {
      id: "gh",
      name: "GitHub",
      tools: [
        { description: "", inputSchema: {}, name: "list", readOnlyHint: true },
        { description: "", inputSchema: {}, name: "close", readOnlyHint: null },
      ],
    },
  ],
};

const sql = (connectionId: string): Source => ({
  connectionId,
  database: null,
  dialect: "postgresql",
  kind: "sql",
  sqlTemplate: "SELECT 1",
});

const mcp = (tool: string): Source => ({
  args: {},
  kind: "mcp",
  select: "$",
  serverId: "gh",
  tool,
});

const capturedAt = <T>(list: readonly T[], index: number): T => {
  const item = list[index];
  if (item === undefined) {
    throw new Error(`nothing captured at ${index}`);
  }
  return item;
};

interface Captured {
  input: MiniAppGenInput;
  ports: MiniAppGenPorts;
  signal: AbortSignal;
}

const setup = (
  script: (captured: Captured) => AsyncGenerator<MiniAppGenEvent>,
  { model = true }: { model?: boolean } = {}
) => {
  const sent: MiniAppGenEventMessage[] = [];
  const captured: Captured[] = [];
  const runSource = vi.fn(() =>
    resolved({
      columns: [],
      executionTimeMs: 1,
      isTruncated: false,
      resultType: "tabular" as const,
      rowCount: 0,
      rows: [],
    })
  );
  const service = createMiniAppGenService({
    catalogFor: () =>
      resolved({
        actionTargets: { connections: [], httpEndpoints: [], mcpServers: [] },
        catalog,
      }),
    generate: (input, ports, signal) => {
      const entry = { input, ports, signal };
      captured.push(entry);
      return script(entry);
    },
    getApp: (appId) =>
      resolved(
        appId === "app-1"
          ? {
              ...draft("Saved"),
              actions: [],
              createdAt: "",
              id: "app-1",
              lastOpenedAt: null,
              updatedAt: "",
            }
          : null
      ),
    loadModel: () => resolved(model ? "test-model" : null),
    now: () => new Date("2026-11-21T10:00:00Z"),
    runSource,
    send: (message) => sent.push(message),
  });
  return { captured, runSource, sent, service };
};

const request = (genId: string, baseAppId: string | null = null) => ({
  baseAppId,
  connectionId: "pg",
  database: null,
  genId,
  prompt: "refund desk",
});

async function* finishes(name: string): AsyncGenerator<MiniAppGenEvent> {
  yield { detail: "Choosing data…", phase: "plan", type: "phase" };
  yield { draft: draft(name), notes: [], type: "done" };
}

describe("mini-app generation service", () => {
  it("asks for AI settings when no model is set", async () => {
    const env = setup(() => finishes("x"), { model: false });
    env.service.start(request("g1"));
    await waitFor(() => env.sent.length === 1);
    expect(env.sent[0]).toStrictEqual({
      event: {
        code: "NO_AI_SETTINGS",
        message: "Add an AI provider in Settings to build apps.",
        type: "error",
      },
      genId: "g1",
    });
    expect(env.captured).toHaveLength(0);
  });

  it("broadcasts events under the genId and keeps the finished draft", async () => {
    const env = setup(() => finishes("Desk"));
    env.service.start(request("g1"));
    await waitFor(() => env.sent.length === 2);
    expect(env.sent.map((message) => message.genId)).toStrictEqual([
      "g1",
      "g1",
    ]);
    expect(env.service.draftOf("g1")?.name).toBe("Desk");
  });

  it("keeps only the last three drafts", async () => {
    const env = setup(() => finishes("Desk"));
    for (const genId of ["g1", "g2", "g3", "g4"]) {
      env.service.start(request(genId));
      await waitFor(() => env.service.draftOf(genId) !== null);
    }
    expect(KEPT_DRAFTS).toBe(3);
    expect(env.service.draftOf("g1")).toBeNull();
    expect(env.service.draftOf("g4")).not.toBeNull();
  });

  it("starts from the saved app when changing one", async () => {
    const env = setup(() => finishes("Desk"));
    env.service.start(request("g1", "app-1"));
    await waitFor(() => env.captured.length === 1);
    expect(env.captured[0]?.input.base?.name).toBe("Saved");
  });

  it("stops the previous build when another starts, and on cancel", async () => {
    const env = setup(async function* hang({ signal }) {
      yield { detail: "Choosing data…", phase: "plan", type: "phase" };
      const { promise, resolve } = Promise.withResolvers<void>();
      signal.addEventListener("abort", () => resolve(), { once: true });
      await promise;
    });
    env.service.start(request("g1"));
    await waitFor(() => env.captured.length === 1);
    env.service.start(request("g2"));
    await waitFor(() => env.captured.length === 2);
    expect(env.captured[0]?.signal.aborted).toBeTruthy();
    env.service.cancel({ genId: "g2" });
    expect(env.captured[1]?.signal.aborted).toBeTruthy();
  });

  it("runs only read sources from the chosen catalog", async () => {
    const env = setup(() => finishes("Desk"));
    env.service.start(request("g1"));
    await waitFor(() => env.captured.length === 1);
    const { ports } = capturedAt(env.captured, 0);
    const { signal } = new AbortController();
    await ports.runSource(sql("pg"), [], signal);
    await ports.runSource(mcp("list"), [], signal);
    await expect(
      ports.runSource(sql("other"), [], signal)
    ).rejects.toMatchObject({
      code: "NOT_IN_CATALOG",
    });
    await expect(
      ports.runSource(mcp("close"), [], signal)
    ).rejects.toMatchObject({
      code: "NOT_IN_CATALOG",
    });
    expect(env.runSource).toHaveBeenCalledTimes(2);
  });

  it("reports a missing base app as an error", async () => {
    const env = setup(() => finishes("Desk"));
    env.service.start(request("g1", "gone"));
    await waitFor(() => env.sent.length === 1);
    expect(env.sent[0]?.event).toMatchObject({
      message: "This app no longer exists.",
      type: "error",
    });
  });
});

const catalogDeps = (overrides: Partial<CatalogDeps> = {}): CatalogDeps => ({
  findConnection: (id) =>
    resolved(
      id === "pg"
        ? {
            createdAt: "",
            database: "shop",
            host: "h",
            id: "pg",
            lastConnectedAt: null,
            name: "Shop",
            password: "",
            piiRedaction: true,
            pinned: false,
            port: 5432,
            type: "postgresql",
            username: "u",
          }
        : null
    ),
  isAllowed: (kind, id) => resolved(kind === "connection" && id === "pg"),
  listEndpoints: () =>
    resolved([
      {
        auth: { kind: "none" },
        baseUrl: "https://api.example.com",
        createdAt: "",
        id: "api",
        name: "API",
        updatedAt: "",
      },
    ]),
  listServers: () =>
    resolved([
      {
        args: [],
        command: "/bin/gh",
        createdAt: "",
        env: {},
        id: "gh",
        name: "GitHub",
        readTools: [],
        transport: "stdio",
        updatedAt: "",
      },
      {
        args: [],
        command: "/bin/broken",
        createdAt: "",
        env: {},
        id: "broken",
        name: "Broken",
        readTools: [],
        transport: "stdio",
        updatedAt: "",
      },
    ]),
  listTools: (serverId) =>
    serverId === "gh"
      ? resolved([
          {
            annotations: { readOnlyHint: true },
            description: "List issues",
            inputSchema: {},
            name: "list_issues",
            title: null,
          },
        ])
      : rejected(new Error("spawn failed")),
  openSchema: () =>
    resolved({
      database: "public",
      dialect: "postgresql",
      schema: { schemas: [] },
    }),
  ...overrides,
});

describe("buildGenerationCatalog", () => {
  it("lists the connection, readable tools and endpoints with write opt-ins", async () => {
    const error = vi.spyOn(console, "error").mockReturnValue();
    const built = await buildGenerationCatalog(catalogDeps(), {
      connectionId: "pg",
      database: null,
      prompt: "issues",
    });
    expect(built.catalog.connection).toMatchObject({
      id: "pg",
      redact: { customPatterns: [], enabled: true },
    });
    expect(built.catalog.mcpServers).toStrictEqual([
      {
        id: "gh",
        name: "GitHub",
        tools: [
          {
            description: "List issues",
            inputSchema: {},
            name: "list_issues",
            readOnlyHint: true,
          },
        ],
      },
    ]);
    expect(built.actionTargets.connections).toStrictEqual([
      { id: "pg", name: "Shop", writesAllowed: true },
    ]);
    expect(built.actionTargets.httpEndpoints).toStrictEqual([
      { id: "api", name: "API", writesAllowed: false },
    ]);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("leaves out a connection that isn't SQL or doesn't exist", async () => {
    const mongo = await buildGenerationCatalog(
      catalogDeps({
        listServers: () => resolved([]),
        openSchema: () =>
          resolved({
            database: "db",
            dialect: null,
            schema: { schemas: [] },
          }),
      }),
      { connectionId: "pg", database: null, prompt: "x" }
    );
    expect(mongo.catalog.connection).toBeNull();
    const none = await buildGenerationCatalog(
      catalogDeps({ listServers: () => resolved([]) }),
      {
        connectionId: null,
        database: null,
        prompt: "x",
      }
    );
    expect(none.catalog.connection).toBeNull();
    expect(none.actionTargets.connections).toStrictEqual([]);
  });
});

describe("generation catalog secrets", () => {
  it("never carries an endpoint's auth header or URL credentials", async () => {
    const built = await buildGenerationCatalog(
      catalogDeps({
        listEndpoints: () =>
          resolved([
            {
              auth: {
                kind: "header",
                name: "Authorization",
                value: "Bearer sk_live_hidden",
              },
              baseUrl:
                "https://user:pw-hidden@api.example.com/v1?token=tok-hidden#frag",
              createdAt: "",
              id: "api",
              name: "API",
              updatedAt: "",
            },
          ]),
        listServers: () => resolved([]),
      }),
      { connectionId: null, database: null, prompt: "x" }
    );
    const prompt = catalogBlock(built.catalog, built.actionTargets, "x");
    expect(prompt).toContain("https://api.example.com/v1");
    for (const secret of [
      "sk_live_hidden",
      "pw-hidden",
      "tok-hidden",
      "Authorization",
    ]) {
      expect(prompt).not.toContain(secret);
    }
  });
});
