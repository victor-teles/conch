import type { TabularResult } from "@conch/core";

import { DuckDBInstance } from "@duckdb/node-api";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DuckdbPool } from "./pool.ts";

const signal = () => new AbortController().signal;

const seededPool = async (): Promise<DuckdbPool> => {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  await conn.run("create table t (id integer)");
  await conn.run("insert into t values (1)");
  conn.disconnect();
  return new DuckdbPool(instance);
};

const count = async (pool: DuckdbPool, readOnly: boolean): Promise<unknown> => {
  const result = (await pool.execute(
    "select count(*)::integer as n from t",
    10,
    null,
    signal(),
    { readOnly }
  )) as TabularResult;
  return result.rows[0]?.[0];
};

describe("duckdbPool.execute read-only", () => {
  it("rejects writes inside the read-only transaction", async () => {
    const pool = await seededPool();
    await expect(
      pool.execute("insert into t values (2)", 10, null, signal(), {
        readOnly: true,
      })
    ).rejects.toThrow(/read-only/);
    await expect(
      pool.execute("delete from t", 10, null, signal(), { readOnly: true })
    ).rejects.toThrow(/read-only/);
    await expect(count(pool, true)).resolves.toBe(1);
    await pool.close();
  });

  it("leaves later writes unaffected", async () => {
    const pool = await seededPool();
    await count(pool, true);
    await pool.execute("insert into t values (2)", 10, null, signal());
    await expect(count(pool, false)).resolves.toBe(2);
    await pool.close();
  });
});

const HOSTILE = "x'; drop table t; --";
const QUOTED = "O'Brien";

describe("duckdbPool.execute params", () => {
  it("round-trips hostile and quoted params as data under read-only", async () => {
    const pool = await seededPool();
    const result = (await pool.execute(
      "select ? as v, ? as w, ?::date::varchar as d, ? + 1 as n",
      10,
      null,
      signal(),
      { params: [HOSTILE, QUOTED, "2026-03-01", 41], readOnly: true }
    )) as TabularResult;
    expect(result.rows).toStrictEqual([[HOSTILE, QUOTED, "2026-03-01", 42]]);
    await expect(count(pool, true)).resolves.toBe(1);
    await pool.close();
  });

  it("filters with a bound value inside the read-only transaction", async () => {
    const pool = await seededPool();
    const result = (await pool.execute(
      "select count(*)::integer from t where id::varchar = ?",
      10,
      null,
      signal(),
      { params: [HOSTILE], readOnly: true }
    )) as TabularResult;
    expect(result.rows).toStrictEqual([[0]]);
    await pool.close();
  });

  it("still rejects writes when params are bound under read-only", async () => {
    const pool = await seededPool();
    await expect(
      pool.execute("insert into t values (?)", 10, null, signal(), {
        params: [2],
        readOnly: true,
      })
    ).rejects.toThrow(/read-only/);
    await expect(count(pool, false)).resolves.toBe(1);
    await pool.close();
  });
});

const CANARY = "canary-local-file-contents";

const withCanary = async <T>(work: (path: string) => Promise<T>) => {
  const path = join(tmpdir(), `conch-canary-${randomUUID()}.txt`);
  await writeFile(path, CANARY);
  try {
    return await work(path);
  } finally {
    await rm(path, { force: true });
  }
};

const readOnlyRun = (pool: DuckdbPool, sql: string) =>
  pool.execute(sql, 10, null, signal(), { readOnly: true });

describe("duckdbPool.execute read-only sources", () => {
  it.each([
    [
      "a file table function",
      (path: string) => `select * from read_text('${path}')`,
    ],
    ["a blob reader", (path: string) => `select * from read_blob('${path}')`],
    ["a quoted path", (path: string) => `select * from '${path}'`],
    [
      "a reader inside a CTE",
      (path: string) =>
        `with f as (select content from read_text('${path}')) select * from t, f`,
    ],
    [
      "a reader inside a scalar subquery",
      (path: string) =>
        `select (select content from read_text('${path}')) as c`,
    ],
    ["dynamic SQL", () => "select * from query('select 1')"],
  ])("refuses %s", async (_label, sqlFor) => {
    const pool = await seededPool();
    await withCanary(async (path) => {
      await expect(readOnlyRun(pool, sqlFor(path))).rejects.toMatchObject({
        code: "NOT_READ_ONLY",
      });
    });
    await pool.close();
  });

  it("refuses more than one statement", async () => {
    const pool = await seededPool();
    await expect(readOnlyRun(pool, "select 1; select 2")).rejects.toMatchObject(
      { code: "NOT_READ_ONLY" }
    );
    await pool.close();
  });

  it("still runs reads of its own tables, row generators and SHOW", async () => {
    const pool = await seededPool();
    const own = (await readOnlyRun(
      pool,
      "select id, n from t, range(2) as r(n) order by n"
    )) as TabularResult;
    expect(own.rows).toStrictEqual([
      [1, "0"],
      [1, "1"],
    ]);
    const shown = (await readOnlyRun(pool, "show tables")) as TabularResult;
    expect(shown.rows).toStrictEqual([["t"]]);
    await pool.close();
  });

  it("keeps the syntax error for a query that does not parse", async () => {
    const pool = await seededPool();
    await expect(readOnlyRun(pool, "selec 1")).rejects.toThrow(/syntax/i);
    await pool.close();
  });

  it("leaves file access to queries the user runs directly", async () => {
    const pool = await seededPool();
    await withCanary(async (path) => {
      const result = (await pool.execute(
        `select content from read_text('${path}')`,
        10,
        null,
        signal()
      )) as TabularResult;
      expect(result.rows).toStrictEqual([[CANARY]]);
    });
    await pool.close();
  });
});
