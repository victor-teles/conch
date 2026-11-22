import { describe, expect, it } from "vitest";

import type { ActionActivity } from "@/lib/ipc";

import {
  activitySections,
  filterActivity,
  integrityText,
  outcomeLabel,
} from "./activity-model";

const item = (overrides: Partial<ActionActivity>): ActionActivity => ({
  actionLabel: "Mark shipped",
  at: "2026-11-21T10:00:00.000Z",
  bound: [],
  compiled: null,
  durationMs: 42,
  effect: "write",
  environment: "production",
  executionId: "x1",
  outcome: { durationMs: 42, ok: true, summary: "1 row changed" },
  status: "ok",
  targetKind: "sql",
  targetName: "analytics-prod",
  widgetId: "w1",
  ...overrides,
});

const NOW = new Date("2026-11-21T18:00:00.000Z");

describe("activity model", () => {
  it("groups by day, newest first", () => {
    const sections = activitySections(
      [
        item({ at: "2026-11-19T09:00:00.000Z", executionId: "old" }),
        item({ executionId: "today" }),
        item({ at: "2026-11-20T12:00:00.000Z", executionId: "yesterday" }),
      ],
      NOW
    );
    expect(sections.map((section) => section.label)).toStrictEqual([
      "Today",
      "Yesterday",
      "November 19, 2026",
    ]);
  });

  it("filters on label and target", () => {
    const list = [
      item({ executionId: "a" }),
      item({
        actionLabel: "Refund charge",
        executionId: "b",
        targetName: "Stripe",
      }),
    ];
    expect(
      filterActivity(list, "stripe").map((x) => x.executionId)
    ).toStrictEqual(["b"]);
    expect(filterActivity(list, "mark analytics")).toHaveLength(1);
    expect(filterActivity(list, " ")).toHaveLength(2);
  });

  it("mentions logs set aside at a reset", () => {
    expect(integrityText({ archived: 1, entries: 0, ok: true })).toBe(
      "Log verified · an earlier log was set aside at a reset"
    );
  });

  it("names the log's integrity", () => {
    expect(integrityText({ archived: 0, entries: 4, ok: true })).toBe(
      "Log verified"
    );
    expect(
      integrityText({ archived: 0, brokenAt: 2, entries: 4, ok: false })
    ).toBe("Log broken at entry 3");
  });

  it("describes each outcome", () => {
    expect(outcomeLabel(item({}))).toBe("1 row changed");
    expect(
      outcomeLabel(
        item({
          outcome: { code: "X", durationMs: 1, message: "Nope", ok: false },
          status: "failed",
        })
      )
    ).toBe("Nope");
    expect(outcomeLabel(item({ outcome: null, status: "interrupted" }))).toBe(
      "No result recorded"
    );
  });
});
