import { describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";

import { makeListed } from "@/test/action-fixtures";

import {
  checkDraft,
  dialectForType,
  draftEffect,
  editorFromDraft,
  emptyEditor,
  syncedBind,
  targetOf,
  withDefaults,
} from "./action-draft-model";

const DEFAULTS = {
  connectionId: "pg",
  endpointId: "e1",
  scope: "row" as const,
  serverId: "s1",
};

const connections = [
  { id: "pg", name: "analytics", type: "postgresql" },
  { id: "ch", name: "events", type: "clickhouse" },
] as DatabaseConnection[];

describe("action draft model", () => {
  it("maps write-capable engines to dialects", () => {
    expect(dialectForType("mssql")).toBe("tsql");
    expect(dialectForType("clickhouse")).toBeNull();
    expect(dialectForType("redis")).toBeNull();
  });

  it("builds a SQL draft with synced bindings", () => {
    const state = {
      ...emptyEditor(DEFAULTS),
      label: "Ship",
      sql: {
        connectionId: "pg",
        maxRows: 1,
        statement: "UPDATE t SET s = {{status}} WHERE id = {{id}}",
      },
    };
    const check = checkDraft(state, connections, ["id"]);
    expect(check.names).toStrictEqual(["status", "id"]);
    expect(check.draft?.bind).toStrictEqual({
      id: { column: "id", from: "row" },
      status: { column: "id", from: "row" },
    });
  });

  it("refuses engines without guarded writes", () => {
    const state = {
      ...emptyEditor({ ...DEFAULTS, connectionId: "ch" }),
      label: "x",
    };
    expect(checkDraft(state, connections, []).problem).toBe(
      "Write actions aren't available for this database."
    );
  });

  it("asks for a label first", () => {
    expect(checkDraft(emptyEditor(DEFAULTS), connections, []).problem).toBe(
      "Give the action a label."
    );
  });

  it("reports invalid JSON and missing sources", () => {
    const base = { ...emptyEditor({ ...DEFAULTS, serverId: "" }), label: "x" };
    expect(targetOf({ ...base, kind: "mcp" }, connections)).toStrictEqual({
      error: "Add an MCP server in Settings first.",
      ok: false,
    });
    expect(
      targetOf(
        {
          ...base,
          kind: "mcp",
          mcp: { argsText: "{", serverId: "s1", tool: "refund" },
        },
        connections
      )
    ).toStrictEqual({ error: "The arguments isn't valid JSON.", ok: false });
  });

  it("drops row bindings on a widget action", () => {
    expect(
      syncedBind(["id"], { id: { column: "id", from: "row" } }, "widget", [
        "id",
      ])
    ).toStrictEqual({ id: { from: "literal", value: "" } });
  });

  it("round-trips a saved draft and fills missing ids", () => {
    const { action } = makeListed();
    const state = editorFromDraft(
      {
        bind: action.bind,
        label: action.label,
        scope: action.scope,
        target: action.target,
      },
      DEFAULTS
    );
    expect(state.sql.statement).toBe(
      "UPDATE revenue SET status = {{status}} WHERE month = {{month}}"
    );
    expect(
      withDefaults({ ...state, mcp: { ...state.mcp, serverId: "" } }, DEFAULTS)
        .mcp.serverId
    ).toBe("s1");
  });

  it("derives the effect from the tool's own hint", () => {
    const target = {
      args: {},
      kind: "mcp" as const,
      serverId: "s1",
      tool: "t",
    };
    const tool = {
      description: "",
      inputSchema: {},
      markedRead: true,
      name: "t",
      readEligible: true,
      title: null,
    };
    expect(draftEffect(target, [{ ...tool, readOnlyHint: true }])).toBe("read");
    expect(draftEffect(target, [{ ...tool, readOnlyHint: null }])).toBe(
      "write"
    );
  });
});
