import type { ConnectionPool } from "mssql";

import { describe, expect, it, vi } from "vitest";

import { MssqlPool } from "./pool.ts";

const UPDATE = "UPDATE orders SET status = @p1 WHERE id = @p2";

const fakePool = (rowsAffected: number[]) => {
  const events: string[] = [];
  const request = {
    cancel: vi.fn(() => events.push("cancel")),
    input: vi.fn((name: string, value: unknown) => {
      events.push(`input ${name}=${String(value)}`);
    }),
    query: vi.fn((sql: string) => {
      events.push(sql);
      return Promise.resolve({ recordset: [], rowsAffected });
    }),
  };
  const transaction = {
    begin: vi.fn(() => {
      events.push("BEGIN");
      return Promise.resolve();
    }),
    commit: vi.fn(() => {
      events.push("COMMIT");
      return Promise.resolve();
    }),
    request: () => request,
    rollback: vi.fn(() => {
      events.push("ROLLBACK");
      return Promise.resolve();
    }),
  };
  const pool = {
    request: () => request,
    transaction: () => transaction,
  } as unknown as ConnectionPool;
  return { events, pool: new MssqlPool(pool, "master"), request };
};

const abortingOn =
  (statement: string, controller: AbortController, events: string[]) =>
  (sql: string) => {
    events.push(sql);
    if (sql === statement) {
      controller.abort();
    }
    const result = { recordset: [], rowsAffected: [1] };
    return Promise.resolve(result);
  };

const options = (signal = new AbortController().signal) => ({
  maxAffectedRows: 1,
  schema: "shop",
  signal,
});

describe("mssqlPool.executeWrite", () => {
  it("binds values in a transaction and commits", async () => {
    const { events, pool } = fakePool([1]);
    await expect(
      pool.executeWrite(UPDATE, ["x'; drop table t; --", 7], options())
    ).resolves.toStrictEqual({ affectedRows: 1 });
    expect(events).toStrictEqual([
      "BEGIN",
      "USE [shop]",
      "input p1=x'; drop table t; --",
      "input p2=7",
      UPDATE,
      "COMMIT",
    ]);
  });

  it("rolls back when the batch changes too many rows", async () => {
    const { events, pool } = fakePool([1, 1]);
    await expect(
      pool.executeWrite(UPDATE, ["s", 7], options())
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
    expect(events.at(-1)).toBe("ROLLBACK");
    expect(events).not.toContain("COMMIT");
  });

  it("cancels the request and rolls back when aborted", async () => {
    const controller = new AbortController();
    const { events, pool, request } = fakePool([1]);
    request.query.mockImplementation(abortingOn(UPDATE, controller, events));
    await expect(
      pool.executeWrite(UPDATE, [], options(controller.signal))
    ).rejects.toMatchObject({ code: "QUERY_CANCELLED" });
    expect(events).toContain("cancel");
    expect(events.at(-1)).toBe("ROLLBACK");
  });
});
