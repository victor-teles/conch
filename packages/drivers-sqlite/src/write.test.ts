import type { Database } from "bun:sqlite";

import { describe, expect, it, vi } from "vitest";

import { SqlitePool } from "./pool.ts";

const HOSTILE = "x'; drop table t; --";
const UPDATE = "UPDATE orders SET status = ? WHERE id = ?";

const fakeDb = (changes: number) => {
  const log: string[] = [];
  const run = vi.fn(() => ({ changes, lastInsertRowid: 0 }));
  const db = {
    query: vi.fn((sql: string) => {
      log.push(sql);
      return { run };
    }),
    run: vi.fn((sql: string) => {
      log.push(sql);
    }),
  };
  return { db: db as unknown as Database, log, run };
};

const options = (signal = new AbortController().signal) => ({
  maxAffectedRows: 1,
  schema: null,
  signal,
});

describe("sqlitePool.executeWrite", () => {
  it("binds values inside an immediate transaction and commits", async () => {
    const { db, log, run } = fakeDb(1);
    const pool = new SqlitePool(db, "sqlite");
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(log).toStrictEqual(["BEGIN IMMEDIATE", UPDATE, "COMMIT"]);
    expect(run).toHaveBeenCalledWith("shipped", 7);
  });

  it("rolls back when more rows change than allowed", async () => {
    const { db, log } = fakeDb(5);
    const pool = new SqlitePool(db, "sqlite");
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(log).toStrictEqual(["BEGIN IMMEDIATE", UPDATE, "ROLLBACK"]);
  });

  it("never starts when already cancelled", async () => {
    const { db, log } = fakeDb(1);
    const controller = new AbortController();
    controller.abort();
    const pool = new SqlitePool(db, "sqlite");
    await expect(
      pool.executeWrite(UPDATE, [], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(log).toStrictEqual([]);
  });

  it("rolls back when cancelled before commit", async () => {
    const controller = new AbortController();
    const { db, log, run } = fakeDb(1);
    run.mockImplementation(() => {
      controller.abort();
      return { changes: 1, lastInsertRowid: 0 };
    });
    const pool = new SqlitePool(db, "sqlite");
    await expect(
      pool.executeWrite(UPDATE, [], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(log.at(-1)).toBe("ROLLBACK");
  });
});

const bunSqlite = await import("bun:sqlite").catch(() => null);

const statuses = (db: Database) =>
  db.query("select status from orders order by id").values().flat();

describe.skipIf(!bunSqlite)("sqlitePool.executeWrite (bun:sqlite)", () => {
  const open = () => {
    const sqlite = bunSqlite as NonNullable<typeof bunSqlite>;
    const db = new sqlite.Database(":memory:");
    db.run("create table orders (id integer primary key, status text)");
    db.run("insert into orders values (1, 'new'), (2, 'new'), (3, 'new')");
    return { db, pool: new SqlitePool(db, "sqlite") };
  };

  it("updates one row and stores an injection string as data", async () => {
    const { db, pool } = open();
    await expect(
      pool.executeWrite(UPDATE, [HOSTILE, 2], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(statuses(db)).toStrictEqual(["new", HOSTILE, "new"]);
  });

  it("rolls back a write that changes too many rows", async () => {
    const { db, pool } = open();
    await expect(
      pool.executeWrite(
        "UPDATE orders SET status = ? WHERE id > ?",
        ["shipped", 0],
        options()
      )
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(statuses(db)).toStrictEqual(["new", "new", "new"]);
  });
});
