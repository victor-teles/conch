import type { DialectType } from "@conch/core";

import { describe, expect, it } from "vitest";

import { assertGuardedWrite } from "./write-guard.ts";

const WRITE_DIALECTS = [
  "postgresql",
  "mysql",
  "sqlite",
  "duckdb",
  "tsql",
] as const satisfies readonly DialectType[];

const PERMITTED: [string, string, "insert" | "update" | "delete", string][] = [
  [
    "update by id",
    "UPDATE orders SET status = {{status}} WHERE id = {{id}}",
    "update",
    "orders",
  ],
  [
    "update with a schema and several columns",
    "UPDATE sales.orders SET status = {{status}}, note = 'shipped' WHERE id = {{id}} AND region = {{region}};",
    "update",
    "sales.orders",
  ],
  ["delete by id", "DELETE FROM orders WHERE id = {{id}}", "delete", "orders"],
  [
    "insert one row",
    "INSERT INTO notes (order_id, body) VALUES ({{id}}, {{body}})",
    "insert",
    "notes",
  ],
  [
    "an input inside a parenthesized condition",
    "DELETE FROM orders WHERE (id = {{id}} AND region = 'eu')",
    "delete",
    "orders",
  ],
  [
    "a literal that mentions forbidden words",
    "UPDATE orders SET note = 'drop table; select * from x' WHERE id = {{id}}",
    "update",
    "orders",
  ],
];

const across = <T extends unknown[]>(cases: readonly T[]) =>
  WRITE_DIALECTS.flatMap((dialect) =>
    cases.map((item): [DialectType, ...T] => [dialect, ...item])
  );

describe("assertGuardedWrite — permitted", () => {
  it.each(across(PERMITTED))("%s: %s", (dialect, _name, sql, kind, table) => {
    expect(assertGuardedWrite(sql, dialect)).toStrictEqual({
      kind,
      ok: true,
      table,
    });
  });

  it.each(["postgresql", "sqlite", "duckdb"] as const)(
    "%s: allows RETURNING",
    (dialect) => {
      expect(
        assertGuardedWrite(
          "UPDATE orders SET status = {{status}} WHERE id = {{id}} RETURNING id, status",
          dialect
        )
      ).toMatchObject({ kind: "update", ok: true });
    }
  );

  it("allows bracket identifiers in T-SQL", () => {
    expect(
      assertGuardedWrite(
        "UPDATE [dbo].[orders] SET [status] = {{status}} WHERE [id] = {{id}}",
        "tsql"
      )
    ).toMatchObject({ kind: "update", ok: true });
  });
});

const REJECTED: [string, string][] = [
  ["WHERE 1=1", "UPDATE orders SET status = {{status}} WHERE 1=1"],
  ["WHERE true", "DELETE FROM orders WHERE true"],
  ["input only outside WHERE", "UPDATE orders SET status = {{s}} WHERE id > 0"],
  ["missing WHERE on UPDATE", "UPDATE orders SET status = {{status}}"],
  ["missing WHERE on DELETE", "DELETE FROM orders"],
  [
    "data-modifying CTE",
    "WITH gone AS (DELETE FROM orders WHERE id = {{id}} RETURNING *) SELECT * FROM gone",
  ],
  [
    "WITH before UPDATE",
    "WITH x AS (SELECT 1) UPDATE orders SET a = 1 WHERE id = {{id}}",
  ],
  [
    "UPDATE … FROM",
    "UPDATE orders SET status = {{s}} FROM customers WHERE orders.id = {{id}}",
  ],
  [
    "DELETE … USING",
    "DELETE FROM orders USING customers WHERE orders.id = {{id}}",
  ],
  [
    "subquery in WHERE",
    "DELETE FROM orders WHERE id IN (SELECT id FROM old WHERE k = {{k}})",
  ],
  ["subquery in SET", "UPDATE orders SET total = (SELECT 1) WHERE id = {{id}}"],
  ["INSERT … SELECT", "INSERT INTO notes (body) SELECT {{body}}"],
  [
    "multi-row VALUES",
    "INSERT INTO notes (a, b) VALUES ({{a}}, 1), ({{b}}, 2)",
  ],
  [
    "ON CONFLICT",
    "INSERT INTO notes (id, body) VALUES ({{id}}, {{b}}) ON CONFLICT (id) DO UPDATE SET body = {{b}}",
  ],
  [
    "ON DUPLICATE KEY",
    "INSERT INTO notes (id, body) VALUES ({{id}}, {{b}}) ON DUPLICATE KEY UPDATE body = {{b}}",
  ],
  ["INSERT without columns", "INSERT INTO notes VALUES ({{id}})"],
  [
    "two statements",
    "UPDATE orders SET a = 1 WHERE id = {{id}}; DELETE FROM orders WHERE id = {{id}}",
  ],
  [
    "a T-SQL batch without semicolons",
    "UPDATE orders SET a = 1 WHERE id = {{id}} DELETE FROM orders WHERE id = {{id}}",
  ],
  [
    "a statement hidden from one lexer flavor in a backslash literal",
    String.raw`UPDATE orders SET note = 'a\' WHERE id = {{id}}; DROP TABLE orders; -- ' WHERE id = {{id}}`,
  ],
  [
    "a statement hidden in a hash comment for one flavor",
    "UPDATE orders SET a = 1 WHERE id = {{id}} #\n; DROP TABLE orders",
  ],
  [
    "a MySQL executable comment",
    "UPDATE orders SET a = 1 /*! , b = 2 */ WHERE id = {{id}}",
  ],
  ["MERGE", "MERGE INTO orders USING x ON 1 = 1 WHEN MATCHED THEN DELETE"],
  ["REPLACE", "REPLACE INTO orders (id) VALUES ({{id}})"],
  ["UPSERT", "UPSERT INTO orders (id) VALUES ({{id}})"],
  ["a plain SELECT", "SELECT * FROM orders WHERE id = {{id}}"],
  [
    "UPDATE with JOIN",
    "UPDATE orders JOIN c ON c.id = orders.c SET a = 1 WHERE orders.id = {{id}}",
  ],
  ["UNION", "DELETE FROM orders WHERE id = {{id}} UNION SELECT 1"],
  ["unterminated string", "UPDATE orders SET a = 'x WHERE id = {{id}}"],
  ["input inside a string", "UPDATE orders SET a = '{{x}}' WHERE id = {{id}}"],
  ["an empty statement", " ; "],
];

const DENY_LIST = [
  "create",
  "drop",
  "alter",
  "truncate",
  "rename",
  "grant",
  "revoke",
  "comment",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "lock",
  "call",
  "exec",
  "execute",
  "do",
  "copy",
  "load",
  "attach",
  "pragma",
  "outfile",
  "dumpfile",
  "load_file",
  "pg_sleep",
  "sleep",
  "benchmark",
  "dblink",
  "lo_import",
  "pg_read_file",
  "xp_cmdshell",
  "openrowset",
  "opendatasource",
  "set_config",
  "pg_advisory_lock",
  "pg_reload_conf",
  "lo_unlink",
  "dblink_exec",
  "sp_executesql",
  "xp_regread",
  "load_extension",
  "writefile",
  "getenv",
  "sys_exec",
];

describe("assertGuardedWrite — rejected", () => {
  it.each(across(REJECTED))("%s: %s", (dialect, _name, sql) => {
    expect(assertGuardedWrite(sql, dialect).ok).toBeFalsy();
  });

  it.each(across(DENY_LIST.map((word) => [word] as [string])))(
    "%s: rejects %s outside literals",
    (dialect, word) => {
      const sql = `UPDATE orders SET a = ${word}(1) WHERE id = {{id}}`;
      expect(assertGuardedWrite(sql, dialect)).toMatchObject({ ok: false });
    }
  );

  it("rejects a second SET (a session SET)", () => {
    expect(
      assertGuardedWrite(
        "UPDATE orders SET a = 1 WHERE id = {{id}} SET ROLE admin",
        "postgresql"
      ).ok
    ).toBeFalsy();
  });

  it("rejects INTO OUTFILE", () => {
    expect(
      assertGuardedWrite(
        "UPDATE orders SET a = 1 WHERE id = {{id}} INTO OUTFILE '/tmp/x'",
        "mysql"
      ).ok
    ).toBeFalsy();
  });

  it.each([
    "clickhouse",
    "snowflake",
    "bigquery",
    "oracle",
    "redshift",
  ] as const)("rejects %s, which has no guarded write path", (dialect) => {
    expect(
      assertGuardedWrite("DELETE FROM t WHERE id = {{id}}", dialect)
    ).toStrictEqual({
      ok: false,
      reason: "Write actions aren't available for this database.",
    });
  });

  it("rejects a statement polyglot can't parse", () => {
    expect(
      assertGuardedWrite(
        "UPDATE orders SET a = = 1 WHERE id = {{id}}",
        "postgresql"
      )
    ).toMatchObject({
      ok: false,
      reason: "The statement could not be parsed.",
    });
  });

  it("explains a missing WHERE input", () => {
    expect(
      assertGuardedWrite("DELETE FROM orders WHERE 1=1", "postgresql")
    ).toStrictEqual({
      ok: false,
      reason:
        "DELETE's WHERE must compare against an input, like WHERE id = {{id}}.",
    });
  });
});

describe("assertGuardedWrite — parse-tree checks (SEC-019-02)", () => {
  it.each(
    across([
      [
        "a nested comment hiding OR true",
        "UPDATE orders SET status = {{s}} WHERE id = {{id}} /* /* */ '*/ OR true --'",
      ],
      [
        "a nested comment hiding a second SET",
        "UPDATE orders SET status = {{s}} /* /* */ '*/, total = 0 --' WHERE id = {{id}}",
      ],
      ["OR without an input", "DELETE FROM orders WHERE id = {{id}} OR 1 = 1"],
      ["NOT around the input", "DELETE FROM orders WHERE NOT id = {{id}}"],
      [
        "a function outside the allow-list",
        "UPDATE orders SET note = audit_secret({{note}}) WHERE id = {{id}}",
      ],
      [
        "the reserved input marker",
        "DELETE FROM orders WHERE conch_bound_input = {{id}}",
      ],
    ] as [string, string][])
  )("%s: rejects %s", (dialect, _name, sql) => {
    expect(assertGuardedWrite(sql, dialect).ok).toBeFalsy();
  });

  it.each(
    across([
      [
        "OR between inputs",
        "DELETE FROM orders WHERE (id = {{a}} OR id = {{b}})",
      ],
      [
        "AND with a fixed filter",
        "DELETE FROM orders WHERE id = {{id}} AND region = 'eu'",
      ],
      [
        "allowed built-ins",
        "UPDATE orders SET status = upper({{s}}), note = coalesce({{n}}, 'x') WHERE id = {{id}}",
      ],
    ] as [string, string][])
  )("%s: allows %s", (dialect, _name, sql) => {
    expect(assertGuardedWrite(sql, dialect).ok).toBeTruthy();
  });
});

describe("assertGuardedWrite — calls in any form (SEC-019-09)", () => {
  it.each([
    [
      "quoted schema-qualified",
      `UPDATE orders SET note = "pg_catalog"."pg_read_file"({{n}}) WHERE id = {{id}}`,
    ],
    [
      "unquoted schema-qualified",
      "UPDATE orders SET note = pg_catalog.now() WHERE id = {{id}}",
    ],
    [
      "quoted denied function",
      `UPDATE orders SET note = "dblink_exec"({{n}}) WHERE id = {{id}}`,
    ],
    [
      "quoted set_config",
      `UPDATE orders SET note = "set_config"('role', {{n}}, false) WHERE id = {{id}}`,
    ],
    [
      "a quoted unknown name",
      `UPDATE orders SET note = "my fn"({{n}}) WHERE id = {{id}}`,
    ],
    [
      "overlap comment hiding a second SET",
      "UPDATE orders SET status = {{s}} /*/ '*/, role = 'admin' --' */ WHERE id = {{id}}",
    ],
  ])("postgresql: rejects %s", (_name, sql) => {
    expect(assertGuardedWrite(sql, "postgresql").ok).toBeFalsy();
  });

  it("tsql: rejects bracketed schema-qualified calls", () => {
    expect(
      assertGuardedWrite(
        "UPDATE [orders] SET [note] = [dbo].[fn]({{n}}) WHERE [id] = {{id}}",
        "tsql"
      ).ok
    ).toBeFalsy();
  });

  it.each([
    "md5({{v}})",
    "date_trunc('day', {{v}})",
    "to_char(now(), 'YYYY')",
    "jsonb_set(meta, '{a}', to_jsonb({{v}}))",
    "concat_ws('-', {{v}}, 'x')",
    "left({{v}}, 3)",
    "to_timestamp({{v}})",
    "json_build_object('a', {{v}})",
    "uuid_generate_v4()",
    "coalesce({{v}}, lower('A'), upper('b'))",
    "round(greatest({{v}}, 1) + least(2, 3), 2)",
    "extract(year FROM now())",
    "replace({{v}}, 'a', 'b')",
  ])("postgresql: allows the built-in %s", (expression) => {
    expect(
      assertGuardedWrite(
        `UPDATE orders SET note = ${expression} WHERE id = {{id}}`,
        "postgresql"
      )
    ).toMatchObject({ ok: true });
  });
});
