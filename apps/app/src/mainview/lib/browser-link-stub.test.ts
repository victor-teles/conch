import type { LauncherNavigateView } from "@conch/rpc";

import { describe, expect, it } from "vitest";

import { createLinkOpener } from "./browser-link-stub";

const setup = (boards: string[] = ["b-1"]) => {
  const log: string[] = [];
  const views: LauncherNavigateView[] = [];
  const open = createLinkOpener({
    boardExists: (boardId) => boards.includes(boardId),
    navigate: (view) => views.push(view),
    openBoard: (boardId) => log.push(`board ${boardId}`),
    show: () => log.push("show"),
  });
  return { log, open, views };
};

describe("createLinkOpener", () => {
  it("shows the launcher for an open link", () => {
    const { open, log, views } = setup();
    open("conch://open");
    expect(log).toStrictEqual(["show"]);
    expect(views).toStrictEqual([]);
  });

  it("summons with the same views the bun router sends", () => {
    const { open, views } = setup();
    open("conch://ask?q=a&conn=x");
    open("conch://widget/w");
    open("conch://widget/w?region=EU");
    expect(views).toStrictEqual([
      { connection: "x", kind: "ask-draft", prompt: "a" },
      { kind: "widget-run", widgetId: "w" },
      { kind: "widget-args", values: { region: "EU" }, widgetId: "w" },
    ]);
  });

  it("opens an existing board without the launcher, and says when one is missing", () => {
    const { open, log, views } = setup();
    open("conch://board/b-1");
    expect(log).toStrictEqual(["board b-1"]);
    open("conch://board/b-2");
    expect(views).toStrictEqual([
      { kind: "notice", message: "That board no longer exists." },
    ]);
  });

  it("shows a notice for a link it does not understand", () => {
    const { open, views } = setup();
    open("conch://nope");
    expect(views).toStrictEqual([
      { kind: "notice", message: "That link isn't one Conch understands." },
    ]);
  });
});
