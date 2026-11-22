import { describe, expect, it } from "vitest";

import type { BoundValues } from "./arg-template.ts";

import {
  buildRequestUrl,
  parsePathTemplate,
  pathParamRefs,
} from "./request-url.ts";

const text = (value: string): BoundValues => ({
  id: { kind: "text", value },
});

const BASE = "https://api.example.com/v1";

describe("parsePathTemplate", () => {
  it("reads literal and whole-segment placeholders", () => {
    expect(parsePathTemplate("/repos/{{owner}}/{{period.from}}")).toStrictEqual(
      {
        ok: true,
        parts: [
          { kind: "literal", text: "repos" },
          { kind: "param", name: "owner", part: null },
          { kind: "param", name: "period", part: "from" },
        ],
      }
    );
    expect(pathParamRefs("/a/{{id}}/{{period.to}}")).toStrictEqual([
      { $param: "id" },
      { $param: "period", part: "to" },
    ]);
  });

  it.each([
    ["status", "Start the path with /."],
    ["/items-{{id}}", "An input fills a whole path segment, like /{{id}}/."],
    ["/{{ID}}", "An input fills a whole path segment, like /{{id}}/."],
    ["/a/../b", "The path can't use . or .. segments."],
    ["/a/%2e%2E/b", "The path can't use . or .. segments."],
  ])("rejects %s", (path, error) => {
    expect(parsePathTemplate(path)).toStrictEqual({ error, ok: false });
    expect(pathParamRefs(path)).toStrictEqual([]);
  });
});

describe("buildRequestUrl", () => {
  it("joins under the base path and sets query values", () => {
    const url = buildRequestUrl(
      BASE,
      "/items/{{id}}",
      { limit: 10, q: "a b&c", status: { $param: "id" } },
      text("42")
    );
    expect(url.toString()).toBe(
      "https://api.example.com/v1/items/42?limit=10&q=a+b%26c&status=42"
    );
  });

  it("keeps the base's own query and drops its fragment", () => {
    const url = buildRequestUrl(
      "https://api.example.com/v1/?team=core#x",
      "/status",
      {},
      {}
    );
    expect(url.toString()).toBe("https://api.example.com/v1/status?team=core");
  });

  it.each([
    ["../../admin", "..%2F..%2Fadmin"],
    ["a/b", "a%2Fb"],
    ["%2F", "%252F"],
    ["//evil.com", "%2F%2Fevil.com"],
    ["user@evil.com", "user%40evil.com"],
    ["https://evil.com/x", "https%3A%2F%2Fevil.com%2Fx"],
    ["café ☕", "caf%C3%A9%20%E2%98%95"],
    ["?admin=1#frag", "%3Fadmin%3D1%23frag"],
  ])("encodes %s as one segment", (value, encoded) => {
    const url = buildRequestUrl(BASE, "/items/{{id}}", {}, text(value));
    expect(url.origin).toBe("https://api.example.com");
    expect(url.pathname).toBe(`/v1/items/${encoded}`);
    expect(url.search).toBe("");
  });

  it.each(["", ".", ".."])("rejects the path value %j", (value) => {
    expect(() =>
      buildRequestUrl(BASE, "/items/{{id}}", {}, text(value))
    ).toThrow("A path input can't be empty, . or ..");
  });

  it("rejects a template that would escape the base path", () => {
    expect(() => buildRequestUrl(BASE, "/../admin", {}, {})).toThrow(
      "The path can't use . or .. segments."
    );
  });

  it("refuses a whole date range as a path or query value", () => {
    const values: BoundValues = {
      period: { from: "2026-01-01", kind: "dateRange", to: "2026-02-01" },
    };
    expect(() =>
      buildRequestUrl(BASE, "/x", { from: { $param: "period" } }, values)
    ).toThrow('Use "period" with part "from" or "to" here.');
    expect(
      buildRequestUrl(
        BASE,
        "/x/{{period.from}}",
        { to: { $param: "period", part: "to" } },
        values
      ).toString()
    ).toBe("https://api.example.com/v1/x/2026-01-01?to=2026-02-01");
  });
});
