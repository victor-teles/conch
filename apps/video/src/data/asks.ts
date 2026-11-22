import { COLOR } from "@/theme";

import type { Series } from "./revenue";

import {
  ANSWER,
  CONNECTION,
  MONTH_LABELS,
  PROMPT,
  REGION_MRR,
  SQL,
} from "./revenue";

export type Trend = "up" | "down" | "flat";

export interface CardCopy {
  title: string;
  subtitle: string;
  insight: string;
  trend: Trend;
  views: readonly string[];
  view: string;
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export interface BarRow {
  label: string;
  value: number;
}

export type AskChart =
  | { kind: "line"; labels: readonly string[]; series: readonly Series[] }
  | { kind: "stacked"; labels: readonly string[]; series: readonly Series[] }
  | { kind: "donut"; slices: readonly Slice[]; unit: string }
  | { kind: "bars"; rows: readonly BarRow[]; unit: string }
  | {
      kind: "kpi";
      value: number;
      delta: string;
      label: string;
      spark: readonly number[];
    }
  | {
      kind: "table";
      columns: readonly string[];
      rows: readonly (readonly string[])[];
    };

export interface Connection {
  name: string;
  engine: string;
}

export interface ShowcaseAsk {
  prompt: string;
  connection: Connection;
  writing: string;
  query: string;
  runtimeMs: number;
  rows: number;
  copy: CardCopy;
  chart: AskChart;
}

export interface RefusedAsk {
  prompt: string;
  connection: Connection;
  query: string;
  message: string;
  detail: string;
}

export const REVENUE_ASK: ShowcaseAsk = {
  chart: { kind: "line", labels: MONTH_LABELS, series: REGION_MRR },
  connection: CONNECTION,
  copy: {
    insight: ANSWER.insight,
    subtitle: ANSWER.subtitle,
    title: ANSWER.title,
    trend: "up",
    view: "Line",
    views: ["Line", "Bar", "Table"],
  },
  prompt: PROMPT,
  query: SQL,
  rows: ANSWER.rows,
  runtimeMs: ANSWER.runtimeMs,
  writing: "Writing SQL",
};

const quarterly = (values: readonly number[]): number[] =>
  [0, 3, 6].map((start) =>
    values.slice(start, start + 3).reduce((sum, value) => sum + value, 0)
  );

export const REFINE_PROMPT = "as stacked bars by quarter";

export const QUARTERLY_ASK: ShowcaseAsk = {
  ...REVENUE_ASK,
  chart: {
    kind: "stacked",
    labels: ["Q1", "Q2", "Q3"],
    series: REGION_MRR.map((series) => ({
      ...series,
      values: quarterly(series.values),
    })),
  },
  copy: {
    insight:
      "Q3 was the best quarter in every region. Asia Pacific grew fastest, up 87% from Q1.",
    subtitle: "Q1 to Q3 2026 · $1.35M in Q3",
    title: "Quarterly revenue by region",
    trend: "up",
    view: "Bar",
    views: ["Line", "Bar", "Table"],
  },
  prompt: REFINE_PROMPT,
  rows: 9,
  runtimeMs: 212,
};

const ACCOUNT_SPARK = Array.from({ length: 30 }, (_, day) =>
  Math.round(1146 + day * 4.6 + Math.sin(day * 1.3) * 9)
);

export const ORDER_SLICES: readonly Slice[] = [
  { color: COLOR.chart5, label: "Delivered", value: 2904 },
  { color: COLOR.chart2, label: "Shipped", value: 1126 },
  { color: COLOR.chart1, label: "Processing", value: 538 },
  { color: COLOR.chart3, label: "Cancelled", value: 244 },
];

export const ORDERS_ASK: ShowcaseAsk = {
  chart: { kind: "donut", slices: ORDER_SLICES, unit: "orders" },
  connection: { engine: "mongodb", name: "Orders" },
  copy: {
    insight:
      "Six in ten orders this week are already delivered. Cancellations stay at 5%.",
    subtitle: "Nov 16 to 20 · 4,812 orders",
    title: "Orders by status this week",
    trend: "flat",
    view: "Pie",
    views: ["Pie", "Bar", "Table"],
  },
  prompt: "orders by status this week",
  query: `db.orders.aggregate([
  { $match: { placedAt: { $gte: ISODate("2026-11-16") } } },
  { $group: { _id: "$status", orders: { $sum: 1 } } }
])`,
  rows: 4,
  runtimeMs: 58,
  writing: "Writing the pipeline",
};

export const LATENCY_ASK: ShowcaseAsk = {
  chart: {
    kind: "bars",
    rows: [
      { label: "/search", value: 842 },
      { label: "/checkout", value: 615 },
      { label: "/reports/export", value: 488 },
      { label: "/orders", value: 231 },
      { label: "/login", value: 96 },
    ],
    unit: "ms",
  },
  connection: { engine: "clickhouse", name: "Analytics" },
  copy: {
    insight: "/search is the slowest at 842 ms, 37% slower than /checkout.",
    subtitle: "Today · 5 slowest endpoints",
    title: "p95 latency by endpoint",
    trend: "flat",
    view: "Bar",
    views: ["Bar", "Table"],
  },
  prompt: "p95 latency by endpoint today",
  query: `select endpoint, quantile(0.95)(duration_ms) as p95
from requests where ts >= today()
group by endpoint order by p95 desc limit 5`,
  rows: 5,
  runtimeMs: 94,
  writing: "Writing SQL",
};

export const ACCOUNTS_ASK: ShowcaseAsk = {
  chart: {
    delta: "+12% vs last month",
    kind: "kpi",
    label: "accounts on an active plan",
    spark: ACCOUNT_SPARK,
    value: 1284,
  },
  connection: CONNECTION,
  copy: {
    insight: "138 more than a month ago. Growth held every week.",
    subtitle: "Right now · last 30 days",
    title: "Active accounts",
    trend: "up",
    view: "Number",
    views: ["Number", "Line", "Table"],
  },
  prompt: "how many active accounts right now",
  query: `select count(*) as active_accounts
from accounts
where status = 'active'`,
  rows: 1,
  runtimeMs: 21,
  writing: "Writing SQL",
};

export const LEADERBOARD_ASK: ShowcaseAsk = {
  chart: {
    columns: ["#", "Player", "Score"],
    kind: "table",
    rows: [
      ["1", "nova_k", "98,420"],
      ["2", "marlo", "91,077"],
      ["3", "juniper.dev", "87,310"],
      ["4", "okafor", "80,902"],
      ["5", "tsuki", "76,544"],
    ],
  },
  connection: { engine: "redis", name: "Game cache" },
  copy: {
    insight: "nova_k leads by 7,343 points over marlo.",
    subtitle: "leaderboard:week · top 5",
    title: "Weekly leaderboard",
    trend: "flat",
    view: "Table",
    views: ["Table", "Bar"],
  },
  prompt: "top 5 on the weekly leaderboard",
  query: `ZREVRANGE leaderboard:week 0 4 WITHSCORES`,
  rows: 5,
  runtimeMs: 3,
  writing: "Writing the commands",
};

export const REFUSED_ASK: RefusedAsk = {
  connection: CONNECTION,
  detail: `Nothing ran on ${CONNECTION.name}.`,
  message: "Only read-only queries can run here, not DELETE.",
  prompt: "delete users inactive for a year",
  query: `-- Remove users inactive for a year
delete from users
where last_seen_at < now() - interval '1 year'`,
};
