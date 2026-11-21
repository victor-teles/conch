import type { ConchLink, LauncherNavigateView } from "@conch/rpc";

import { parseConchLink } from "@conch/rpc";

interface LinkOpenerPorts {
  show: () => void;
  navigate: (view: LauncherNavigateView) => void;
  boardExists: (boardId: string) => boolean;
  openBoard: (boardId: string) => void;
}

const UNKNOWN_LINK = "That link isn't one Conch understands.";
const MISSING_BOARD = "That board no longer exists.";

const viewOf = (
  link: Exclude<ConchLink, { kind: "open" | "board" }>
): LauncherNavigateView => {
  if (link.kind === "ask") {
    return {
      connection: link.connection,
      kind: "ask-draft",
      prompt: link.prompt,
    };
  }
  return Object.keys(link.values).length === 0
    ? { kind: "widget-run", widgetId: link.widgetId }
    : { kind: "widget-args", values: link.values, widgetId: link.widgetId };
};

// Plays the bun link router in the browser build, so e2e can open links.
export const createLinkOpener =
  ({ show, navigate, boardExists, openBoard }: LinkOpenerPorts) =>
  (url: string): void => {
    const summon = (view: LauncherNavigateView) => {
      show();
      navigate(view);
    };
    const parsed = parseConchLink(url);
    if (!parsed.ok) {
      summon({ kind: "notice", message: UNKNOWN_LINK });
      return;
    }
    const { link } = parsed;
    if (link.kind === "open") {
      show();
    } else if (link.kind !== "board") {
      summon(viewOf(link));
    } else if (boardExists(link.boardId)) {
      openBoard(link.boardId);
    } else {
      summon({ kind: "notice", message: MISSING_BOARD });
    }
  };
