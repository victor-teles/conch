import { describe, expect, it } from "vitest";

import {
  argsProblem,
  buildSource,
  emptyFields,
  fieldsOf,
  newQueryRow,
} from "./draft-model";

const MCP = { id: "stripe", type: "mcp" } as const;
const HTTP = { id: "status", type: "http" } as const;

describe("draft model", () => {
  it("starts empty for each kind", () => {
    expect(emptyFields(MCP)).toStrictEqual({
      argsText: "{}",
      kind: "mcp",
      select: "$",
      tool: "",
    });
    expect(emptyFields(HTTP)).toStrictEqual({
      kind: "http",
      path: "/",
      query: [],
      select: "$",
    });
  });

  it("builds an MCP call from typed JSON", () => {
    expect(
      buildSource(MCP, {
        argsText: '{"status": {"$param": "status"}, "limit": 20}',
        kind: "mcp",
        select: "$.data[*]",
        tool: "list_disputes",
      })
    ).toStrictEqual({
      ok: true,
      source: {
        args: { limit: 20, status: { $param: "status" } },
        kind: "mcp",
        select: "$.data[*]",
        serverId: "stripe",
        tool: "list_disputes",
      },
    });
  });

  it.each([
    ["{", "The arguments aren't valid JSON."],
    [
      '{"a": {"$param": "x", "y": 1}}',
      'A {"$param": …} reference takes only "$param" and "part".',
    ],
    ["[1]", "Invalid input: expected record, received array"],
  ])("explains bad arguments %s", (text, message) => {
    expect(argsProblem(text)).toBe(message);
  });

  it("asks for a tool before anything else", () => {
    expect(buildSource(MCP, emptyFields(MCP))).toStrictEqual({
      message: "Choose a tool.",
      ok: false,
    });
  });

  it("turns query rows into literals and references", () => {
    const built = buildSource(HTTP, {
      kind: "http",
      path: "/incidents/{{state}}",
      query: [
        newQueryRow("since", "{{period.from}}"),
        newQueryRow("limit", "5"),
        newQueryRow("", "x"),
      ],
      select: "$.incidents[*]",
    });
    expect(built).toMatchObject({
      ok: true,
      source: {
        path: "/incidents/{{state}}",
        query: { limit: "5", since: { $param: "period", part: "from" } },
      },
    });
    expect(
      buildSource(HTTP, {
        kind: "http",
        path: "/a/../b",
        query: [],
        select: "$",
      })
    ).toStrictEqual({
      message: "The path can't use . or .. segments.",
      ok: false,
    });
  });

  it("round-trips a proposed source into fields", () => {
    const fields = fieldsOf({
      endpointId: "status",
      kind: "http",
      method: "GET",
      path: "/x",
      query: { state: { $param: "state" }, verbose: true },
      select: "$",
    });
    expect(fields).toMatchObject({
      kind: "http",
      query: [
        { name: "state", value: "{{state}}" },
        { name: "verbose", value: "true" },
      ],
    });
    expect(
      fieldsOf({
        args: { a: 1 },
        kind: "mcp",
        select: "$",
        serverId: "s",
        tool: "t",
      })
    ).toStrictEqual({
      argsText: '{\n  "a": 1\n}',
      kind: "mcp",
      select: "$",
      tool: "t",
    });
  });
});
