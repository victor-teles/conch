import type { DuckDBConnection } from "@duckdb/node-api";

import { DbError } from "@conch/core";

// Table functions that only generate rows; every other one (read_text,
// read_csv, query, httpfs readers…) reaches files, the network or dynamic SQL.
const ROW_GENERATORS = new Set(["range", "generate_series", "unnest"]);
// A quoted string in FROM is a replacement scan that DuckDB reads as a file.
const PATH_LIKE = /[/\\:.]/;

interface SerializedSql {
  error: boolean;
  error_type?: string;
  statements: unknown[];
}

const notReadOnly = (reason: string): DbError =>
  new DbError("NOT_READ_ONLY", reason);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const functionNameOf = (node: Record<string, unknown>): string => {
  const fn = node.function;
  return isRecord(fn) && typeof fn.function_name === "string"
    ? fn.function_name.toLowerCase()
    : "";
};

const sourceViolation = (node: Record<string, unknown>): string | null => {
  if (node.type === "TABLE_FUNCTION") {
    const name = functionNameOf(node);
    return ROW_GENERATORS.has(name)
      ? null
      : `${name || "This table function"} can read files or the network, so it can't run here.`;
  }
  if (
    node.type === "BASE_TABLE" &&
    typeof node.table_name === "string" &&
    PATH_LIKE.test(node.table_name)
  ) {
    return "Reading files by path can't run here.";
  }
  return null;
};

export const violationIn = (node: unknown): string | null => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = violationIn(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isRecord(node)) {
    return null;
  }
  const own = sourceViolation(node);
  if (own) {
    return own;
  }
  for (const value of Object.values(node)) {
    const found = violationIn(value);
    if (found) {
      return found;
    }
  }
  return null;
};

const serializedOf = (raw: unknown): SerializedSql | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || typeof parsed.error !== "boolean") {
    return null;
  }
  return {
    error: parsed.error,
    error_type:
      typeof parsed.error_type === "string" ? parsed.error_type : undefined,
    statements: Array.isArray(parsed.statements) ? parsed.statements : [],
  };
};

export const readOnlySourceViolation = (
  serialized: SerializedSql
): string | null => {
  if (serialized.error) {
    return serialized.error_type === "parser"
      ? null
      : "Only read-only queries can run here.";
  }
  if (serialized.statements.length !== 1) {
    return "Only one statement can run at a time.";
  }
  return violationIn(serialized.statements);
};

// Uses DuckDB's own parser, so the check reads the SQL exactly as it will run.
// A parser error passes through: running the statement fails the same way.
export const assertReadsOwnTables = async (
  conn: DuckDBConnection,
  sql: string
): Promise<void> => {
  const reader = await conn.runAndReadAll(
    "SELECT json_serialize_sql($1::VARCHAR)",
    [sql]
  );
  const serialized = serializedOf(reader.getRowsJson()[0]?.[0]);
  if (!serialized) {
    throw notReadOnly("The query could not be checked.");
  }
  const violation = readOnlySourceViolation(serialized);
  if (violation) {
    throw notReadOnly(violation);
  }
};
