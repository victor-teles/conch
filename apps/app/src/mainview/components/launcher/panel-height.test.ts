import { describe, expect, it } from "vitest";

import {
  fittedPanelHeight,
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

describe("fittedPanelHeight", () => {
  it("keeps the view's cap when bun reports nothing", () => {
    expect(fittedPanelHeight(PANEL_MAX_HEIGHT, null)).toBe(PANEL_MAX_HEIGHT);
  });

  it("leaves room for the shadow margin inside a short window", () => {
    expect(fittedPanelHeight(PANEL_MAX_HEIGHT, 600)).toBe(560);
    expect(fittedPanelHeight(LIST_PANEL_MAX_HEIGHT, 720)).toBe(
      LIST_PANEL_MAX_HEIGHT
    );
  });

  it("never shrinks below a usable panel", () => {
    expect(fittedPanelHeight(PANEL_MAX_HEIGHT, 100)).toBe(240);
  });
});
