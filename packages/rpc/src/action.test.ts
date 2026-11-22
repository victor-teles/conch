import { describe, expect, it } from "vitest";

import type { ActionTarget, AuditEntry } from "./action.ts";

import {
  ActionDraft,
  actionProblems,
  activityOf,
  canonicalActionJson,
  deriveEffect,
  isAudited,
  isSafeLinkUrl,
  placeholderNames,
  understates,
  WidgetAction,
  writeTargetOf,
} from "./action.ts";

const sql: ActionTarget = {
  connectionId: "pg",
  database: null,
  dialect: "postgresql",
  kind: "sql",
  maxAffectedRows: 1,
  statementTemplate: "UPDATE orders SET status = {{status}} WHERE id = {{id}}",
};

const sqlDraft = {
  bind: {
    id: { column: "id", from: "row" as const },
    status: { from: "literal" as const, value: "shipped" },
  },
  label: "Mark shipped",
  scope: "row" as const,
  target: sql,
};

const stamp = "2026-11-21T10:00:00.000Z";
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");

describe("actionDraft", () => {
  it("accepts a row action whose binds match its placeholders", () => {
    expect(ActionDraft.parse(sqlDraft)).toStrictEqual(sqlDraft);
  });

  it("requires a value for every placeholder", () => {
    const { status: _status, ...bind } = sqlDraft.bind;
    expect(actionProblems({ ...sqlDraft, bind })).toStrictEqual([
      'Choose a value for "status".',
    ]);
  });

  it("rejects a binding the target never uses", () => {
    const bind = {
      ...sqlDraft.bind,
      extra: { from: "literal" as const, value: 1 },
    };
    expect(actionProblems({ ...sqlDraft, bind })).toStrictEqual([
      '"extra" isn\'t used by the action.',
    ]);
  });

  it("only lets row actions read row values", () => {
    expect(actionProblems({ ...sqlDraft, scope: "widget" })).toStrictEqual([
      '"id" reads a row, so the action must act on rows.',
    ]);
  });

  it("rejects date-range parts", () => {
    const target: ActionTarget = {
      ...sql,
      statementTemplate: "DELETE FROM t WHERE day = {{range.from}}",
    };
    expect(
      actionProblems({
        bind: { range: { from: "input", name: "range" } },
        scope: "widget",
        target,
      })
    ).toStrictEqual(["Actions bind whole values; leave out .from and .to."]);
  });

  it("reports a malformed template instead of throwing", () => {
    const target: ActionTarget = {
      ...sql,
      statementTemplate: "UPDATE t SET a = '{{x}}' WHERE id = {{id}}",
    };
    expect(actionProblems({ bind: {}, scope: "widget", target })[0]).toMatch(
      /quoted string/
    );
  });

  it("reads placeholders from every target kind", () => {
    expect(
      placeholderNames({
        baseUrl: "https://dashboard.example.com/base",
        kind: "open-url",
        path: "/charges/{{id}}",
        query: { tab: { $param: "tab" } },
      })
    ).toStrictEqual(["id", "tab"]);
    expect(
      placeholderNames({ kind: "copy", template: "{{a}} and {{ b }} {{a}}" })
    ).toStrictEqual(["a", "b"]);
    expect(
      placeholderNames({
        args: { charge: { $param: "charge" }, nested: [{ $param: "amount" }] },
        kind: "mcp",
        serverId: "s",
        tool: "refund",
      })
    ).toStrictEqual(["charge", "amount"]);
    expect(
      placeholderNames({
        body: { note: { $param: "note" } },
        endpointId: "e",
        kind: "http",
        method: "POST",
        path: "/v1/{{id}}",
        query: {},
      })
    ).toStrictEqual(["id", "note"]);
  });

  it("rejects stray braces in a copy template", () => {
    expect(
      actionProblems({
        bind: {},
        scope: "widget",
        target: { kind: "copy", template: "{{ Bad }}" },
      })
    ).toStrictEqual(["Write inputs as {{name}}."]);
  });

  it("caps max affected rows at 100", () => {
    expect(
      ActionDraft.safeParse({
        ...sqlDraft,
        target: { ...sql, maxAffectedRows: 101 },
      }).success
    ).toBeFalsy();
  });
});

describe("isSafeLinkUrl", () => {
  it.each([
    ["https://dashboard.stripe.com", true],
    ["https://example.com/base/path", true],
    ["http://example.com", false],
    [SCRIPT_URL, false],
    ["https://user:pw@example.com", false],
    ["https://example.com/?a=1", false],
    ["https://example.com/#x", false],
    ["file:///etc/passwd", false],
  ])("%s → %s", (url, safe) => {
    expect(isSafeLinkUrl(url)).toBe(safe);
  });
});

describe("deriveEffect", () => {
  it.each<[string, ActionTarget, boolean | null, string]>([
    ["copy", { kind: "copy", template: "x" }, null, "read"],
    [
      "open-url",
      { baseUrl: "https://a.com", kind: "open-url", path: "/", query: {} },
      null,
      "external",
    ],
    [
      "http GET",
      {
        body: null,
        endpointId: "e",
        kind: "http",
        method: "GET",
        path: "/",
        query: {},
      },
      null,
      "read",
    ],
    ...(["POST", "PUT", "PATCH", "DELETE"] as const).map(
      (method): [string, ActionTarget, boolean | null, string] => [
        `http ${method}`,
        {
          body: null,
          endpointId: "e",
          kind: "http",
          method,
          path: "/",
          query: {},
        },
        null,
        "write",
      ]
    ),
    [
      "mcp read-only hint",
      { args: {}, kind: "mcp", serverId: "s", tool: "t" },
      true,
      "read",
    ],
    [
      "mcp hint false",
      { args: {}, kind: "mcp", serverId: "s", tool: "t" },
      false,
      "write",
    ],
    [
      "mcp hint missing",
      { args: {}, kind: "mcp", serverId: "s", tool: "t" },
      null,
      "write",
    ],
    ["sql", sql, true, "write"],
  ])("%s", (_name, target, hint, effect) => {
    expect(deriveEffect(target, hint)).toBe(effect);
  });

  it("audits writes and links but not reads", () => {
    expect(isAudited("read")).toBeFalsy();
    expect(isAudited("external")).toBeTruthy();
    expect(isAudited("write")).toBeTruthy();
  });

  it("flags a stored effect weaker than the derived one", () => {
    expect(understates("read", "write")).toBeTruthy();
    expect(understates("external", "write")).toBeTruthy();
    expect(understates("read", "external")).toBeTruthy();
    expect(understates("write", "write")).toBeFalsy();
    expect(understates("write", "read")).toBeFalsy();
  });
});

describe("canonicalActionJson", () => {
  it("is stable under key reordering and ignores other fields", () => {
    const reordered = JSON.parse(
      `{"target":{"statementTemplate":${JSON.stringify(
        "UPDATE orders SET status = {{status}} WHERE id = {{id}}"
      )},"maxAffectedRows":1,"kind":"sql","dialect":"postgresql","database":null,"connectionId":"pg"},"label":"Another label","scope":"row","bind":{"status":{"value":"shipped","from":"literal"},"id":{"from":"row","column":"id"}}}`
    );
    expect(Object.keys(reordered)).toStrictEqual([
      "target",
      "label",
      "scope",
      "bind",
    ]);
    expect(canonicalActionJson(reordered)).toBe(canonicalActionJson(sqlDraft));
  });

  it("changes when a bound value changes", () => {
    const changed = {
      ...sqlDraft,
      bind: {
        ...sqlDraft.bind,
        status: { from: "literal" as const, value: "cancelled" },
      },
    };
    expect(canonicalActionJson(changed)).not.toBe(
      canonicalActionJson(sqlDraft)
    );
  });
});

describe("widgetAction", () => {
  it("parses a stored action", () => {
    const stored = {
      ...sqlDraft,
      createdAt: stamp,
      effect: "write",
      id: "a1",
      reviewHash: "a".repeat(64),
      reviewedAt: stamp,
      updatedAt: stamp,
      widgetId: "w1",
    };
    expect(WidgetAction.parse(stored)).toStrictEqual(stored);
  });
});

describe("writeTargetOf", () => {
  it("names the permission a target needs", () => {
    expect(writeTargetOf(sql)).toStrictEqual({ id: "pg", kind: "connection" });
    expect(
      writeTargetOf({ args: {}, kind: "mcp", serverId: "s", tool: "t" })
    ).toStrictEqual({ id: "s", kind: "mcp" });
    expect(writeTargetOf({ kind: "copy", template: "x" })).toBeNull();
  });
});

describe("activityOf", () => {
  const entry = (
    overrides: Partial<AuditEntry> & Pick<AuditEntry, "executionId" | "phase">
  ): AuditEntry => ({
    actionId: "a1",
    actionLabel: "Mark shipped",
    at: stamp,
    bound: [],
    compiled: null,
    durationMs: null,
    effect: "write",
    environment: "production",
    id: `${overrides.executionId}-${overrides.phase}`,
    outcome: null,
    prevHash: "0".repeat(64),
    targetKind: "sql",
    targetName: "analytics",
    widgetId: "w1",
    ...overrides,
  });

  it("pairs started and finished entries, newest first", () => {
    const activity = activityOf([
      entry({ executionId: "x1", phase: "started" }),
      entry({
        durationMs: 42,
        executionId: "x1",
        outcome: {
          affectedRows: 1,
          durationMs: 42,
          ok: true,
          summary: "1 row",
        },
        phase: "finished",
      }),
      entry({
        at: "2026-11-21T11:00:00.000Z",
        executionId: "x2",
        phase: "started",
      }),
      entry({
        at: "2026-11-21T12:00:00.000Z",
        executionId: "x3",
        phase: "started",
      }),
      entry({
        executionId: "x3",
        outcome: {
          code: "TOO_MANY_ROWS",
          durationMs: 3,
          message: "no",
          ok: false,
        },
        phase: "finished",
      }),
    ]);
    expect(
      activity.map((item) => [item.executionId, item.status])
    ).toStrictEqual([
      ["x3", "failed"],
      ["x2", "interrupted"],
      ["x1", "ok"],
    ]);
    expect(activity[2]?.durationMs).toBe(42);
  });
});
