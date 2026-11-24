import { describe, expect, it, vi } from "vitest";

import { rootCommands } from "@/components/launcher/root-commands";
import { makeConnection } from "@/test/connection-fixture";
import { makeWidget } from "@/test/widget-fixtures";

import type { RootItem } from "./root-items";

import { rankRootItems } from "./root-ranking";

const [command] = rootCommands({
  addConnection: vi.fn(),
  addSample: null,
  dismiss: vi.fn(),
  exportAll: vi.fn(),
  newApp: vi.fn(),
  newBoard: vi.fn(),
  newSourceWidget: vi.fn(),
  openActivity: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
  openThemes: vi.fn(),
  startMode: vi.fn(),
});
if (!command) {
  throw new Error("missing command");
}
const commandItem: RootItem = { command, id: command.id, kind: "command" };
const widgetItem: RootItem = {
  id: "widget-w",
  kind: "widget",
  widget: makeWidget({ id: "w" }),
};
const connectionItem: RootItem = {
  connection: makeConnection({ id: "c" }),
  id: "c",
  kind: "connection",
};

const idsOf = (items: readonly RootItem[]) => items.map((item) => item.id);

describe("rankRootItems", () => {
  it("puts the higher score first regardless of kind", () => {
    expect(
      idsOf(
        rankRootItems([
          { item: widgetItem, score: 10 },
          { item: commandItem, score: 90 },
        ])
      )
    ).toStrictEqual([command.id, "widget-w"]);
  });

  it("breaks ties by kind: widget, board, connection, command", () => {
    expect(
      idsOf(
        rankRootItems([
          { item: commandItem, score: 50 },
          { item: connectionItem, score: 50 },
          { item: widgetItem, score: 50 },
        ])
      )
    ).toStrictEqual(["widget-w", "c", command.id]);
  });

  it("keeps the given order for equal score and kind", () => {
    const second: RootItem = { ...widgetItem, id: "widget-second" };
    expect(
      idsOf(
        rankRootItems([
          { item: widgetItem, score: 5 },
          { item: second, score: 5 },
        ])
      )
    ).toStrictEqual(["widget-w", "widget-second"]);
  });
});
