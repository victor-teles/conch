import type { DialectType } from "@conch/core";

import { describe, expect, it } from "vitest";

import { assertReadOnly } from "./read-only-guard.ts";

const NESTING = [
  "postgresql",
  "duckdb",
] as const satisfies readonly DialectType[];
const FLAT = ["mysql", "sqlite"] as const satisfies readonly DialectType[];

// Engines that nest end this comment at the second */, so what follows the
// quote is code there (SEC-019-01); the overlap variants share a * between
// an opener and a closer (SEC-019-08).
const HIDDEN = [
  "SELECT 1 /* /* */ '*/; COMMIT; UPDATE orders SET total = 0; --'",
  "SELECT 1 /* x /*/ '*/; COMMIT; DELETE FROM orders; --'",
  "SELECT 1 /*/ '*/, pg_read_file('/etc/passwd'); --'",
];

describe("assertReadOnly — block comments per engine", () => {
  it.each(NESTING.flatMap((dialect) => HIDDEN.map((sql) => [dialect, sql])))(
    "%s: refuses %s",
    (dialect, sql) => {
      expect(assertReadOnly(sql, dialect as DialectType).ok).toBeFalsy();
    }
  );

  it.each(HIDDEN)("tsql: refuses %s", (sql) => {
    expect(assertReadOnly(sql, "tsql").ok).toBeFalsy();
  });

  it.each(NESTING)("%s: allows a comment that nests cleanly", (dialect) => {
    expect(
      assertReadOnly("SELECT 1 /* outer /* inner */ still */ AS n", dialect)
    ).toStrictEqual({ ok: true });
  });

  it.each(FLAT)("%s: reads /* inside a comment as text", (dialect) => {
    expect(assertReadOnly("SELECT 1 /* a /* b */ AS n", dialect)).toStrictEqual(
      { ok: true }
    );
  });

  it("tsql: refuses a comment that opens another", () => {
    expect(
      assertReadOnly("SELECT 1 /* a /* b */ c */ AS n", "tsql")
    ).toStrictEqual({
      ok: false,
      reason: "Comments inside comments are not allowed.",
    });
  });

  it.each([...NESTING, ...FLAT, "tsql"] as DialectType[])(
    "%s: still allows a plain block comment",
    (dialect) => {
      expect(assertReadOnly("SELECT 1 /* note */ AS n", dialect)).toStrictEqual(
        {
          ok: true,
        }
      );
    }
  );
});

describe("assertReadOnly — server file and network calls", () => {
  it.each([
    "SELECT pg_read_file('/etc/passwd')",
    `SELECT "pg_catalog"."pg_read_file"('/etc/passwd')`,
    `SELECT "pg_read_binary_file"('/etc/passwd')`,
    "SELECT * FROM pg_ls_dir('.')",
    "SELECT pg_stat_file('postgresql.conf')",
    "SELECT lo_import('/etc/passwd')",
    "SELECT dblink_exec('dbname=x', 'drop table t')",
    `SELECT * FROM "dblink"('dbname=x', 'select 1') AS t(a int)`,
    "SELECT query_to_xml('select 1', true, true, '')",
    "SELECT pg_advisory_lock(1)",
    "SELECT set_config('role', 'admin', false)",
  ])("postgresql: refuses %s", (sql) => {
    expect(assertReadOnly(sql, "postgresql").ok).toBeFalsy();
  });

  it.each([
    "SELECT pg_size_pretty(pg_total_relation_size('orders'))",
    "SELECT pg_typeof(1)",
    `SELECT "lo_value" FROM t`,
  ])("postgresql: still allows %s", (sql) => {
    expect(assertReadOnly(sql, "postgresql")).toStrictEqual({ ok: true });
  });

  it.each([
    ["mysql", "SELECT LOAD_FILE('/etc/passwd')"],
    ["tsql", "SELECT * FROM OPENROWSET(BULK 'c:/x', SINGLE_CLOB) AS t"],
    ["tsql", "SELECT [dbo].[xp_dirtree]('c:/')"],
    ["sqlite", "SELECT readfile('/etc/passwd')"],
  ] as [DialectType, string][])("%s: refuses %s", (dialect, sql) => {
    expect(assertReadOnly(sql, dialect).ok).toBeFalsy();
  });

  it("tsql: refuses a batch that doesn't parse as one statement", () => {
    expect(
      assertReadOnly("SELECT 1 AS a SELECT 2 AS b", "tsql").ok
    ).toBeFalsy();
  });
});

describe("assertReadOnly — escaped names", () => {
  it.each([
    `SELECT U&"\\0070g_read_file"('/etc/passwd')`,
    `SELECT u&"set_\\0063onfig"('role', 'admin', false)`,
    `SELECT U&'\\0041' AS a`,
  ])("postgresql: refuses %s (SEC-019-10)", (sql) => {
    expect(assertReadOnly(sql, "postgresql")).toStrictEqual({
      ok: false,
      reason: "Unicode-escaped names and strings are not allowed.",
    });
  });

  it("postgresql: still allows a column named u in an expression", () => {
    expect(
      assertReadOnly("SELECT menu&1 AS m FROM t", "postgresql")
    ).toStrictEqual({ ok: true });
  });

  it("tsql: reads ]] as an escaped bracket, not the end of a name (SEC-019-11)", () => {
    expect(
      assertReadOnly("SELECT [a]]'] AS n, xp_cmdshell('dir') --'", "tsql").ok
    ).toBeFalsy();
    expect(assertReadOnly("SELECT 1 AS [a]]b]", "tsql")).toStrictEqual({
      ok: true,
    });
  });
});
