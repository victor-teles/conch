import { COLOR } from "@/theme";

export const CONNECTION = { engine: "postgres", name: "Production" } as const;

export const PROMPT = "mrr by region this year";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
] as const;

export interface Series {
  label: string;
  color: string;
  values: readonly number[];
}

export const REGION_MRR: readonly Series[] = [
  {
    color: COLOR.chart1,
    label: "North America",
    values: [180, 186, 195, 203, 214, 222, 234, 246, 258],
  },
  {
    color: COLOR.chart2,
    label: "Europe",
    values: [97, 101, 106, 110, 117, 123, 131, 139, 146],
  },
  {
    color: COLOR.chart3,
    label: "Asia Pacific",
    values: [31, 34, 38, 42, 47, 52, 58, 64, 71],
  },
];

export const ANSWER = {
  insight:
    "Asia Pacific more than doubled this year, from $31k to $71k. Total MRR reached $475k in September, up 54% since January.",
  rows: 27,
  runtimeMs: 386,
  subtitle: "Jan to Sep 2026 · $475k in September",
  title: "Monthly recurring revenue by region",
} as const;

export const SQL = `-- Monthly recurring revenue by region in 2026
select date_trunc('month', s.billed_at)::date as month,
       r.name as region,
       sum(s.amount_cents) / 100.0 as mrr
from subscriptions s
join accounts a on a.id = s.account_id
join regions r on r.id = a.region_id
where s.billed_at >= date '2026-01-01'
  and s.status = 'active'
group by 1, 2
order by 1, 2
limit 500`;

export const RECENT_ASKS = [
  "weekly signups by plan",
  "orders by status this week",
  "slowest queries in the last hour",
] as const;

export const WIDGETS = [
  { name: "Revenue this month", params: "range" },
  { name: "Active accounts", params: "plan" },
] as const;
