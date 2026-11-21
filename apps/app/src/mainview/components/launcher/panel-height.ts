import type { LauncherView } from "./use-launcher-stack";

export const PANEL_MAX_HEIGHT = 680;
export const LIST_PANEL_MAX_HEIGHT = 476;

// Answers and previews need room; every other view is a list or a short form
// that scrolls inside a fixed panel instead of growing with its content.
const CONTENT_VIEWS: ReadonlySet<LauncherView["kind"]> = new Set([
  "ask",
  "import",
  "lookup",
  "watch",
  "widget-run",
]);

export const panelMaxHeightOf = (kind: LauncherView["kind"]): number =>
  CONTENT_VIEWS.has(kind) ? PANEL_MAX_HEIGHT : LIST_PANEL_MAX_HEIGHT;
