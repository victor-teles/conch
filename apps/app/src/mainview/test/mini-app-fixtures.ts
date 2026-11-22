import { CARD_SPEC_VERSION } from "@conch/rpc";
import { MINI_APP_VERSION } from "@conch/rpc/mini-app";

import type {
  CardElement,
  MiniApp,
  MiniAppDraft,
  MiniAppSourceRun,
} from "@/lib/ipc";

const card = (
  source: string,
  title: string,
  rowActions: string[] = []
): CardElement => ({
  children: [],
  props: {
    data: { $state: `/sources/${source}` },
    rowActions,
    size: "l",
    spec: {
      formats: {},
      title,
      version: CARD_SPEC_VERSION,
      view: { kind: "table" },
    },
    view: "table",
  },
  type: "Card",
});

const sql = (sqlTemplate: string) => ({
  connectionId: "analytics",
  database: null,
  dialect: "postgresql" as const,
  kind: "sql" as const,
  sqlTemplate,
});

export const deskDraft = (): MiniAppDraft => ({
  actions: [
    {
      bind: { charge_id: { column: "charge_id", from: "row" } },
      id: "refund",
      label: "Refund",
      scope: "row",
      target: {
        connectionId: "analytics",
        database: null,
        dialect: "postgresql",
        kind: "sql",
        maxAffectedRows: 1,
        statementTemplate:
          "UPDATE charges SET refunded = true WHERE id = {{charge_id}}",
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
  description: "Failed charges next to their orders.",
  emoji: "💳",
  inputOptions: {},
  inputs: [
    { default: "last7d", label: "Period", name: "period", type: "dateRange" },
    { default: "EU", label: "Region", name: "region", type: "text" },
  ],
  layout: {
    elements: {
      charges: card("charges", "Failed charges", ["refund"]),
      copy: {
        children: [],
        props: { action: "copy-region" },
        type: "ActionButton",
      },
      grid: { children: ["charges", "orders"], props: {}, type: "Grid" },
      main: {
        children: ["title", "note", "grid", "copy"],
        props: { direction: "vertical", gap: "m" },
        type: "Stack",
      },
      note: {
        children: [],
        props: { text: "Only EU charges." },
        type: "Note",
        visible: { $state: "/inputs/region", eq: "EU" },
      },
      orders: card("orders", "Matching orders"),
      title: { children: [], props: { text: "Refund desk" }, type: "Heading" },
    },
    root: "main",
  },
  name: "Refund desk",
  prompt: "refund desk",
  refresh: "off",
  refreshAfter: { refund: ["charges"] },
  sources: {
    charges: sql(
      "SELECT id AS charge_id, amount FROM charges WHERE failed_at >= {{period.from}} AND failed_at < {{period.to}}"
    ),
    orders: sql("SELECT id, total FROM orders WHERE region = {{region}}"),
  },
  values: {},
  version: MINI_APP_VERSION,
});

const STAMP = "2026-11-21T10:00:00.000Z";

export const deskApp = (overrides: Partial<MiniApp> = {}): MiniApp => {
  const draft = deskDraft();
  return {
    ...draft,
    actions: draft.actions.map((action) => ({
      ...action,
      createdAt: STAMP,
      effect: action.target.kind === "sql" ? "write" : "read",
      reviewHash: "a".repeat(64),
      reviewedAt: STAMP,
      updatedAt: STAMP,
    })),
    createdAt: STAMP,
    id: "app-desk",
    lastOpenedAt: null,
    updatedAt: STAMP,
    ...overrides,
  };
};

export const chargesRun = (amounts: number[] = [12, 40]): MiniAppSourceRun => ({
  compiled: { kind: "sql", sql: "SELECT … $1" },
  result: {
    columns: [
      { name: "charge_id", typeName: "TEXT" },
      { name: "amount", typeName: "NUMERIC" },
    ],
    executionTimeMs: 12,
    isTruncated: false,
    resultType: "tabular",
    rowCount: amounts.length,
    rows: amounts.map((amount, index) => [`ch_${index + 1}`, String(amount)]),
  },
  values: { period: "last7d" },
});

export const ordersRun = (): MiniAppSourceRun => ({
  compiled: { kind: "sql", sql: "SELECT … $1" },
  result: {
    columns: [
      { name: "id", typeName: "INT4" },
      { name: "total", typeName: "NUMERIC" },
    ],
    executionTimeMs: 8,
    isTruncated: false,
    resultType: "tabular",
    rowCount: 1,
    rows: [[7, "99.00"]],
  },
  values: { region: "EU" },
});

export const deskAction = (id: string) => {
  const action = deskDraft().actions.find((item) => item.id === id);
  if (!action) {
    throw new Error(`no fixture action ${id}`);
  }
  return action;
};
