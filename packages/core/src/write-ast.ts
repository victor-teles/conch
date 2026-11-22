import { parse } from "@polyglot-sql/sdk";
import { z } from "zod";

import type { DialectType } from "./types.ts";

import { toPolyglotDialect } from "./polyglot-dialect.ts";

export const WRITE_AST_DIALECTS = [
  "postgresql",
  "mysql",
  "sqlite",
  "duckdb",
  "tsql",
] as const satisfies readonly DialectType[];

export type WriteKind = "insert" | "update" | "delete";

export type WriteAstVerdict =
  | { ok: true; kind: WriteKind; table: string }
  | { ok: false; reason: string };

const Name = z.looseObject({ name: z.string().min(1) });

const TableRef = z.looseObject({
  alias: z.unknown().nullish(),
  name: Name,
  schema: Name.nullish(),
});

const Empty = z.array(z.unknown()).max(0);
const Absent = z.null().optional();

const UpdateNode = z.looseObject({
  extra_tables: Empty,
  from_clause: Absent,
  from_joins: Empty,
  output: Absent,
  set: z.array(z.unknown()).min(1),
  table: TableRef,
  table_joins: Empty,
  where_clause: z.looseObject({ this: z.unknown() }),
  with: Absent,
});

const DeleteNode = z.looseObject({
  joins: Empty,
  output: Absent,
  table: TableRef,
  tables: Empty,
  using: Empty,
  where_clause: z.looseObject({ this: z.unknown() }),
  with: Absent,
});

const InsertNode = z.looseObject({
  columns: z.array(Name).min(1),
  default_values: z.literal(false),
  is_replace: z.literal(false),
  on_conflict: Absent,
  output: Absent,
  overwrite: z.literal(false),
  query: Absent,
  source: Absent,
  table: TableRef,
  values: z.array(z.array(z.unknown())).length(1),
  with: Absent,
});

const Statement = z.union([
  z.strictObject({ update: UpdateNode }),
  z.strictObject({ delete: DeleteNode }),
  z.strictObject({ insert: InsertNode }),
]);

const Parsed = z.looseObject({
  ast: z.array(z.unknown()),
  success: z.literal(true),
});

const NESTED_QUERY_KEYS = new Set([
  "select",
  "subquery",
  "union",
  "intersect",
  "except",
  "exists",
  "insert",
  "update",
  "delete",
  "merge",
]);

const reject = (reason: string): WriteAstVerdict => ({ ok: false, reason });

const hasNestedQuery = (node: unknown, depth: number): boolean => {
  if (Array.isArray(node)) {
    return node.some((item) => hasNestedQuery(item, depth + 1));
  }
  if (typeof node !== "object" || node === null) {
    return false;
  }
  return Object.entries(node).some(
    ([key, value]) =>
      (depth > 0 && NESTED_QUERY_KEYS.has(key)) ||
      hasNestedQuery(value, depth + 1)
  );
};

// Built-ins the parser names itself (upper, coalesce, cast, …) get their own
// node; anything it only knows by name must be on this list.
const ALLOWED_FUNCTIONS = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "atan2",
  "btrim",
  "cardinality",
  "cbrt",
  "ceil",
  "ceiling",
  "char_length",
  "character_length",
  "chr",
  "coalesce",
  "concat",
  "concat_ws",
  "cos",
  "curdate",
  "current_date",
  "current_time",
  "current_timestamp",
  "curtime",
  "date",
  "date_add",
  "date_part",
  "date_sub",
  "date_trunc",
  "dateadd",
  "datediff",
  "datename",
  "datepart",
  "datetime",
  "day",
  "decode",
  "encode",
  "exp",
  "extract",
  "floor",
  "format",
  "format_date",
  "gen_random_uuid",
  "getdate",
  "getutcdate",
  "greatest",
  "hour",
  "ifnull",
  "iif",
  "initcap",
  "instr",
  "isnull",
  "json_array",
  "json_build_array",
  "json_build_object",
  "json_object",
  "json_set",
  "jsonb_build_array",
  "jsonb_build_object",
  "jsonb_insert",
  "jsonb_set",
  "jsonb_strip_nulls",
  "julianday",
  "last_day",
  "lcase",
  "least",
  "left",
  "len",
  "length",
  "ln",
  "localtime",
  "localtimestamp",
  "log",
  "log10",
  "lower",
  "lpad",
  "ltrim",
  "make_date",
  "make_interval",
  "make_timestamp",
  "md5",
  "minute",
  "mod",
  "month",
  "newid",
  "now",
  "nullif",
  "nvl",
  "octet_length",
  "pi",
  "position",
  "power",
  "quote_ident",
  "quote_literal",
  "random",
  "regexp_replace",
  "repeat",
  "replace",
  "reverse",
  "right",
  "round",
  "rpad",
  "rtrim",
  "second",
  "sha1",
  "sha2",
  "sha256",
  "sign",
  "sin",
  "split_part",
  "sqrt",
  "strftime",
  "strpos",
  "substr",
  "substring",
  "sysdatetime",
  "sysutcdatetime",
  "tan",
  "timezone",
  "to_char",
  "to_date",
  "to_json",
  "to_jsonb",
  "to_number",
  "to_timestamp",
  "translate",
  "trim",
  "trunc",
  "ucase",
  "unixepoch",
  "upper",
  "utc_timestamp",
  "uuid",
  "uuid_generate_v4",
  "week",
  "year",
]);

const NAMED_FUNCTION_KEYS = new Set([
  "function",
  "anonymous",
  "anonymous_function",
  "aggregate_function",
]);

const functionName = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { name } = value as { name?: unknown };
  if (typeof name === "string") {
    return name.toLowerCase();
  }
  return typeof name === "object" && name !== null ? functionName(name) : null;
};

const hasArgs = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { args?: unknown }).args);

// Every node that carries call arguments is a call, whatever the parser
// named its kind; a schema-qualified call (`a.b(...)`) is refused outright.
const callProblem = (key: string, value: unknown): string | null => {
  if (key === "method_call") {
    return "a schema-qualified function";
  }
  if (!(NAMED_FUNCTION_KEYS.has(key) || hasArgs(value))) {
    return null;
  }
  const name = NAMED_FUNCTION_KEYS.has(key)
    ? (functionName(value) ?? key)
    : key;
  return ALLOWED_FUNCTIONS.has(name) ? null : `${name}()`;
};

const disallowedFunction = (node: unknown): string | null => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = disallowedFunction(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof node !== "object" || node === null) {
    return null;
  }
  for (const [key, value] of Object.entries(node)) {
    const problem = callProblem(key, value);
    if (problem) {
      return problem;
    }
    const found = disallowedFunction(value);
    if (found) {
      return found;
    }
  }
  return null;
};

const mentionsColumn = (node: unknown, column: string): boolean => {
  if (Array.isArray(node)) {
    return node.some((item) => mentionsColumn(item, column));
  }
  if (typeof node !== "object" || node === null) {
    return false;
  }
  return Object.entries(node).some(([key, value]) =>
    key === "column"
      ? functionName(value) === column
      : mentionsColumn(value, column)
  );
};

const childOf = (node: unknown, key: string): unknown =>
  typeof node === "object" && node !== null && key in node
    ? (node as Record<string, unknown>)[key]
    : undefined;

const sides = (node: unknown): [unknown, unknown] => [
  childOf(node, "left"),
  childOf(node, "right"),
];

// Every OR branch must narrow by an input, so `id = {{id}} OR true` can't
// reach the whole table; an AND needs an input on one side, NOT never counts.
const narrowsByInput = (expression: unknown, marker: string): boolean => {
  const or = childOf(expression, "or");
  if (or !== undefined) {
    return sides(or).every((side) => narrowsByInput(side, marker));
  }
  const and = childOf(expression, "and");
  if (and !== undefined) {
    return sides(and).some((side) => narrowsByInput(side, marker));
  }
  const paren = childOf(expression, "paren");
  if (paren !== undefined) {
    return narrowsByInput(childOf(paren, "this"), marker);
  }
  if (childOf(expression, "not") !== undefined) {
    return false;
  }
  return mentionsColumn(expression, marker);
};

const kindOf = (statement: z.infer<typeof Statement>) => {
  if ("update" in statement) {
    return { kind: "update" as const, node: statement.update };
  }
  if ("delete" in statement) {
    return { kind: "delete" as const, node: statement.delete };
  }
  return { kind: "insert" as const, node: statement.insert };
};

// How many statements polyglot reads in the SQL, or null when it can't.
export const statementCount = (
  sql: string,
  dialect: DialectType
): number | null => {
  try {
    const parsed = Parsed.safeParse(parse(sql, toPolyglotDialect(dialect)));
    return parsed.success ? parsed.data.ast.length : null;
  } catch {
    return null;
  }
};

const supportsWrites = (
  dialect: DialectType
): dialect is (typeof WRITE_AST_DIALECTS)[number] =>
  (WRITE_AST_DIALECTS as readonly DialectType[]).includes(dialect);

// A structural second opinion on a statement the lexical guard passed. Any
// shape it can't classify is rejected, never waved through.
export const classifyWriteAst = (
  sql: string,
  dialect: DialectType,
  inputMarker: string | null = null
): WriteAstVerdict => {
  if (!supportsWrites(dialect)) {
    return reject(`Write actions aren't available for ${dialect}.`);
  }
  let raw: unknown;
  try {
    raw = parse(sql, toPolyglotDialect(dialect));
  } catch {
    return reject("The statement could not be parsed.");
  }
  const parsed = Parsed.safeParse(raw);
  if (!parsed.success) {
    return reject("The statement could not be parsed.");
  }
  if (parsed.data.ast.length !== 1) {
    return reject("Only one statement can run at a time.");
  }
  const [first] = parsed.data.ast;
  const statement = Statement.safeParse(first);
  if (!statement.success) {
    return reject(
      "Only a single-table INSERT, UPDATE or DELETE can be a write action."
    );
  }
  if (hasNestedQuery(first, 0)) {
    return reject("Write actions can't contain subqueries.");
  }
  const blocked = disallowedFunction(first);
  if (blocked) {
    return reject(`${blocked} isn't allowed in a write action.`);
  }
  const { kind, node } = kindOf(statement.data);
  if (
    inputMarker &&
    kind !== "insert" &&
    !narrowsByInput(childOf(childOf(node, "where_clause"), "this"), inputMarker)
  ) {
    return reject(
      "Every condition in WHERE must compare against an input; OR and NOT can't widen it."
    );
  }
  const { name, schema } = node.table;
  return {
    kind,
    ok: true,
    table: schema ? `${schema.name}.${name.name}` : name.name,
  };
};
