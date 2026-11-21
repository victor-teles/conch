export type TimeGrain = "hour" | "day" | "week" | "month" | "quarter" | "year";

export type Node = Record<string, unknown>;

export interface ColumnRef {
  name: string;
  table: string | null;
}

export const isRecord = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const nodeOf = (value: unknown, type: string): Node | null => {
  if (!isRecord(value)) {
    return null;
  }
  const inner = value[type];
  return isRecord(inner) ? inner : null;
};

export const listOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

export const identifier = (value: unknown): string | null =>
  isRecord(value) && typeof value.name === "string" ? value.name : null;

export const textOf = (value: unknown): string | null => {
  const literal = nodeOf(value, "literal");
  if (literal && typeof literal.value === "string") {
    return literal.value;
  }
  const variable = nodeOf(value, "var");
  return variable && typeof variable.this === "string" ? variable.this : null;
};

const WRAPPERS = ["alias", "cast", "paren"];

export const unwrap = (value: unknown): unknown => {
  for (const wrapper of WRAPPERS) {
    const inner = nodeOf(value, wrapper);
    if (inner) {
      return unwrap(inner.this);
    }
  }
  return value;
};

export const columnOf = (value: unknown): ColumnRef | null => {
  const column = nodeOf(unwrap(value), "column");
  const name = column ? identifier(column.name) : null;
  if (!(column && name)) {
    return null;
  }
  return { name, table: identifier(column.table) };
};

export const operatorOf = (conjunct: unknown): [string, Node] | null => {
  if (!isRecord(conjunct)) {
    return null;
  }
  const [entry] = Object.entries(conjunct);
  return entry && isRecord(entry[1]) ? [entry[0], entry[1]] : null;
};

export const functionOf = (
  value: unknown
): { name: string; args: unknown[] } | null => {
  const fn = nodeOf(unwrap(value), "function");
  return fn && typeof fn.name === "string"
    ? { args: listOf(fn.args), name: fn.name.toLowerCase() }
    : null;
};

export const NOW_FUNCTIONS = new Set([
  "current_date",
  "current_timestamp",
  "now",
  "today",
  "getdate",
  "sysdate",
  "date",
  "datetime",
]);

const GRAIN_WORDS: [RegExp, TimeGrain][] = [
  [/^(hour|hh)/, "hour"],
  [/^(day|dd?$|dayofyear)/, "day"],
  [/^(week|wk|ww|isoweek|iso_week)/, "week"],
  [/^(month|mm?$|mon)/, "month"],
  [/^(quarter|qq?$)/, "quarter"],
  [/^(year|yy|yyyy)/, "year"],
];

export const grainOfUnit = (unit: string | null): TimeGrain | null => {
  const word = unit?.toLowerCase().trim() ?? "";
  return GRAIN_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? null;
};

const FORMAT_GRAINS: [RegExp, TimeGrain][] = [
  [/%H/, "hour"],
  [/%[dj]/, "day"],
  [/%[WVUu]/, "week"],
  [/%m/, "month"],
  [/%Y/, "year"],
];

export const grainOfFormat = (format: string | null): TimeGrain | null =>
  FORMAT_GRAINS.find(([pattern]) => pattern.test(format ?? ""))?.[1] ?? null;
