import type { LanguageModel } from "@conch/agent";
import type { DatabaseConnection } from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type {
  ParamDef,
  RecentAsk,
  SqlSource,
  Widget,
  WidgetDraft,
} from "@conch/rpc";

import { getConnections } from "@conch/core";
import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { FakeSourceOptions } from "./test-fake-sources.ts";
import type {
  RecentAskStore,
  RunLogStore,
  WidgetStore,
} from "./widget-service.ts";

import { valuesKeyOf } from "./run-samples.ts";
import { createSourceRunner } from "./source-runner.ts";
import { fakeSources } from "./test-fake-sources.ts";
import { createWidgetService } from "./widget-service.ts";

vi.mock(import("@conch/core"), async (importOriginal) => ({
  ...(await importOriginal()),
  getConnections: vi.fn(),
}));

const connection: DatabaseConnection = {
  createdAt: "2026-11-18T00:00:00.000Z",
  database: "oh_my_query",
  host: "127.0.0.1",
  id: "conn-1",
  lastConnectedAt: null,
  name: "analytics",
  password: "secret",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "conch",
};

vi.mocked(getConnections).mockResolvedValue([connection]);

const NOW = new Date(2026, 10, 18, 9, 0);

const TEMPLATE = `select region, sum(mrr) as mrr from revenue
where billed_at >= {{period.from}}::date and billed_at < {{period.to}}::date
  and region = {{region}}
group by 1`;

type SqlOverrides = Partial<Omit<SqlSource, "kind">>;
type WidgetOverrides = Partial<Widget> & SqlOverrides;

const sqlSource = ({
  connectionId = "conn-1",
  database = null,
  dialect = "postgresql",
  sqlTemplate = TEMPLATE,
}: SqlOverrides = {}): SqlSource => ({
  connectionId,
  database,
  dialect,
  kind: "sql",
  sqlTemplate,
});

const widgetFixture = ({
  connectionId,
  database,
  dialect,
  sqlTemplate,
  ...overrides
}: WidgetOverrides = {}): Widget => ({
  createdAt: "2026-11-01T00:00:00.000Z",
  id: "w1",
  lastRunAt: null,
  lastValues: {},
  name: "Revenue by region",
  params: [
    {
      default: "lastQuarter",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
    {
      default: "Europe",
      label: "Region",
      name: "region",
      optionsSql: "select distinct region from revenue order by 1",
      type: "select",
    },
  ],
  prompt: "revenue by region",
  source: sqlSource({ connectionId, database, dialect, sqlTemplate }),
  spec: {
    formats: {},
    title: "Revenue",
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  updatedAt: "2026-11-01T00:00:00.000Z",
  version: 2,
  view: "table",
  ...overrides,
});

const memoryWidgets = (initial: Widget[] = []): WidgetStore => {
  let items = [...initial];
  return {
    deleteWidget: (id) => {
      items = items.filter((item) => item.id !== id);
      return Promise.resolve();
    },
    getWidget: (id) => {
      const found = items.find((item) => item.id === id) ?? null;
      return Promise.resolve(found);
    },
    listWidgets: () => {
      const all = [...items];
      return Promise.resolve(all);
    },
    saveWidget: (widget) => {
      items = [...items.filter((item) => item.id !== widget.id), widget];
      return Promise.resolve(widget);
    },
    updateWidget: (id, change) => {
      const current = items.find((item) => item.id === id);
      if (!current) {
        return Promise.resolve(null);
      }
      const next = change(current);
      items = items.map((item) => (item.id === id ? next : item));
      return Promise.resolve(next);
    },
  };
};

const memoryRecents = (): RecentAskStore & { items: RecentAsk[] } => {
  const items: RecentAsk[] = [];
  return {
    clearRecentAsks: () => {
      items.length = 0;
      return Promise.resolve();
    },
    items,
    listRecentAsks: (limit) => {
      const newest = items.slice(0, limit);
      return Promise.resolve(newest);
    },
    pushRecentAsk: (ask) => {
      items.unshift(ask);
      return Promise.resolve();
    },
    removeRecentAsk: (id) => {
      const index = items.findIndex((item) => item.id === id);
      items.splice(index, 1);
      return Promise.resolve();
    },
  };
};

const tabular = (rows: unknown[][]) => ({
  columns: [{ name: "region", typeName: "TEXT" }],
  executionTimeMs: 3,
  isTruncated: false,
  resultType: "tabular" as const,
  rowCount: rows.length,
  rows,
});

type ExecuteArgs = [
  sql: string,
  maxRows: number,
  schema: string,
  signal: AbortSignal,
  options?: unknown,
];

const fakePool = (dialect: "postgresql" | null = "postgresql") => ({
  dialect,
  execute: vi.fn((...[sql]: ExecuteArgs) => {
    const rows = sql.includes("distinct")
      ? [["Europe"], ["North America"], [null]]
      : [["Europe", 1]];
    return Promise.resolve(tabular(rows));
  }),
  executeWrite: vi.fn(),
  listDatabases: vi.fn().mockResolvedValue(["public"]),
});

const recentAsk = (id: string): RecentAsk => ({
  askedAt: NOW.toISOString(),
  connectionId: "conn-1",
  database: null,
  dialect: "postgresql",
  id,
  prompt: `question ${id}`,
  spec: widgetFixture().spec,
  sql: "select 1",
});

type Entry = Awaited<ReturnType<RunLogStore["append"]>>;

const memoryRunLog = (): RunLogStore & { entries: Map<string, Entry> } => {
  const entries = new Map<string, Entry>();
  return {
    append: (widgetId, valuesKey, sample) => {
      const id = `${widgetId}:${valuesKey}`;
      const entry = {
        id,
        samples: [...(entries.get(id)?.samples ?? []), sample],
        valuesKey,
        widgetId,
      };
      entries.set(id, entry);
      return Promise.resolve(entry);
    },
    entries,
    entry: (widgetId, valuesKey) => {
      const found = entries.get(`${widgetId}:${valuesKey}`) ?? null;
      return Promise.resolve(found);
    },
    latestFor: (widgetIds) => {
      const latest = Object.fromEntries(
        [...entries.values()]
          .filter((entry) => widgetIds.includes(entry.widgetId))
          .map((entry) => [entry.widgetId, entry])
      );
      return Promise.resolve(latest);
    },
    removeForWidget: (widgetId) => {
      for (const [id, entry] of entries) {
        if (entry.widgetId === widgetId) {
          entries.delete(id);
        }
      }
      return Promise.resolve();
    },
  };
};

const setup = (
  options: {
    widgets?: Widget[];
    pool?: ReturnType<typeof fakePool>;
    model?: LanguageModel | null;
    runLog?: RunLogStore;
    sources?: FakeSourceOptions;
  } = {}
) => {
  const pool = options.pool ?? fakePool();
  const pools = {
    connect: vi.fn<ConnectionPoolManager["connect"]>().mockResolvedValue(),
    getPool: vi.fn(() => pool),
    has: vi.fn(() => true),
  };
  const widgets = memoryWidgets(options.widgets ?? [widgetFixture()]);
  const recents = memoryRecents();
  const runLog = options.runLog ?? memoryRunLog();
  const onSampled = vi.fn();
  const loadModel = vi.fn().mockResolvedValue(options.model ?? null);
  const sources = fakeSources(options.sources);
  const runner = createSourceRunner({
    fetchJson: sources.fetchJson,
    httpEndpoints: sources.endpoints,
    mcp: sources.mcp,
    mcpServers: sources.servers,
    pools: pools as unknown as ConnectionPoolManager,
  });
  const runCache = { record: vi.fn() };
  const service = createWidgetService({
    loadModel,
    now: () => NOW,
    onSampled,
    recents,
    runCache,
    runLog,
    runner,
    widgets,
  });
  return {
    loadModel,
    onSampled,
    pool,
    recents,
    runCache,
    runLog,
    service,
    sources,
    widgets,
  };
};

const run = (values: Record<string, unknown> = {}) => ({
  runId: "r1",
  values: values as never,
  widgetId: "w1",
});

describe("runWidget", () => {
  it("binds values as parameters and runs read-only without the model", async () => {
    const { loadModel, pool, service } = setup();
    const outcome = await service.runWidget(run({ region: "North America" }));

    const call = pool.execute.mock.calls.find(
      ([sql]) => !sql.includes("distinct")
    );
    expect(call?.slice(0, 2)).toStrictEqual([
      expect.stringMatching(
        /billed_at >= \$1::date and billed_at < \$2::date[\s\S]*region = \$3/
      ),
      2000,
    ]);
    expect(call?.[4]).toStrictEqual({
      params: ["2026-07-01", "2026-10-01", "North America"],
      readOnly: true,
    });
    expect(JSON.stringify(outcome.compiled)).not.toContain("North America");
    expect(outcome.values).toStrictEqual({
      period: "lastQuarter",
      region: "North America",
    });
    expect(loadModel).not.toHaveBeenCalled();
  });

  it("falls back to last values, then to defaults", async () => {
    const { pool, service } = setup({
      widgets: [widgetFixture({ lastValues: { period: "ytd" } })],
    });
    const outcome = await service.runWidget(run());
    expect(outcome.values).toStrictEqual({ period: "ytd", region: "Europe" });
    expect(pool.execute.mock.calls.at(-1)?.[4]).toMatchObject({
      params: ["2026-01-01", "2026-11-19", "Europe"],
    });
  });

  it("stores the values and run time after a run", async () => {
    const { service, widgets } = setup();
    await service.runWidget(run({ period: "last7d" }));
    const stored = await widgets.getWidget("w1");
    expect(stored?.lastValues).toStrictEqual({
      period: "last7d",
      region: "Europe",
    });
    expect(stored?.lastRunAt).toBe(NOW.toISOString());
  });

  it("refuses a select value that isn't one of the loaded options", async () => {
    const { service } = setup();
    await expect(
      service.runWidget(run({ region: "x'; drop table revenue; --" }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses an input the widget doesn't declare", async () => {
    const { service } = setup();
    await expect(service.runWidget(run({ extra: "1" }))).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Unknown input: extra.",
    });
  });

  it("binds a fixed input's default and refuses a value for it", async () => {
    const fixed = widgetFixture({
      params: [
        {
          default: "lastQuarter",
          label: "Period",
          name: "period",
          type: "dateRange",
        },
        {
          default: "Europe",
          fixed: true,
          label: "Region",
          name: "region",
          options: ["Europe", "North America"],
          type: "select",
        },
      ],
    });
    const { pool, service } = setup({ widgets: [fixed] });
    await expect(
      service.runWidget(run({ region: "North America" }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await service.runWidget(run());
    expect(pool.execute.mock.calls.at(-1)?.[4]).toMatchObject({
      params: ["2026-07-01", "2026-10-01", "Europe"],
    });
  });

  it("refuses a malformed custom range", async () => {
    const { service } = setup();
    await expect(
      service.runWidget(
        run({ period: { from: "2026-10-01", to: "2026-07-01" } })
      )
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses a template that writes", async () => {
    const { pool, service } = setup({
      widgets: [
        widgetFixture({
          params: [],
          sqlTemplate: "delete from revenue",
        }),
      ],
    });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "NOT_READ_ONLY",
    });
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("reports a widget whose connection is gone", async () => {
    const { service } = setup({
      widgets: [widgetFixture({ connectionId: "gone" })],
    });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "CONNECTION_MISSING",
    });
  });

  it("reports a missing widget", async () => {
    const { service } = setup({ widgets: [] });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "WIDGET_NOT_FOUND",
    });
  });

  it("refuses engines without SQL", async () => {
    const { service } = setup({ pool: fakePool(null) });
    await expect(service.runWidget(run())).rejects.toMatchObject({
      code: "UNSUPPORTED_ENGINE",
    });
  });

  it("cancels a run by id", async () => {
    const pool = fakePool();
    pool.execute.mockImplementation((...args: ExecuteArgs) => {
      const { promise, reject } = Promise.withResolvers<never>();
      const { 3: signal } = args;
      signal.addEventListener("abort", () => reject(signal.reason));
      return promise;
    });
    const { service } = setup({
      pool,
      widgets: [widgetFixture({ params: [], sqlTemplate: "select 1" })],
    });
    const pending = service.runWidget(run());
    await vi.waitFor(() => expect(pool.execute).toHaveBeenCalledOnce());
    service.cancelRun("r1");
    await expect(pending).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
  });
});

const kpiWidget = (overrides: Partial<Widget> = {}): Widget =>
  widgetFixture({
    spec: {
      formats: {},
      title: "Revenue",
      version: 1,
      view: { kind: "kpi", value: "mrr" },
    },
    view: "kpi",
    ...overrides,
  });

const mrrPool = (mrr: number) => {
  const pool = fakePool();
  const kpiRows = {
    ...tabular([["Europe", mrr]]),
    columns: [
      { name: "region", typeName: "TEXT" },
      { name: "mrr", typeName: "NUMERIC" },
    ],
  };
  const options = tabular([["Europe"], ["North America"]]);
  pool.execute.mockImplementation((...[sql]: ExecuteArgs) => {
    const rows = sql.includes("distinct") ? options : kpiRows;
    return Promise.resolve(rows);
  });
  return pool;
};

describe("samples and trends", () => {
  it("records a sample per run under the unexpanded preset values", async () => {
    const { onSampled, runLog, service } = setup({
      pool: mrrPool(48_200),
      widgets: [kpiWidget()],
    });
    await service.runWidget(run({ period: "last30d" }));
    const outcome = await service.runWidget(run({ period: "last30d" }));

    const key = valuesKeyOf({ period: "last30d", region: "Europe" });
    const entry = await runLog.entry("w1", key);
    expect(entry?.samples).toHaveLength(2);
    expect(entry?.samples.at(-1)).toMatchObject({
      at: NOW.toISOString(),
      rowCount: 1,
      value: 48_200,
    });
    expect(onSampled).toHaveBeenCalledWith("w1", key);
    expect(outcome.trend).toMatchObject({
      series: [48_200, 48_200],
      valuesKey: key,
    });
  });

  it("appends nothing when the run fails", async () => {
    const pool = fakePool();
    pool.execute.mockRejectedValue(new Error("connection reset"));
    const { onSampled, runLog, service } = setup({
      pool,
      widgets: [widgetFixture({ params: [], sqlTemplate: "select 1" })],
    });
    await expect(service.runWidget(run())).rejects.toThrow("connection reset");
    await expect(runLog.latestFor(["w1"])).resolves.toStrictEqual({});
    expect(onSampled).not.toHaveBeenCalled();
  });

  it("still returns the result when the run log can't be written", async () => {
    const runLog = memoryRunLog();
    vi.spyOn(runLog, "append").mockRejectedValue(new Error("disk full"));
    const error = vi.spyOn(console, "error").mockReturnValue();
    const { service } = setup({ runLog });

    const outcome = await service.runWidget(run());
    expect(outcome.result.rowCount).toBe(1);
    expect(outcome.trend).toBeNull();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("lists the latest trend per widget", async () => {
    const { service } = setup({
      pool: mrrPool(10),
      widgets: [kpiWidget()],
    });
    await service.runWidget(run());
    const trends = await service.listWidgetTrends(["w1", "w2"]);
    expect(Object.keys(trends)).toStrictEqual(["w1"]);
    expect(trends.w1?.latest?.value).toBe(10);
    expect(trends.w1?.previous).toBeNull();
  });

  it("forgets a deleted widget's samples", async () => {
    const { runLog, service } = setup();
    await service.runWidget(run());
    await service.deleteWidget("w1");
    await expect(runLog.latestFor(["w1"])).resolves.toStrictEqual({});
  });
});

const signal = () => new AbortController().signal;

describe("runDetached", () => {
  it("leaves lastRunAt and lastValues untouched", async () => {
    const original = kpiWidget({ lastValues: { region: "North America" } });
    const { loadModel, service, widgets } = setup({
      pool: mrrPool(48_200),
      widgets: [original],
    });
    const outcome = await service.runDetached(
      "w1",
      { period: "last7d" },
      signal()
    );

    await expect(widgets.getWidget("w1")).resolves.toStrictEqual(original);
    expect(outcome.values).toStrictEqual({
      period: "last7d",
      region: "Europe",
    });
    expect(outcome.sample.value).toBe(48_200);
    expect(outcome.previous).toBeNull();
    expect(loadModel).not.toHaveBeenCalled();
  });

  it("drops inputs the widget no longer has instead of refusing", async () => {
    const { service } = setup();
    const outcome = await service.runDetached(
      "w1",
      { gone: "x", period: "ytd" },
      signal()
    );
    expect(outcome.values).toStrictEqual({ period: "ytd", region: "Europe" });
  });

  it("returns the previous sample for the same inputs and finds it again", async () => {
    const { service } = setup({
      pool: mrrPool(5),
      widgets: [kpiWidget()],
    });
    await service.runDetached("w1", { period: "last30d" }, signal());
    const second = await service.runDetached(
      "w1",
      { period: "last30d" },
      signal()
    );
    expect(second.previous?.value).toBe(5);
    expect(second.valuesKey).toBe(
      valuesKeyOf({ period: "last30d", region: "Europe" })
    );
    await expect(
      service.lastSampleFor("w1", { period: "last30d" })
    ).resolves.toMatchObject({ value: 5 });
    await expect(service.lastSampleFor("gone", {})).resolves.toBeNull();
  });

  it("can run without recording a sample", async () => {
    const { runLog, service } = setup({
      pool: mrrPool(5),
      widgets: [kpiWidget()],
    });
    const outcome = await service.runDetached("w1", {}, signal(), {
      record: false,
    });
    expect(outcome.sample.value).toBe(5);
    expect(outcome.previous).toBeNull();
    await expect(runLog.latestFor(["w1"])).resolves.toStrictEqual({});
  });

  it("runs read-only with bound parameters", async () => {
    const { pool, service } = setup();
    await service.runDetached("w1", {}, signal());
    expect(pool.execute.mock.calls.at(-1)?.[4]).toMatchObject({
      readOnly: true,
    });
  });

  it("reports a missing widget", async () => {
    const { service } = setup({ widgets: [] });
    await expect(service.runDetached("w1", {}, signal())).rejects.toMatchObject(
      { code: "WIDGET_NOT_FOUND" }
    );
  });
});

describe("loadParamOptions", () => {
  it("runs the options query read-only and returns distinct strings", async () => {
    const { pool, service } = setup();
    await expect(
      service.loadParamOptions("w1", "region")
    ).resolves.toStrictEqual(["Europe", "North America"]);
    expect(pool.execute).toHaveBeenCalledWith(
      "select distinct region from revenue order by 1",
      200,
      "public",
      expect.any(AbortSignal),
      { params: undefined, readOnly: true }
    );
  });

  it("caches options for a minute", async () => {
    const { pool, service } = setup();
    await service.loadParamOptions("w1", "region");
    await service.loadParamOptions("w1", "region");
    expect(pool.execute).toHaveBeenCalledOnce();
  });

  it("returns static options without a query", async () => {
    const { pool, service } = setup({
      widgets: [
        widgetFixture({
          params: [
            {
              default: "EU",
              label: "Region",
              name: "region",
              options: ["EU", "US"],
              type: "select",
            },
          ],
          sqlTemplate: "select * from t where r = {{region}}",
        }),
      ],
    });
    await expect(
      service.loadParamOptions("w1", "region")
    ).resolves.toStrictEqual(["EU", "US"]);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("rejects an input without options", async () => {
    const { service } = setup();
    await expect(
      service.loadParamOptions("w1", "period")
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

const draft = ({
  connectionId,
  database,
  dialect,
  sqlTemplate,
  ...overrides
}: Partial<WidgetDraft> & SqlOverrides = {}): WidgetDraft => {
  const {
    createdAt: _c,
    id: _i,
    lastRunAt: _l,
    updatedAt: _u,
    version: _v,
    ...rest
  } = widgetFixture({ connectionId, database, dialect, sqlTemplate });
  return { ...rest, ...overrides };
};

describe("saveWidget", () => {
  it("creates a widget with fresh timestamps and an id", async () => {
    const { service, widgets } = setup({ widgets: [] });
    const saved = await service.saveWidget(draft());
    expect(saved.id).toMatch(/^[\da-f-]{36}$/);
    expect(saved.createdAt).toBe(NOW.toISOString());
    expect(saved.lastRunAt).toBeNull();
    await expect(widgets.listWidgets()).resolves.toHaveLength(1);
  });

  it("keeps createdAt and lastRunAt when updating", async () => {
    const { service } = setup({
      widgets: [widgetFixture({ lastRunAt: "2026-11-10T00:00:00.000Z" })],
    });
    const saved = await service.saveWidget(draft({ id: "w1", name: "MRR" }));
    expect(saved).toMatchObject({
      createdAt: "2026-11-01T00:00:00.000Z",
      lastRunAt: "2026-11-10T00:00:00.000Z",
      name: "MRR",
    });
  });

  it("drops last values for inputs that were removed or no longer fit", async () => {
    const { service } = setup({ widgets: [] });
    const saved = await service.saveWidget(
      draft({
        lastValues: { gone: 1, period: "ytd", region: 7 },
      })
    );
    expect(saved.lastValues).toStrictEqual({ period: "ytd" });
  });

  it("refuses a template that doesn't compile with its inputs", async () => {
    const { service } = setup({ widgets: [] });
    await expect(
      service.saveWidget(draft({ params: [] }))
    ).rejects.toMatchObject({ code: "INVALID_TEMPLATE" });
  });

  it("refuses a template that writes", async () => {
    const { service } = setup({ widgets: [] });
    await expect(
      service.saveWidget(
        draft({ params: [], sqlTemplate: "drop table revenue" })
      )
    ).rejects.toMatchObject({ code: "NOT_READ_ONLY" });
  });
});

describe("listing and recents", () => {
  it("lists the most recently run widgets first", async () => {
    const { service } = setup({
      widgets: [
        widgetFixture({ id: "old", lastRunAt: null }),
        widgetFixture({ id: "ran", lastRunAt: "2026-11-17T00:00:00.000Z" }),
      ],
    });
    const widgets = await service.listWidgets();
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toStrictEqual(["ran", "old"]);
  });

  it("deletes a widget", async () => {
    const { service } = setup();
    await service.deleteWidget("w1");
    await expect(service.listWidgets()).resolves.toStrictEqual([]);
  });

  it("remembers asks for the root list", async () => {
    const { service } = setup();
    const ask: RecentAsk = {
      askedAt: NOW.toISOString(),
      connectionId: "conn-1",
      database: null,
      dialect: "postgresql",
      id: "a1",
      prompt: "mrr",
      spec: widgetFixture().spec,
      sql: "select 1",
    };
    await service.rememberAsk(ask);
    await expect(service.listRecentAsks()).resolves.toStrictEqual([ask]);
  });

  it("lists the newest recent asks up to a limit", async () => {
    const { service } = setup();
    await service.rememberAsk(recentAsk("a1"));
    await service.rememberAsk(recentAsk("a2"));
    const ids = async (limit?: number) => {
      const asks = await service.listRecentAsks({ limit });
      return asks.map((ask) => ask.id);
    };
    await expect(ids(1)).resolves.toStrictEqual(["a2"]);
    await expect(ids()).resolves.toStrictEqual(["a2", "a1"]);
  });

  it.each([
    [0, "Too small"],
    [501, "Too big"],
    [1.5, "expected int"],
  ])("rejects a recent-ask limit of %s", async (limit, message) => {
    const { service } = setup();
    await expect(service.listRecentAsks({ limit })).rejects.toThrow(message);
  });

  it("removes one recent ask and clears them all", async () => {
    const { service } = setup();
    await service.rememberAsk(recentAsk("a1"));
    await service.rememberAsk(recentAsk("a2"));
    await service.deleteRecentAsk("a1");
    await expect(service.listRecentAsks()).resolves.toStrictEqual([
      recentAsk("a2"),
    ]);
    await service.clearRecentAsks();
    await expect(service.listRecentAsks()).resolves.toStrictEqual([]);
  });

  it("rejects an empty ask id", async () => {
    const { service } = setup();
    await expect(service.deleteRecentAsk("")).rejects.toThrow("Too small");
  });
});

describe("proposeParams", () => {
  it("asks for AI settings when there is no model", async () => {
    const { service } = setup();
    await expect(
      service.proposeParams({
        dialect: "postgresql",
        prompt: "q",
        sql: "select 1",
      })
    ).resolves.toStrictEqual({
      error: "Add an AI provider in Settings to find inputs.",
    });
  });

  it("validates the request", async () => {
    const { service } = setup();
    await expect(
      service.proposeParams({ dialect: "postgresql", prompt: "q", sql: " " })
    ).rejects.toThrow(/too_small|at least 1/i);
  });
});

const STATUS_PARAM: ParamDef = {
  default: "needs_response",
  label: "Status",
  name: "status",
  options: ["needs_response", "won"],
  type: "select",
};

const mcpWidget = (overrides: Partial<Widget> = {}): Widget =>
  widgetFixture({
    id: "w-mcp",
    lastRunAt: "2026-11-10T00:00:00.000Z",
    name: "Open disputes",
    params: [
      STATUS_PARAM,
      { default: 20, label: "Limit", name: "limit", type: "number" },
    ],
    source: {
      args: { limit: { $param: "limit" }, status: { $param: "status" } },
      kind: "mcp",
      select: "$.data[*]",
      serverId: "stripe",
      tool: "list_disputes",
    },
    ...overrides,
  });

const httpWidget = (): Widget =>
  widgetFixture({
    id: "w-http",
    lastRunAt: "2026-11-12T00:00:00.000Z",
    name: "Incidents",
    params: [STATUS_PARAM],
    source: {
      endpointId: "status",
      kind: "http",
      method: "GET",
      path: "/incidents/{{status}}",
      query: { limit: 5 },
      select: "$.incidents[*]",
    },
  });

const runOf = (widgetId: string, values: Record<string, unknown> = {}) => ({
  runId: `run-${widgetId}`,
  values: values as never,
  widgetId,
});

describe("widgets with MCP and HTTP sources", () => {
  it("lists SQL, MCP and HTTP widgets together by recency", async () => {
    const { service } = setup({
      widgets: [widgetFixture(), mcpWidget(), httpWidget()],
    });
    const widgets = await service.listWidgets();
    expect(widgets.map((widget) => widget.source.kind)).toStrictEqual([
      "http",
      "mcp",
      "sql",
    ]);
  });

  it("sends input values to the tool as JSON numbers and strings, without the model", async () => {
    const { loadModel, service, sources, widgets } = setup({
      widgets: [mcpWidget()],
    });
    const outcome = await service.runWidget(
      runOf("w-mcp", { limit: 3, status: "won" })
    );

    expect(sources.fixture.calls).toStrictEqual([
      { args: { limit: 3, status: "won" }, tool: "list_disputes" },
    ]);
    expect(outcome.compiled).toStrictEqual({
      args: { limit: 3, status: "won" },
      kind: "mcp",
      server: "Stripe",
      tool: "list_disputes",
    });
    expect(outcome.result.rows).toStrictEqual([[450, "dp_2", "won"]]);
    expect(loadModel).not.toHaveBeenCalled();
    await expect(widgets.getWidget("w-mcp")).resolves.toMatchObject({
      lastRunAt: NOW.toISOString(),
      lastValues: { limit: 3, status: "won" },
    });
  });

  it("refuses the next run once the tool stops being read-only", async () => {
    const { service, sources } = setup({ widgets: [mcpWidget()] });
    await service.runWidget(runOf("w-mcp"));
    sources.fixture.state.listReadOnly = false;
    sources.clock.now += 60_000;
    sources.mcp.invalidate("stripe");
    await expect(service.runWidget(runOf("w-mcp"))).rejects.toMatchObject({
      code: "TOOL_NOT_READ_ONLY",
    });
    expect(sources.fixture.calls).toHaveLength(1);
  });

  it("rejects inputs the widget doesn't have and values outside the options", async () => {
    const { service, sources } = setup({ widgets: [mcpWidget()] });
    await expect(
      service.runWidget(runOf("w-mcp", { customer: "cus_1" }))
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Unknown input: customer.",
    });
    await expect(
      service.runWidget(runOf("w-mcp", { status: "lost" }))
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(sources.fixture.calls).toStrictEqual([]);
  });

  it("requests the URL built from the inputs", async () => {
    const { service, sources } = setup({ widgets: [httpWidget()] });
    const outcome = await service.runWidget(runOf("w-http", { status: "won" }));
    expect(sources.requests).toStrictEqual([
      {
        endpoint: "Status API",
        url: "https://status.example.com/api/incidents/won?limit=5",
      },
    ]);
    expect(outcome.compiled).toStrictEqual({
      endpoint: "Status API",
      kind: "http",
      url: "https://status.example.com/api/incidents/won?limit=5",
    });
  });

  it("runs a detached MCP widget for watches", async () => {
    const { service } = setup({ widgets: [mcpWidget()] });
    const run = await service.runDetached(
      "w-mcp",
      { status: "won" },
      new AbortController().signal
    );
    expect(run.compiled.kind).toBe("mcp");
    expect(run.values).toStrictEqual({ limit: 20, status: "won" });
  });

  it("only offers static options for MCP inputs", async () => {
    const { pool, service } = setup({ widgets: [mcpWidget()] });
    await expect(
      service.loadParamOptions("w-mcp", "status")
    ).resolves.toStrictEqual(["needs_response", "won"]);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("saves a read call and refuses one that writes", async () => {
    const { service } = setup({ widgets: [] });
    const {
      createdAt: _c,
      id: _i,
      lastRunAt: _l,
      updatedAt: _u,
      version: _v,
      ...draft
    } = mcpWidget();
    await expect(service.saveWidget(draft)).resolves.toMatchObject({
      source: { kind: "mcp", tool: "list_disputes" },
      version: 2,
    });
    await expect(
      service.saveWidget({
        ...draft,
        params: [],
        source: {
          args: { charge: "ch_1" },
          kind: "mcp",
          select: "$",
          serverId: "stripe",
          tool: "refund_charge",
        },
      })
    ).rejects.toMatchObject({ code: "TOOL_NOT_READ_ONLY" });
    await expect(
      service.saveWidget({
        ...draft,
        source: {
          args: { limit: { $param: "limit" }, status: { $param: "status" } },
          kind: "mcp",
          select: "$",
          serverId: "gone",
          tool: "list_disputes",
        },
      })
    ).rejects.toMatchObject({ code: "SOURCE_MISSING" });
  });
});

describe("previewSource", () => {
  const preview = {
    params: [STATUS_PARAM],
    prompt: "open disputes",
    runId: "p1",
    source: {
      args: { status: { $param: "status" } },
      kind: "mcp" as const,
      select: "$.data[*]",
      serverId: "stripe",
      tool: "list_disputes",
    },
    values: {},
  };

  it("runs the call with defaults and infers a card, storing nothing", async () => {
    const { service, widgets } = setup({ widgets: [] });
    const outcome = await service.previewSource(preview);
    expect(outcome.values).toStrictEqual({ status: "needs_response" });
    expect(outcome.result.rows).toStrictEqual([
      [1200, "dp_1", "needs_response"],
    ]);
    expect(outcome.spec).toMatchObject({
      version: CARD_SPEC_VERSION,
      view: { kind: "kpi" },
    });
    await expect(widgets.listWidgets()).resolves.toStrictEqual([]);
  });

  it("refuses a write tool and an unused input", async () => {
    const { service, sources } = setup({ widgets: [] });
    await expect(
      service.previewSource({
        ...preview,
        params: [],
        source: { ...preview.source, args: {}, tool: "refund_charge" },
      })
    ).rejects.toMatchObject({ code: "TOOL_NOT_READ_ONLY" });
    await expect(
      service.previewSource({
        ...preview,
        source: { ...preview.source, args: {} },
      })
    ).rejects.toMatchObject({
      code: "INVALID_TEMPLATE",
      message: 'The input "status" isn\'t used by the call.',
    });
    expect(sources.fixture.calls).toStrictEqual([]);
  });

  it("can be cancelled like a widget run", async () => {
    const { service } = setup({ widgets: [] });
    const pending = service.previewSource({ ...preview, runId: "p-cancel" });
    service.cancelRun("p-cancel");
    await expect(pending).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
  });
});

describe("proposeSource", () => {
  it("asks for AI settings when there is no model", async () => {
    const { service } = setup();
    await expect(
      service.proposeSource({
        prompt: "open disputes",
        target: { id: "stripe", type: "mcp" },
      })
    ).resolves.toStrictEqual({
      error: "Add an AI provider in Settings, or fill the call in by hand.",
    });
  });
});

describe("write isolation", () => {
  it("never reaches executeWrite from runWidget, a detached run or previewSource", async () => {
    const { pool, service } = setup();
    await service.runWidget(run(), { cacheRun: true });
    await service.runDetached("w1", {}, new AbortController().signal);
    await service.previewSource({
      params: [],
      runId: "p1",
      source: sqlSource({ sqlTemplate: "select region from revenue" }),
      values: {},
    });
    expect(pool.execute.mock.calls.length).toBeGreaterThan(0);
    expect(pool.executeWrite).not.toHaveBeenCalled();
  });

  it("caches a launcher run for row actions and skips board runs", async () => {
    const { runCache, service } = setup();
    await service.runWidget(run());
    expect(runCache.record).not.toHaveBeenCalled();
    await service.runWidget({ ...run(), runId: "r2" }, { cacheRun: true });
    expect(runCache.record).toHaveBeenCalledWith(
      "r2",
      "w1",
      expect.objectContaining({ resultType: "tabular" })
    );
  });
});
