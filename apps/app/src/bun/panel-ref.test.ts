import { describe, expect, it } from "vitest";

import { panelUrl, windowKey } from "./panel-ref.ts";

describe("panel refs", () => {
  it("keeps a board's bare id as its window key and prefixes apps", () => {
    expect(windowKey({ id: "b1", kind: "board" })).toBe("b1");
    expect(windowKey({ id: "a1", kind: "app" })).toBe("app:a1");
  });

  it("routes each kind to its own hash path", () => {
    const base = "views://mainview/index.html#/";
    expect(panelUrl(base, { id: "b 1", kind: "board" })).toBe(
      "views://mainview/index.html#/board/b%201"
    );
    expect(panelUrl(base, { id: "a1", kind: "app" })).toBe(
      "views://mainview/index.html#/app/a1"
    );
  });
});

describe("window keys for odd board ids", () => {
  it("never lets a board share an app window's key", () => {
    expect(windowKey({ id: "app:a1", kind: "board" })).toBe("board:app:a1");
    expect(windowKey({ id: "app:a1", kind: "board" })).not.toBe(
      windowKey({ id: "a1", kind: "app" })
    );
  });
});
