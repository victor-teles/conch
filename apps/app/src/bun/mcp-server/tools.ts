import type { AskPorts, runAsk as RunAsk } from "@conch/agent";
import type { DatabaseConnection, SchemaInfo } from "@conch/core";
import type {
  AskEvent,
  CardResult,
  CardSpec,
  CompiledSource,
  ParamValues,
  Widget,
} from "@conch/rpc";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { connectionIdOf } from "@conch/rpc";
import { z } from "zod";

import type { CallContext, RunToolCall } from "./tool-call.ts";

import {
  DATA_PREAMBLE,
  exposedConnections,
  publicConnection,
  publicInputs,
  publicSchema,
  resolveConnection,
  resolveWidget,
  shapeRows,
  visibleWidgets,
} from "./mcp-policy.ts";
import { ambiguous, notFound, ToolError } from "./tool-call.ts";

export const SCHEMA_TIMEOUT_MS = 15_000;
export const WIDGET_TIMEOUT_MS = 30_000;
export const ASK_TIMEOUT_MS = 120_000;

export interface AskTarget {
  connectionId: string;
  database: string | null;
}

export interface McpPolicySettings {
  exposedConnectionIds: readonly string[];
  rowLimit: number;
}

export interface McpToolDeps {
  settings(): Promise<McpPolicySettings>;
  listConnections(): Promise<DatabaseConnection[]>;
  hasAiModel(): Promise<boolean>;
  resolveDatabase(
    connection: DatabaseConnection,
    requested: string | null
  ): Promise<string>;
  loadSchema(connectionId: string, database: string): Promise<SchemaInfo>;
  askPorts(target: AskTarget): Promise<AskPorts>;
  runAsk: typeof RunAsk;
  listWidgets(): Promise<Widget[]>;
  runWidget(
    widgetId: string,
    values: ParamValues,
    signal: AbortSignal
  ): Promise<{
    compiled: CompiledSource;
    result: CardResult & { executionTimeMs: number };
    values: ParamValues;
  }>;
}

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const ConnectionRef = z
  .string()
  .min(1)
  .max(200)
  .describe("Connection id or exact name from list_connections.");

const WidgetInputValue = z.union([
  z.string().max(1000),
  z.number(),
  z.object({ from: z.string().max(40), to: z.string().max(40) }),
]);

const WidgetInputs = z
  .record(z.string().max(100), WidgetInputValue)
  .refine((inputs) => Object.keys(inputs).length <= 20, {
    message: "At most 20 inputs.",
  });

const abortable = async <T>(
  work: Promise<T>,
  signal: AbortSignal
): Promise<T> => {
  signal.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  const onAbort = () => aborted.reject(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([work, aborted.promise]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};

const redactionOf = (connection: DatabaseConnection) => ({
  customPatterns: connection.customPiiPatterns ?? [],
  enabled: Boolean(connection.piiRedaction),
});

interface AskOutcome {
  sql: string;
  result: Parameters<typeof shapeRows>[0] | null;
  spec: CardSpec | null;
}

const consumeAsk = async (
  events: AsyncIterable<AskEvent>
): Promise<AskOutcome> => {
  const outcome: AskOutcome = { result: null, spec: null, sql: "" };
  for await (const event of events) {
    if (event.type === "sqlDone") {
      outcome.sql = event.sql;
    } else if (event.type === "result") {
      outcome.result = event;
    } else if (event.type === "card") {
      outcome.spec = event.spec;
    } else if (event.type === "error") {
      throw new ToolError(event.code, event.message, event.sql ?? null);
    }
  }
  return outcome;
};

const cardSummary = ({ title, subtitle, insight, view }: CardSpec) => ({
  title,
  view: view.kind,
  ...(subtitle ? { subtitle } : {}),
  ...(insight ? { insight } : {}),
});

export const registerMcpTools = (
  server: McpServer,
  deps: McpToolDeps,
  call: RunToolCall
): void => {
  const exposed = async () => {
    const [settings, connections] = await Promise.all([
      deps.settings(),
      deps.listConnections(),
    ]);
    return {
      all: connections,
      connections: exposedConnections(
        connections,
        settings.exposedConnectionIds
      ),
      settings,
    };
  };

  const requireConnection = async (
    ref: string,
    context: CallContext
  ): Promise<{ connection: DatabaseConnection; rowLimit: number }> => {
    const { all, settings } = await exposed();
    const resolved = resolveConnection(ref, all, settings.exposedConnectionIds);
    if (!resolved.ok) {
      throw resolved.code === "AMBIGUOUS"
        ? ambiguous(resolved.candidates)
        : notFound();
    }
    context.target(resolved.value);
    return { connection: resolved.value, rowLimit: settings.rowLimit };
  };

  server.registerTool(
    "list_connections",
    {
      annotations: { ...READ_ONLY, title: "List connections" },
      description:
        "List the database connections the user exposed to agents. Never includes hosts or credentials.",
      inputSchema: {},
    },
    (_args, extra) =>
      call("list_connections", extra.signal, null, async () => {
        const [{ connections }, canAsk] = await Promise.all([
          exposed(),
          deps.hasAiModel(),
        ]);
        return {
          connectionName: null,
          payload: {
            connections: connections.map((connection) =>
              publicConnection(connection, canAsk)
            ),
          },
        };
      })
  );

  server.registerTool(
    "describe_schema",
    {
      annotations: { ...READ_ONLY, title: "Describe schema" },
      description:
        "Describe the tables and columns of one exposed connection. Pass table names to narrow it.",
      inputSchema: {
        connection: ConnectionRef,
        database: z.string().max(500).optional(),
        tables: z.array(z.string().min(1).max(200)).max(50).optional(),
      },
    },
    ({ connection: ref, database, tables }, extra) =>
      call("describe_schema", extra.signal, SCHEMA_TIMEOUT_MS, async (ctx) => {
        const { connection } = await requireConnection(ref, ctx);
        const resolved = await abortable(
          deps.resolveDatabase(connection, database ?? null),
          ctx.signal
        );
        const schema = await abortable(
          deps.loadSchema(connection.id, resolved),
          ctx.signal
        );
        return {
          connectionName: null,
          payload: {
            connection: connection.name,
            ...publicSchema(schema, resolved, tables),
          },
        };
      })
  );

  server.registerTool(
    "ask",
    {
      annotations: { ...READ_ONLY, idempotentHint: false, title: "Ask" },
      description: `Ask a question in plain language about one exposed database connection. Conch writes read-only SQL, runs it, and returns the SQL and the rows. ${DATA_PREAMBLE}`,
      inputSchema: {
        connection: ConnectionRef,
        database: z.string().max(500).optional(),
        question: z.string().trim().min(1).max(2000),
      },
    },
    ({ connection: ref, database, question }, extra) =>
      call("ask", extra.signal, ASK_TIMEOUT_MS, async (ctx) => {
        ctx.audit.question = question;
        const { connection, rowLimit } = await requireConnection(ref, ctx);
        const release = ctx.askLock(connection);
        try {
          const ports = await deps.askPorts({
            connectionId: connection.id,
            database: database ?? null,
          });
          const outcome = await consumeAsk(
            deps.runAsk(question, ports, ctx.signal)
          );
          ctx.audit.sql = outcome.sql || null;
          const shaped = outcome.result
            ? shapeRows(outcome.result, {
                redact: redactionOf(connection),
                rowLimit,
              })
            : { columns: [], rowCount: 0, rows: [], truncated: false };
          ctx.audit.rowCount = shaped.rowCount;
          return {
            connectionName: connection.name,
            payload: {
              sql: outcome.sql,
              ...shaped,
              card: outcome.spec ? cardSummary(outcome.spec) : null,
            },
          };
        } finally {
          release();
        }
      })
  );

  server.registerTool(
    "list_widgets",
    {
      annotations: { ...READ_ONLY, title: "List widgets" },
      description:
        "List the saved widgets on exposed connections, with the inputs each one takes.",
      inputSchema: { connection: ConnectionRef.optional() },
    },
    ({ connection: ref }, extra) =>
      call("list_widgets", extra.signal, null, async (ctx) => {
        const { connections } = await exposed();
        let scope = connections;
        if (ref) {
          const { connection } = await requireConnection(ref, ctx);
          scope = [connection];
        }
        const names = new Map(scope.map((item) => [item.id, item.name]));
        const widgets = visibleWidgets(await deps.listWidgets(), scope);
        return {
          connectionName: null,
          payload: {
            widgets: widgets.map((widget) => ({
              connection: names.get(connectionIdOf(widget) ?? "") ?? null,
              id: widget.id,
              inputs: publicInputs(widget.params),
              name: widget.name,
              question: widget.prompt,
            })),
          },
        };
      })
  );

  server.registerTool(
    "run_widget",
    {
      annotations: { ...READ_ONLY, title: "Run widget" },
      description: `Run one saved widget with optional inputs and return its rows. Inputs not given use the widget's defaults. ${DATA_PREAMBLE}`,
      inputSchema: {
        inputs: WidgetInputs.optional(),
        widget: z
          .string()
          .min(1)
          .max(200)
          .describe("Widget id or exact name from list_widgets."),
      },
    },
    ({ widget: ref, inputs }, extra) =>
      call("run_widget", extra.signal, WIDGET_TIMEOUT_MS, async (ctx) => {
        const { connections, settings } = await exposed();
        const resolved = resolveWidget(
          ref,
          await deps.listWidgets(),
          connections
        );
        if (!resolved.ok) {
          throw resolved.code === "AMBIGUOUS"
            ? ambiguous(resolved.candidates)
            : notFound();
        }
        const widget = resolved.value;
        const connection = connections.find(
          (item) => item.id === connectionIdOf(widget)
        );
        if (!connection) {
          throw notFound();
        }
        ctx.audit.widgetId = widget.id;
        ctx.target(connection);
        const run = await deps.runWidget(widget.id, inputs ?? {}, ctx.signal);
        ctx.audit.sql = run.compiled.kind === "sql" ? run.compiled.sql : null;
        const shaped = shapeRows(run.result, {
          redact: redactionOf(connection),
          rowLimit: settings.rowLimit,
        });
        ctx.audit.rowCount = shaped.rowCount;
        return {
          connectionName: connection.name,
          payload: {
            widget: widget.name,
            ...shaped,
            executionTimeMs: run.result.executionTimeMs,
            inputs: run.values,
          },
        };
      })
  );
};
