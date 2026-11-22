import type { ConnectionPoolManager } from "@conch/drivers";
import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-v1-records-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const {
  decryptLine,
  encryptLine,
  recentAsksPath,
  resetCryptoCache,
  saveConnections,
  setLegacyKeyLoader,
  widgetsPath,
} = await import("@conch/core");
const { createWidgetService, defaultRecentAskStore, defaultWidgetStore } =
  await import("./widget-service.ts");
const { createSourceRunner } = await import("./source-runner.ts");
const { fakeSources } = await import("./test-fake-sources.ts");
const { RecentAsk } = await import("@conch/rpc");

const V1_SPEC = {
  formats: { mrr: { currency: "USD", kind: "currency" } },
  insight: "Europe grew every month.",
  title: "Monthly recurring revenue by region",
  version: 1,
  view: {
    groupBy: "region",
    kind: "chart",
    mark: "line",
    stacked: false,
    x: "month",
    y: ["mrr"],
  },
};

const V1_WIDGET = {
  connectionId: "conn-analytics",
  createdAt: "2026-11-18T09:00:00.000Z",
  database: null,
  dialect: "postgresql",
  id: "w-revenue",
  lastRunAt: "2026-11-19T08:00:00.000Z",
  lastValues: { period: "lastQuarter" },
  name: "Revenue by region",
  params: [
    {
      default: "lastQuarter",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
  ],
  prompt: "revenue by region",
  spec: V1_SPEC,
  sqlTemplate:
    "select month, region, mrr from mrr where month >= {{period.from}} and month < {{period.to}}",
  updatedAt: "2026-11-18T09:00:00.000Z",
  view: "line",
};

const V1_RECENT = {
  askedAt: "2026-11-19T10:00:00.000Z",
  connectionId: "conn-analytics",
  database: null,
  dialect: "postgresql",
  id: "4b0c2f61-8f4e-4a43-9a52-7d0c1d7a0e11",
  prompt: "Revenue by region",
  spec: V1_SPEC,
  sql: "select month, region, mrr from mrr order by month",
};

const writeEncrypted = async (file: string, records: unknown[]) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await encryptLine(JSON.stringify(records)));
};

const readEncrypted = async (file: string): Promise<unknown> => {
  const line = await fs.readFile(file, "utf8");
  return JSON.parse(await decryptLine(line.trim()));
};

const versionsIn = async (file: string): Promise<unknown[]> => {
  const records = await readEncrypted(file);
  return Array.isArray(records)
    ? records.map(
        (record: { spec?: { version?: unknown } }) => record.spec?.version
      )
    : [];
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

describe("records saved before the CardSpec version bump", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(path.join(TMP_HOME, ".config"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("loads a version 1 widget and rewrites it as version 2 on save", async () => {
    await writeEncrypted(widgetsPath(), [V1_WIDGET]);
    const store = defaultWidgetStore();

    const [loaded] = await store.listWidgets();
    expect(loaded).toMatchObject({
      id: "w-revenue",
      name: "Revenue by region",
      spec: { title: V1_SPEC.title, version: 2 },
    });
    await expect(versionsIn(widgetsPath())).resolves.toStrictEqual([1]);

    await store.updateWidget("w-revenue", (widget) => ({
      ...widget,
      lastRunAt: "2026-11-20T08:00:00.000Z",
    }));
    await expect(versionsIn(widgetsPath())).resolves.toStrictEqual([2]);
  });

  it("loads a version 1 recent ask and rewrites it as version 2 when asked again", async () => {
    await writeEncrypted(recentAsksPath(), [V1_RECENT]);
    const store = defaultRecentAskStore();

    const [loaded] = await store.listRecentAsks();
    expect(loaded).toMatchObject({
      dialect: "postgresql",
      id: V1_RECENT.id,
      spec: { version: 2 },
    });

    await store.pushRecentAsk(
      RecentAsk.parse({ ...V1_RECENT, askedAt: "2026-11-20T10:00:00Z" })
    );
    await expect(versionsIn(recentAsksPath())).resolves.toStrictEqual([2]);
  });

  it("keeps a MongoDB recent next to SQL ones", async () => {
    await writeEncrypted(recentAsksPath(), [
      V1_RECENT,
      {
        ...V1_RECENT,
        dialect: "mongodb",
        id: "mongo-1",
        prompt: "orders by status",
        sql: '{"collection":"orders","pipeline":[{"$limit":1}]}',
      },
    ]);
    const asks = await defaultRecentAskStore().listRecentAsks();
    expect(asks.map((ask) => ask.dialect)).toStrictEqual([
      "postgresql",
      "mongodb",
    ]);
  });
});

const V1_SIGNUPS = {
  ...V1_WIDGET,
  id: "w-signups",
  lastRunAt: null,
  lastValues: {},
  name: "Signups",
  params: [],
  sqlTemplate: "select count(*) as signups from users",
};

const UNKNOWN_RECORD = {
  future: { shape: [1, 2, 3] },
  id: "w-from-a-newer-build",
  version: 9,
};

const sourceKinds = async (file: string): Promise<unknown[]> => {
  const records = await readEncrypted(file);
  return Array.isArray(records)
    ? records.map(
        (record: { version?: unknown; source?: { kind?: unknown } }) =>
          record.version === 2 ? record.source?.kind : (record.version ?? "v1")
      )
    : [];
};

describe("widgets saved before sources", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(path.join(TMP_HOME, ".config"), {
      force: true,
      recursive: true,
    });
  });

  it("upgrades v1 widgets in memory and rewrites only the one that changes", async () => {
    await writeEncrypted(widgetsPath(), [
      V1_WIDGET,
      V1_SIGNUPS,
      UNKNOWN_RECORD,
    ]);
    const store = defaultWidgetStore();

    const listed = await store.listWidgets();
    expect(
      listed.map((widget) => [widget.id, widget.version, widget.source])
    ).toStrictEqual([
      [
        "w-revenue",
        2,
        {
          connectionId: "conn-analytics",
          database: null,
          dialect: "postgresql",
          kind: "sql",
          sqlTemplate: V1_WIDGET.sqlTemplate,
        },
      ],
      [
        "w-signups",
        2,
        {
          connectionId: "conn-analytics",
          database: null,
          dialect: "postgresql",
          kind: "sql",
          sqlTemplate: V1_SIGNUPS.sqlTemplate,
        },
      ],
    ]);
    await expect(sourceKinds(widgetsPath())).resolves.toStrictEqual([
      "v1",
      "v1",
      9,
    ]);

    await store.updateWidget("w-signups", (widget) => ({
      ...widget,
      lastRunAt: "2026-11-21T08:00:00.000Z",
    }));

    const onDisk = await readEncrypted(widgetsPath());
    expect(onDisk).toStrictEqual([
      V1_WIDGET,
      expect.objectContaining({
        id: "w-signups",
        lastRunAt: "2026-11-21T08:00:00.000Z",
        source: expect.objectContaining({ kind: "sql" }),
        version: 2,
      }),
      UNKNOWN_RECORD,
    ]);
    const raw = await fs.readFile(widgetsPath(), "utf8");
    await expect(decryptLine(raw.trim())).resolves.toContain(
      JSON.stringify(UNKNOWN_RECORD)
    );
  });

  it("runs a v1 widget from disk and stores it back as v2", async () => {
    await saveConnections([
      {
        createdAt: "2026-11-18T00:00:00.000Z",
        database: "analytics",
        host: "127.0.0.1",
        id: "conn-analytics",
        lastConnectedAt: null,
        name: "analytics",
        password: "secret",
        pinned: false,
        port: 5432,
        type: "postgresql",
        username: "conch",
      },
    ]);
    await writeEncrypted(widgetsPath(), [V1_SIGNUPS, UNKNOWN_RECORD]);
    const execute = vi.fn().mockResolvedValue({
      columns: [{ name: "signups", typeName: "INT8" }],
      executionTimeMs: 2,
      isTruncated: false,
      resultType: "tabular",
      rowCount: 1,
      rows: [[42]],
    });
    const pool = {
      dialect: "postgresql",
      execute,
      listDatabases: () => {
        const settled = ["analytics"];
        return Promise.resolve(settled);
      },
    };
    const pools = { connect: vi.fn(), getPool: () => pool, has: () => true };
    const sources = fakeSources();
    const service = createWidgetService({
      loadModel: () => {
        const none = null;
        return Promise.resolve(none);
      },
      now: () => new Date("2026-11-21T09:00:00.000Z"),
      onSampled: vi.fn(),
      recents: defaultRecentAskStore(),
      runCache: { record: vi.fn() },
      runLog: {
        append: () => {
          const entry = {
            id: "x",
            samples: [],
            valuesKey: "",
            widgetId: "w-signups",
          };
          return Promise.resolve(entry);
        },
        entry: () => {
          const none = null;
          return Promise.resolve(none);
        },
        latestFor: () => {
          const settled = {};
          return Promise.resolve(settled);
        },
        removeForWidget: vi.fn().mockResolvedValue(null),
      },
      runner: createSourceRunner({
        fetchJson: sources.fetchJson,
        httpEndpoints: sources.endpoints,
        mcp: sources.mcp,
        mcpServers: sources.servers,
        pools: pools as unknown as ConnectionPoolManager,
      }),
      widgets: defaultWidgetStore(),
    });

    const outcome = await service.runWidget({
      runId: "r1",
      values: {},
      widgetId: "w-signups",
    });
    expect(outcome.result.rows).toStrictEqual([[42]]);
    expect(execute.mock.calls[0]?.[0]).toBe(V1_SIGNUPS.sqlTemplate);
    await expect(sourceKinds(widgetsPath())).resolves.toStrictEqual(["sql", 9]);
  });
});
