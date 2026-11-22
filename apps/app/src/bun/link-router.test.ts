import type { LauncherNavigateView } from "@conch/rpc";

import { describe, expect, it, vi } from "vitest";

import type { BoardOpenOutcome, LinkLauncher } from "./link-router";

import {
  BOARD_FAILED,
  createLinkRouter,
  MISSING_BOARD,
  UNKNOWN_LINK,
  urlOfOpenEvent,
} from "./link-router";

const fakeLauncher = () => {
  const views: LauncherNavigateView[] = [];
  const launcher: LinkLauncher & { shown: number } = {
    navigate: (view) => views.push(view),
    show: () => {
      launcher.shown += 1;
    },
    shown: 0,
  };
  return { launcher, views };
};

const setup = (outcome: BoardOpenOutcome | Error = "opened") => {
  const { launcher, views } = fakeLauncher();
  const slot = { current: launcher as LinkLauncher | null };
  const logged: string[] = [];
  const openBoardWindow =
    vi.fn<(boardId: string) => Promise<BoardOpenOutcome>>();
  if (outcome instanceof Error) {
    openBoardWindow.mockRejectedValue(outcome);
  } else {
    openBoardWindow.mockResolvedValue(outcome);
  }
  const router = createLinkRouter({
    launcher: () => slot.current,
    log: (route) => logged.push(route),
    openBoardWindow,
  });
  return { launcher, logged, openBoardWindow, router, slot, views };
};

describe("createLinkRouter", () => {
  it("shows the launcher for an open link", () => {
    const { router, launcher, views } = setup();
    router.handle("conch://open");
    expect(launcher.shown).toBe(1);
    expect(views).toStrictEqual([]);
  });

  it("stages an ask draft and never starts it", () => {
    const { router, views } = setup();
    router.handle("conch://ask?q=revenue%20by%20region&conn=analytics");
    expect(views).toStrictEqual([
      {
        connection: "analytics",
        kind: "ask-draft",
        prompt: "revenue by region",
      },
    ]);
  });

  it("runs a widget only when the link carries nothing but its id", () => {
    const { router, views } = setup();
    router.handle("conch://widget/w-1");
    router.handle("conch://widget/w-1?region=EU");
    expect(views).toStrictEqual([
      { kind: "widget-run", widgetId: "w-1" },
      { kind: "widget-args", values: { region: "EU" }, widgetId: "w-1" },
    ]);
  });

  it("opens a board window", async () => {
    const { router, openBoardWindow, views } = setup();
    router.handle("conch://board/b-1");
    await vi.waitFor(() => expect(openBoardWindow).toHaveBeenCalledWith("b-1"));
    expect(views).toStrictEqual([]);
  });

  it("says when the board no longer exists", async () => {
    const { router, views } = setup("missing");
    router.handle("conch://board/b-404");
    await vi.waitFor(() =>
      expect(views).toStrictEqual([{ kind: "notice", message: MISSING_BOARD }])
    );
  });

  it("says when the board could not open", async () => {
    const { router, views, logged } = setup(new Error("no window"));
    router.handle("conch://board/b-1");
    await vi.waitFor(() =>
      expect(views).toStrictEqual([{ kind: "notice", message: BOARD_FAILED }])
    );
    expect(logged).toStrictEqual(["board", "board failed"]);
  });

  it("shows a notice for a link it does not understand", () => {
    const { router, views, logged } = setup();
    router.handle("conch://nope");
    expect(views).toStrictEqual([{ kind: "notice", message: UNKNOWN_LINK }]);
    expect(logged).toStrictEqual(["rejected"]);
  });

  it("logs the route and never the prompt or values", () => {
    const { router, logged } = setup();
    router.handle("conch://ask?q=orders%20for%20ada%40example.com");
    router.handle("conch://widget/w-1?email=ada%40example.com");
    expect(logged).toStrictEqual(["ask", "widget"]);
    expect(logged.join(" ")).not.toContain("ada");
  });

  it("keeps only the latest link until the launcher exists, then replays it once", () => {
    const { router, slot, launcher, views } = setup();
    slot.current = null;
    router.handle("conch://ask?q=first");
    router.handle("conch://ask?q=second");
    router.flush();
    expect(views).toStrictEqual([]);

    slot.current = launcher;
    router.flush();
    router.flush();
    expect(views).toStrictEqual([
      { connection: null, kind: "ask-draft", prompt: "second" },
    ]);
  });

  it("does nothing on flush without a queued link", () => {
    const { router, views, launcher } = setup();
    router.flush();
    expect(views).toStrictEqual([]);
    expect(launcher.shown).toBe(0);
  });
});

describe("urlOfOpenEvent", () => {
  it.each([
    [{ data: { url: "conch://open" } }, "conch://open"],
    [{ data: { url: 3 } }, null],
    [{ data: null }, null],
    [{}, null],
    [null, null],
    ["conch://open", null],
  ])("reads %j", (event, url) => {
    expect(urlOfOpenEvent(event)).toBe(url);
  });
});
