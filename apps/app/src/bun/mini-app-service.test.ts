import type { DatabaseConnection, TabularResult } from "@conch/core";
import type { MiniAppDraft } from "@conch/rpc/mini-app";
import type * as NodeOs from "node:os";

import { CARD_SPEC_VERSION } from "@conch/rpc";
import { MINI_APP_VERSION } from "@conch/rpc/mini-app";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-mini-apps-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { decryptLine, miniAppsPath } = await import("@conch/core");
const { createActionService } = await import("./action-service.ts");
const { createRunCache } = await import("./run-cache.ts");
const {
  createMiniAppService,
  defaultMiniAppStore,
  MAX_STAGES_PER_WINDOW,
  miniAppRunOwner,
  STAGE_GAP_MS,
} = await import("./mini-app-service.ts");

const settledVoid = async (): Promise<void> => {
  await Promise.resolve();
};

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const connection: DatabaseConnection = {
  createdAt: "2026-11-01T00:00:00.000Z",
  database: "shop",
  environment: "production",
  host: "127.0.0.1",
  id: "pg",
  lastConnectedAt: null,
  name: "shop-prod",
  password: "db-password",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "conch",
};

const card = (source: string, rowActions: string[]) => ({
  children: [],
  props: {
    data: { $state: `/sources/${source}` },
    rowActions,
    size: "l" as const,
    spec: {
      formats: {},
      title: source,
      version: CARD_SPEC_VERSION,
      view: { kind: "table" as const },
    },
    view: "table" as const,
  },
  type: "Card" as const,
});

const desk = (): MiniAppDraft => ({
  actions: [
    {
      bind: { id: { column: "id", from: "row" } },
      id: "refund",
      label: "Refund",
      scope: "row",
      target: {
        connectionId: "pg",
        database: null,
        dialect: "postgresql",
        kind: "sql",
        maxAffectedRows: 1,
        statementTemplate:
          "UPDATE orders SET status = 'refunded' WHERE id = {{id}}",
      },
    },
    {
      bind: { region: { from: "input", name: "region" } },
      id: "copy-region",
      label: "Copy region",
      scope: "widget",
      target: { kind: "copy", template: "Region {{region}}" },
    },
  ],
  description: "Failed orders",
  inputOptions: { region: "regions" },
  inputs: [
    { default: "EU", label: "Region", name: "region", type: "select" },
    {
      default: 10,
      label: "Limit",
      max: 100,
      min: 1,
      name: "limit",
      type: "number",
    },
  ],
  layout: {
    elements: {
      charges: card("charges", []),
      grid: { children: ["orders", "charges"], props: {}, type: "Grid" },
      orders: card("orders", ["refund"]),
    },
    root: "grid",
  },
  name: "Refund desk",
  prompt: "refund desk",
  refresh: "off",
  refreshAfter: { refund: ["orders"] },
  sources: {
    charges: {
      connectionId: "pg",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate: "SELECT id FROM charges LIMIT {{limit}}",
    },
    orders: {
      connectionId: "pg",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate: "SELECT id, total FROM orders WHERE region = {{region}}",
    },
    regions: {
      connectionId: "pg",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate: "SELECT DISTINCT region FROM orders",
    },
  },
  values: {},
  version: MINI_APP_VERSION,
});

const tabular = (columns: string[], rows: unknown[][]): TabularResult => ({
  columns: columns.map((name) => ({ name, typeName: "text" })),
  executionTimeMs: 1,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

const RESULTS: Record<string, TabularResult> = {
  "SELECT DISTINCT region FROM orders": tabular(["region"], [["EU"], ["US"]]),
  "SELECT id FROM charges LIMIT {{limit}}": tabular(["id"], [["ch_1"]]),
  "SELECT id, total FROM orders WHERE region = {{region}}": tabular(
    ["id", "total"],
    [
      [7, "12.00"],
      [8, "40.00"],
    ]
  ),
};

const setup = () => {
  const allowed = new Set<string>(["connection:pg"]);
  const confirm = vi.fn(() => resolved(true));
  const executor = {
    run: vi.fn(() =>
      resolved({
        affectedRows: 1,
        durationMs: 3,
        ok: true as const,
        summary: "1 row",
      })
    ),
  };
  const runCache = createRunCache({ now: () => Date.now() });
  let ids = 0;
  const newId = () => {
    ids += 1;
    return `id-${ids}`;
  };
  const permissions = {
    isAllowed: (kind: string, id: string) =>
      resolved(allowed.has(`${kind}:${id}`)),
  };
  const actions = createActionService({
    actions: {
      get: () => resolved(null),
      listForWidget: () => resolved([]),
      remove: () => settledVoid(),
      save: (action) => resolved(action),
    },
    audit: {
      append: () => settledVoid(),
      read: () => resolved([]),
      verify: () => resolved({ archived: 0, entries: 0, ok: true }),
    },
    confirm,
    executor,
    findConnection: (id) => resolved(id === "pg" ? connection : null),
    getWidget: () => resolved(null),
    httpEndpoint: () => resolved(null),
    inspectConnection: () =>
      resolved({
        dialect: "postgresql" as const,
        schema: "public",
        writable: true,
      }),
    listTools: () => resolved([]),
    loadModel: () => resolved(null),
    loadSchema: () => resolved({ schemas: [] }),
    mcpServer: () => resolved(null),
    newId,
    newToken: () => `tok${String(newId().length + ids).padStart(19, "0")}`,
    now: () => new Date(),
    permissions,
    runCache,
    sha256: (text) => createHash("sha256").update(text).digest("hex"),
  });
  const run = vi.fn(
    (input: {
      source: { kind: string; sqlTemplate?: string };
      values: unknown;
    }) => {
      const result = RESULTS[input.source.sqlTemplate ?? ""] ?? tabular([], []);
      return resolved({
        compiled: { kind: "sql" as const, sql: input.source.sqlTemplate ?? "" },
        result: { ...result, executionTimeMs: 2 },
      });
    }
  );
  const drafts = new Map<string, MiniAppDraft>();
  const clock = { at: Date.parse("2026-11-21T10:00:00Z") };
  const onChanged = vi.fn();
  const onRefresh = vi.fn();
  const appConfirm = vi.fn((_request: { detail: string; message: string }) =>
    resolved(true)
  );
  const service = createMiniAppService({
    actions,
    confirm: appConfirm,
    draftOf: (genId) => drafts.get(genId) ?? null,
    newId,
    now: () => new Date(clock.at),
    onChanged,
    onRefresh,
    permissions,
    runCache,
    runner: { check: () => settledVoid(), run },
    store: defaultMiniAppStore(),
  });
  return {
    actions,
    allowed,
    appConfirm,
    clock,
    confirm,
    drafts,
    executor,
    onChanged,
    onRefresh,
    run,
    runCache,
    service,
  };
};

const present = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("expected a value");
  }
  return value;
};

const voidingRefund = () => ({
  bind: { id: { column: "id", from: "row" as const } },
  id: "refund",
  label: "Refund",
  scope: "row" as const,
  target: {
    connectionId: "pg",
    database: null,
    dialect: "postgresql" as const,
    kind: "sql" as const,
    maxAffectedRows: 1,
    statementTemplate: "UPDATE orders SET status = 'void' WHERE id = {{id}}",
  },
});

const savedDesk = (env: ReturnType<typeof setup>) =>
  env.service.saveMiniApp({
    draft: desk(),
    reviewedActionIds: ["refund"],
  });

describe("mini-app service", () => {
  beforeEach(async () => {
    await fs.rm(path.join(TMP_HOME, ".config"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  describe("saveMiniApp", () => {
    it("refuses a write action nobody reviewed", async () => {
      const env = setup();
      await expect(
        env.service.saveMiniApp({ draft: desk(), reviewedActionIds: [] })
      ).rejects.toMatchObject({
        code: "ACTION_NOT_REVIEWED",
        message: "Review “Refund” before saving the app.",
      });
      expect(env.confirm).not.toHaveBeenCalled();
      await expect(env.service.listMiniApps()).resolves.toStrictEqual([]);
    });

    it("refuses a write action whose connection has writes off", async () => {
      const env = setup();
      env.allowed.clear();
      await expect(savedDesk(env)).rejects.toMatchObject({
        code: "WRITES_NOT_ALLOWED",
        message: expect.stringContaining("“Refund” writes to shop-prod"),
      });
      expect(env.confirm).not.toHaveBeenCalled();
    });

    it("reviews a write natively, stamps it and keeps it on a resave", async () => {
      const env = setup();
      const app = await savedDesk(env);
      expect(env.confirm).toHaveBeenCalledOnce();
      expect(app.actions[0]).toMatchObject({ effect: "write", id: "refund" });
      expect(app.actions[0]?.reviewHash).toMatch(/^[0-9a-f]{64}$/);
      expect(env.onChanged).toHaveBeenCalledWith(app.id);
    });

    it("keeps the review stamp when nothing it covers changed", async () => {
      const env = setup();
      const app = await savedDesk(env);
      const renamed = await env.service.saveMiniApp({
        draft: { ...desk(), id: app.id, name: "Refunds" },
        reviewedActionIds: [],
      });
      expect(env.confirm).toHaveBeenCalledOnce();
      expect(renamed.actions[0]?.reviewHash).toBe(app.actions[0]?.reviewHash);
      expect(renamed.createdAt).toBe(app.createdAt);
    });

    it("asks again when a write action changes", async () => {
      const env = setup();
      const app = await savedDesk(env);
      const draft = desk();
      const [, copy] = draft.actions;
      const changed = voidingRefund();
      await expect(
        env.service.saveMiniApp({
          draft: { ...draft, actions: [changed, copy], id: app.id },
          reviewedActionIds: [],
        })
      ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
      env.confirm.mockResolvedValueOnce(false);
      await expect(
        env.service.saveMiniApp({
          draft: { ...draft, actions: [changed, copy], id: app.id },
          reviewedActionIds: ["refund"],
        })
      ).rejects.toMatchObject({ code: "REVIEW_DECLINED" });
    });

    it("refuses a source that would write", async () => {
      const env = setup();
      const draft = desk();
      const sources = {
        ...draft.sources,
        orders: {
          ...present(draft.sources.orders),
          sqlTemplate: "DELETE FROM orders WHERE region = {{region}}",
        },
      };
      await expect(
        env.service.saveMiniApp({
          draft: { ...draft, sources },
          reviewedActionIds: ["refund"],
        })
      ).rejects.toMatchObject({ code: "NOT_READ_ONLY" });
    });

    it("stores no row data", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await env.service.runSource({
        runId: "r1",
        sourceName: "orders",
        target: { appId: app.id, kind: "saved" },
        values: {},
      });
      await env.service.setValues({
        appId: app.id,
        values: { "region:select": "US" },
      });
      const raw = await fs.readFile(miniAppsPath(), "utf8");
      const stored = await decryptLine(raw.trim());
      expect(stored).not.toContain('"rows"');
      expect(stored).not.toContain("40.00");
      expect(stored).toContain('"region:select":"US"');
    });
  });

  describe("runSource", () => {
    it("runs the stored source with only the inputs it uses", async () => {
      const env = setup();
      const app = await savedDesk(env);
      const run = await env.service.runSource({
        runId: "r1",
        sourceName: "charges",
        target: { appId: app.id, kind: "saved" },
        values: { limit: 5, region: "US" },
      });
      expect(run.values).toStrictEqual({ limit: 5 });
      expect(env.run).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: [expect.objectContaining({ name: "limit" })],
          source: desk().sources.charges,
          values: { limit: 5 },
        }),
        expect.any(AbortSignal)
      );
    });

    it("rejects an invalid value before running anything", async () => {
      const env = setup();
      const app = await savedDesk(env);
      env.run.mockClear();
      await expect(
        env.service.runSource({
          runId: "r1",
          sourceName: "charges",
          target: { appId: app.id, kind: "saved" },
          values: { limit: 500 },
        })
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: "Limit must be at most 100.",
      });
      await expect(
        env.service.runSource({
          runId: "r1",
          sourceName: "orders",
          target: { appId: app.id, kind: "saved" },
          values: { region: "Mars" },
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        env.service.runSource({
          runId: "r1",
          sourceName: "orders",
          target: { appId: app.id, kind: "saved" },
          values: { ghost: "x" },
        })
      ).rejects.toMatchObject({ message: "Unknown input: ghost." });
      expect(
        env.run.mock.calls.every(([call]) =>
          call.source.sqlTemplate?.includes("DISTINCT")
        )
      ).toBeTruthy();
    });

    it("never runs a definition the renderer sends", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await env.service.runSource({
        runId: "r1",
        source: { kind: "sql", sqlTemplate: "DELETE FROM orders" },
        sourceName: "charges",
        target: { appId: app.id, kind: "saved" },
        values: {},
      });
      expect(env.run).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: desk().sources.charges }),
        expect.any(AbortSignal)
      );
      await expect(
        env.service.runSource({
          runId: "r2",
          sourceName: "ghost",
          target: { appId: app.id, kind: "saved" },
          values: {},
        })
      ).rejects.toMatchObject({ code: "SOURCE_NOT_FOUND" });
    });

    it("runs a preview from bun's own draft and never caches it", async () => {
      const env = setup();
      env.drafts.set("g1", desk());
      const run = await env.service.runSource({
        runId: "r1",
        sourceName: "orders",
        target: { genId: "g1", kind: "draft" },
        values: { region: "EU" },
      });
      expect(run.result.rowCount).toBe(2);
      expect(env.runCache.rowAt("r1", 0)).toBeNull();
      await expect(
        env.service.runSource({
          runId: "r2",
          sourceName: "orders",
          target: { genId: "gone", kind: "draft" },
          values: {},
        })
      ).rejects.toMatchObject({ code: "DRAFT_GONE" });
    });

    it("loads select options from the mapped source", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await expect(
        env.service.loadInputOptions({
          inputName: "region",
          target: { appId: app.id, kind: "saved" },
        })
      ).resolves.toStrictEqual(["EU", "US"]);
      await expect(
        env.service.loadInputOptions({
          inputName: "limit",
          target: { appId: app.id, kind: "saved" },
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
  });

  describe("actions", () => {
    it("resolves the row from bun's run of the card's source", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await env.service.runSource({
        runId: "run-orders",
        sourceName: "orders",
        target: { appId: app.id, kind: "saved" },
        values: {},
      });
      expect(env.runCache.rowAt("run-orders", 1)?.ownerId).toBe(
        miniAppRunOwner(app.id, "orders")
      );
      const preview = await env.service.prepareAction({
        actionId: "refund",
        appId: app.id,
        context: { rowIndex: 1, runId: "run-orders", values: {} },
      });
      expect(preview).toMatchObject({
        bound: [{ detail: "row.id", from: "row", name: "id", value: 8 }],
        effect: "write",
      });
      expect(env.executor.run).not.toHaveBeenCalled();

      const outcome = await env.actions.executeAction({ token: preview.token });
      await env.service.afterExecute(preview.token, outcome);
      expect(env.executor.run).toHaveBeenCalledOnce();
      expect(env.onRefresh).toHaveBeenCalledWith(app.id, ["orders"]);
    });

    it("refuses a row from another source's run", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await env.service.runSource({
        runId: "run-charges",
        sourceName: "charges",
        target: { appId: app.id, kind: "saved" },
        values: {},
      });
      await expect(
        env.service.prepareAction({
          actionId: "refund",
          appId: app.id,
          context: { rowIndex: 0, runId: "run-charges", values: {} },
        })
      ).rejects.toMatchObject({ code: "RUN_EXPIRED" });
    });

    it("binds an app action from the inputs and ignores a sent definition", async () => {
      const env = setup();
      const app = await savedDesk(env);
      const preview = await env.service.prepareAction({
        action: { target: { kind: "sql", statementTemplate: "DROP TABLE x" } },
        actionId: "copy-region",
        appId: app.id,
        context: { rowIndex: null, runId: "none", values: { region: "US" } },
      });
      expect(preview.compiled).toStrictEqual({
        kind: "copy",
        text: "Region US",
      });
      await expect(
        env.service.stageAction(
          {
            actionId: "ghost",
            appId: app.id,
            context: { rowIndex: null, runId: "none", values: {} },
          },
          { appId: app.id, focused: true }
        )
      ).rejects.toMatchObject({ code: "ACTION_NOT_FOUND" });
    });

    it("re-checks the stored action at execute", async () => {
      const env = setup();
      const app = await savedDesk(env);
      await env.service.runSource({
        runId: "run-orders",
        sourceName: "orders",
        target: { appId: app.id, kind: "saved" },
        values: {},
      });
      const preview = await env.service.prepareAction({
        actionId: "refund",
        appId: app.id,
        context: { rowIndex: 0, runId: "run-orders", values: {} },
      });
      await env.service.deleteMiniApp(app.id);
      await expect(
        env.actions.executeAction({ token: preview.token })
      ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
      expect(env.executor.run).not.toHaveBeenCalled();
    });
  });

  it("duplicates an app with its reviews and lists the most recent first", async () => {
    const env = setup();
    const app = await savedDesk(env);
    const copy = await env.service.duplicateMiniApp(app.id);
    expect(copy.name).toBe("Refund desk copy");
    expect(copy.actions).toStrictEqual(app.actions);
    await env.service.markOpened(app.id);
    const listed = await env.service.listMiniApps();
    expect(listed.map((item) => item.id)).toStrictEqual([app.id, copy.id]);
    expect(env.confirm).toHaveBeenCalledOnce();
  });
});

const stageRequest = (appId: string) => ({
  actionId: "copy-region",
  appId,
  context: { rowIndex: null, runId: "app", values: {} },
});

describe("staging from an app window", () => {
  it("accepts only the app's own, focused window", async () => {
    const env = setup();
    const app = await savedDesk(env);
    await expect(
      env.service.stageAction(stageRequest(app.id), {
        appId: "other",
        focused: true,
      })
    ).rejects.toMatchObject({ code: "NOT_THIS_WINDOW" });
    await expect(
      env.service.stageAction(stageRequest(app.id), {
        appId: app.id,
        focused: false,
      })
    ).rejects.toMatchObject({ code: "WINDOW_NOT_FOCUSED" });
    await expect(
      env.service.stageAction(stageRequest(app.id), {
        appId: app.id,
        focused: true,
      })
    ).resolves.toMatchObject({ actionId: "copy-region" });
  });

  it("refuses stages faster than a click and caps them per minute", async () => {
    const env = setup();
    const app = await savedDesk(env);
    const from = { appId: app.id, focused: true };
    await env.service.stageAction(stageRequest(app.id), from);
    await expect(
      env.service.stageAction(stageRequest(app.id), from)
    ).rejects.toMatchObject({
      code: "STAGE_TOO_FAST",
    });
    for (let step = 1; step < MAX_STAGES_PER_WINDOW; step += 1) {
      env.clock.at += STAGE_GAP_MS;
      await env.service.stageAction(stageRequest(app.id), from);
    }
    env.clock.at += STAGE_GAP_MS;
    await expect(
      env.service.stageAction(stageRequest(app.id), from)
    ).rejects.toMatchObject({
      code: "STAGE_TOO_FAST",
    });
  });
});

const withOpenUrl = (draft: MiniAppDraft): MiniAppDraft => ({
  ...draft,
  actions: [
    ...draft.actions,
    {
      bind: { region: { from: "input", name: "region" } },
      id: "open-region",
      label: "Open region",
      scope: "widget",
      target: {
        baseUrl: "https://evil.example",
        kind: "open-url",
        path: "/r/{{region}}",
        query: {},
      },
    },
  ],
});

describe("saving from an app window", () => {
  it("keeps layout edits, renames and removals working", async () => {
    const env = setup();
    const app = await savedDesk(env);
    const draft = {
      ...desk(),
      actions: desk().actions.slice(0, 1),
      id: app.id,
      inputs: desk().inputs.map((input) => ({ ...input, fixed: true })),
      name: "Refunds",
    };
    const layout = {
      ...draft.layout,
      elements: { ...draft.layout.elements },
    };
    await expect(
      env.service.saveMiniApp(
        { draft: { ...draft, layout }, reviewedActionIds: [] },
        { appId: app.id, kind: "window" }
      )
    ).resolves.toMatchObject({ name: "Refunds" });
  });

  it("refuses a new action, source or input, and another app", async () => {
    const env = setup();
    const app = await savedDesk(env);
    const origin = { appId: app.id, kind: "window" } as const;
    await expect(
      env.service.saveMiniApp(
        {
          draft: { ...withOpenUrl(desk()), id: app.id },
          reviewedActionIds: ["open-region"],
        },
        origin
      )
    ).rejects.toMatchObject({ code: "WINDOW_EDIT_REFUSED" });
    const sources = {
      ...desk().sources,
      regions: {
        ...present(desk().sources.regions),
        sqlTemplate: "SELECT secret FROM vault",
      },
    };
    await expect(
      env.service.saveMiniApp(
        {
          draft: { ...desk(), id: app.id, sources },
          reviewedActionIds: ["refund"],
        },
        origin
      )
    ).rejects.toMatchObject({ code: "WINDOW_EDIT_REFUSED" });
    await expect(
      env.service.saveMiniApp(
        { draft: { ...desk(), id: app.id }, reviewedActionIds: [] },
        { appId: "other", kind: "window" }
      )
    ).rejects.toMatchObject({ code: "NOT_THIS_WINDOW" });
  });

  it("accepts what bun generated for this app, still behind the review tick", async () => {
    const env = setup();
    const app = await savedDesk(env);
    env.drafts.set("g-change", { ...withOpenUrl(desk()), id: app.id });
    const origin = { appId: app.id, kind: "window" } as const;
    await expect(
      env.service.saveMiniApp(
        {
          draft: { ...withOpenUrl(desk()), id: app.id },
          fromGenId: "g-change",
          reviewedActionIds: [],
        },
        origin
      )
    ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
    await expect(
      env.service.saveMiniApp(
        {
          draft: { ...withOpenUrl(desk()), id: app.id },
          fromGenId: "g-change",
          reviewedActionIds: ["open-region"],
        },
        origin
      )
    ).resolves.toMatchObject({ id: app.id });
  });
});

describe("review ticks", () => {
  it("needs a tick for links and service calls, not for copy", async () => {
    const env = setup();
    await expect(
      env.service.saveMiniApp({
        draft: withOpenUrl(desk()),
        reviewedActionIds: ["refund"],
      })
    ).rejects.toMatchObject({
      code: "ACTION_NOT_REVIEWED",
      message: expect.stringContaining("Open region"),
    });
    await expect(
      env.service.saveMiniApp({
        draft: withOpenUrl(desk()),
        reviewedActionIds: ["refund", "open-region"],
      })
    ).resolves.toMatchObject({ name: "Refund desk" });
  });
});

const origin = (appId: string) => ({ appId, kind: "window" }) as const;

describe("window saves that add actions", () => {
  const linkSave = (appId: string) => ({
    draft: { ...withOpenUrl(desk()), id: appId },
    fromGenId: "g-link",
    reviewedActionIds: ["open-region"],
  });

  it("asks natively with the label, effect, template and values", async () => {
    const env = setup();
    const app = await savedDesk(env);
    env.drafts.set("g-link", { ...withOpenUrl(desk()), id: app.id });
    await env.service.saveMiniApp(linkSave(app.id), origin(app.id));
    expect(env.appConfirm).toHaveBeenCalledOnce();
    expect(env.appConfirm.mock.calls[0]?.[0]).toMatchObject({
      confirmLabel: "Save App",
      title: "Save app actions",
    });
    expect(env.appConfirm.mock.calls[0]?.[0].detail).toBe(
      "Open region — Opens link\nhttps://evil.example/r/{{region}}\nValues: region ← input region"
    );
  });

  it("saves nothing when the dialog is declined", async () => {
    const env = setup();
    const app = await savedDesk(env);
    env.drafts.set("g-link", { ...withOpenUrl(desk()), id: app.id });
    env.appConfirm.mockResolvedValueOnce(false);
    await expect(
      env.service.saveMiniApp(linkSave(app.id), origin(app.id))
    ).rejects.toMatchObject({ code: "REVIEW_DECLINED" });
    const stored = await env.service.getMiniApp(app.id);
    expect(stored?.actions.map((action) => action.id)).toStrictEqual([
      "refund",
      "copy-region",
    ]);
  });

  it("saves the new action once accepted", async () => {
    const env = setup();
    const app = await savedDesk(env);
    env.drafts.set("g-link", { ...withOpenUrl(desk()), id: app.id });
    const saved = await env.service.saveMiniApp(
      linkSave(app.id),
      origin(app.id)
    );
    expect(saved.actions.map((action) => action.id)).toContain("open-region");
  });

  it("never asks for unchanged actions from a window, or for launcher saves", async () => {
    const env = setup();
    const app = await savedDesk(env);
    await env.service.saveMiniApp(
      {
        draft: { ...desk(), id: app.id, name: "Refunds" },
        reviewedActionIds: [],
      },
      origin(app.id)
    );
    await env.service.saveMiniApp({
      draft: { ...withOpenUrl(desk()), id: app.id },
      reviewedActionIds: ["open-region"],
    });
    expect(env.appConfirm).not.toHaveBeenCalled();
  });

  it("refuses an unticked new action before any dialog", async () => {
    const env = setup();
    const app = await savedDesk(env);
    env.drafts.set("g-link", { ...withOpenUrl(desk()), id: app.id });
    await expect(
      env.service.saveMiniApp(
        { ...linkSave(app.id), reviewedActionIds: [] },
        origin(app.id)
      )
    ).rejects.toMatchObject({ code: "ACTION_NOT_REVIEWED" });
    expect(env.appConfirm).not.toHaveBeenCalled();
  });
});
