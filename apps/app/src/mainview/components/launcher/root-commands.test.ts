import { SlidersHorizontalIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  aiSetupCommand,
  fallbackCommands,
  filterCommands,
  rootCommands,
} from "./root-commands";

const handlers = () => ({
  addConnection: vi.fn(),
  dismiss: vi.fn(),
  exportAll: vi.fn(),
  newApp: vi.fn(),
  newBoard: vi.fn(),
  newSourceWidget: vi.fn(),
  openActivity: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
  startMode: vi.fn(),
});

const commands = () => rootCommands(handlers());

describe("rootCommands", () => {
  it("wires each command to its handler", () => {
    const wired = handlers();
    for (const command of rootCommands(wired)) {
      command.run();
    }
    const { startMode, ...rest } = wired;
    for (const handler of Object.values(rest)) {
      expect(handler).toHaveBeenCalledOnce();
    }
    expect(startMode.mock.calls).toStrictEqual([["> "], ["#"], ["@"]]);
  });

  it("offers export and import of widgets and boards", () => {
    const wired = handlers();
    const byId = new Map(rootCommands(wired).map((c) => [c.id, c]));
    expect(byId.get("export-bundle")).toMatchObject({
      actionLabel: "Export",
      subtitle: "Saves a .conch.json to Downloads",
      title: "Export Widgets and Boards",
    });
    byId.get("import-bundle")?.run();
    expect(wired.openImport).toHaveBeenCalledOnce();
  });

  it("finds export and import by their keywords", () => {
    expect(filterCommands(commands(), "backup").map((c) => c.id)).toStrictEqual(
      ["export-bundle"]
    );
    expect(
      filterCommands(commands(), "restore").map((c) => c.id)
    ).toStrictEqual(["import-bundle"]);
  });

  it("offers AI setup through Settings", () => {
    const openSettings = vi.fn();
    aiSetupCommand(openSettings).run();
    expect(openSettings).toHaveBeenCalledOnce();
  });
});

describe("filterCommands", () => {
  it("returns every command for an empty or blank query", () => {
    expect(filterCommands(commands(), "")).toHaveLength(13);
    expect(filterCommands(commands(), "   ")).toHaveLength(13);
  });

  it("matches titles fuzzily", () => {
    expect(filterCommands(commands(), "sttng").map((c) => c.id)).toStrictEqual([
      "settings",
    ]);
  });

  it("matches keywords", () => {
    expect(filterCommands(commands(), "theme").map((c) => c.id)).toStrictEqual([
      "settings",
    ]);
    expect(filterCommands(commands(), "close").map((c) => c.id)).toStrictEqual([
      "hide",
    ]);
  });

  it("finds Search History by its keywords", () => {
    expect(filterCommands(commands(), "past").map((c) => c.id)).toStrictEqual([
      "history",
    ]);
    expect(filterCommands(commands(), "recent").map((c) => c.id)).toStrictEqual(
      ["history"]
    );
  });

  it("returns nothing when no command matches", () => {
    expect(filterCommands(commands(), "zzz")).toStrictEqual([]);
  });

  it("ranks the stronger match first", () => {
    const command = (id: string, title: string) => ({
      actionLabel: "Open",
      icon: SlidersHorizontalIcon,
      id,
      run: vi.fn(),
      subtitle: "",
      title,
    });
    const ranked = filterCommands(
      [command("loose", "Update data sources"), command("exact", "Data")],
      "data"
    );
    expect(ranked.map((c) => c.id)).toStrictEqual(["exact", "loose"]);
  });
});

describe("fallbackCommands", () => {
  it("offers nothing for a blank query", () => {
    expect(
      fallbackCommands("  ", { findTable: vi.fn(), searchHistory: vi.fn() })
    ).toStrictEqual([]);
  });

  it("searches History with the trimmed text", () => {
    const searchHistory = vi.fn();
    const [history] = fallbackCommands(" signups ", {
      findTable: null,
      searchHistory,
    });
    history?.run();
    expect(history?.title).toBe("Search History");
    expect(searchHistory).toHaveBeenCalledWith("signups");
  });

  it("offers Find Table only when a SQL connection can answer", () => {
    expect(
      fallbackCommands("orders", { findTable: null, searchHistory: vi.fn() })
    ).toHaveLength(1);
    const findTable = vi.fn();
    const table = fallbackCommands("orders", {
      findTable,
      searchHistory: vi.fn(),
    }).at(-1);
    table?.run();
    expect(table?.title).toBe("Find Table");
    expect(findTable).toHaveBeenCalledWith("orders");
  });
});

describe("input mode commands", () => {
  it("teach the >, # and @ prefixes", () => {
    const prefixes = commands()
      .filter((command) => command.prefix)
      .map((command) => [command.title, command.prefix]);
    expect(prefixes).toStrictEqual([
      ["Run SQL", ">"],
      ["Browse Tables", "#"],
      ["Switch Connection", "@"],
    ]);
  });
});
