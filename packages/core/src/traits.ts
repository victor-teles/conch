import type { ExplainResult } from "./explain.ts";
import type {
  BindValue,
  ConnectionParams,
  DialectType,
  ExecuteResult,
  SchemaInfo,
  TestConnectionResult,
} from "./types.ts";

import { DbError } from "./error.ts";

export interface Driver {
  readonly dbType: string;
  testConnection(params: ConnectionParams): Promise<TestConnectionResult>;
  connect(connectionId: string, params: ConnectionParams): Promise<Pool>;
}

export interface ExecuteOptions {
  readOnly?: boolean;
  params?: BindValue[];
}

export interface Pool {
  readonly dialect: DialectType | null;
  readonly supportsExplain: boolean;
  fetchVersion(): Promise<string>;
  listDatabases(): Promise<string[]>;
  fetchSchema(database: string): Promise<SchemaInfo>;
  execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal,
    options?: ExecuteOptions
  ): Promise<ExecuteResult>;
  explain(
    sql: string,
    analyze: boolean,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExplainResult>;
  close(): Promise<void>;
}

export type { DbError };

export interface GuardedWriteOptions {
  schema: string | null;
  maxAffectedRows: number;
  signal: AbortSignal;
}

export const WRITE_STATEMENT_TIMEOUT_MS = 15_000;

// A separate capability, never a Pool flag: read paths hold a Pool and can't
// reach a write. Drivers run the statement in a transaction and roll back
// when it touches more rows than allowed.
export interface GuardedWrite {
  executeWrite(
    sql: string,
    params: BindValue[],
    options: GuardedWriteOptions
  ): Promise<{ affectedRows: number }>;
}

export const supportsGuardedWrites = (
  pool: Pool
): pool is Pool & GuardedWrite =>
  typeof (pool as Partial<GuardedWrite>).executeWrite === "function";

export const tooManyRows = (affected: number, allowed: number): DbError =>
  new DbError(
    "TOO_MANY_ROWS",
    `The write would change ${affected} rows; this action allows at most ${allowed}. Nothing was changed.`
  );
