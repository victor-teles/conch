import type { EngineReading } from "@conch/agent";

import { assertReadOnly, compareGuardWithEngine } from "@conch/agent";
import { Pool as PgPool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { PostgresPool } from "./pool.ts";

const FIXTURE_URL =
  process.env.OMQ_PG_URL ?? "postgres://omq:omq@127.0.0.1:5432/oh_my_query";

const connectFixture = async (): Promise<PgPool | null> => {
  const raw = new PgPool({
    connectionString: FIXTURE_URL,
    connectionTimeoutMillis: 1000,
    max: 1,
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

const NOTHING_RAN: EngineReading = {
  ran: false,
  sawProbe: false,
  statements: 0,
};

const fieldsOf = (result: unknown): string[] => {
  const results = Array.isArray(result) ? result : [result];
  return results.flatMap((item: { fields?: { name: string }[] }) =>
    (item.fields ?? []).map((field) => field.name)
  );
};

// The simple protocol runs every statement it is given, so it shows exactly
// what the engine reads.
const readOnPostgres = async (sql: string): Promise<EngineReading> => {
  const client = await (fixture as PgPool).connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result: unknown = await client.query(sql);
    return {
      ran: true,
      sawProbe: fieldsOf(result).includes("conch_probe"),
      statements: Array.isArray(result) ? result.length : 1,
    };
  } catch {
    return NOTHING_RAN;
  } finally {
    await client.query("ROLLBACK").catch(() => null);
    client.release();
  }
};

const runs = async (pool: PostgresPool, sql: string): Promise<boolean> => {
  try {
    await pool.execute(sql, 10, null, new AbortController().signal, {
      readOnly: true,
    });
    return true;
  } catch {
    return false;
  }
};

describe.skipIf(!fixture)("read-only guard vs Postgres (differential)", () => {
  afterAll(async () => {
    await (fixture as PgPool).end();
  });

  it("never accepts SQL the engine reads as more statements or more code", async () => {
    const result = await compareGuardWithEngine("postgresql", readOnPostgres);
    console.info(
      `[differential] postgres: ${result.cases} cases, ${result.ran} ran, ${result.accepted} accepted`
    );
    expect(result.disagreements).toStrictEqual([]);
    expect(result.ran).toBeGreaterThan(300);
  }, 120_000);

  it("refuses server file reads the read-only transaction would allow", async () => {
    const read = `SELECT "pg_catalog"."pg_read_file"('PG_VERSION') AS v`;
    const listing = "SELECT pg_ls_dir('.') AS v";
    expect({
      engine: await runs(new PostgresPool(fixture as PgPool), read),
      guard: [read, listing].map((sql) => assertReadOnly(sql, "postgresql").ok),
    }).toStrictEqual({ engine: true, guard: [false, false] });
  });
});
