import { describe, expect, it } from "vitest";

import { sqlSource } from "@/test/widget-fixtures";

import { COPIED, sourceText } from "./source-text";

describe("sourceText", () => {
  it("copies the last run's call when there is one", () => {
    expect(
      sourceText(sqlSource(), { kind: "sql", sql: "select 1 where a = $1" })
    ).toBe("select 1 where a = $1");
    expect(
      sourceText(
        {
          endpointId: "status",
          kind: "http",
          method: "GET",
          path: "/x",
          query: {},
          select: "$",
        },
        { endpoint: "Status", kind: "http", url: "https://a.example.com/x?s=1" }
      )
    ).toBe("https://a.example.com/x?s=1");
  });

  it("falls back to the template for each kind", () => {
    expect(sourceText(sqlSource({ sqlTemplate: "select {{a}}" }), null)).toBe(
      "select {{a}}"
    );
    expect(
      sourceText(
        {
          args: { status: { $param: "status" } },
          kind: "mcp",
          select: "$",
          serverId: "s",
          tool: "list_disputes",
        },
        null
      )
    ).toBe('list_disputes {\n  "status": {\n    "$param": "status"\n  }\n}');
    expect(
      sourceText(
        {
          endpointId: "status",
          kind: "http",
          method: "GET",
          path: "/incidents",
          query: { limit: 5, since: { $param: "period", part: "from" } },
          select: "$",
        },
        null
      )
    ).toBe("/incidents?limit=5&since=%7B%7Bperiod.from%7D%7D");
    expect(
      sourceText(
        {
          endpointId: "status",
          kind: "http",
          method: "GET",
          path: "/all",
          query: {},
          select: "$",
        },
        null
      )
    ).toBe("/all");
    expect(COPIED).toStrictEqual({
      http: "Copied URL",
      mcp: "Copied call",
      sql: "Copied SQL",
    });
  });
});
