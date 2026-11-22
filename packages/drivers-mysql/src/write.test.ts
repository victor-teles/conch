import type { TabularResult } from "@conch/core";
import type { Pool as MysqlPoolType } from "mysql2/promise";

import { createPool } from "mysql2/promise";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MysqlPool } from "./pool.ts";

const HOSTILE = "x'; drop table t; --";
const UPDATE = "UPDATE orders SET status = ? WHERE id = ?";

const fakePool = (affectedRows: number) => {
  const statements: string[] = [];
  const query = vi.fn((input: string | { sql: string }) => {
    statements.push(typeof input === "string" ? input : input.sql);
    return Promise.resolve([[], []]);
  });
  const execute = vi.fn((input: { sql: string }) => {
    statements.push(input.sql);
    return Promise.resolve([{ affectedRows }, []]);
  });
  const conn = { destroy: vi.fn(), execute, query, release: vi.fn() };
  const pool = {
    getConnection: vi.fn().mockResolvedValue(conn),
  } as unknown as MysqlPoolType;
  return { conn, execute, pool: new MysqlPool(pool, "app"), statements };
};

const options = (signal = new AbortController().signal) => ({
  maxAffectedRows: 1,
  schema: "shop",
  signal,
});

describe("mysqlPool.executeWrite", () => {
  it("binds values in a transaction with a timeout and commits", async () => {
    const { execute, pool, statements } = fakePool(1);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(statements).toStrictEqual([
      "USE `shop`",
      "START TRANSACTION",
      UPDATE,
      "COMMIT",
      "USE `app`",
    ]);
    expect(execute).toHaveBeenCalledWith({ sql: UPDATE, timeout: 15_000 }, [
      "shipped",
      7,
    ]);
  });

  it("rolls back when more rows change than allowed", async () => {
    const { pool, statements } = fakePool(2);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("destroys the connection on cancel so the server rolls back", async () => {
    const controller = new AbortController();
    const { conn, execute, pool, statements } = fakePool(1);
    execute.mockImplementation((input: { sql: string }) => {
      statements.push(input.sql);
      controller.abort();
      return Promise.resolve([{ affectedRows: 1 }, []]);
    });
    await expect(
      pool.executeWrite(UPDATE, ["x", 1], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(statements).not.toContain("COMMIT");
    expect(conn.destroy).toHaveBeenCalledWith();
  });
});

const FIXTURE_URL =
  process.env.OMQ_MYSQL_URL ?? "mysql://omq:omq@127.0.0.1:3306/oh_my_query";

const connectFixture = async (): Promise<MysqlPoolType | null> => {
  const raw = createPool({
    connectTimeout: 1000,
    connectionLimit: 3,
    uri: FIXTURE_URL,
  });
  try {
    await raw.query("select 1");
    return raw;
  } catch {
    await raw.end();
    return null;
  }
};

const fixture = await connectFixture();
const signal = () => new AbortController().signal;

describe.skipIf(!fixture)("mysqlPool.executeWrite (fixture database)", () => {
  const raw = fixture as MysqlPoolType;
  const pool = new MysqlPool(raw, new URL(FIXTURE_URL).pathname.slice(1));
  const table = `conch_write_${process.pid}`;
  const rows = async (): Promise<unknown[][]> => {
    const result = (await pool.execute(
      `select id, status from ${table} order by id`,
      100,
      null,
      signal(),
      { readOnly: true }
    )) as TabularResult;
    return result.rows;
  };

  beforeEach(async () => {
    await raw.query(`drop table if exists ${table}`);
    await raw.query(
      `create table ${table} (id int primary key, status varchar(64)) engine=InnoDB`
    );
    await raw.query(
      `insert into ${table} values (1, 'new'), (2, 'new'), (3, 'new')`
    );
  });

  afterAll(async () => {
    await raw.query(`drop table if exists ${table}`);
    await raw.end();
  });

  it("updates one row", async () => {
    await expect(
      pool.executeWrite(
        `update ${table} set status = ? where id = ?`,
        ["shipped", 2],
        { maxAffectedRows: 1, schema: null, signal: signal() }
      )
    ).resolves.toStrictEqual({ affectedRows: 1 });
    await expect(rows()).resolves.toStrictEqual([
      [1, "new"],
      [2, "shipped"],
      [3, "new"],
    ]);
  });

  it("rolls back a write that changes too many rows", async () => {
    await expect(
      pool.executeWrite(
        `update ${table} set status = ? where id > ?`,
        ["shipped", 0],
        { maxAffectedRows: 1, schema: null, signal: signal() }
      )
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    await expect(rows()).resolves.toStrictEqual([
      [1, "new"],
      [2, "new"],
      [3, "new"],
    ]);
  });

  it("stores an injection string as data", async () => {
    await pool.executeWrite(
      `update ${table} set status = ? where id = ?`,
      [HOSTILE, 1],
      { maxAffectedRows: 1, schema: null, signal: signal() }
    );
    const [first] = await rows();
    expect(first).toStrictEqual([1, HOSTILE]);
  });

  it("rolls back when cancelled mid-statement", async () => {
    const controller = new AbortController();
    const pending = pool.executeWrite(
      `update ${table} set status = ? where id = ? and sleep(1) = 0`,
      ["shipped", 1],
      { maxAffectedRows: 1, schema: null, signal: controller.signal }
    );
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toBeDefined();
    const [first] = await rows();
    expect(first).toStrictEqual([1, "new"]);
  });
});
