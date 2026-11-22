import type { ProposeSourceTarget } from "@conch/agent";
import type {
  BindValue,
  DatabaseConnection,
  DialectType,
  Pool,
  TabularResult,
  TemplateValue,
} from "@conch/core";
import type { ConnectionPoolManager } from "@conch/drivers";
import type {
  CompiledSource,
  ExternalSource,
  HttpEndpointConfig,
  McpServerConfig,
  McpSource,
  ParamDef,
  ParamValues,
  Source,
  SourceTarget,
  SqlSource,
} from "@conch/rpc";

import { assertReadOnly } from "@conch/agent";
import {
  bindArgs,
  buildRequestUrl,
  compileSqlTemplate,
  DbError,
  maskTemplateInputs,
  raceWithCancel,
  toTabular,
} from "@conch/core";
import { isReadEligible, toTemplateValue } from "@conch/rpc";

import type { McpClientManager, McpToolInfo } from "./mcp-clients.ts";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
  tabular,
} from "./connection-access.ts";
import { sourceMissing, toolResultJson } from "./mcp-clients.ts";

export const SOURCE_MAX_ROWS = 2000;
export const SOURCE_TIMEOUT_MS = 30_000;

export const NOT_READ_ONLY_TOOL =
  "This tool can change data, so it can't feed a widget.";

export interface SourceRun {
  result: TabularResult & { executionTimeMs: number };
  compiled: CompiledSource;
}

export interface SourceRunInput {
  source: Source;
  params: readonly ParamDef[];
  values: ParamValues;
  now: Date;
}

export interface SourceRunnerDeps {
  pools: ConnectionPoolManager;
  mcp: Pick<McpClientManager, "listTools" | "callTool">;
  mcpServers: { get(id: string): Promise<McpServerConfig | null> };
  httpEndpoints: { get(id: string): Promise<HttpEndpointConfig | null> };
  fetchJson(
    endpoint: HttpEndpointConfig,
    url: URL,
    signal: AbortSignal
  ): Promise<unknown>;
}

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

export const templateValues = (
  params: readonly ParamDef[],
  values: ParamValues,
  now: Date
): Record<string, TemplateValue> =>
  Object.fromEntries(
    params.map((param) => [
      param.name,
      toTemplateValue(param, values[param.name] ?? param.default, now),
    ])
  );

export const guardTemplate = (template: string, dialect: DialectType): void => {
  const verdict = assertReadOnly(
    maskTemplateInputs(template, dialect, "NULL"),
    dialect
  );
  if (!verdict.ok) {
    throw failure("NOT_READ_ONLY", verdict.reason);
  }
};

const bindArgObject = (
  args: McpSource["args"],
  values: Record<string, TemplateValue>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, bindArgs(value, values)])
  );

// Drivers and SDKs reject with their own abort errors; a cancelled or timed
// out run reports why it stopped instead.
const abortReason = (signal: AbortSignal): DbError =>
  signal.reason instanceof DbError ? signal.reason : DbError.cancelled();

const timed = async <T>(work: () => Promise<T>) => {
  const started = performance.now();
  const value = await work();
  return { executionTimeMs: Math.round(performance.now() - started), value };
};

export const createSourceRunner = (deps: SourceRunnerDeps) => {
  const openConnection = async (
    source: SqlSource
  ): Promise<{
    connection: DatabaseConnection;
    pool: Pool;
    schema: string;
  }> => {
    const connection = await findConnection(source.connectionId);
    if (!connection) {
      throw failure(
        "CONNECTION_MISSING",
        "This widget's connection no longer exists. Choose a connection to run it on."
      );
    }
    const pool = await ensurePool(deps.pools, connection);
    if (!pool.dialect) {
      throw failure(
        "UNSUPPORTED_ENGINE",
        "Widgets work with SQL databases for now."
      );
    }
    const schema = await resolveSchemaName(pool, source.database, connection);
    return { connection, pool, schema };
  };

  const executeSql = async (
    source: SqlSource,
    sql: string,
    options: { maxRows: number; params?: BindValue[] },
    signal: AbortSignal
  ) => {
    const { pool, schema } = await openConnection(source);
    const { executionTimeMs, value } = await timed(async () =>
      tabular(
        await pool.execute(sql, options.maxRows, schema, signal, {
          params: options.params,
          readOnly: true,
        })
      )
    );
    return { ...value, executionTimeMs };
  };

  const requireServer = async (serverId: string): Promise<McpServerConfig> => {
    const server = await deps.mcpServers.get(serverId);
    if (!server) {
      throw sourceMissing();
    }
    return server;
  };

  const requireEndpoint = async (
    endpointId: string
  ): Promise<HttpEndpointConfig> => {
    const endpoint = await deps.httpEndpoints.get(endpointId);
    if (!endpoint) {
      throw sourceMissing();
    }
    return endpoint;
  };

  // Eligibility is checked on every run, so a server that stops calling a
  // tool read-only (or a user who unmarks it) takes effect right away.
  const readTool = async (
    server: McpServerConfig,
    toolName: string
  ): Promise<McpToolInfo> => {
    const tools = await deps.mcp.listTools(server.id);
    const tool = tools.find((item) => item.name === toolName);
    if (!tool) {
      throw failure(
        "TOOL_MISSING",
        `${server.name} no longer has a tool named ${toolName}.`
      );
    }
    if (!isReadEligible(tool, server)) {
      throw failure("TOOL_NOT_READ_ONLY", NOT_READ_ONLY_TOOL);
    }
    return tool;
  };

  const runSql = async (
    source: SqlSource,
    values: Record<string, TemplateValue>,
    signal: AbortSignal
  ): Promise<SourceRun> => {
    guardTemplate(source.sqlTemplate, source.dialect);
    const compiled = compileSqlTemplate(
      source.sqlTemplate,
      values,
      source.dialect
    );
    const result = await executeSql(
      source,
      compiled.sql,
      { maxRows: SOURCE_MAX_ROWS, params: compiled.params },
      signal
    );
    return { compiled: { kind: "sql", sql: compiled.sql }, result };
  };

  const runMcp = async (
    source: McpSource,
    values: Record<string, TemplateValue>,
    signal: AbortSignal
  ): Promise<SourceRun> => {
    const server = await requireServer(source.serverId);
    await readTool(server, source.tool);
    const args = bindArgObject(source.args, values);
    const { executionTimeMs, value } = await timed(() =>
      deps.mcp.callTool(server.id, source.tool, args, signal)
    );
    const result = toTabular(toolResultJson(value), source.select, {
      maxRows: SOURCE_MAX_ROWS,
    });
    return {
      compiled: { args, kind: "mcp", server: server.name, tool: source.tool },
      result: { ...result, executionTimeMs },
    };
  };

  const runHttp = async (
    source: Extract<ExternalSource, { kind: "http" }>,
    values: Record<string, TemplateValue>,
    signal: AbortSignal
  ): Promise<SourceRun> => {
    const endpoint = await requireEndpoint(source.endpointId);
    const url = buildRequestUrl(
      endpoint.baseUrl,
      source.path,
      source.query,
      values
    );
    const { executionTimeMs, value } = await timed(() =>
      deps.fetchJson(endpoint, url, signal)
    );
    const result = toTabular(value, source.select, {
      maxRows: SOURCE_MAX_ROWS,
    });
    return {
      compiled: { endpoint: endpoint.name, kind: "http", url: url.toString() },
      result: { ...result, executionTimeMs },
    };
  };

  const dispatch = (
    source: Source,
    values: Record<string, TemplateValue>,
    signal: AbortSignal
  ): Promise<SourceRun> => {
    switch (source.kind) {
      case "sql": {
        return runSql(source, values, signal);
      }
      case "mcp": {
        return runMcp(source, values, signal);
      }
      case "http": {
        return runHttp(source, values, signal);
      }
      default: {
        throw new Error(`Unknown source ${source satisfies never}`);
      }
    }
  };

  return {
    // Draft checks for MCP and HTTP: the source exists, the tool can be read
    // and the call builds with every input at its default.
    async check(
      source: ExternalSource,
      params: readonly ParamDef[],
      now: Date
    ) {
      const values = templateValues(params, {}, now);
      if (source.kind === "mcp") {
        await readTool(await requireServer(source.serverId), source.tool);
        bindArgObject(source.args, values);
        return;
      }
      const endpoint = await requireEndpoint(source.endpointId);
      buildRequestUrl(endpoint.baseUrl, source.path, source.query, values);
    },

    async proposalTarget(target: SourceTarget): Promise<ProposeSourceTarget> {
      if (target.type === "http") {
        const endpoint = await requireEndpoint(target.id);
        return {
          baseUrl: endpoint.baseUrl,
          endpointId: endpoint.id,
          kind: "http",
          name: endpoint.name,
        };
      }
      const server = await requireServer(target.id);
      const tools = await deps.mcp.listTools(server.id);
      return {
        kind: "mcp",
        serverId: server.id,
        serverName: server.name,
        tools: tools.map((tool) => ({
          description: tool.description,
          inputSchema: tool.inputSchema,
          name: tool.name,
          readEligible: isReadEligible(tool, server),
        })),
      };
    },

    readSql: (
      source: SqlSource,
      sql: string,
      maxRows: number,
      signal: AbortSignal
    ): Promise<TabularResult> => {
      const verdict = assertReadOnly(sql, source.dialect);
      if (!verdict.ok) {
        throw failure("NOT_READ_ONLY", verdict.reason);
      }
      return raceWithCancel(
        (merged) => executeSql(source, sql, { maxRows }, merged),
        { signal, timeoutMs: SOURCE_TIMEOUT_MS }
      );
    },

    run: (input: SourceRunInput, signal: AbortSignal): Promise<SourceRun> =>
      raceWithCancel(
        async (merged) => {
          try {
            return await dispatch(
              input.source,
              templateValues(input.params, input.values, input.now),
              merged
            );
          } catch (error) {
            throw merged.aborted ? abortReason(merged) : error;
          }
        },
        { signal, timeoutMs: SOURCE_TIMEOUT_MS }
      ),
  };
};

export type SourceRunner = ReturnType<typeof createSourceRunner>;
