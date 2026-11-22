import { describe, expect, it } from "vitest";

import { parseSelectPath, select } from "./json-select.ts";

const at = (json: unknown, path: string): unknown => {
  const parsed = parseSelectPath(path);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return select(json, parsed.segments);
};

describe("parseSelectPath", () => {
  it.each([
    ["$", []],
    ["$.data", [{ key: "data", kind: "key" }]],
    ["$['first name']", [{ key: "first name", kind: "key" }]],
    ['$["a.b"]', [{ key: "a.b", kind: "key" }]],
    ["$[3]", [{ index: 3, kind: "index" }]],
    [
      "$.data[*].id",
      [
        { key: "data", kind: "key" },
        { kind: "wildcard" },
        { key: "id", kind: "key" },
      ],
    ],
  ])("parses %s", (path, segments) => {
    expect(parseSelectPath(path)).toStrictEqual({ ok: true, segments });
  });

  it.each([
    ["", "Start the path with $."],
    ["data", "Start the path with $."],
    ["$..data", 'The path can\'t read "..data".'],
    ["$.data[?(@.x > 1)]", 'The path can\'t read "[?(@.x > 1)]".'],
    ["$.data[(1+1)]", 'The path can\'t read "[(1+1)]".'],
    ["$.data[-1]", 'The path can\'t read "[-1]".'],
    ["$.data[0:2]", 'The path can\'t read "[0:2]".'],
    ["$.a[*].b[*].c[*]", "Use at most 2 [*] in a path."],
    [`$.${"a".repeat(200)}`, "Keep the path under 200 characters."],
    ["$['unterminated]", "The path can't read \"['unterminated]\"."],
  ])("rejects %s", (path, error) => {
    expect(parseSelectPath(path)).toStrictEqual({ error, ok: false });
  });
});

describe("select", () => {
  it("reads Stripe-style lists under data", () => {
    const json = { data: [{ id: "dp_1" }, { id: "dp_2" }], has_more: false };
    expect(at(json, "$.data[*]")).toStrictEqual(json.data);
    expect(at(json, "$.data[*].id")).toStrictEqual(["dp_1", "dp_2"]);
    expect(at(json, "$.data[1].id")).toBe("dp_2");
  });

  it("reads GitHub-style top-level arrays", () => {
    const json = [{ number: 1 }, { number: 2 }];
    expect(at(json, "$")).toBe(json);
    expect(at(json, "$[*].number")).toStrictEqual([1, 2]);
  });

  it("flattens two wildcards and spreads object values", () => {
    const json = {
      teams: [{ members: ["a", "b"] }, { members: ["c"] }],
      totals: { eu: 3, us: 5 },
    };
    expect(at(json, "$.teams[*].members[*]")).toStrictEqual(["a", "b", "c"]);
    expect(at(json, "$.totals[*]")).toStrictEqual([3, 5]);
  });

  it.each([
    [{ a: 1 }, "$.b"],
    [{ a: 1 }, "$.constructor"],
    [{ a: 1 }, "$['__proto__']"],
    [[1], "$[5]"],
    ["text", "$.a"],
  ])("finds nothing in %j at %s, never reading the prototype", (json, path) => {
    expect(at(json, path)).toBeUndefined();
  });

  it("skips items without the key under a wildcard", () => {
    expect(at({ a: [{ b: 1 }, {}] }, "$.a[*].b")).toStrictEqual([1]);
  });
});
