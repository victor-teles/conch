import { describe, expect, it } from "vitest";

import { makeAuditEntry } from "@/test/mcp-fixtures";

import { auditActions } from "./audit-actions";

const idsOf = (entry: ReturnType<typeof makeAuditEntry>) =>
  auditActions(entry).map((action) => action.id);

describe("auditActions", () => {
  it("offers SQL and question copies when the entry has them", () => {
    expect(idsOf(makeAuditEntry())).toStrictEqual([
      "copy-sql",
      "copy-question",
      "clear",
    ]);
  });

  it("leaves only a destructive clear for calls without SQL or a question", () => {
    const entry = makeAuditEntry({ question: null, sql: null });
    expect(idsOf(entry)).toStrictEqual(["clear"]);
    expect(auditActions(entry)[0]?.tone).toBe("destructive");
  });
});
