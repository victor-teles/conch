import type { MiniAppDraft } from "./mini-app.ts";
import type { PanelElement } from "./panel-spec.ts";

import { MINI_APP_VERSION } from "./mini-app.ts";

export const ordersCard: PanelElement = {
  children: [],
  props: {
    data: { $state: "/sources/orders" },
    rowActions: ["refund"],
    size: "l",
    spec: {
      formats: {},
      title: "Failed orders",
      version: 2,
      view: { kind: "table" },
    },
    view: "table",
  },
  type: "Card",
};

export const chargesCard: PanelElement = {
  children: [],
  props: {
    data: { $state: "/sources/charges" },
    rowActions: [],
    size: "m",
    spec: {
      formats: {},
      title: "Failed charges",
      version: 2,
      view: { kind: "kpi", value: "failed" },
    },
    view: "kpi",
  },
  type: "Card",
};

export const refundDesk = (): MiniAppDraft => ({
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
  description: "Failed charges next to their orders.",
  emoji: "💳",
  inputOptions: {},
  inputs: [
    {
      default: "last7d",
      label: "Period",
      name: "period",
      type: "dateRange",
    },
    { default: "EU", label: "Region", name: "region", type: "text" },
  ],
  layout: {
    elements: {
      charges: chargesCard,
      copy: {
        children: [],
        props: { action: "copy-region" },
        type: "ActionButton",
      },
      grid: { children: ["charges", "orders"], props: {}, type: "Grid" },
      main: {
        children: ["title", "grid", "copy"],
        props: { direction: "vertical", gap: "m" },
        type: "Stack",
      },
      orders: ordersCard,
      title: { children: [], props: { text: "Refund desk" }, type: "Heading" },
    },
    root: "main",
  },
  name: "Refund desk",
  prompt: "a refund desk",
  refresh: "off",
  refreshAfter: { refund: ["orders"] },
  sources: {
    charges: {
      connectionId: "pg",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate:
        "SELECT count(*) AS failed FROM charges WHERE failed_at >= {{period.from}} AND failed_at < {{period.to}}",
    },
    orders: {
      connectionId: "pg",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate:
        "SELECT id, total FROM orders WHERE status = 'failed' AND region = {{region}}",
    },
  },
  values: {},
  version: MINI_APP_VERSION,
});

export const cardProps = (element: PanelElement | undefined) => {
  if (element?.type !== "Card") {
    throw new Error("expected a Card");
  }
  return element.props;
};

export const present = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("expected a value");
  }
  return value;
};
