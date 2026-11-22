import { describe, expect, it } from "vitest";

import { assumptionChips } from "./assumption-chips";

describe("assumptionChips", () => {
  it("is empty without assumptions", () => {
    expect(assumptionChips(null)).toStrictEqual([]);
    expect(assumptionChips({ items: [] })).toStrictEqual([]);
  });

  it("joins the tables into one plain chip and orders the rest", () => {
    const chips = assumptionChips({
      items: [
        { kind: "table", name: "orders" },
        { kind: "table", name: "regions" },
        {
          column: "orders.created_at",
          grain: "month",
          kind: "time",
          range: null,
        },
        {
          column: "status",
          kind: "filter",
          label: "status is not refunded",
          text: "status <> 'refunded'",
        },
        { kind: "limit", rows: 500 },
      ],
    });
    expect(chips.map((chip) => chip.label)).toStrictEqual([
      "orders, regions",
      "orders.created_at by month",
      "status is not refunded",
      "top 500",
    ]);
    expect(chips[0]?.prefill).toBeNull();
    expect(chips[2]?.detail).toBe("status <> 'refunded'");
  });

  it("names a date range on the time chip when nothing buckets by time", () => {
    const [chip] = assumptionChips({
      items: [
        {
          column: "created_at",
          grain: null,
          kind: "time",
          range: "created_at last 30 days",
        },
      ],
    });
    expect(chip?.label).toBe("created_at last 30 days");
  });

  it.each([
    [
      {
        column: "created_at",
        grain: "month" as const,
        kind: "time" as const,
        range: null,
      },
      "group by week instead of by month",
      "week",
    ],
    [
      {
        column: "created_at",
        grain: "year" as const,
        kind: "time" as const,
        range: null,
      },
      "group by quarter instead of by year",
      "quarter",
    ],
    [
      {
        column: "created_at",
        grain: null,
        kind: "time" as const,
        range: null,
      },
      "use another date column than created_at",
      "another date column",
    ],
  ])(
    "pre-fills a time chip and selects the word to edit",
    (item, text, word) => {
      const [chip] = assumptionChips({ items: [item] });
      const start = text.indexOf(word);
      expect(chip?.prefill).toStrictEqual({
        selection: [start, start + word.length],
        text,
      });
    }
  );

  it("pre-fills filter and limit chips with the caret at the end", () => {
    const chips = assumptionChips({
      items: [
        {
          column: null,
          kind: "filter",
          label: "total over 10",
          text: "total > 10",
        },
        { kind: "limit", rows: 50 },
      ],
    });
    expect(chips.map((chip) => chip.prefill)).toStrictEqual([
      { selection: null, text: "drop the “total over 10” filter" },
      { selection: null, text: "show all rows, not only the top 50" },
    ]);
  });
});
