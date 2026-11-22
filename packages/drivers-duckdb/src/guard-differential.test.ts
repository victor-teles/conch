import type { EngineReading } from "@conch/agent";

import { compareGuardWithEngine } from "@conch/agent";
import { describe, expect, it } from "vitest";

const duckdb = await import("@duckdb/node-api").catch(() => null);
const instance = duckdb
  ? await duckdb.DuckDBInstance.create(":memory:").catch(() => null)
  : null;

const NOTHING_RAN: EngineReading = {
  ran: false,
  sawProbe: false,
  statements: 0,
};

// DuckDB's own statement splitter and result columns show what it reads.
const readOnDuckdb = async (sql: string): Promise<EngineReading> => {
  const conn = await (instance as NonNullable<typeof instance>).connect();
  try {
    const extracted = await conn.extractStatements(sql);
    const reader = await conn.runAndReadAll(sql);
    return {
      ran: true,
      sawProbe: reader.columnNames().includes("conch_probe"),
      statements: extracted.count,
    };
  } catch {
    return NOTHING_RAN;
  } finally {
    conn.disconnect();
  }
};

describe.skipIf(!instance)("read-only guard vs DuckDB (differential)", () => {
  it("never accepts SQL the engine reads as more statements or more code", async () => {
    const result = await compareGuardWithEngine("duckdb", readOnDuckdb);
    console.info(
      `[differential] duckdb: ${result.cases} cases, ${result.ran} ran, ${result.accepted} accepted`
    );
    expect(result.disagreements).toStrictEqual([]);
    expect(result.ran).toBeGreaterThan(300);
  }, 240_000);
});
