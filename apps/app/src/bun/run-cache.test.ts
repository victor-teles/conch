import type { TabularResult } from "@conch/core";

import { describe, expect, it } from "vitest";

import { createRunCache } from "./run-cache.ts";

const result = (rows: unknown[][]): TabularResult => ({
  columns: [
    { name: "id", typeName: "int" },
    { name: "status", typeName: "text" },
  ],
  executionTimeMs: 1,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

const clock = () => {
  const state = { at: 0 };
  return { advance: (ms: number) => (state.at += ms), now: () => state.at };
};

describe("run cache", () => {
  it("returns a recorded row with its columns and widget", () => {
    const time = clock();
    const cache = createRunCache({ now: time.now });
    cache.record(
      "r1",
      "w1",
      result([
        [1, "new"],
        [2, "paid"],
      ])
    );
    expect(cache.rowAt("r1", 1)).toStrictEqual({
      columns: ["id", "status"],
      ownerId: "w1",
      row: [2, "paid"],
    });
    expect(cache.rowAt("r1", 5)).toBeNull();
    expect(cache.rowAt("missing", 0)).toBeNull();
  });

  it("forgets runs after ten minutes", () => {
    const time = clock();
    const cache = createRunCache({ now: time.now });
    cache.record("r1", "w1", result([[1, "new"]]));
    time.advance(10 * 60_000);
    expect(cache.rowAt("r1", 0)).toBeNull();
  });

  it("keeps only the newest twenty runs", () => {
    const time = clock();
    const cache = createRunCache({ now: time.now });
    for (let index = 0; index < 21; index += 1) {
      cache.record(`r${index}`, "w1", result([[index, "x"]]));
    }
    expect(cache.rowAt("r0", 0)).toBeNull();
    expect(cache.rowAt("r20", 0)?.row).toStrictEqual([20, "x"]);
  });

  it("knows the latest columns of a widget", () => {
    const time = clock();
    const cache = createRunCache({ now: time.now });
    expect(cache.columnsFor("w1")).toStrictEqual([]);
    cache.record("r1", "w1", result([]));
    expect(cache.columnsFor("w1")).toStrictEqual(["id", "status"]);
  });
});
