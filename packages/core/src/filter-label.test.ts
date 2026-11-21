import { describe, expect, it } from "vitest";

import type { DialectType } from "./types.ts";

import { describeSqlAssumptions } from "./sql-assumptions.ts";

const labelsOf = (where: string, dialect: DialectType = "postgresql") =>
  describeSqlAssumptions(
    `select count(*) from orders where ${where}`,
    dialect
  )?.items.flatMap((item) => (item.kind === "filter" ? [item.label] : []));

describe("filter labels", () => {
  it.each([
    [
      "EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())",
      "created_at this year",
    ],
    [
      "date_trunc('month', created_at) = date_trunc('month', current_date)",
      "created_at this month",
    ],
    ["EXTRACT(YEAR FROM created_at) = 2025", "created_at in 2025"],
    ["EXTRACT(QUARTER FROM created_at) = 3", "created_at quarter 3"],
    ["region = 'Europe'", "region is Europe"],
    ["o.region <> 'Europe'", "region is not Europe"],
    ["total > 100", "total over 100"],
    ["100 <= total", "total at least 100"],
    ["total < 5", "total under 5"],
    ["is_active = true", "is_active"],
    ["is_active = false", "not is_active"],
    ["NOT is_active", "not is_active"],
    ["is_active", "is_active"],
    ["status IN ('paid')", "status is paid"],
    [
      "status IN ('paid', 'shipped', 'held')",
      "status is paid, shipped or held",
    ],
    ["status IN ('a', 'b', 'c', 'd', 'e')", "status is a, b, c +2"],
    ["status NOT IN ('refunded', 'void')", "status is not refunded or void"],
    ["email IS NULL", "email is empty"],
    ["email IS NOT NULL", "email is set"],
    ["name LIKE '%acme%'", "name contains acme"],
    ["name ILIKE 'acme%'", "name starts with acme"],
    ["name LIKE '%inc'", "name ends with inc"],
    ["name LIKE 'a_c%'", "name matches a_c%"],
    ["total BETWEEN 10 AND 20", "total 10 to 20"],
    ["total NOT BETWEEN 10 AND 20", "total outside 10 to 20"],
  ])("reads %s as %s", (where, label) => {
    expect(labelsOf(`${where} and id > 0`)?.[0]).toBe(label);
  });

  it.each([
    ["created_at >= NOW() - INTERVAL '30 days'", "created_at last 30 days"],
    [
      "created_at >= CURRENT_DATE - INTERVAL '1 month'",
      "created_at past month",
    ],
    ["created_at >= CURRENT_DATE", "created_at from today"],
    ["created_at < NOW()", "created_at before today"],
    ["created_at >= DATE '2026-01-01'", "created_at since 2026-01-01"],
    ["created_at < '2026-03-01 00:00:00'", "created_at before 2026-03-01"],
  ])("reads the date range %s as %s", (where, label) => {
    const items = describeSqlAssumptions(
      `select count(*) from orders where ${where}`,
      "postgresql"
    )?.items;
    expect(items).toContainEqual({
      column: "created_at",
      grain: null,
      kind: "time",
      range: label,
    });
  });

  it("reads SQLite's strftime periods", () => {
    expect(
      labelsOf(
        "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
        "sqlite"
      )
    ).toStrictEqual(["created_at this month"]);
  });

  it("falls back to the SQL for shapes it does not know", () => {
    expect(labelsOf("total * 2 > tax")).toStrictEqual(["total * 2 > tax"]);
  });
});
