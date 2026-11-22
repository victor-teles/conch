import type { AskPorts, LanguageModel, QueryEngine } from "@conch/agent";
import type { DatabaseConnection, Pool, QueryLanguage } from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type { AskErrorCode } from "@conch/rpc";

import {
  ASK_MAX_ROWS,
  mongoEngine,
  redisEngine,
  sqlEngine,
} from "@conch/agent";
import { appendHistory, DbError } from "@conch/core";
import {
  isMongoPool,
  isRedisPool,
  runMongoReadQuery,
  runRedisReadPlan,
} from "@conch/drivers/read";

import type { SchemaCache } from "./schema-cache.ts";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
  tabular,
  UNSUPPORTED_ENGINE_MESSAGE,
} from "./connection-access.ts";

export class SetupFailure extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const toSetupFailure = (error: unknown): SetupFailure =>
  error instanceof SetupFailure
    ? error
    : new SetupFailure("QUERY_FAILED", DbError.fromUnknown(error).message);

export interface AskPortsDeps {
  pools: ConnectionPoolManager;
  schemas: SchemaCache;
  loadModel(): Promise<LanguageModel | null>;
}

export interface AskTarget {
  connectionId: string;
  database: string | null;
}

export interface OpenPool {
  connection: DatabaseConnection;
  pool: Pool;
  database: string;
}

type RunQuery = AskPorts["execute"];

const requireConnection = async (id: string): Promise<DatabaseConnection> => {
  const connection = await findConnection(id);
  if (!connection) {
    throw new SetupFailure(
      "QUERY_FAILED",
      "This connection no longer exists. Pick another one."
    );
  }
  return connection;
};

export const openPool = async (
  pools: ConnectionPoolManager,
  { connectionId, database }: AskTarget
): Promise<OpenPool> => {
  const connection = await requireConnection(connectionId);
  const pool = await ensurePool(pools, connection);
  const resolved = await resolveSchemaName(pool, database, connection);
  return { connection, database: resolved, pool };
};

const recordHistory = async (
  { connection, database }: OpenPool,
  language: QueryLanguage,
  entry: { sql: string; error: string | null; executionTimeMs: number }
): Promise<void> => {
  try {
    await appendHistory({
      ...entry,
      connectionId: connection.id,
      database,
      dialect: language,
      success: entry.error === null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[ask] could not record history: ${String(error)}`);
  }
};

export const withHistory =
  (open: OpenPool, language: QueryLanguage, run: RunQuery): RunQuery =>
  async (sql, signal, params) => {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const result = await run(sql, signal, params);
      await recordHistory(open, language, {
        error: null,
        executionTimeMs: elapsed(),
        sql,
      });
      return result;
    } catch (error) {
      await recordHistory(open, language, {
        error: DbError.fromUnknown(error).message,
        executionTimeMs: elapsed(),
        sql,
      });
      throw error;
    }
  };

export const sqlRunner =
  ({ pool, database }: OpenPool): RunQuery =>
  async (sql, signal, params) =>
    tabular(
      await pool.execute(
        sql,
        ASK_MAX_ROWS,
        database,
        signal,
        params ? { params, readOnly: true } : { readOnly: true }
      )
    );

interface AskEngine {
  engine: QueryEngine;
  run: RunQuery;
}

const askEngineOf = (open: OpenPool): AskEngine | null => {
  const { pool, database } = open;
  if (pool.dialect) {
    return { engine: sqlEngine(pool.dialect), run: sqlRunner(open) };
  }
  if (isMongoPool(pool)) {
    return {
      engine: mongoEngine,
      run: (text, signal) =>
        runMongoReadQuery(pool, text, database, ASK_MAX_ROWS, signal),
    };
  }
  if (isRedisPool(pool)) {
    return {
      engine: redisEngine,
      run: (text, signal) =>
        runRedisReadPlan(pool, text, database, ASK_MAX_ROWS, signal),
    };
  }
  return null;
};

export const buildAskPorts = async (
  deps: AskPortsDeps,
  target: AskTarget
): Promise<AskPorts> => {
  const open = await openPool(deps.pools, target);
  const selected = askEngineOf(open);
  if (!selected) {
    throw new SetupFailure("UNSUPPORTED_ENGINE", UNSUPPORTED_ENGINE_MESSAGE);
  }
  const model = await deps.loadModel();
  if (!model) {
    throw new SetupFailure(
      "NO_AI_SETTINGS",
      "Add an AI provider in Settings to ask questions."
    );
  }
  const { connection, database } = open;
  const { engine, run } = selected;
  return {
    connectionLabel: connection.name,
    engine,
    execute: withHistory(open, engine.language, run),
    loadSchema: () => deps.schemas.get(connection.id, database),
    model,
    now: () => new Date(),
    redact: {
      customPatterns: connection.customPiiPatterns ?? [],
      enabled: Boolean(connection.piiRedaction),
    },
  };
};
