import { describe, expect, it } from "vitest";

import type { Visibility } from "@/lib/ipc";

import { initialWidgetRun } from "@/components/widgets/widget-run-reducer";
import { runResult } from "@/test/widget-fixtures";

import type { PanelState } from "./mini-app-state";

import { isVisible, valueAt } from "./panel-visibility";

const loaded = {
  ...initialWidgetRun({}),
  outcome: runResult(),
  status: "done" as const,
};

const state: PanelState = {
  inputs: { limit: 10, region: "EU" },
  sources: { orders: loaded, pending: initialWidgetRun({}) },
};

const cases: [string, Visibility | undefined, boolean][] = [
  ["no condition", undefined, true],
  ["input equals", { $state: "/inputs/region", eq: "EU" }, true],
  ["input differs", { $state: "/inputs/region", eq: "US" }, false],
  ["input not equal", { $state: "/inputs/region", neq: "US" }, true],
  ["number above", { $state: "/inputs/limit", gt: 5 }, true],
  ["number not above", { $state: "/inputs/limit", gt: 10 }, false],
  ["text is never above", { $state: "/inputs/region", gt: 0 }, false],
  ["negated", { $state: "/inputs/region", eq: "EU", not: true }, false],
  ["missing input is falsy", { $state: "/inputs/ghost" }, false],
  ["source has rows", { $state: "/sources/orders/rows" }, true],
  ["pending source has no rows", { $state: "/sources/pending/rows" }, false],
  ["row count above", { $state: "/sources/orders/rowCount", gt: 0 }, true],
  ["status", { $state: "/sources/orders/status", eq: "done" }, true],
  [
    "unknown source status",
    { $state: "/sources/ghost/status", eq: "idle" },
    true,
  ],
];

describe("isVisible", () => {
  it.each(cases)("%s", (_name, cond, expected) => {
    expect(isVisible(cond, state)).toBe(expected);
  });

  it("never reads a prototype key", () => {
    expect(valueAt("/inputs/constructor", state)).toBeUndefined();
    expect(valueAt("/sources/orders/other", state)).toBeUndefined();
  });
});
