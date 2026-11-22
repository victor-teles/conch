import type { DatabaseConnection } from "@conch/core";
import type {
  ActionDraft,
  HttpEndpointConfig,
  McpServerConfig,
  Widget,
  WidgetAction,
} from "@conch/rpc";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedCall } from "./action-executor.ts";
import type { McpToolInfo } from "./mcp-clients.ts";

import { createActionService } from "./action-service.ts";
import { createRunCache } from "./run-cache.ts";

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const SECRET = "Bearer endpoint_secret_9999";

const connection: DatabaseConnection = {
  createdAt: "2026-11-01T00:00:00.000Z",
  database: "shop",
  environment: "production",
  host: "127.0.0.1",
  id: "pg",
  lastConnectedAt: null,
  name: "analytics-prod",
  password: "db-password",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "conch",
};

const server: McpServerConfig = {
  args: [],
  command: "/usr/bin/stripe-mcp",
  createdAt: "",
  env: { STRIPE_KEY: "sk_live_secret" },
  id: "stripe",
  name: "Stripe",
  readTools: ["refund_charge"],
  transport: "stdio",
  updatedAt: "",
};

const endpoint: HttpEndpointConfig = {
  auth: { kind: "header", name: "Authorization", value: SECRET },
  baseUrl: "https://api.example.com/v1",
  createdAt: "",
  id: "support",
  name: "Support API",
  updatedAt: "",
};

const widget: Widget = {
  createdAt: "2026-11-01T00:00:00.000Z",
  id: "w1",
  lastRunAt: null,
  lastValues: {},
  name: "Open orders",
  params: [
    {
      default: "eu",
      label: "Region",
      name: "region",
      options: ["eu", "us"],
      type: "select",
    },
    {
      default: "last7d",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
  ],
  prompt: "open orders",
  source: {
    connectionId: "pg",
    database: null,
    dialect: "postgresql",
    kind: "sql",
    sqlTemplate:
      "select id, email, status from orders where region = {{region}} and day >= {{period.from}}",
  },
  spec: {
    formats: {},
    title: "Orders",
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  updatedAt: "2026-11-01T00:00:00.000Z",
  version: 2,
  view: "table",
};

const sqlDraft: ActionDraft = {
  bind: {
    id: { column: "id", from: "row" },
    status: { from: "literal", value: "shipped" },
  },
  label: "Mark shipped",
  scope: "row",
  target: {
    connectionId: "pg",
    database: null,
    dialect: "postgresql",
    kind: "sql",
    maxAffectedRows: 1,
    statementTemplate:
      "UPDATE orders SET status = {{status}} WHERE id = {{id}}",
  },
};

const mcpDraft: ActionDraft = {
  bind: { charge: { column: "id", from: "row" } },
  label: "Refund charge",
  scope: "row",
  target: {
    args: { charge: { $param: "charge" } },
    kind: "mcp",
    serverId: "stripe",
    tool: "refund_charge",
  },
};

const httpDraft: ActionDraft = {
  bind: {
    id: { column: "id", from: "row" },
    region: { from: "input", name: "region" },
  },
  label: "Close ticket",
  scope: "row",
  target: {
    body: { region: { $param: "region" } },
    endpointId: "support",
    kind: "http",
    method: "POST",
    path: "/tickets/{{id}}/close",
    query: {},
  },
};

const linkDraft: ActionDraft = {
  bind: { id: { column: "id", from: "row" } },
  label: "Open in admin",
  scope: "row",
  target: {
    baseUrl: "https://admin.example.com/orders",
    kind: "open-url",
    path: "/{{id}}",
    query: {},
  },
};

const copyDraft: ActionDraft = {
  bind: { email: { column: "email", from: "row" } },
  label: "Copy email",
  scope: "row",
  target: { kind: "copy", template: "Email: {{email}}" },
};

const ROWS = [
  [1, "ann@example.com", "new"],
  [2, `${["javascript", "alert(1)"].join(":")}/../x`, "new"],
];

const setup = () => {
  const clock = { at: Date.parse("2026-11-21T10:00:00.000Z") };
  const store = new Map<string, WidgetAction>();
  const allowed = new Set<string>();
  const tools: McpToolInfo[] = [
    {
      annotations: null,
      description: "Refund a charge.",
      inputSchema: {},
      name: "refund_charge",
      title: null,
    },
    {
      annotations: { readOnlyHint: true },
      description: "Look up a charge.",
      inputSchema: {},
      name: "get_charge",
      title: null,
    },
  ];
  const audit: Record<string, unknown>[] = [];
  const auditControl = { fail: false };
  const runCache = createRunCache({ now: () => clock.at });
  runCache.record("r1", "w1", {
    columns: [
      { name: "id", typeName: "int" },
      { name: "email", typeName: "text" },
      { name: "status", typeName: "text" },
    ],
    executionTimeMs: 1,
    isTruncated: false,
    resultType: "tabular",
    rowCount: 2,
    rows: ROWS,
  });
  const connections = new Map([["pg", { ...connection }]]);
  let ids = 0;
  const executor = {
    run: vi.fn((call: ResolvedCall) =>
      resolved({
        affectedRows: call.kind === "sql" ? 1 : undefined,
        durationMs: 4,
        ok: true as const,
        response: { secret_echo: SECRET },
        summary: "done",
      })
    ),
  };
  const confirm = vi.fn(() => resolved(true));
  const inspectConnection = vi.fn(() =>
    resolved({
      dialect: "postgresql" as const,
      schema: "public",
      writable: true,
    })
  );
  const service = createActionService({
    actions: {
      get: (id) => resolved(store.get(id) ?? null),
      listForWidget: (widgetId) =>
        resolved(
          [...store.values()].filter((item) => item.widgetId === widgetId)
        ),
      remove: (id) => {
        store.delete(id);
        return Promise.resolve();
      },
      save: (action) => {
        store.set(action.id, action);
        return resolved(action);
      },
    },
    audit: {
      append: (entry) => {
        if (auditControl.fail) {
          return Promise.reject(new Error("disk full"));
        }
        audit.push({ ...entry, prevHash: "0".repeat(64) });
        return Promise.resolve();
      },
      read: () => resolved(audit.toReversed()),
      verify: () => resolved({ archived: 0, entries: audit.length, ok: true }),
    },
    confirm,
    executor,
    findConnection: (id) => resolved(connections.get(id) ?? null),
    getWidget: (id) => resolved(id === widget.id ? widget : null),
    httpEndpoint: (id) => resolved(id === "support" ? endpoint : null),
    inspectConnection,
    listTools: () => resolved(tools.map((tool) => ({ ...tool }))),
    loadModel: () => resolved(null),
    loadSchema: () => resolved({ schemas: [] }),
    mcpServer: (id) => resolved(id === "stripe" ? server : null),
    newId: () => {
      ids += 1;
      return `id-${ids}`;
    },
    newToken: () => {
      ids += 1;
      return `tok${String(ids).padStart(19, "0")}`;
    },
    now: () => new Date(clock.at),
    permissions: {
      isAllowed: (kind, id) => resolved(allowed.has(`${kind}:${id}`)),
    },
    runCache,
    sha256: (text) => createHash("sha256").update(text).digest("hex"),
  });
  const flipTool = (name: string, readOnlyHint: boolean) => {
    for (const tool of tools.filter((item) => item.name === name)) {
      tool.annotations = { readOnlyHint };
    }
  };
  return {
    allowed,
    audit,
    auditControl,
    clock,
    confirm,
    connections,
    executor,
    flipTool,
    inspectConnection,
    service,
    store,
    tools,
  };
};

const context = (rowIndex: number | null = 1, values = {}) => ({
  rowIndex,
  runId: "r1",
  values,
});

const saved = async (
  env: ReturnType<typeof setup>,
  draft: ActionDraft = sqlDraft
) => {
  const listed = await env.service.saveAction({ draft, widgetId: "w1" });
  return listed.action;
};

describe("saveAction", () => {
  it("asks natively with the full template before saving a write", async () => {
    const env = setup();
    const action = await saved(env);
    expect(env.confirm).toHaveBeenCalledWith({
      confirmLabel: "Save Action",
      detail:
        'UPDATE orders SET status = {{status}} WHERE id = {{id}}\n\nChanges at most 1 row per run.\n\nValues:\nid ← row id\nstatus ← "shipped"',
      message: "Save “Mark shipped”? It writes to analytics-prod (production).",
      title: "Save write action",
    });
    expect(action).toMatchObject({
      effect: "write",
      reviewHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      widgetId: "w1",
    });
  });

  it("saves nothing when the native review is declined", async () => {
    const env = setup();
    env.confirm.mockResolvedValue(false);
    await expect(
      env.service.saveAction({ draft: sqlDraft, widgetId: "w1" })
    ).rejects.toMatchObject({ code: "REVIEW_DECLINED" });
    expect(env.store.size).toBe(0);
  });

  it("refuses a statement the write guard rejects, before any dialog", async () => {
    const env = setup();
    const draft: ActionDraft = {
      ...sqlDraft,
      bind: { status: { from: "literal", value: "shipped" } },
      target: {
        ...sqlDraft.target,
        statementTemplate: "UPDATE orders SET status = {{status}} WHERE 1=1",
      } as ActionDraft["target"],
    };
    await expect(
      env.service.saveAction({ draft, widgetId: "w1" })
    ).rejects.toMatchObject({ code: "NOT_A_GUARDED_WRITE" });
    expect(env.confirm).not.toHaveBeenCalled();
  });

  it("refuses an engine without guarded writes", async () => {
    const env = setup();
    env.inspectConnection.mockResolvedValue({
      dialect: "postgresql",
      schema: "public",
      writable: false,
    });
    await expect(
      env.service.saveAction({ draft: sqlDraft, widgetId: "w1" })
    ).rejects.toMatchObject({ code: "WRITES_UNSUPPORTED" });
  });

  it("treats an MCP tool marked Treat as read as a write", async () => {
    const env = setup();
    const action = await saved(env, mcpDraft);
    expect(action.effect).toBe("write");
    expect(env.confirm).toHaveBeenCalledOnce();
  });

  it("saves reads and links without a native dialog", async () => {
    const env = setup();
    await saved(env, linkDraft);
    await saved(env, copyDraft);
    expect(env.confirm).not.toHaveBeenCalled();
  });

  it("refuses an input binding to a date range", async () => {
    const env = setup();
    const draft: ActionDraft = {
      ...sqlDraft,
      bind: {
        id: { column: "id", from: "row" },
        status: { from: "input", name: "period" },
      },
    };
    await expect(
      env.service.saveAction({ draft, widgetId: "w1" })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("lists actions with the effect derived from live data", async () => {
    const env = setup();
    await saved(env, linkDraft);
    await saved(env, mcpDraft);
    const listed = await env.service.listActions("w1");
    expect(
      listed.map((item) => [item.action.label, item.effect, item.subtitle])
    ).toStrictEqual([
      ["Open in admin", "external", "admin.example.com/orders/{{id}}"],
      ["Refund charge", "write", "Calls refund_charge on Stripe"],
    ]);
  });
});

describe("prepareAction", () => {
  it("refuses a write while writes are off for the connection", async () => {
    const env = setup();
    const action = await saved(env);
    await expect(
      env.service.prepareAction({ actionId: action.id, context: context() })
    ).rejects.toMatchObject({ code: "WRITES_NOT_ALLOWED" });
  });

  it("previews the exact statement and values read from bun's run cache", async () => {
    const env = setup();
    env.allowed.add("connection:pg");
    const action = await saved(env);
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(1, { id: 999, status: "deleted" }),
    });
    expect(preview).toMatchObject({
      bound: [
        {
          detail: "literal",
          from: "literal",
          name: "status",
          value: "shipped",
        },
        { detail: "row.id", from: "row", name: "id", value: 2 },
      ],
      compiled: {
        kind: "sql",
        params: ["shipped", 2],
        statement: "UPDATE orders SET status = $1 WHERE id = $2",
      },
      effect: "write",
      limits: { maxAffectedRows: 1 },
      target: {
        environment: "production",
        kind: "sql",
        name: "analytics-prod",
      },
      token: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
    });
    expect(JSON.stringify(preview)).not.toContain("db-password");
  });

  it("asks for a fresh run when the run is gone or belongs to another widget", async () => {
    const env = setup();
    env.allowed.add("connection:pg");
    const action = await saved(env);
    await expect(
      env.service.prepareAction({
        actionId: action.id,
        context: { ...context(), runId: "unknown" },
      })
    ).rejects.toMatchObject({ code: "RUN_EXPIRED" });
    await expect(
      env.service.prepareAction({ actionId: action.id, context: context(9) })
    ).rejects.toMatchObject({ code: "RUN_EXPIRED" });
  });

  it("refuses a stored action that no longer matches its review", async () => {
    const env = setup();
    env.allowed.add("connection:pg");
    const action = await saved(env);
    env.store.set(action.id, {
      ...action,
      target: {
        ...sqlDraft.target,
        statementTemplate:
          "DELETE FROM orders WHERE id = {{id}} OR {{status}} = 'x'",
      } as WidgetAction["target"],
    });
    await expect(
      env.service.prepareAction({ actionId: action.id, context: context() })
    ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
  });

  it("refuses a stored effect weaker than the derived one", async () => {
    const env = setup();
    env.allowed.add("connection:pg");
    const action = await saved(env);
    env.store.set(action.id, { ...action, effect: "read" });
    await expect(
      env.service.prepareAction({ actionId: action.id, context: context() })
    ).rejects.toMatchObject({ code: "EFFECT_UNDERSTATED" });
  });

  it("validates input values against the widget's inputs", async () => {
    const env = setup();
    env.allowed.add("http:support");
    const action = await saved(env, httpDraft);
    await expect(
      env.service.prepareAction({
        actionId: action.id,
        context: context(0, { region: "mars" }),
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(0, { region: "us" }),
    });
    expect(preview.compiled).toStrictEqual({
      body: { region: "us" },
      kind: "http",
      method: "POST",
      url: "https://api.example.com/v1/tickets/1/close",
    });
  });

  it("keeps a link's origin when row data looks like a URL", async () => {
    const env = setup();
    const action = await saved(env, linkDraft);
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(1),
    });
    expect(preview.effect).toBe("external");
    const linked = await env.service.saveAction({
      draft: {
        ...linkDraft,
        bind: { id: { column: "email", from: "row" } },
      },
      widgetId: "w1",
    });
    const hostile = await env.service.prepareAction({
      actionId: linked.action.id,
      context: context(1),
    });
    expect(hostile.compiled).toStrictEqual({
      kind: "open-url",
      url: "https://admin.example.com/orders/javascript%3Aalert(1)%2F..%2Fx",
    });
  });
});

describe("executeAction", () => {
  const prepared = async (draft: ActionDraft = sqlDraft) => {
    const env = setup();
    env.allowed.add("connection:pg");
    env.allowed.add("mcp:stripe");
    env.allowed.add("http:support");
    const action = await saved(env, draft);
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(),
    });
    return { action, env, preview };
  };

  it("never runs without a token", async () => {
    const env = setup();
    await expect(
      env.service.executeAction({ token: "not-a-token" })
    ).rejects.toMatchObject({ code: "TOKEN_UNKNOWN" });
    await expect(
      env.service.executeAction({ token: "a".repeat(22) })
    ).rejects.toMatchObject({ code: "TOKEN_UNKNOWN" });
    expect(env.executor.run).not.toHaveBeenCalled();
  });

  it("runs exactly the prepared call once and audits a started/finished pair", async () => {
    const { env, preview } = await prepared();
    const outcome = await env.service.executeAction({ token: preview.token });
    expect(outcome).toMatchObject({ affectedRows: 1, ok: true });
    expect(env.executor.run).toHaveBeenCalledWith(
      {
        connectionId: "pg",
        database: null,
        kind: "sql",
        maxAffectedRows: 1,
        params: ["shipped", 2],
        statement: "UPDATE orders SET status = $1 WHERE id = $2",
      },
      expect.any(AbortSignal)
    );
    expect(env.audit.map((entry) => entry.phase)).toStrictEqual([
      "started",
      "finished",
    ]);
    expect(env.audit[0]?.executionId).toBe(env.audit[1]?.executionId);
    expect(env.audit[1]).toMatchObject({
      effect: "write",
      environment: "production",
      outcome: { affectedRows: 1, ok: true },
      targetName: "analytics-prod",
    });
  });

  it("can't replay a token", async () => {
    const { env, preview } = await prepared();
    await env.service.executeAction({ token: preview.token });
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "TOKEN_UNKNOWN" });
    expect(env.executor.run).toHaveBeenCalledOnce();
  });

  it("refuses an expired token", async () => {
    const { env, preview } = await prepared();
    env.clock.at += 120_001;
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(env.executor.run).not.toHaveBeenCalled();
  });

  it("refuses once writes are turned off after the preview", async () => {
    const { env, preview } = await prepared();
    env.allowed.delete("connection:pg");
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "WRITES_NOT_ALLOWED" });
    expect(env.executor.run).not.toHaveBeenCalled();
    expect(env.audit).toStrictEqual([]);
  });

  it("refuses when the action changed after the preview", async () => {
    const { action, env, preview } = await prepared();
    await saved(env, {
      ...sqlDraft,
      id: action.id,
      target: {
        ...sqlDraft.target,
        maxAffectedRows: 5,
      } as ActionDraft["target"],
    });
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
    expect(env.executor.run).not.toHaveBeenCalled();
  });

  it("still runs a reviewed call whose label alone changed", async () => {
    const { action, env, preview } = await prepared();
    await saved(env, { ...sqlDraft, id: action.id, label: "Ship it" });
    await expect(
      env.service.executeAction({ token: preview.token })
    ).resolves.toMatchObject({ ok: true });
  });

  it("blocks the write when the started entry can't be recorded", async () => {
    const { env, preview } = await prepared();
    env.auditControl.fail = true;
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "AUDIT_FAILED" });
    expect(env.executor.run).not.toHaveBeenCalled();
  });

  it("keeps secrets and response bodies out of the audit", async () => {
    const { env, preview } = await prepared(httpDraft);
    await env.service.executeAction({ token: preview.token });
    const text = JSON.stringify(env.audit);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("secret_echo");
    expect(env.audit[0]).toMatchObject({
      compiled: {
        body: { region: "eu" },
        method: "POST",
        url: "https://api.example.com/v1/tickets/2/close",
      },
      targetName: "Support API",
    });
  });

  it("redacts bound values in the audit when the connection redacts PII", async () => {
    const env = setup();
    env.allowed.add("connection:pg");
    env.connections.set("pg", { ...connection, piiRedaction: true });
    const action = await saved(env, {
      ...sqlDraft,
      bind: {
        id: { column: "email", from: "row" },
        status: { from: "literal", value: "shipped" },
      },
    });
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(0),
    });
    expect(preview.bound[1]?.value).toBe("ann@example.com");
    await env.service.executeAction({ token: preview.token });
    expect(JSON.stringify(env.audit)).not.toContain("ann@example.com");
  });

  it("re-derives an MCP tool's effect: a tool that stops being read-only needs a confirm path", async () => {
    const env = setup();
    const readDraft: ActionDraft = {
      ...mcpDraft,
      label: "Look up charge",
      target: {
        ...mcpDraft.target,
        tool: "get_charge",
      } as ActionDraft["target"],
    };
    const action = await saved(env, readDraft);
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(),
    });
    expect([
      action.effect,
      preview.effect,
      env.confirm.mock.calls.length,
    ]).toStrictEqual(["read", "read", 0]);
    env.flipTool("get_charge", false);
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "EFFECT_CHANGED" });
    await expect(
      env.service.prepareAction({ actionId: action.id, context: context() })
    ).rejects.toMatchObject({ code: "EFFECT_UNDERSTATED" });
    expect(env.executor.run).not.toHaveBeenCalled();
  });

  it("runs a read without an audit entry and a link with one", async () => {
    const env = setup();
    const lookup = await saved(env, {
      ...mcpDraft,
      label: "Look up charge",
      target: {
        ...mcpDraft.target,
        tool: "get_charge",
      } as ActionDraft["target"],
    });
    const read = await env.service.prepareAction({
      actionId: lookup.id,
      context: context(),
    });
    await env.service.executeAction({ token: read.token });
    expect(env.audit).toStrictEqual([]);
    const link = await saved(env, linkDraft);
    const opened = await env.service.prepareAction({
      actionId: link.id,
      context: context(0),
    });
    await env.service.executeAction({ token: opened.token });
    expect(env.audit.map((entry) => [entry.phase, entry.effect])).toStrictEqual(
      [
        ["started", "external"],
        ["finished", "external"],
      ]
    );
  });

  it("leaves copy to the launcher", async () => {
    const env = setup();
    const action = await saved(env, copyDraft);
    const preview = await env.service.prepareAction({
      actionId: action.id,
      context: context(0),
    });
    expect(preview.compiled).toStrictEqual({
      kind: "copy",
      text: "Email: ann@example.com",
    });
    await expect(
      env.service.executeAction({ token: preview.token })
    ).rejects.toMatchObject({ code: "COPY_IN_LAUNCHER" });
    expect(env.audit).toStrictEqual([]);
  });

  it("lists activity newest first with the log's integrity", async () => {
    const { env, preview } = await prepared();
    await env.service.executeAction({ token: preview.token });
    const page = await env.service.listActivity({ limit: 10 });
    expect(page.integrity).toStrictEqual({ archived: 0, entries: 2, ok: true });
    expect(page.activity).toMatchObject([
      {
        actionLabel: "Mark shipped",
        status: "ok",
        targetName: "analytics-prod",
      },
    ]);
  });
});

describe("reviewAction", () => {
  it("previews an unsaved draft with the selected row, without a token", async () => {
    const env = setup();
    const review = await env.service.reviewAction({
      context: context(0),
      draft: sqlDraft,
      widgetId: "w1",
    });
    expect(review).toMatchObject({
      bound: [{ value: "shipped" }, { value: 1 }],
      effect: "write",
    });
    expect(review).not.toHaveProperty("token");
    expect(env.confirm).not.toHaveBeenCalled();
  });
});
