import { CopyIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { ListedAction } from "@/lib/ipc";

import { actionMenuEntries, isActionMenuEntry } from "./action-menu-items";

const listedOf = (
  id: string,
  scope: "row" | "widget",
  effect: ListedAction["effect"],
  kind: "sql" | "copy" = "sql"
): ListedAction => ({
  action: {
    bind: {},
    createdAt: "",
    effect,
    id,
    label: `Action ${id}`,
    reviewHash: "a".repeat(64),
    reviewedAt: "",
    scope,
    target:
      kind === "copy"
        ? { kind: "copy", template: "x" }
        : {
            connectionId: "pg",
            database: null,
            dialect: "postgresql",
            kind: "sql",
            maxAffectedRows: 1,
            statementTemplate: "DELETE FROM t WHERE id = 1",
          },
    updatedAt: "",
    widgetId: "w1",
  },
  effect,
  subtitle: `Subtitle ${id}`,
  targetName: "analytics",
});

describe("actionMenuEntries", () => {
  const listed = [
    listedOf("a", "row", "write"),
    listedOf("b", "widget", "external"),
    listedOf("c", "row", "read", "copy"),
  ];

  it("leads with row actions and built-in copies when a row is selected", () => {
    const entries = actionMenuEntries(listed, true);
    expect(entries.map((entry) => entry.id)).toStrictEqual([
      "action:a",
      "action:c",
      "row:copy-value",
      "row:copy-row-json",
      "action:b",
    ]);
    expect(entries[0]).toMatchObject({
      accent: true,
      detail: "Subtitle a",
      label: "Action a",
    });
    expect(entries[1]?.accent).toBeFalsy();
  });

  it("lists only widget actions without a row", () => {
    expect(
      actionMenuEntries(listed, false).map((entry) => entry.id)
    ).toStrictEqual(["action:b"]);
  });

  it("recognizes its own entries", () => {
    const entries = actionMenuEntries(listed, true);
    expect(entries.every(isActionMenuEntry)).toBeTruthy();
    expect(
      isActionMenuEntry({
        icon: CopyIcon,
        id: "copy-sql",
        label: "Copy SQL",
        tone: "default",
      })
    ).toBeFalsy();
  });
});
