import type { LauncherView } from "./use-launcher-stack";

export const PANEL_MAX_HEIGHT = 680;
export const LIST_PANEL_MAX_HEIGHT = 476;
export const PANEL_MARGIN = 20;
const MIN_FITTED_HEIGHT = 240;

// Answers and previews need room; every other view is a list or a short form
// that scrolls inside a fixed panel instead of growing with its content.
const CONTENT_VIEWS: ReadonlySet<LauncherView["kind"]> = new Set([
  "action-edit",
  "action-review",
  "activity-entry",
  "ask",
  "import",
  "lookup",
  "mini-app-action",
  "mini-app-generate",
  "source-draft",
  "source-edit",
  "theme-edit",
  "watch",
  "widget-run",
]);

export const panelMaxHeightOf = (kind: LauncherView["kind"]): number =>
  CONTENT_VIEWS.has(kind) ? PANEL_MAX_HEIGHT : LIST_PANEL_MAX_HEIGHT;

// Bun reports how tall the window may grow before it reaches the Dock; the
// panel never asks for more, so its footer can't end up off screen.
export const fittedPanelHeight = (
  max: number,
  windowRoom: number | null
): number =>
  windowRoom === null
    ? max
    : Math.max(MIN_FITTED_HEIGHT, Math.min(max, windowRoom - PANEL_MARGIN * 2));
