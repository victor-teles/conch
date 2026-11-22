import type {
  ActionActivity,
  ActionPreview,
  ActionTarget,
  ListedAction,
} from "@/lib/ipc";

const STAMP = "2026-11-21T10:00:00.000Z";

export const sqlTarget: ActionTarget = {
  connectionId: "analytics",
  database: null,
  dialect: "postgresql",
  kind: "sql",
  maxAffectedRows: 1,
  statementTemplate:
    "UPDATE revenue SET status = {{status}} WHERE month = {{month}}",
};

export const makeListed = (
  overrides: Partial<ListedAction["action"]> = {},
  effect: ListedAction["effect"] = "write"
): ListedAction => ({
  action: {
    bind: {
      month: { column: "month", from: "row" },
      status: { from: "literal", value: "reviewed" },
    },
    createdAt: STAMP,
    effect,
    id: "a-review",
    label: "Mark reviewed",
    reviewHash: "a".repeat(64),
    reviewedAt: STAMP,
    scope: "row",
    target: sqlTarget,
    updatedAt: STAMP,
    widgetId: "w-revenue",
    ...overrides,
  },
  effect,
  subtitle: "Writes to analytics · at most 1 row",
  targetName: "analytics",
});

export const sqlPreview = (
  overrides: Partial<ActionPreview> = {}
): ActionPreview => ({
  bound: [
    { detail: "literal", from: "literal", name: "status", value: "reviewed" },
    { detail: "row.month", from: "row", name: "month", value: "2026-02-01" },
  ],
  compiled: {
    kind: "sql",
    params: ["reviewed", "2026-02-01"],
    statement: "UPDATE revenue SET status = $1 WHERE month = $2",
  },
  effect: "write",
  expiresAt: STAMP,
  label: "Mark reviewed",
  limits: { maxAffectedRows: 1 },
  target: { environment: "prod", kind: "sql", name: "analytics" },
  token: "tok0000000000000000001",
  ...overrides,
});

export const mcpPreview = (): ActionPreview =>
  sqlPreview({
    bound: [
      { detail: "row.id", from: "row", name: "charge", value: "ch_3NqK" },
    ],
    compiled: {
      args: { amount: 1200, charge: "ch_3NqK" },
      kind: "mcp",
      tool: "refund_charge",
    },
    label: "Refund charge",
    limits: {},
    target: { environment: null, kind: "mcp", name: "Stripe" },
  });

export const httpPreview = (): ActionPreview =>
  sqlPreview({
    bound: [{ detail: "row.id", from: "row", name: "id", value: 42 }],
    compiled: {
      body: { reason: "resolved" },
      kind: "http",
      method: "POST",
      url: "https://api.example.com/v1/tickets/42/close",
    },
    label: "Close ticket",
    limits: {},
    target: { environment: null, kind: "http", name: "Support API" },
  });

export const makeActivity = (
  overrides: Partial<ActionActivity> = {}
): ActionActivity => ({
  actionLabel: "Mark reviewed",
  at: STAMP,
  bound: sqlPreview().bound,
  compiled: sqlPreview().compiled,
  durationMs: 42,
  effect: "write",
  environment: "prod",
  executionId: "x1",
  outcome: {
    affectedRows: 1,
    durationMs: 42,
    ok: true,
    summary: "1 row changed",
  },
  status: "ok",
  targetKind: "sql",
  targetName: "analytics",
  widgetId: "w-revenue",
  ...overrides,
});
