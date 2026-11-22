import type { Node, TimeGrain } from "./sql-ast.ts";

import {
  columnOf,
  functionOf,
  grainOfFormat,
  grainOfUnit,
  listOf,
  nodeOf,
  NOW_FUNCTIONS,
  operatorOf,
  textOf,
  unwrap,
} from "./sql-ast.ts";

type Comparison = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

interface Value {
  text: string;
  kind: "text" | "number" | "date" | "boolean";
}

const COMPARISONS: ReadonlySet<string> = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
]);
const FLIPPED: Record<Comparison, Comparison> = {
  eq: "eq",
  gt: "lt",
  gte: "lte",
  lt: "gt",
  lte: "gte",
  neq: "neq",
};
const VALUE_WORDS: Record<Comparison, string> = {
  eq: "is",
  gt: "over",
  gte: "at least",
  lt: "under",
  lte: "at most",
  neq: "is not",
};
const DATE_WORDS: Record<Comparison, string> = {
  eq: "on",
  gt: "after",
  gte: "since",
  lt: "before",
  lte: "until",
  neq: "not on",
};
const CURRENT_PERIOD: Record<TimeGrain, string> = {
  day: "today",
  hour: "this hour",
  month: "this month",
  quarter: "this quarter",
  week: "this week",
  year: "this year",
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const MIDNIGHT = /[ T]00:00(:00)?(\.0+)?$/;
const AMOUNT = /^\s*(\d+)\s*([a-z]+)/i;
const LIST_SHOWN = 3;

const isComparison = (kind: string): kind is Comparison =>
  COMPARISONS.has(kind);

const valueOf = (expression: unknown): Value | null => {
  const value = unwrap(expression);
  const flag = nodeOf(value, "boolean");
  if (flag && typeof flag.value === "boolean") {
    return { kind: "boolean", text: String(flag.value) };
  }
  const literal = nodeOf(value, "literal");
  if (!(literal && typeof literal.value === "string")) {
    return null;
  }
  const type = literal.literal_type;
  if (type === "number") {
    return { kind: "number", text: literal.value };
  }
  if (type === "date" || type === "timestamp" || ISO_DATE.test(literal.value)) {
    return { kind: "date", text: literal.value.replace(MIDNIGHT, "") };
  }
  return { kind: "text", text: literal.value };
};

const NOW_MODIFIERS: ReadonlySet<string> = new Set(["now", "localtime", "utc"]);

const isNowWord = (expression: unknown): boolean =>
  NOW_MODIFIERS.has(textOf(unwrap(expression))?.toLowerCase() ?? "");

const isNow = (expression: unknown): boolean => {
  const value = unwrap(expression);
  if (textOf(value)?.toLowerCase() === "now") {
    return true;
  }
  const fn = functionOf(value);
  return Boolean(fn && NOW_FUNCTIONS.has(fn.name) && fn.args.every(isNowWord));
};

const listWords = (values: readonly string[]): string => {
  if (values.length > LIST_SHOWN) {
    const rest = values.length - LIST_SHOWN;
    return `${values.slice(0, LIST_SHOWN).join(", ")} +${rest}`;
  }
  const last = values.at(-1) ?? "";
  return values.length > 1
    ? `${values.slice(0, -1).join(", ")} or ${last}`
    : last;
};

interface Period {
  grain: TimeGrain;
  of: unknown;
}

const PERIOD_FUNCTIONS: Partial<Record<string, TimeGrain>> = {
  day: "day",
  month: "month",
  quarter: "quarter",
  week: "week",
  year: "year",
};

const functionPeriod = (name: string, args: unknown[]): Period | null => {
  const direct = PERIOD_FUNCTIONS[name];
  if (direct) {
    return { grain: direct, of: args[0] };
  }
  const [first, second] = args;
  switch (name) {
    case "date_trunc":
    case "date_part":
    case "datepart": {
      const grain = grainOfUnit(textOf(first));
      return grain ? { grain, of: second } : null;
    }
    case "strftime": {
      const grain = grainOfFormat(textOf(first));
      return grain ? { grain, of: second } : null;
    }
    case "date_format": {
      const grain = grainOfFormat(textOf(second));
      return grain ? { grain, of: first } : null;
    }
    default: {
      return null;
    }
  }
};

const periodOf = (expression: unknown): Period | null => {
  const value = unwrap(expression);
  const extract = nodeOf(value, "extract");
  if (extract) {
    const grain =
      typeof extract.field === "string" ? grainOfUnit(extract.field) : null;
    return grain ? { grain, of: extract.this } : null;
  }
  const fn = functionOf(value);
  return fn ? functionPeriod(fn.name, fn.args) : null;
};

const periodLabel = (
  kind: Comparison,
  left: unknown,
  right: unknown
): string | null => {
  const period = periodOf(left);
  const column = period ? columnOf(period.of) : null;
  if (!(period && column && kind === "eq")) {
    return null;
  }
  const other = periodOf(right);
  if (other?.grain === period.grain && isNow(other.of)) {
    return `${column.name} ${CURRENT_PERIOD[period.grain]}`;
  }
  const value = valueOf(right);
  if (!value) {
    return null;
  }
  return period.grain === "year"
    ? `${column.name} in ${value.text}`
    : `${column.name} ${period.grain} ${value.text}`;
};

type Amount = [count: number, unit: TimeGrain];

const amountOf = (text: string): Amount | null => {
  const match = AMOUNT.exec(text);
  const grain = match ? grainOfUnit(match[2] ?? null) : null;
  return match && grain ? [Number(match[1]), grain] : null;
};

const intervalAmount = (expression: unknown): Amount | null => {
  const interval = nodeOf(unwrap(expression), "interval");
  const amount = interval ? textOf(interval.this) : null;
  if (!(interval && amount)) {
    return null;
  }
  const unit = typeof interval.unit === "string" ? interval.unit : "";
  return amountOf(`${amount} ${unit}`);
};

// NOW() - INTERVAL '30 days', CURRENT_DATE - 30, or SQLite's DATE('now', '-30 days').
const pastAmount = (expression: unknown): Amount | null => {
  const value = unwrap(expression);
  const back = nodeOf(value, "sub");
  if (back && isNow(back.left)) {
    const days = valueOf(back.right);
    return days?.kind === "number"
      ? [Number(days.text), "day"]
      : intervalAmount(back.right);
  }
  const fn = functionOf(value);
  const [first, modifier] = fn?.args ?? [];
  const offset = textOf(unwrap(modifier));
  if (!(fn && NOW_FUNCTIONS.has(fn.name) && isNowWord(first) && offset)) {
    return null;
  }
  return offset.trimStart().startsWith("-")
    ? amountOf(offset.replace("-", ""))
    : null;
};

const relativeLabel = (
  kind: Comparison,
  column: string,
  other: unknown
): string | null => {
  const after = kind === "gt" || kind === "gte";
  if (isNow(other)) {
    if (kind === "eq" || kind === "neq") {
      return null;
    }
    return `${column} ${after ? "from today" : "before today"}`;
  }
  const amount = pastAmount(other);
  if (!(amount && after)) {
    return null;
  }
  const [count, unit] = amount;
  return count === 1
    ? `${column} past ${unit}`
    : `${column} last ${count} ${unit}s`;
};

const comparisonLabel = (kind: Comparison, node: Node): string | null => {
  const period =
    periodLabel(kind, node.left, node.right) ??
    periodLabel(FLIPPED[kind], node.right, node.left);
  if (period) {
    return period;
  }
  const leftColumn = columnOf(node.left);
  const column = leftColumn ?? columnOf(node.right);
  if (!column) {
    return null;
  }
  const op = leftColumn ? kind : FLIPPED[kind];
  const other = leftColumn ? node.right : node.left;
  const relative = relativeLabel(op, column.name, other);
  const value = valueOf(other);
  if (relative || !value) {
    return relative;
  }
  if (value.kind === "boolean" && (op === "eq" || op === "neq")) {
    const holds = (value.text === "true") === (op === "eq");
    return holds ? column.name : `not ${column.name}`;
  }
  const words = value.kind === "date" ? DATE_WORDS : VALUE_WORDS;
  return `${column.name} ${words[op]} ${value.text}`;
};

const inLabel = (node: Node): string | null => {
  const column = columnOf(node.this);
  const values = listOf(node.expressions).map((item) => valueOf(item)?.text);
  if (!column || values.length === 0 || values.some((v) => v === undefined)) {
    return null;
  }
  const words = listWords(values.filter((v): v is string => v !== undefined));
  return `${column.name} ${node.not === true ? "is not" : "is"} ${words}`;
};

const likeLabel = (node: Node): string | null => {
  const column = columnOf(node.left);
  const pattern = textOf(unwrap(node.right));
  if (!(column && pattern)) {
    return null;
  }
  const starts = pattern.startsWith("%");
  const ends = pattern.endsWith("%");
  const core = pattern.replaceAll(/^%|%$/g, "");
  if (core.includes("%") || core.includes("_") || core === "") {
    return `${column.name} matches ${pattern}`;
  }
  if (starts && ends) {
    return `${column.name} contains ${core}`;
  }
  if (ends) {
    return `${column.name} starts with ${core}`;
  }
  return starts
    ? `${column.name} ends with ${core}`
    : `${column.name} is ${core}`;
};

const betweenLabel = (node: Node): string | null => {
  const column = columnOf(node.this);
  const low = valueOf(node.low);
  const high = valueOf(node.high);
  if (!(column && low && high)) {
    return null;
  }
  const range = `${low.text} to ${high.text}`;
  return node.not === true
    ? `${column.name} outside ${range}`
    : `${column.name} ${range}`;
};

const nullLabel = (node: Node): string | null => {
  const column = columnOf(node.this);
  if (!column) {
    return null;
  }
  return `${column.name} ${node.not === true ? "is set" : "is empty"}`;
};

const notLabel = (node: Node): string | null => {
  const column = columnOf(node.this);
  return column ? `not ${column.name}` : null;
};

// Reads a WHERE conjunct the way a person would say it ("region is Europe",
// "created_at this year"); null when the shape isn't one it knows.
export const filterLabel = (conjunct: unknown): string | null => {
  const bare = columnOf(conjunct);
  if (bare) {
    return bare.name;
  }
  const operator = operatorOf(unwrap(conjunct));
  if (!operator) {
    return null;
  }
  const [kind, node] = operator;
  if (isComparison(kind)) {
    return comparisonLabel(kind, node);
  }
  switch (kind) {
    case "in": {
      return inLabel(node);
    }
    case "like":
    case "i_like": {
      return likeLabel(node);
    }
    case "between": {
      return betweenLabel(node);
    }
    case "is_null": {
      return nullLabel(node);
    }
    case "not": {
      return notLabel(node);
    }
    default: {
      return null;
    }
  }
};
