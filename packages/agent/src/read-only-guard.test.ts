import type { DialectType } from "@conch/core";

import { describe, expect, it } from "vitest";

import { assertReadOnly } from "./read-only-guard.ts";

const allowed: [string, string, DialectType][] = [
  ["a plain select", "select id, email from users", "postgresql"],
  ["a trailing semicolon", "select 1;", "postgresql"],
  ["a leading comment", "-- Revenue by region\nselect 1", "postgresql"],
  [
    "a CTE",
    "with monthly as (select date_trunc('month', created_at) as month from orders) select * from monthly",
    "postgresql",
  ],
  ["a parenthesised select", "(select 1) union (select 2)", "mysql"],
  ["show", "show tables", "mysql"],
  ["describe", "describe orders", "mysql"],
  ["explain", "explain select * from orders", "postgresql"],
  ["values", "values (1), (2)", "postgresql"],
  ["table", "table orders", "postgresql"],
  [
    "a forbidden word inside a string",
    "select * from notes where note = 'drop table users'",
    "postgresql",
  ],
  [
    "a semicolon inside a string",
    "select * from notes where body = 'a; b'",
    "mysql",
  ],
  [
    "a forbidden word inside a quoted identifier",
    'select "update" from audit_log',
    "postgresql",
  ],
  [
    "a forbidden word in a bracket identifier on SQL Server",
    "select [update] from audit_log",
    "tsql",
  ],
  [
    "T-SQL paging with OFFSET and FETCH",
    "select id from orders order by id offset 10 rows fetch next 5 rows only",
    "tsql",
  ],
  [
    "T-SQL statement words used as bracketed column names",
    "select [backup], [kill], [begin] from jobs",
    "tsql",
  ],
  [
    "column names that contain forbidden words",
    "select created_at, updated_by, settings, offset_ms from t",
    "postgresql",
  ],
];

const rejected: [string, string, DialectType][] = [
  ["an empty statement", "  ;  ", "postgresql"],
  ["insert", "insert into t values (1)", "postgresql"],
  ["update", "update t set a = 1 where id = 1", "postgresql"],
  ["delete", "delete from t where id = 1", "postgresql"],
  ["drop", "drop table t", "postgresql"],
  ["truncate", "truncate t", "postgresql"],
  ["pragma (writes in SQLite)", "pragma journal_mode = delete", "sqlite"],
  ["multiple statements", "select 1; select 2", "postgresql"],
  ["comment injection", "select 1; -- \n drop table x", "postgresql"],
  [
    "a data-modifying CTE",
    "with x as (delete from t returning *) select * from x",
    "postgresql",
  ],
  ["select into", "select * into backup from users", "postgresql"],
  [
    "MySQL into outfile",
    "select * from users into outfile '/tmp/users.csv'",
    "mysql",
  ],
  ["pg_sleep", "select pg_sleep(60)", "postgresql"],
  [
    "dblink",
    "select * from dblink('host=x', 'select 1') as t(a int)",
    "postgresql",
  ],
  ["DuckDB install", "select 1 from (install httpfs)", "duckdb"],
  ["copy", "copy users to '/tmp/x.csv'", "postgresql"],
  ["set", "set role admin", "postgresql"],
  ["call", "call refresh_stats()", "mysql"],
  ["exec", "exec sp_who", "tsql"],
  ["attach", "attach database 'x.db' as x", "sqlite"],
  [
    "merge",
    "merge into t using s on t.id = s.id when matched then delete",
    "tsql",
  ],
  [
    "a backslash-escaped quote hiding code from the standard lexer",
    String.raw`select 'a\'' , 1 into outfile '/tmp/x'`,
    "mysql",
  ],
  ["a MySQL executable comment", "select 1 /*! , sleep(10) */", "mysql"],
  [
    "a MySQL double-dash that is not a comment",
    "select a --1 into outfile '/tmp/x'\nfrom t",
    "mysql",
  ],
  [
    "a string opened inside a comment marker",
    "select '--', 1 into t",
    "postgresql",
  ],
  [
    "a dollar-quoted string, which the MySQL lexer reads as code",
    "select $$drop table x$$ as label",
    "postgresql",
  ],
  ["an unterminated string", "select 'abc", "postgresql"],
  ["an unterminated block comment", "select 1 /* never closed", "postgresql"],
  ["a T-SQL batch without semicolons", "select 1 commit", "tsql"],
  ["a T-SQL batch that shuts the server down", "select 1 shutdown", "tsql"],
  ["a T-SQL batch that kills a session", "select name from t kill 52", "tsql"],
  [
    "a T-SQL batch that restores a database",
    "select 1 restore database app from disk = 'x.bak'",
    "tsql",
  ],
  [
    "a T-SQL batch with DBCC",
    "select 1 dbcc checkident ('t', reseed, 0)",
    "tsql",
  ],
  [
    "a T-SQL batch that disables a trigger",
    "select 1 disable trigger audit on orders",
    "tsql",
  ],
  ["a T-SQL batch that waits", "select 1 waitfor delay '00:10:00'", "tsql"],
  [
    "OPENROWSET reading outside the database",
    "select * from openrowset(bulk 'c:\\secrets.txt', single_clob) as f",
    "tsql",
  ],
];

describe("assertReadOnly", () => {
  it.each(allowed)("allows %s", (_label, sql, dialect) => {
    expect(assertReadOnly(sql, dialect)).toStrictEqual({ ok: true });
  });

  it.each(rejected)("rejects %s", (_label, sql, dialect) => {
    const verdict = assertReadOnly(sql, dialect);
    expect(verdict.ok).toBeFalsy();
  });

  it("explains which keyword was rejected", () => {
    expect(
      assertReadOnly("select * into backup from users", "postgresql")
    ).toStrictEqual({
      ok: false,
      reason: "INTO is not allowed in a read-only query.",
    });
    expect(assertReadOnly("delete from t", "postgresql")).toStrictEqual({
      ok: false,
      reason: "Only read-only queries can run here, not DELETE.",
    });
  });
});
