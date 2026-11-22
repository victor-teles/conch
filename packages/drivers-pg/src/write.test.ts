import type { TabularResult } from "@conch/core";

import { Pool as PgPool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PostgresPool } from "./pool.ts";

const HOSTILE = "x'; drop table t; --";

const fakePool = (rowCount: number, failOn?: string) => {
  const statements: string[] = [];
  const query = vi.fn((input: string | { text: string }): Promise<unknown> => {
    const text = typeof input === "string" ? input : input.text;
    statements.push(text);
    if (text === failOn) {
      return Promise.reject(
        Object.assign(new Error("boom"), { code: "23505" })
      );
    }
    const result = { fields: [], rowCount, rows: [] };
    return Promise.resolve(result);
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  return { client, pool: new PostgresPool(pool as never), query, statements };
};

const abortingOn =
  (statement: string, controller: AbortController, statements: string[]) =>
  (input: string | { text: string }) => {
    const text = typeof input === "string" ? input : input.text;
    statements.push(text);
    if (text === statement) {
      controller.abort();
    }
    const result = { fields: [], rowCount: 1, rows: [] };
    return Promise.resolve(result);
  };

const multiResult =
  (statements: string[]) =>
  (input: string | { text: string }): Promise<unknown> => {
    const text = typeof input === "string" ? input : input.text;
    statements.push(text);
    const result =
      text === UPDATE
        ? [
            { fields: [], rowCount: 1, rows: [] },
            { fields: [], rowCount: 1, rows: [] },
          ]
        : { fields: [], rowCount: null, rows: [] };
    return Promise.resolve(result);
  };

const options = (signal = new AbortController().signal) => ({
  maxAffectedRows: 1,
  schema: "public",
  signal,
});

const UPDATE = "UPDATE orders SET status = $1 WHERE id = $2";

describe("postgresPool.executeWrite", () => {
  it("runs the statement in a transaction with a timeout and commits", async () => {
    const { pool, query, statements } = fakePool(1);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(statements).toStrictEqual([
      "BEGIN",
      "SET LOCAL statement_timeout = 15000",
      'SET LOCAL search_path TO "public"',
      UPDATE,
      "COMMIT",
    ]);
    expect(query).toHaveBeenCalledWith({
      queryMode: "extended",
      rowMode: "array",
      text: UPDATE,
      values: ["shipped", 7],
    });
  });

  it("rolls back and refuses when more rows match than allowed", async () => {
    const { pool, statements } = fakePool(3);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("rolls back when the statement fails", async () => {
    const { pool, statements } = fakePool(1, UPDATE);
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "23505" });
    expect(statements.at(-1)).toBe("ROLLBACK");
  });

  it("destroys the connection on cancel so the server rolls back", async () => {
    const controller = new AbortController();
    const { client, pool, query, statements } = fakePool(1);
    query.mockImplementation(abortingOn(UPDATE, controller, statements));
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(statements).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it("refuses a multi-result reply instead of counting it as zero rows", async () => {
    const { pool, query, statements } = fakePool(1);
    query.mockImplementation(multiResult(statements));
    await expect(
      pool.executeWrite(UPDATE, ["shipped", 7], options())
    ).rejects.toMatchObject({ code: "MULTIPLE_STATEMENTS" });
    expect(statements).not.toContain("COMMIT");
  });

  it("refuses an invalid schema name before writing", async () => {
    const { pool, statements } = fakePool(1);
    await expect(
      pool.executeWrite(UPDATE, [], { ...options(), schema: 'x"; drop' })
    ).rejects.toBeDefined();
    expect(statements).not.toContain(UPDATE);
  });
});

const FIXTURE_URL =
  process.env.OMQ_PG_URL ?? "postgres://omq:omq@127.0.0.1:5432/oh_my_query";

const connectFixture = async (): Promise<PgPool | null> => {
  const raw = new PgPool({
    connectionString: FIXTURE_URL,
    connectionTimeoutMillis: 1000,
    max: 3,
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

describe.skipIf(!fixture)(
  "postgresPool.executeWrite (fixture database)",
  () => {
    const raw = fixture as PgPool;
    const pool = new PostgresPool(raw);
    const table = `conch_write_${process.pid}`;

    const rows = async (): Promise<unknown[][]> => {
      const result = (await pool.execute(
        `select id, status from ${table} order by id`,
        100,
        null,
        new AbortController().signal,
        { readOnly: true }
      )) as TabularResult;
      return result.rows;
    };

    beforeEach(async () => {
      await raw.query(`drop table if exists ${table}`);
      await raw.query(
        `create table ${table} (id int primary key, status text)`
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
          `update ${table} set status = $1 where id = $2`,
          ["shipped", 2],
          {
            maxAffectedRows: 1,
            schema: null,
            signal: new AbortController().signal,
          }
        )
      ).resolves.toStrictEqual({ affectedRows: 1 });
      await expect(rows()).resolves.toStrictEqual([
        [1, "new"],
        [2, "shipped"],
        [3, "new"],
      ]);
    });

    it("rolls back a write that matches too many rows", async () => {
      await expect(
        pool.executeWrite(
          `update ${table} set status = $1 where id > $2`,
          ["shipped", 0],
          {
            maxAffectedRows: 1,
            schema: null,
            signal: new AbortController().signal,
          }
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
        `update ${table} set status = $1 where id = $2`,
        [HOSTILE, 1],
        {
          maxAffectedRows: 1,
          schema: null,
          signal: new AbortController().signal,
        }
      );
      await expect(
        pool.executeWrite(`delete from ${table} where id = $1`, ["1 OR 1=1"], {
          maxAffectedRows: 1,
          schema: null,
          signal: new AbortController().signal,
        })
      ).rejects.toBeDefined();
      await expect(rows()).resolves.toStrictEqual([
        [1, HOSTILE],
        [2, "new"],
        [3, "new"],
      ]);
    });

    it("never commits a write hidden behind a nested comment on the read-only path", async () => {
      const hidden = `SELECT 1 /* /* */ '*/; COMMIT; UPDATE ${table} SET status = 'pwned'; --'`;
      await expect(
        pool.execute(hidden, 10, null, new AbortController().signal, {
          readOnly: true,
        })
      ).rejects.toBeDefined();
      await expect(rows()).resolves.toStrictEqual([
        [1, "new"],
        [2, "new"],
        [3, "new"],
      ]);
    });

    it("refuses a second statement in a write", async () => {
      await expect(
        pool.executeWrite(
          `update ${table} set status = $1 where id = $2; update ${table} set status = 'x'`,
          ["shipped", 1],
          {
            maxAffectedRows: 1,
            schema: null,
            signal: new AbortController().signal,
          }
        )
      ).rejects.toBeDefined();
      await expect(rows()).resolves.toStrictEqual([
        [1, "new"],
        [2, "new"],
        [3, "new"],
      ]);
    });

    it("rolls back when cancelled mid-statement", async () => {
      const controller = new AbortController();
      const pending = pool.executeWrite(
        `update ${table} set status = $1 where id = $2 and pg_sleep(1) is not null`,
        ["shipped", 1],
        { maxAffectedRows: 1, schema: null, signal: controller.signal }
      );
      setTimeout(() => controller.abort(), 100);
      await expect(pending).rejects.toBeDefined();
      await expect(rows()).resolves.toStrictEqual([
        [1, "new"],
        [2, "new"],
        [3, "new"],
      ]);
    });
  }
);
