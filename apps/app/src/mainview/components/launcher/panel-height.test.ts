import { describe, expect, it } from "vitest";

import {
  LIST_PANEL_MAX_HEIGHT,
  PANEL_MAX_HEIGHT,
  panelMaxHeightOf,
} from "./panel-height";

describe("panelMaxHeightOf", () => {
  it.each(["ask", "lookup", "widget-run", "watch", "import"] as const)(
    "gives the %s view the full panel height",
    (kind) => {
      expect(panelMaxHeightOf(kind)).toBe(PANEL_MAX_HEIGHT);
    }
  );

  it.each(["root", "history", "settings", "board-picker", "watches"] as const)(
    "caps the %s list so it scrolls instead of growing",
    (kind) => {
      expect(panelMaxHeightOf(kind)).toBe(LIST_PANEL_MAX_HEIGHT);
    }
  );
});
