import type { ConchLink, LauncherNavigateView } from "@conch/rpc";

import { parseConchLink } from "@conch/rpc";

export const UNKNOWN_LINK = "That link isn't one Conch understands.";
export const MISSING_BOARD = "That board no longer exists.";
export const BOARD_FAILED = "That board could not open.";

export type BoardOpenOutcome = "opened" | "missing";

export interface LinkLauncher {
  show(): void;
  navigate(view: LauncherNavigateView): void;
}

interface LinkRouterOptions {
  launcher: () => LinkLauncher | null;
  openBoardWindow: (boardId: string) => Promise<BoardOpenOutcome>;
  log: (route: string) => void;
}

export interface LinkRouter {
  handle(url: string): void;
  flush(): void;
}

const notice = (message: string): LauncherNavigateView => ({
  kind: "notice",
  message,
});

const widgetView = (
  link: Extract<ConchLink, { kind: "widget" }>
): LauncherNavigateView =>
  Object.keys(link.values).length === 0
    ? { kind: "widget-run", widgetId: link.widgetId }
    : { kind: "widget-args", values: link.values, widgetId: link.widgetId };

// Links come from anywhere, so they only stage work: the user's ↵ starts an
// ask or a run with link values. Logs name the route, never its text.
export const createLinkRouter = ({
  launcher,
  openBoardWindow,
  log,
}: LinkRouterOptions): LinkRouter => {
  let pending: string | null = null;

  const openBoard = async (target: LinkLauncher, boardId: string) => {
    try {
      if ((await openBoardWindow(boardId)) === "missing") {
        target.navigate(notice(MISSING_BOARD));
      }
    } catch {
      log("board failed");
      target.navigate(notice(BOARD_FAILED));
    }
  };

  const route = (target: LinkLauncher, url: string) => {
    const parsed = parseConchLink(url);
    if (!parsed.ok) {
      log("rejected");
      target.navigate(notice(UNKNOWN_LINK));
      return;
    }
    const { link } = parsed;
    log(link.kind);
    switch (link.kind) {
      case "open": {
        target.show();
        return;
      }
      case "ask": {
        target.navigate({
          connection: link.connection,
          kind: "ask-draft",
          prompt: link.prompt,
        });
        return;
      }
      case "widget": {
        target.navigate(widgetView(link));
        return;
      }
      case "board": {
        openBoard(target, link.boardId);
        return;
      }
      default: {
        throw new Error(`Unknown link ${link satisfies never}`);
      }
    }
  };

  return {
    flush: () => {
      const target = launcher();
      if (pending === null || !target) {
        return;
      }
      const url = pending;
      pending = null;
      route(target, url);
    },
    handle: (url) => {
      const target = launcher();
      if (!target) {
        pending = url;
        return;
      }
      route(target, url);
    },
  };
};

export const urlOfOpenEvent = (event: unknown): string | null => {
  if (typeof event !== "object" || event === null || !("data" in event)) {
    return null;
  }
  const { data } = event;
  if (typeof data !== "object" || data === null || !("url" in data)) {
    return null;
  }
  return typeof data.url === "string" ? data.url : null;
};
