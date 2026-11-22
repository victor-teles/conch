import { describe, expect, it } from "vitest";

import type { BoundValues } from "./arg-template.ts";

import {
  bindArgs,
  collectParamRefs,
  isParamRef,
  paramText,
} from "./arg-template.ts";

const values: BoundValues = {
  day: { kind: "date", value: "2026-11-18" },
  limit: { kind: "number", value: 25 },
  period: { from: "2026-08-01", kind: "dateRange", to: "2026-11-01" },
  status: { kind: "text", value: "needs_response" },
};

describe("isParamRef", () => {
  it.each([
    [{ $param: "status" }, true],
    [{ $param: "period", part: "from" }, true],
    [{ $param: "period", part: "middle" }, false],
    [{ $param: "status", extra: 1 }, false],
    [{ $param: 3 }, false],
    ["{{status}}", false],
    [null, false],
  ])("%j → %s", (value, expected) => {
    expect(isParamRef(value)).toBe(expected);
  });
});

describe("bindArgs", () => {
  it("replaces references with typed JSON values", () => {
    const template = {
      created: { gte: { $param: "period", part: "from" } },
      limit: { $param: "limit" },
      on: { $param: "day" },
      range: { $param: "period" },
      statuses: [{ $param: "status" }, "won"],
      verbose: false,
    };
    expect(bindArgs(template, values)).toStrictEqual({
      created: { gte: "2026-08-01" },
      limit: 25,
      on: "2026-11-18",
      range: { from: "2026-08-01", to: "2026-11-01" },
      statuses: ["needs_response", "won"],
      verbose: false,
    });
  });

  it("never interprets braces inside strings", () => {
    expect(bindArgs({ q: "{{status}}" }, values)).toStrictEqual({
      q: "{{status}}",
    });
  });

  it("rejects unknown names and parts on non-range inputs", () => {
    expect(() => bindArgs({ a: { $param: "nope" } }, values)).toThrow(
      'The call uses an input named "nope" that doesn\'t exist.'
    );
    expect(() =>
      bindArgs({ a: { $param: "status", part: "to" } }, values)
    ).toThrow('"status" isn\'t a date range, so it has no to.');
  });

  it("does not resolve names through the prototype", () => {
    expect(() => bindArgs({ $param: "constructor" }, values)).toThrow(
      "doesn't exist"
    );
  });
});

describe("collectParamRefs", () => {
  it("finds references at any depth", () => {
    expect(
      collectParamRefs({
        a: [{ $param: "status" }, { b: { $param: "period", part: "to" } }],
        c: "literal",
      })
    ).toStrictEqual([{ $param: "status" }, { $param: "period", part: "to" }]);
  });
});

describe("paramText", () => {
  it("renders scalars and refuses a whole range", () => {
    expect(paramText({ $param: "limit" }, values)).toBe("25");
    expect(paramText({ $param: "period", part: "to" }, values)).toBe(
      "2026-11-01"
    );
    expect(() => paramText({ $param: "period" }, values)).toThrow(
      'Use "period" with part "from" or "to" here.'
    );
  });
});
