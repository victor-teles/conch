import type { DatabaseConnection } from "@conch/core";
import type { CardSpec, WidgetDraft } from "@conch/rpc";

import { CARD_SPEC_VERSION, SAMPLE_CONNECTION_ID } from "@conch/rpc";

type SampleWidget = Pick<WidgetDraft, "id" | "name" | "prompt" | "view"> & {
  sql: string;
  spec: Omit<CardSpec, "version">;
};

const SAMPLE_WIDGETS: readonly SampleWidget[] = [
  {
    id: "sample-revenue-by-month",
    name: "Revenue by month",
    prompt: "Revenue by month from paid orders",
    spec: {
      formats: {
        month: { kind: "month" },
        revenue: { currency: "USD", kind: "currency" },
      },
      subtitle: "Paid orders, last 12 months",
      title: "Revenue by month",
      view: {
        kind: "chart",
        mark: "bar",
        stacked: false,
        x: "month",
        y: ["revenue"],
      },
    },
    sql: `SELECT strftime('%Y-%m-01', created_at) AS month, ROUND(SUM(total), 2) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY 1
ORDER BY 1`,
    view: "bar",
  },
  {
    id: "sample-orders-by-status",
    name: "Orders by status",
    prompt: "How many orders are in each status?",
    spec: {
      formats: { orders: { kind: "integer" } },
      title: "Orders by status",
      view: { kind: "pie", label: "status", value: "orders" },
    },
    sql: `SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC`,
    view: "pie",
  },
  {
    id: "sample-top-products",
    name: "Top products",
    prompt: "Top products by revenue",
    spec: {
      formats: {
        revenue: { currency: "USD", kind: "currency" },
        units: { kind: "integer" },
      },
      subtitle: "By revenue",
      title: "Top products",
      view: {
        kind: "chart",
        mark: "bar",
        stacked: false,
        x: "product",
        y: ["revenue"],
      },
    },
    sql: `SELECT p.name AS product, SUM(oi.quantity) AS units, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.name
ORDER BY revenue DESC
LIMIT 8`,
    view: "bar",
  },
];

export const sampleWidgetDrafts = (): WidgetDraft[] =>
  SAMPLE_WIDGETS.map(({ sql, spec, ...widget }) => ({
    ...widget,
    lastValues: {},
    params: [],
    source: {
      connectionId: SAMPLE_CONNECTION_ID,
      database: null,
      dialect: "sqlite",
      kind: "sql",
      sqlTemplate: sql,
    },
    spec: { ...spec, version: CARD_SPEC_VERSION },
  }));

const sampleConnection = (filePath: string, now: Date): DatabaseConnection => ({
  createdAt: now.toISOString(),
  database: filePath,
  emoji: "☕",
  environment: "dev",
  host: "",
  id: SAMPLE_CONNECTION_ID,
  lastConnectedAt: null,
  name: "Sample Store",
  password: "",
  pinned: false,
  port: 0,
  type: "sqlite",
  username: "",
});

export interface SampleServiceDeps {
  filePath: string;
  now: () => Date;
  fileExists: (filePath: string) => Promise<boolean>;
  writeDatabase: (filePath: string, now: Date) => void;
  getConnections: () => Promise<DatabaseConnection[]>;
  saveConnections: (connections: DatabaseConnection[]) => Promise<void>;
  saveWidget: (draft: WidgetDraft) => Promise<unknown>;
}

export const createSampleService = (deps: SampleServiceDeps) => ({
  // Safe to repeat: the file, the connection and the widgets are each added once.
  async add(): Promise<DatabaseConnection> {
    const now = deps.now();
    if (!(await deps.fileExists(deps.filePath))) {
      deps.writeDatabase(deps.filePath, now);
    }
    const connections = await deps.getConnections();
    const existing = connections.find(
      (connection) => connection.id === SAMPLE_CONNECTION_ID
    );
    const connection = existing ?? sampleConnection(deps.filePath, now);
    if (!existing) {
      await deps.saveConnections([...connections, connection]);
    }
    for (const draft of sampleWidgetDrafts()) {
      await deps.saveWidget(draft);
    }
    return connection;
  },
});

export type SampleService = ReturnType<typeof createSampleService>;
