import { describe, expect, it, vi } from "vitest";

import { INITIAL_STATE } from "@/components/connection-form/connection-form-state";
import { secondActionOf } from "@/components/launcher/actions/menu-action";
import { rootCommands } from "@/components/launcher/root-commands";
import { makeConnection } from "@/test/connection-fixture";
import { makeRecent } from "@/test/widget-fixtures";

import type { RowMenuItem } from "./row-actions";

import { isRowMenuItem, rowActions, rowMenuTitle } from "./row-actions";

const connection = makeConnection({ id: "analytics", name: "analytics" });
const [command] = rootCommands({
  addConnection: vi.fn(),
  dismiss: vi.fn(),
  exportAll: vi.fn(),
  newBoard: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
  startMode: vi.fn(),
});
if (!command) {
  throw new Error("missing command");
}

const ITEMS: RowMenuItem[] = [
  { connection, id: "ask", kind: "ask", prompt: "revenue" },
  { connection, id: "sql", kind: "sql", sql: "select 1" },
  {
    connection,
    id: "lookup",
    kind: "lookup",
    origin: "typed",
    value: { kind: "email", value: "ada@example.com" },
  },
  {
    id: "table-orders",
    kind: "table",
    schema: "public",
    table: {
      columns: [],
      foreignKeys: [],
      indexes: [],
      name: "orders",
      rowEstimate: null,
    },
  },
  { ask: makeRecent(), id: "recent-1", kind: "recent" },
  {
    alert: {
      firedAt: "2026-11-20T00:00:00.000Z",
      label: "Signups dropped",
      watchId: "watch-1",
      widgetId: "w",
    },
    id: "alert-1",
    kind: "alert",
  },
  { draft: { ...INITIAL_STATE }, id: "draft-connection", kind: "draft" },
  { command, id: command.id, kind: "command" },
];

const labelsOf = (item: RowMenuItem, sqlRunnable = true) =>
  rowActions(item, { sqlRunnable }).map((action) => action.label);

const itemOf = (kind: RowMenuItem["kind"]): RowMenuItem => {
  const item = ITEMS.find((entry) => entry.kind === kind);
  if (!item) {
    throw new Error(`missing ${kind}`);
  }
  return item;
};

describe("rowActions", () => {
  it("leads every row's menu with its ↵ action", () => {
    for (const item of ITEMS) {
      const [first] = rowActions(item, { sqlRunnable: true });
      expect(first?.keys).toStrictEqual(["↩"]);
      expect(first?.id).toBe("run");
    }
  });

  it.each([
    ["ask", ["Ask", "Copy Prompt"]],
    ["sql", ["Run", "Copy SQL"]],
    ["lookup", ["Find", "Copy Value"]],
    ["table", ["Preview Rows", "Copy Table Name", "Show Columns"]],
    [
      "recent",
      [
        "Ask Again",
        "Run SQL (no AI)",
        "Copy SQL",
        "Copy Prompt",
        "Remove from History",
      ],
    ],
    ["alert", ["Open", "Dismiss"]],
    ["draft", ["Open Draft", "Discard Draft"]],
    ["command", [command.actionLabel]],
  ] as const)("lists the %s row's actions", (kind, labels) => {
    expect(labelsOf(itemOf(kind))).toStrictEqual(labels);
  });

  it.each([
    ["sql", "Copy SQL"],
    ["lookup", "Copy Value"],
    ["table", "Copy Table Name"],
    ["recent", "Run SQL (no AI)"],
    ["ask", undefined],
    ["command", undefined],
  ] as const)("marks the %s row's ⌘↵ action", (kind, label) => {
    const second = secondActionOf(
      rowActions(itemOf(kind), { sqlRunnable: true })
    );
    expect(second?.label).toBe(label);
  });

  it("disables Run SQL when the stored SQL cannot run", () => {
    const runSql = rowActions(itemOf("recent"), { sqlRunnable: false }).find(
      (action) => action.id === "run-sql"
    );
    expect(runSql?.disabled).toBeTruthy();
  });

  it("titles each menu after its row", () => {
    expect(ITEMS.map((item) => rowMenuTitle(item))).toStrictEqual([
      "revenue",
      "select 1",
      "ada@example.com",
      "orders",
      makeRecent().prompt,
      "Signups dropped",
      "New Connection",
      command.title,
    ]);
  });

  it("leaves widgets, boards and connections to their own menus", () => {
    expect(isRowMenuItem(itemOf("recent"))).toBeTruthy();
    expect(
      isRowMenuItem({ connection, id: "analytics", kind: "connection" })
    ).toBeFalsy();
  });
});
