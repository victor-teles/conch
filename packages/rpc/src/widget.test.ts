import { describe, expect, it } from "vitest";

import type { ParamDef } from "./widget.ts";

import { CARD_SPEC_VERSION } from "./card-spec.ts";
import {
  ParamDef as ParamDefSchema,
  parseStoredWidget,
  paramValueSchema,
  RecentAsk,
  toTemplateValue,
  Widget,
  WidgetDraft,
} from "./widget.ts";

const NOW = new Date(2026, 10, 18, 9, 30);

const region: ParamDef = {
  default: "Europe",
  label: "Region",
  name: "region",
  options: ["Europe", "North America"],
  type: "select",
};

const threshold: ParamDef = {
  default: 10,
  label: "Threshold",
  max: 100,
  min: 0,
  name: "threshold",
  type: "number",
};

const period: ParamDef = {
  default: "lastQuarter",
  label: "Period",
  name: "period",
  type: "dateRange",
};

describe("paramDef", () => {
  it("accepts each input type", () => {
    for (const def of [region, threshold, period]) {
      expect(ParamDefSchema.safeParse(def).success).toBeTruthy();
    }
  });

  it("rejects a name that isn't a lowercase identifier", () => {
    expect(
      ParamDefSchema.safeParse({ ...region, name: "Region Name" }).success
    ).toBeFalsy();
  });

  it("rejects a number default outside its bounds", () => {
    expect(
      ParamDefSchema.safeParse({ ...threshold, default: 101 }).success
    ).toBeFalsy();
  });

  it("rejects a select default missing from its options", () => {
    expect(
      ParamDefSchema.safeParse({ ...region, default: "Mars" }).success
    ).toBeFalsy();
  });

  it("rejects a backwards custom range", () => {
    expect(
      ParamDefSchema.safeParse({
        ...period,
        default: { from: "2026-02-01", to: "2026-01-01" },
      }).success
    ).toBeFalsy();
  });
});

describe("paramValueSchema", () => {
  it("accepts only listed select options", () => {
    expect(paramValueSchema(region).safeParse("Europe").success).toBeTruthy();
    expect(paramValueSchema(region).safeParse("x'; drop").success).toBeFalsy();
  });

  it("checks select values against options loaded from the database", () => {
    const schema = paramValueSchema(
      { ...region, options: undefined, optionsSql: "select 1" },
      ["Asia Pacific"]
    );
    expect(schema.safeParse("Asia Pacific").success).toBeTruthy();
    expect(schema.safeParse("Europe").success).toBeFalsy();
  });

  it("bounds numbers and refuses non-finite values", () => {
    const schema = paramValueSchema(threshold);
    expect(schema.safeParse(50).success).toBeTruthy();
    expect(schema.safeParse(-1).success).toBeFalsy();
    expect(schema.safeParse(Number.POSITIVE_INFINITY).success).toBeFalsy();
    expect(schema.safeParse("50").success).toBeFalsy();
  });

  it("takes a preset or an ISO calendar date", () => {
    const schema = paramValueSchema({
      default: "today",
      label: "Day",
      name: "day",
      type: "date",
    });
    expect(schema.safeParse("startOfMonth").success).toBeTruthy();
    expect(schema.safeParse("2026-02-28").success).toBeTruthy();
    expect(schema.safeParse("2026-02-30").success).toBeFalsy();
    expect(schema.safeParse("02/03/2026").success).toBeFalsy();
  });

  it("caps text length", () => {
    const schema = paramValueSchema({
      default: "",
      label: "Search",
      name: "search",
      type: "text",
    });
    expect(schema.safeParse("a".repeat(200)).success).toBeTruthy();
    expect(schema.safeParse("a".repeat(201)).success).toBeFalsy();
  });
});

describe("toTemplateValue", () => {
  it("resolves a range preset against now", () => {
    expect(toTemplateValue(period, "lastQuarter", NOW)).toStrictEqual({
      from: "2026-07-01",
      kind: "dateRange",
      to: "2026-10-01",
    });
  });

  it("keeps a custom range", () => {
    const range = { from: "2026-01-01", to: "2026-02-01" };
    expect(toTemplateValue(period, range, NOW)).toStrictEqual({
      ...range,
      kind: "dateRange",
    });
  });

  it("resolves a date preset", () => {
    expect(
      toTemplateValue(
        { default: "today", label: "Day", name: "day", type: "date" },
        "startOfYear",
        NOW
      )
    ).toStrictEqual({ kind: "date", value: "2026-01-01" });
  });

  it("maps select and number values", () => {
    expect(toTemplateValue(region, "Europe", NOW)).toStrictEqual({
      kind: "text",
      value: "Europe",
    });
    expect(toTemplateValue(threshold, 5, NOW)).toStrictEqual({
      kind: "number",
      value: 5,
    });
  });
});

describe("widget", () => {
  const v1 = {
    connectionId: "c1",
    createdAt: "2026-11-18T00:00:00.000Z",
    database: null,
    dialect: "postgresql",
    id: "w1",
    lastRunAt: null,
    lastValues: { region: "Asia" },
    name: "Revenue by region",
    params: [region, period],
    prompt: "revenue by region",
    spec: {
      formats: {},
      title: "Revenue",
      version: 1,
      view: { kind: "table" },
    },
    sqlTemplate: "select 1",
    updatedAt: "2026-11-18T00:00:00.000Z",
    view: "table",
  };

  const v2 = {
    createdAt: v1.createdAt,
    id: v1.id,
    lastRunAt: null,
    lastValues: v1.lastValues,
    name: v1.name,
    params: [region, period],
    prompt: v1.prompt,
    source: {
      connectionId: "c1",
      database: null,
      dialect: "postgresql",
      kind: "sql",
      sqlTemplate: "select 1",
    },
    spec: { ...v1.spec, version: CARD_SPEC_VERSION },
    updatedAt: v1.updatedAt,
    version: 2,
    view: "table",
  };

  const mcp = {
    ...v2,
    params: [{ ...region, default: "won", options: ["needs_response", "won"] }],
    source: {
      args: { limit: 20, status: { $param: "region" } },
      kind: "mcp",
      select: "$.data[*]",
      serverId: "stripe",
      tool: "list_disputes",
    },
  };

  it("upgrades a version 1 widget into a SQL source", () => {
    expect(parseStoredWidget(v1)).toStrictEqual(v2);
  });

  it("round-trips a version 2 widget", () => {
    const parsed = parseStoredWidget(v2);
    expect(parsed).toStrictEqual(v2);
    expect(parseStoredWidget(structuredClone(parsed))).toStrictEqual(v2);
    expect(parseStoredWidget(mcp)?.source.kind).toBe("mcp");
  });

  it("returns null for garbage and newer shapes", () => {
    expect(parseStoredWidget(null)).toBeNull();
    expect(parseStoredWidget({ id: "w1" })).toBeNull();
    expect(parseStoredWidget({ ...v2, version: 3 })).toBeNull();
    expect(parseStoredWidget({ ...v1, dialect: "mongodb" })).toBeNull();
  });

  it("only accepts version 2 as a widget", () => {
    expect(Widget.safeParse(v2).success).toBeTruthy();
    expect(Widget.safeParse(v1).success).toBeFalsy();
  });

  it("rejects duplicate input names", () => {
    expect(
      Widget.safeParse({ ...v2, params: [region, region] }).success
    ).toBeFalsy();
  });

  it("caps inputs at six", () => {
    const params = Array.from({ length: 7 }, (_, index) => ({
      ...threshold,
      name: `n${index}`,
    }));
    expect(Widget.safeParse({ ...v2, params }).success).toBeFalsy();
  });

  it.each([
    [
      "an unused input",
      { params: [...mcp.params, threshold] },
      'The input "threshold" isn\'t used by the call.',
    ],
    [
      "an unknown reference",
      { source: { ...mcp.source, args: { status: { $param: "nope" } } } },
      'The call uses "nope", which isn\'t an input.',
    ],
    [
      "options from SQL",
      {
        params: [{ ...region, options: undefined, optionsSql: "select 1" }],
      },
      '"region" needs a fixed list of options.',
    ],
    [
      "a part on a non-range input",
      {
        source: {
          ...mcp.source,
          args: { status: { $param: "region", part: "from" } },
        },
      },
      '"region" isn\'t a date range, so it has no from.',
    ],
  ])("rejects an MCP widget with %s", (_label, change, message) => {
    const parsed = Widget.safeParse({ ...mcp, ...change });
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      message
    );
    expect(
      WidgetDraft.safeParse({ ...mcp, ...change }).error?.issues[0]?.message
    ).toBe(message);
  });

  it("keeps a fixed input on an MCP widget even when the call stops using it", () => {
    const fixed = { ...threshold, fixed: true };
    expect(
      Widget.safeParse({ ...mcp, params: [...mcp.params, fixed] }).success
    ).toBeTruthy();
  });

  it("checks HTTP paths and query references", () => {
    const http = {
      ...v2,
      params: [period],
      source: {
        endpointId: "status",
        kind: "http",
        method: "GET",
        path: "/incidents/{{period.from}}",
        query: { to: { $param: "period", part: "to" } },
        select: "$.items[*]",
      },
    };
    expect(Widget.safeParse(http).success).toBeTruthy();
    expect(
      Widget.safeParse({
        ...http,
        source: { ...http.source, query: { to: { $param: "period" } } },
      }).error?.issues[0]?.message
    ).toBe('Use "period" with part from or to in a path or query.');
    expect(
      Widget.safeParse({
        ...http,
        source: { ...http.source, method: "POST" },
      }).success
    ).toBeFalsy();
  });
});

describe("recentAsk", () => {
  const v1Recent = {
    askedAt: "2026-11-18T09:12:00.000Z",
    connectionId: "conn-analytics",
    database: null,
    dialect: "postgresql",
    id: "4b0c2f61-8f4e-4a43-9a52-7d0c1d7a0e11",
    prompt: "Revenue by region",
    spec: {
      formats: { mrr: { currency: "USD", kind: "currency" } },
      title: "Monthly recurring revenue by region",
      version: 1,
      view: {
        groupBy: "region",
        kind: "chart",
        mark: "line",
        stacked: false,
        x: "month",
        y: ["mrr"],
      },
    },
    sql: "select month, region, mrr from mrr_by_region order by month",
  };

  it("loads a version 1 recent ask and upgrades its spec", () => {
    const parsed = RecentAsk.parse(v1Recent);
    expect(parsed.spec.version).toBe(CARD_SPEC_VERSION);
    expect(parsed.dialect).toBe("postgresql");
  });

  it("accepts MongoDB and Redis recents", () => {
    for (const dialect of ["mongodb", "redis"]) {
      expect(RecentAsk.parse({ ...v1Recent, dialect }).dialect).toBe(dialect);
    }
  });

  it("rejects an unknown language", () => {
    expect(
      RecentAsk.safeParse({ ...v1Recent, dialect: "cassandra" }).success
    ).toBeFalsy();
  });
});
