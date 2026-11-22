import type { AskPorts, SqlRunInput, SqlRunPorts } from "@conch/agent";
import type { DatabaseConnection, DialectType, SchemaInfo } from "@conch/core";
import type {
  AskEvent,
  AskEventMessage,
  AskParams,
  AskPhase,
  RecentAsk,
  SqlRunSource,
} from "@conch/rpc";

import { runAsk, runSql } from "@conch/agent";
import {
  CancellationRegistry,
  compileSqlTemplate,
  limitedSelect,
  lookupKindFits,
  lookupTemplateValue,
  PREVIEW_ROWS,
  qualifiedTable,
  quoteIdentifier,
} from "@conch/core";
import { chainPrompt, RefineContext, RunSqlParams } from "@conch/rpc";
import { z } from "zod";

import type { AskPortsDeps } from "./ask-ports.ts";

import {
  buildAskPorts,
  openPool,
  SetupFailure,
  sqlRunner,
  toSetupFailure,
  withHistory,
} from "./ask-ports.ts";
import { SQL_RUN_UNSUPPORTED_MESSAGE } from "./connection-access.ts";

const askParamsSchema = z.object({
  askId: z.string().min(1).max(100),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  prompt: z.string().trim().min(1).max(4000),
  refine: RefineContext.optional(),
});

export interface AskServiceDeps extends AskPortsDeps {
  send(message: AskEventMessage): void;
  rememberAsk(ask: RecentAsk): Promise<void>;
}

interface QueryTarget {
  connection: DatabaseConnection;
  dialect: DialectType;
  database: string;
  ports: SqlRunPorts;
}

const shortId = (askId: string): string => askId.slice(0, 8);

type MatchSource = Extract<SqlRunSource, { kind: "match" }>;

const TABLE_CHANGED = "This table changed since the search. Search again.";

const matchRunInput = (
  source: MatchSource,
  schema: SchemaInfo,
  dialect: SqlRunPorts["dialect"]
): SqlRunInput => {
  const table = schema.schemas
    .find((item) => item.name === source.schema)
    ?.tables.find((item) => item.name === source.table);
  const column = table?.columns.find((item) => item.name === source.column);
  if (
    !(column && lookupKindFits(source.value.kind, column.dataType, dialect))
  ) {
    throw new SetupFailure("QUERY_FAILED", TABLE_CHANGED);
  }
  const template = limitedSelect(
    dialect,
    qualifiedTable(dialect, source.schema, source.table),
    "*",
    PREVIEW_ROWS,
    `${quoteIdentifier(dialect, source.column)} = {{value}}`
  );
  const { sql, params } = compileSqlTemplate(
    template,
    { value: lookupTemplateValue(source.value) },
    dialect
  );
  return { params, sql, title: `${source.table} · ${source.column}` };
};

export const createAskService = (deps: AskServiceDeps) => {
  const controllers = new CancellationRegistry();
  const activeByConnection = new Map<string, string>();

  const openSqlTarget = async (
    connectionId: string,
    requested: string | null
  ): Promise<QueryTarget> => {
    const open = await openPool(deps.pools, {
      connectionId,
      database: requested,
    });
    const { dialect } = open.pool;
    if (!dialect) {
      throw new SetupFailure("UNSUPPORTED_ENGINE", SQL_RUN_UNSUPPORTED_MESSAGE);
    }
    const execute = withHistory(open, dialect, sqlRunner(open));
    return {
      connection: open.connection,
      database: open.database,
      dialect,
      ports: { connectionLabel: open.connection.name, dialect, execute },
    };
  };

  const forward = (askId: string, event: AskEvent, started: number): void => {
    if (
      event.type === "phase" ||
      event.type === "done" ||
      event.type === "error"
    ) {
      const label = event.type === "phase" ? event.phase : event.type;
      const code = event.type === "error" ? ` ${event.code}` : "";
      const ms = Math.round(performance.now() - started);
      console.log(`[ask] ${shortId(askId)} ${label}${code} +${ms}ms`);
    }
    deps.send({ askId, event });
  };

  const forwardSetupError = (
    askId: string,
    error: unknown,
    phase: AskPhase,
    signal: AbortSignal,
    started: number
  ): void => {
    const failure = toSetupFailure(error);
    const code = signal.aborted ? "CANCELLED" : failure.code;
    forward(
      askId,
      { code, message: failure.message, phase, type: "error" },
      started
    );
  };

  const remember = async (ask: RecentAsk): Promise<void> => {
    try {
      await deps.rememberAsk(ask);
    } catch (error) {
      console.error(`[ask] could not record the recent ask: ${String(error)}`);
    }
  };

  const runQuestion = async (
    params: AskParams,
    signal: AbortSignal
  ): Promise<void> => {
    const started = performance.now();
    let ports: AskPorts;
    try {
      ports = await buildAskPorts(deps, params);
    } catch (error) {
      forwardSetupError(params.askId, error, "schema", signal, started);
      return;
    }
    let sql = "";
    const { refine } = params;
    for await (const event of runAsk(params.prompt, ports, signal, refine)) {
      forward(params.askId, event, started);
      if (event.type === "sqlDone") {
        ({ sql } = event);
      } else if (event.type === "card") {
        await remember({
          askedAt: new Date().toISOString(),
          connectionId: params.connectionId,
          database: params.database,
          dialect: ports.engine.language,
          id: refine?.chainId ?? params.askId,
          prompt: chainPrompt(refine?.turns ?? [], params.prompt),
          spec: event.spec,
          sql,
        });
      }
    }
  };

  const runInputFor = async (
    source: SqlRunSource,
    target: QueryTarget
  ): Promise<SqlRunInput> => {
    if (source.kind === "sql") {
      return { sql: source.sql, title: source.title };
    }
    const schema = await deps.schemas.get(
      target.connection.id,
      target.database
    );
    return matchRunInput(source, schema, target.dialect);
  };

  const runRawSql = async (
    params: RunSqlParams,
    signal: AbortSignal
  ): Promise<void> => {
    const started = performance.now();
    let target: QueryTarget;
    let input: SqlRunInput;
    try {
      target = await openSqlTarget(params.connectionId, params.database);
      input = await runInputFor(params.source, target);
    } catch (error) {
      forwardSetupError(params.askId, error, "run", signal, started);
      return;
    }
    for await (const event of runSql(input, target.ports, signal)) {
      forward(params.askId, event, started);
    }
  };

  const runSession = async (
    session: { askId: string; connectionId: string },
    work: (signal: AbortSignal) => Promise<void>
  ): Promise<void> => {
    const previous = activeByConnection.get(session.connectionId);
    if (previous) {
      controllers.cancel(previous);
    }
    activeByConnection.set(session.connectionId, session.askId);
    const controller = controllers.register(session.askId);
    try {
      await work(controller.signal);
    } catch (error) {
      console.error(
        `[ask] ${shortId(session.askId)} crashed: ${String(error)}`
      );
    } finally {
      controllers.remove(session.askId);
      if (activeByConnection.get(session.connectionId) === session.askId) {
        activeByConnection.delete(session.connectionId);
      }
    }
  };

  return {
    cancelAsk(askId: string): void {
      controllers.cancel(askId);
    },
    startAsk(input: AskParams): void {
      const params = askParamsSchema.parse(input);
      runSession(params, (signal) => runQuestion(params, signal));
    },
    startSqlRun(input: RunSqlParams): void {
      const params = RunSqlParams.parse(input);
      runSession(params, (signal) => runRawSql(params, signal));
    },
  };
};
