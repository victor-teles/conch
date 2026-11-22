import { describe, expect, it } from "vitest";

import { filterByLabel } from "./actions-filter";

const items = ["Run", "Add to Board…", "Export Widget", "Delete"];
const label = (item: string) => item;

describe("filterByLabel", () => {
  it("keeps everything for a blank query", () => {
    expect(filterByLabel(items, "  ", label)).toStrictEqual(items);
  });

  it("keeps matches in their menu order instead of re-ranking", () => {
    expect(filterByLabel(items, "e", label)).toStrictEqual([
      "Export Widget",
      "Delete",
    ]);
    expect(filterByLabel(items, "board", label)).toStrictEqual([
      "Add to Board…",
    ]);
  });

  it("returns nothing when no label matches", () => {
    expect(filterByLabel(items, "zzz", label)).toStrictEqual([]);
  });
});
