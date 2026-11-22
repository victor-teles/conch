import { describe, expect, it } from "vitest";

import {
  ArgTemplate,
  compiledText,
  connectionIdOf,
  HttpSource,
  McpArgs,
  McpSource,
  PathTemplate,
  SelectPath,
  Source,
  sourceParamRefs,
} from "./source.ts";

const nest = (depth: number): unknown =>
  depth === 0 ? "leaf" : { next: nest(depth - 1) };

describe("argTemplate", () => {
  it("accepts JSON with parameter references", () => {
    const args = {
      created: { gte: { $param: "period", part: "from" } },
      limit: 20,
      statuses: [{ $param: "status" }, "won"],
      verbose: null,
    };
    expect(McpArgs.parse(args)).toStrictEqual(args);
  });

  it.each([
    ["too deep", { a: nest(7) }, "Nest arguments at most 6 levels deep."],
    [
      "too many keys",
      Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i])),
      "Keep each object under 64 keys.",
    ],
    [
      "too large",
      { blob: Array.from({ length: 10 }, () => "x".repeat(2000)) },
      "Keep the arguments under 16 KB.",
    ],
    [
      "a malformed reference",
      { a: { $param: "status", extra: true } },
      'A {"$param": …} reference takes only "$param" and "part".',
    ],
    [
      "a reference with a bad name",
      { a: { $param: "Status" } },
      'A {"$param": …} reference takes only "$param" and "part".',
    ],
  ])("rejects %s", (_label, args, message) => {
    expect(McpArgs.safeParse(args).error?.issues[0]?.message).toBe(message);
  });

  it("validates a single template value too", () => {
    expect(ArgTemplate.safeParse(nest(7)).success).toBeFalsy();
    expect(ArgTemplate.safeParse(["a", 1, true]).success).toBeTruthy();
  });
});

describe("paths", () => {
  it.each([
    ["/v1/status", true],
    ["/repos/{{owner}}/issues", true],
    ["/a?b=1", false],
    ["/a#frag", false],
    ["/a b", false],
    ["relative", false],
    ["/items-{{id}}", false],
    ["/a/../b", false],
  ])("path %s → %s", (path, ok) => {
    expect(PathTemplate.safeParse(path).success).toBe(ok);
  });

  it.each([
    ["$.data[*]", true],
    ["$", true],
    ["$..x", false],
    ["data", false],
  ])("select %s → %s", (path, ok) => {
    expect(SelectPath.safeParse(path).success).toBe(ok);
  });
});

describe("source", () => {
  const http = {
    endpointId: "e1",
    kind: "http",
    method: "GET",
    path: "/incidents/{{id}}",
    query: { since: { $param: "period", part: "from" }, state: "open" },
    select: "$.items[*]",
  } as const;

  it("parses each kind and only GET for HTTP", () => {
    expect(Source.parse(http).kind).toBe("http");
    expect(
      HttpSource.safeParse({ ...http, method: "DELETE" }).success
    ).toBeFalsy();
    expect(
      McpSource.safeParse({
        args: {},
        kind: "mcp",
        select: "$",
        serverId: "s1",
        tool: "list",
      }).success
    ).toBeTruthy();
  });

  it("caps HTTP query values at 20", () => {
    const query = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`q${i}`, i])
    );
    expect(HttpSource.safeParse({ ...http, query }).success).toBeFalsy();
  });

  it("collects references from paths, queries and args", () => {
    expect(sourceParamRefs(Source.parse(http))).toStrictEqual([
      { $param: "id" },
      { $param: "period", part: "from" },
    ]);
    expect(
      sourceParamRefs({
        connectionId: "c1",
        database: null,
        dialect: "postgresql",
        kind: "sql",
        sqlTemplate: "select {{x}}",
      })
    ).toStrictEqual([]);
  });

  it("describes a compiled call for copying", () => {
    expect(compiledText({ kind: "sql", sql: "select 1" })).toBe("select 1");
    expect(
      compiledText({
        args: { limit: 2 },
        kind: "mcp",
        server: "Stripe",
        tool: "list_disputes",
      })
    ).toBe('list_disputes {\n  "limit": 2\n}');
    expect(
      compiledText({ endpoint: "Status", kind: "http", url: "https://x.dev/a" })
    ).toBe("https://x.dev/a");
  });

  it("knows which widgets run on a connection", () => {
    expect(
      connectionIdOf({
        source: {
          connectionId: "c1",
          database: null,
          dialect: "postgresql",
          kind: "sql",
          sqlTemplate: "select 1",
        },
      })
    ).toBe("c1");
    expect(connectionIdOf({ source: Source.parse(http) })).toBeNull();
  });
});
