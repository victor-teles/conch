import type { TabularResult } from "@conch/core/client";
import type {
  CardElement,
  DraftPatch,
  MiniAppDraft,
  MiniAppGenEvent,
  PanelElement,
} from "@conch/rpc/mini-app";

import { MINI_APP_VERSION } from "@conch/rpc/mini-app";

const card = (
  source: string,
  title: string,
  view: CardElement["props"]["spec"]["view"],
  rowActions: string[] = []
): CardElement => ({
  children: [],
  props: {
    data: { $state: `/sources/${source}` },
    rowActions,
    size: view.kind === "table" ? "l" : "m",
    spec: { formats: {}, title, version: 2, view },
    view: view.kind === "chart" ? view.mark : view.kind,
  },
  type: "Card",
});

const sql = (connectionId: string, sqlTemplate: string) => ({
  connectionId,
  database: null,
  dialect: "postgresql" as const,
  kind: "sql" as const,
  sqlTemplate,
});

const refundElements = (): Record<string, PanelElement> => ({
  amounts: card("charges", "Refund amounts", {
    kind: "chart",
    mark: "bar",
    stacked: false,
    x: "charge_id",
    y: ["amount"],
  }),
  charges: card(
    "charges",
    "Failed charges",
    { columns: ["charge_id", "amount"], kind: "table" },
    ["refund"]
  ),
  grid: {
    children: ["charges", "orders", "amounts"],
    props: {},
    type: "Grid",
  },
  main: {
    children: ["title", "grid"],
    props: { direction: "vertical", gap: "m" },
    type: "Stack",
  },
  orders: card("orders", "Matching orders", { kind: "table" }),
  title: { children: [], props: { text: "Refund desk" }, type: "Heading" },
});

export const refundDeskDraft = (connectionId: string): MiniAppDraft => ({
  actions: [
    {
      bind: { charge_id: { column: "charge_id", from: "row" } },
      id: "refund",
      label: "Refund",
      scope: "row",
      target: {
        connectionId,
        database: null,
        dialect: "postgresql",
        kind: "sql",
        maxAffectedRows: 1,
        statementTemplate:
          "UPDATE charges SET refunded = true WHERE id = {{charge_id}}",
      },
    },
  ],
  description: "Failed charges next to their orders, with a Refund button.",
  emoji: "💳",
  inputOptions: {},
  inputs: [
    { default: "last7d", label: "Period", name: "period", type: "dateRange" },
    { default: "EU", label: "Region", name: "region", type: "text" },
  ],
  layout: { elements: refundElements(), root: "main" },
  name: "Refund desk",
  prompt: "refund desk",
  refresh: "off",
  refreshAfter: { refund: ["charges"] },
  sources: {
    charges: sql(
      connectionId,
      "SELECT id AS charge_id, amount FROM charges WHERE failed_at >= {{period.from}} AND failed_at < {{period.to}}"
    ),
    orders: sql(
      connectionId,
      "SELECT id, charge_id, total FROM orders WHERE region = {{region}}"
    ),
  },
  values: {},
  version: MINI_APP_VERSION,
});

const ordersDraft = (connectionId: string, prompt: string): MiniAppDraft => ({
  actions: [],
  description: "Orders grouped by status.",
  inputOptions: {},
  inputs: [],
  layout: {
    elements: {
      main: { children: ["status"], props: {}, type: "Grid" },
      status: card("orders", "Orders by status", { kind: "table" }),
    },
    root: "main",
  },
  name: "Orders by status",
  prompt,
  refresh: "off",
  refreshAfter: {},
  sources: {
    orders: sql(
      connectionId,
      "SELECT status, count(*) AS orders FROM orders GROUP BY 1"
    ),
  },
  values: {},
  version: MINI_APP_VERSION,
});

const tabular = (columns: string[], rows: unknown[][]): TabularResult => ({
  columns: columns.map((name) => ({ name, typeName: "TEXT" })),
  executionTimeMs: 24,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

export const recordedResult = (
  sourceName: string,
  values: Readonly<Record<string, unknown>>
): TabularResult => {
  switch (sourceName) {
    case "charges": {
      return tabular(
        ["charge_id", "amount"],
        [
          ["ch_1042", 40],
          ["ch_1043", 12.5],
        ]
      );
    }
    case "orders": {
      const region = typeof values.region === "string" ? values.region : "EU";
      return tabular(
        ["id", "charge_id", "total"],
        [[`${region}-7`, "ch_1042", 40]]
      );
    }
    default: {
      return tabular(
        ["status", "orders"],
        [
          ["paid", 120],
          ["failed", 4],
        ]
      );
    }
  }
};

const add = (path: string, value: unknown): DraftPatch => ({
  op: "add",
  path,
  value,
});

const patch = (...ops: DraftPatch[]): MiniAppGenEvent => ({
  ops,
  type: "patch",
});

const streamOf = (draft: MiniAppDraft): MiniAppGenEvent[] => {
  const sources = Object.entries(draft.sources).flatMap(
    ([name, source]): MiniAppGenEvent[] => [
      patch(add(`/sources/${name}`, source)),
      { detail: `Checking ${name}…`, phase: "sources", type: "phase" },
      { name, result: recordedResult(name, {}), type: "sourceResult" },
    ]
  );
  const { elements, root } = draft.layout;
  return [
    { detail: "Choosing data…", phase: "plan", type: "phase" },
    patch(
      add("/name", draft.name),
      ...(draft.emoji ? [add("/emoji", draft.emoji)] : []),
      add("/description", draft.description)
    ),
    ...draft.inputs.map((input) => patch(add("/inputs/-", input))),
    ...sources,
    ...draft.actions.map((action) => patch(add("/actions/-", action))),
    ...Object.entries(draft.refreshAfter).map(([id, names]) =>
      patch(add(`/refreshAfter/${id}`, names))
    ),
    { detail: "Laying out…", phase: "layout", type: "phase" },
    patch(add("/layout/root", root)),
    ...Object.entries(elements)
      .toSorted(
        ([a], [b]) =>
          layoutOrder(elements, root, a) - layoutOrder(elements, root, b)
      )
      .map(([key, element]) => patch(add(`/layout/elements/${key}`, element))),
    { detail: "Checking the app…", phase: "check", type: "phase" },
  ];
};

// Top-down, the order a model is told to write elements in.
const layoutOrder = (
  elements: Readonly<Record<string, PanelElement>>,
  root: string,
  key: string
): number => {
  const order: string[] = [];
  const visit = (name: string) => {
    order.push(name);
    for (const child of elements[name]?.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
};

const writeNote = (draft: MiniAppDraft): string[] =>
  draft.actions.map(
    (action) => `“${action.label}” changes data, so it waits for your review.`
  );

export const recordedGeneration = (
  prompt: string,
  connectionId: string
): MiniAppGenEvent[] => {
  const text = prompt.toLowerCase();
  if (text.includes("broken")) {
    return [
      { detail: "Choosing data…", phase: "plan", type: "phase" },
      patch(add("/name", "Broken app")),
      { detail: "Checking the app…", phase: "check", type: "phase" },
      { detail: "Fixing 1 problem…", phase: "check", type: "phase" },
      { detail: "Checking the app…", phase: "check", type: "phase" },
      { detail: "Fixing 1 problem…", phase: "check", type: "phase" },
      {
        code: "INVALID_APP",
        message: 'orders failed: relation "orderz" does not exist',
        type: "error",
      },
    ];
  }
  const draft = text.includes("refund")
    ? refundDeskDraft(connectionId)
    : ordersDraft(connectionId, prompt);
  return [...streamOf(draft), { draft, notes: writeNote(draft), type: "done" }];
};
