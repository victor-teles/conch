import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

import { describe, expect, it, vi } from "vitest";

import { DuckdbPool } from "./pool.ts";

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const HOSTILE = "x'; drop table t; --";
const UPDATE = "UPDATE orders SET status = ? WHERE id = ?";

const fakeInstance = (rowsChanged: number) => {
  const log: string[] = [];
  const reader = {
    getRowsJson: () => [[rowsChanged]],
    returnType: 1,
    rowsChanged,
  };
  const conn = {
    disconnect: vi.fn(),
    interrupt: vi.fn(),
    run: vi.fn((sql: string) => {
      log.push(sql);
      return resolved({});
    }),
    runAndReadAll: vi.fn((sql: string) => {
      log.push(sql);
      return resolved(reader);
    }),
  };
  const instance = {
    connect: () => resolved(conn as unknown as DuckDBConnection),
  };
  return {
    conn,
    log,
    pool: new DuckdbPool(instance as unknown as DuckDBInstance),
  };
};

const options = (signal = new AbortController().signal) => ({
  maxAffectedRows: 1,
  schema: "main",
  signal,
});

describe("duckdbPool.executeWrite", () => {
  it("binds values in a transaction and commits", async () => {
    const { conn, log, pool } = fakeInstance(1);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(log).toStrictEqual([
      "SET search_path = 'main'",
      "BEGIN TRANSACTION",
      UPDATE,
      "COMMIT",
    ]);
    expect(conn.runAndReadAll).toHaveBeenCalledWith(UPDATE, ["shipped", 7]);
  });

  it("rolls back when more rows change than allowed", async () => {
    const { log, pool } = fakeInstance(4);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(log.at(-1)).toBe("ROLLBACK");
  });

  it("interrupts and rolls back when cancelled", async () => {
    const controller = new AbortController();
    const { conn, log, pool } = fakeInstance(1);
    conn.runAndReadAll.mockImplementation((sql: string) => {
      log.push(sql);
      controller.abort();
      return resolved({
        getRowsJson: () => [[1]],
        returnType: 1,
        rowsChanged: 1,
      });
    });
    await expect(
      pool.executeWrite(UPDATE, [], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(conn.interrupt).toHaveBeenCalledWith();
    expect(log).not.toContain("COMMIT");
  });
});

const duckdb = await import("@duckdb/node-api").catch(() => null);
const probe = duckdb
  ? await duckdb.DuckDBInstance.create(":memory:").catch(() => null)
  : null;

describe.skipIf(!probe)("duckdbPool.executeWrite (in-memory DuckDB)", () => {
  const open = async () => {
    const api = duckdb as NonNullable<typeof duckdb>;
    const instance = await api.DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    await conn.run("create table orders (id integer, status varchar)");
    await conn.run(
      "insert into orders values (1, 'new'), (2, 'new'), (3, 'new')"
    );
    const statuses = async () => {
      const reader = await conn.runAndReadAll(
        "select status from orders order by id"
      );
      return reader.getRowsJson().flat();
    };
    return { pool: new DuckdbPool(instance), statuses };
  };
  const plain = { ...options(), schema: null };

  it("updates one row and stores an injection string as data", async () => {
    const { pool, statuses } = await open();
    await expect(
      pool.executeWrite(UPDATE, [HOSTILE, 2], plain)
    ).resolves.toStrictEqual({ affectedRows: 1 });
    await expect(statuses()).resolves.toStrictEqual(["new", HOSTILE, "new"]);
  });

  it("rolls back a write that changes too many rows", async () => {
    const { pool, statuses } = await open();
    await expect(
      pool.executeWrite(
        "UPDATE orders SET status = ? WHERE id > ?",
        ["shipped", 0],
        plain
      )
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    await expect(statuses()).resolves.toStrictEqual(["new", "new", "new"]);
  });

  it("counts RETURNING rows and reports a miss as zero", async () => {
    const { pool } = await open();
    await expect(
      pool.executeWrite(
        "UPDATE orders SET status = ? WHERE id = ? RETURNING id",
        ["r", 3],
        plain
      )
    ).resolves.toStrictEqual({ affectedRows: 1 });
    await expect(
      pool.executeWrite("DELETE FROM orders WHERE id = ?", [99], plain)
    ).resolves.toStrictEqual({ affectedRows: 0 });
  });
});
