import type { CatalogConnection, SourceCatalog } from "@conch/agent";
import type { DatabaseConnection, DialectType, SchemaInfo } from "@conch/core";
import type { HttpEndpointConfig, McpServerConfig } from "@conch/rpc";

import type { McpToolInfo } from "./mcp-clients.ts";
import type {
  CatalogRequest,
  GenerationCatalog,
} from "./mini-app-gen-service.ts";

export interface OpenedSchema {
  dialect: DialectType | null;
  database: string;
  schema: SchemaInfo;
}

export interface CatalogDeps {
  findConnection(id: string): Promise<DatabaseConnection | null>;
  openSchema(
    connection: DatabaseConnection,
    database: string | null
  ): Promise<OpenedSchema>;
  listServers(): Promise<McpServerConfig[]>;
  listTools(serverId: string): Promise<McpToolInfo[]>;
  listEndpoints(): Promise<HttpEndpointConfig[]>;
  isAllowed(kind: "connection" | "mcp" | "http", id: string): Promise<boolean>;
}

const catalogConnection = async (
  deps: CatalogDeps,
  { connectionId, database }: CatalogRequest
): Promise<CatalogConnection | null> => {
  const connection = connectionId
    ? await deps.findConnection(connectionId)
    : null;
  if (!connection) {
    return null;
  }
  const opened = await deps.openSchema(connection, database);
  if (!opened.dialect) {
    return null;
  }
  return {
    database: database ?? null,
    dialect: opened.dialect,
    id: connection.id,
    name: connection.name,
    redact: {
      customPatterns: connection.customPiiPatterns ?? [],
      enabled: Boolean(connection.piiRedaction),
    },
    schema: opened.schema,
  };
};

// A server that can't list its tools right now is left out rather than
// failing the whole build.
const serverTools = async (deps: CatalogDeps, server: McpServerConfig) => {
  try {
    const tools = await deps.listTools(server.id);
    return {
      id: server.id,
      name: server.name,
      tools: tools.map((tool) => ({
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint ?? null,
      })),
    };
  } catch (error) {
    console.error(
      `[apps] ${server.name} could not list tools: ${String(error)}`
    );
    return null;
  }
};

// The model sees where an endpoint lives, never its credentials: auth
// headers stay out entirely and a base URL loses any userinfo or query.
export const promptSafeUrl = (baseUrl: string): string => {
  if (!URL.canParse(baseUrl)) {
    return "";
  }
  const url = new URL(baseUrl);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const buildGenerationCatalog = async (
  deps: CatalogDeps,
  request: CatalogRequest
): Promise<GenerationCatalog> => {
  const [connection, servers, endpoints] = await Promise.all([
    catalogConnection(deps, request),
    deps.listServers(),
    deps.listEndpoints(),
  ]);
  const listed = await Promise.all(
    servers.map((server) => serverTools(deps, server))
  );
  const mcpServers = listed.filter((server) => server !== null);
  const catalog: SourceCatalog = {
    connection,
    httpEndpoints: endpoints.map(({ baseUrl, id, name }) => ({
      baseUrl: promptSafeUrl(baseUrl),
      id,
      name,
    })),
    mcpServers,
  };
  const allowed = async (
    kind: "connection" | "mcp" | "http",
    item: { id: string; name: string }
  ) => ({
    id: item.id,
    name: item.name,
    writesAllowed: await deps.isAllowed(kind, item.id),
  });
  return {
    actionTargets: {
      connections: connection ? [await allowed("connection", connection)] : [],
      httpEndpoints: await Promise.all(
        endpoints.map((endpoint) => allowed("http", endpoint))
      ),
      mcpServers: await Promise.all(
        mcpServers.map((server) => allowed("mcp", server))
      ),
    },
    catalog,
  };
};
