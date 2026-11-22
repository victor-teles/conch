import { describe, expect, it } from "vitest";

import { toTabular } from "./to-tabular.ts";

const names = (result: ReturnType<typeof toTabular>) =>
  result.columns.map((column) => column.name);

describe("toTabular", () => {
  it("turns a list of objects into rows with a union of keys", () => {
    const result = toTabular(
      {
        data: [
          { amount: 1200, id: "dp_1", status: "needs_response" },
          { created: "2026-11-02T10:00:00Z", id: "dp_2", status: "won" },
        ],
      },
      "$.data[*]"
    );
    expect(names(result)).toStrictEqual(["amount", "id", "status", "created"]);
    expect(result.rows).toStrictEqual([
      [1200, "dp_1", "needs_response", null],
      [null, "dp_2", "won", "2026-11-02T10:00:00Z"],
    ]);
    expect(result.columns.map((column) => column.typeName)).toStrictEqual([
      "NUMERIC",
      "TEXT",
      "TEXT",
      "TIMESTAMP",
    ]);
  });

  it("flattens one level and clips deeper JSON to 500 characters", () => {
    const result = toTabular(
      [{ owner: { login: "ada", meta: { deep: "x".repeat(600) } } }],
      "$"
    );
    expect(names(result)).toStrictEqual(["owner.login", "owner.meta"]);
    expect(result.rows[0]?.[1]).toMatch(/^\{"deep":"x+…$/);
    expect(String(result.rows[0]?.[1])).toHaveLength(500);
    expect(result.columns[1]?.typeName).toBe("JSON");
  });

  it("shapes scalars, single objects and lists of scalars", () => {
    expect(toTabular({ count: 7 }, "$.count")).toMatchObject({
      columns: [{ name: "value", typeName: "NUMERIC" }],
      rows: [[7]],
    });
    expect(toTabular({ ok: true, open: 3 }, "$")).toMatchObject({
      rows: [[true, 3]],
    });
    expect(toTabular({ tags: ["a", "b"] }, "$.tags")).toMatchObject({
      columns: [{ name: "value" }],
      rows: [["a"], ["b"]],
    });
  });

  it("caps rows and columns", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ index }));
    const result = toTabular(rows, "$", { maxRows: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.isTruncated).toBeTruthy();

    const wide = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`c${index}`, index])
    );
    expect(toTabular(wide, "$").columns).toHaveLength(50);
  });

  it("explains a bad path and a path that matches nothing", () => {
    expect(() => toTabular({}, "data")).toThrow("Start the path with $.");
    expect(() => toTabular({}, "$.data")).toThrow(
      "Nothing in the response matches $.data."
    );
  });

  it("returns no rows for an empty list", () => {
    expect(toTabular({ data: [] }, "$.data")).toMatchObject({
      columns: [],
      rowCount: 0,
      rows: [],
    });
  });
});
