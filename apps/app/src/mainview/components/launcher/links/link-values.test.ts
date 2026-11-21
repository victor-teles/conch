import { describe, expect, it } from "vitest";

import type { ParamDef } from "@/lib/ipc";

import { linkParamsOf, linkValues, rejectedNotice } from "./link-values";

const params: ParamDef[] = [
  {
    default: "Europe",
    label: "Region",
    name: "region",
    options: ["Europe", "North America"],
    type: "select",
  },
  {
    default: "lastQuarter",
    label: "Period",
    name: "period",
    type: "dateRange",
  },
  {
    default: 10,
    label: "Limit",
    max: 100,
    min: 1,
    name: "limit",
    type: "number",
  },
  { default: "today", label: "Day", name: "day", type: "date" },
  { default: "", label: "Email", name: "email", type: "text" },
  {
    default: "",
    label: "Team",
    name: "team",
    optionsSql: "select team from t",
    type: "select",
  },
  {
    default: "acme",
    fixed: true,
    label: "Tenant",
    name: "tenant",
    type: "text",
  },
];

describe("linkValues", () => {
  it("takes each input type from its text", () => {
    expect(
      linkValues(params, {
        day: "2026-11-01",
        email: "ada@example.com",
        limit: "25",
        region: "North America",
        team: "growth",
      })
    ).toStrictEqual({
      rejected: [],
      values: {
        day: "2026-11-01",
        email: "ada@example.com",
        limit: 25,
        region: "North America",
        team: "growth",
      },
    });
  });

  it("reads a date range as a preset or as from and to", () => {
    expect(linkValues(params, { period: "ytd" }).values).toStrictEqual({
      period: "ytd",
    });
    expect(
      linkValues(params, {
        "period.from": "2026-01-01",
        "period.to": "2026-02-01",
      }).values
    ).toStrictEqual({ period: { from: "2026-01-01", to: "2026-02-01" } });
  });

  it("rejects half a range, a backwards range and an unknown preset", () => {
    expect(linkValues(params, { "period.from": "2026-01-01" })).toStrictEqual({
      rejected: ["period.from"],
      values: {},
    });
    expect(
      linkValues(params, {
        "period.from": "2026-02-01",
        "period.to": "2026-01-01",
      }).rejected
    ).toStrictEqual(["period.from", "period.to"]);
    expect(linkValues(params, { period: "forever" }).rejected).toStrictEqual([
      "period",
    ]);
  });

  it.each(["abc", "", "NaN", "Infinity", "1e400", "500", "0"])(
    "rejects the number %s",
    (raw) => {
      expect(linkValues(params, { limit: raw }).rejected).toStrictEqual([
        "limit",
      ]);
    }
  );

  it("rejects an option that is not on the list, but leaves live options to bun", () => {
    expect(linkValues(params, { region: "Mars" }).rejected).toStrictEqual([
      "region",
    ]);
    expect(linkValues(params, { team: "anything" }).values).toStrictEqual({
      team: "anything",
    });
  });

  it("never sets a fixed input and reports unknown keys", () => {
    expect(linkValues(params, { nope: "1", tenant: "evil" })).toStrictEqual({
      rejected: ["nope", "tenant"],
      values: {},
    });
  });

  it("rejects text over the input limit and a bad date", () => {
    expect(
      linkValues(params, { day: "2026-13-01", email: "x".repeat(201) }).rejected
    ).toStrictEqual(["day", "email"]);
  });
});

describe("rejectedNotice", () => {
  it("lists the ignored keys", () => {
    expect(rejectedNotice(["foo", "bar"])).toBe("Ignored from link: foo, bar.");
    expect(rejectedNotice([])).toBeNull();
  });
});

describe("linkParamsOf", () => {
  it("writes presets, ranges and numbers, and skips fixed inputs", () => {
    expect(
      linkParamsOf(params, {
        limit: 25,
        period: { from: "2026-01-01", to: "2026-02-01" },
        region: "Europe",
        tenant: "acme",
      })
    ).toStrictEqual({
      limit: "25",
      "period.from": "2026-01-01",
      "period.to": "2026-02-01",
      region: "Europe",
    });
  });

  it("round-trips through linkValues", () => {
    const values = { day: "today", limit: 3, period: "ytd", region: "Europe" };
    expect(linkValues(params, linkParamsOf(params, values))).toStrictEqual({
      rejected: [],
      values,
    });
  });
});
