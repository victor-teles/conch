import type {
  HttpEndpointConfig as HttpEndpointRecord,
  HttpEndpointInput as HttpEndpointInputValue,
  McpServerConfig as McpServerRecord,
  McpServerInput as McpServerInputValue,
  McpToolSummary,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  SetMcpToolReadRequest as SetMcpToolReadValue,
  SourceTestResult,
  Widget,
} from "@conch/rpc";

import { DbError } from "@conch/core";
import {
  HttpEndpointConfig,
  HttpEndpointInput,
  isReadEligible,
  McpServerConfig,
  McpServerInput,
  redactSecret,
  SetMcpToolReadRequest,
} from "@conch/rpc";
import { z } from "zod";

import type { McpClientManager } from "./mcp-clients.ts";
import type { ConfirmNative } from "./native-confirm.ts";

interface RecordStore<T> {
  get(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(record: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface SourceSettingsDeps {
  servers: RecordStore<McpServerRecord>;
  endpoints: RecordStore<HttpEndpointRecord>;
  mcp: Pick<McpClientManager, "listTools" | "invalidate">;
  probeHttp(endpoint: HttpEndpointRecord, signal: AbortSignal): Promise<number>;
  listWidgets(): Promise<Widget[]>;
  confirm: ConfirmNative;
  resolveCommand(command: string): string | null;
  now(): Date;
  newId(): string;
  elapsedMs(): number;
}

const TEST_TIMEOUT_MS = 15_000;
const idSchema = z.string().min(1).max(100);

const invalid = (message: string): DbError =>
  new DbError("INVALID_INPUT", message);

const shellQuote = (part: string): string =>
  /^[\w@%+=:,./-]+$/.test(part) ? part : `'${part.replaceAll("'", "'\\''")}'`;

export const commandLine = (command: string, args: readonly string[]): string =>
  [command, ...args].map(shellQuote).join(" ");

// A secret row without a value keeps what is stored under that name; rows
// left out are removed.
export const mergeSecrets = (
  rows: readonly { name: string; value?: string }[],
  current: Readonly<Record<string, string>>
): Record<string, string> => {
  const merged: Record<string, string> = {};
  for (const row of rows) {
    if (Object.hasOwn(merged, row.name)) {
      throw invalid(`${row.name} is listed twice.`);
    }
    const value =
      row.value ??
      (Object.hasOwn(current, row.name) ? current[row.name] : undefined);
    if (value === undefined || value === "") {
      throw invalid(`Enter a value for ${row.name}.`);
    }
    merged[row.name] = value;
  }
  return merged;
};

const redactMap = (map: Readonly<Record<string, string>>) =>
  Object.entries(map).map(([name, value]) => redactSecret(name, value));

const usersOf = (
  widgets: readonly Widget[],
  matches: (widget: Widget) => boolean
) => widgets.filter(matches).map((widget) => widget.name);

export const createSourceSettingsService = (deps: SourceSettingsDeps) => {
  const lastTests = new Map<string, SourceTestResult>();

  const redactServer = (server: McpServerRecord): RedactedMcpServer => {
    const base = {
      createdAt: server.createdAt,
      id: server.id,
      lastTest: lastTests.get(server.id) ?? null,
      name: server.name,
      readTools: server.readTools,
      updatedAt: server.updatedAt,
    };
    return server.transport === "stdio"
      ? {
          ...base,
          args: server.args,
          command: server.command,
          env: redactMap(server.env),
          transport: "stdio",
        }
      : {
          ...base,
          headers: redactMap(server.headers),
          transport: "http",
          url: server.url,
        };
  };

  const redactEndpoint = (
    endpoint: HttpEndpointRecord
  ): RedactedHttpEndpoint => ({
    auth:
      endpoint.auth.kind === "header"
        ? {
            kind: "header",
            ...redactSecret(endpoint.auth.name, endpoint.auth.value),
          }
        : { kind: "none" },
    baseUrl: endpoint.baseUrl,
    createdAt: endpoint.createdAt,
    id: endpoint.id,
    lastTest: lastTests.get(endpoint.id) ?? null,
    name: endpoint.name,
    updatedAt: endpoint.updatedAt,
  });

  const requireServer = async (serverId: string): Promise<McpServerRecord> => {
    const server = await deps.servers.get(idSchema.parse(serverId));
    if (!server) {
      throw new DbError("SOURCE_MISSING", "This MCP server no longer exists.");
    }
    return server;
  };

  const requireEndpoint = async (
    endpointId: string
  ): Promise<HttpEndpointRecord> => {
    const endpoint = await deps.endpoints.get(idSchema.parse(endpointId));
    if (!endpoint) {
      throw new DbError(
        "SOURCE_MISSING",
        "This HTTP endpoint no longer exists."
      );
    }
    return endpoint;
  };

  const resolvedCommand = (command: string): string => {
    const resolved = deps.resolveCommand(command);
    if (!resolved) {
      throw invalid(
        `Couldn't find ${command}. Use its full path, like /opt/homebrew/bin/${command}.`
      );
    }
    return resolved;
  };

  const buildServer = (
    input: McpServerInputValue,
    existing: McpServerRecord | null,
    stamps: { id: string; createdAt: string; updatedAt: string }
  ): McpServerRecord => {
    const readTools = existing?.readTools ?? [];
    if (input.transport === "stdio") {
      const current = existing?.transport === "stdio" ? existing.env : {};
      return McpServerConfig.parse({
        ...stamps,
        args: input.args,
        command: resolvedCommand(input.command),
        env: mergeSecrets(input.env, current),
        name: input.name,
        readTools,
        transport: "stdio",
      });
    }
    const current = existing?.transport === "http" ? existing.headers : {};
    return McpServerConfig.parse({
      ...stamps,
      headers: mergeSecrets(input.headers, current),
      name: input.name,
      readTools,
      transport: "http",
      url: input.url,
    });
  };

  const launchChanged = (
    next: McpServerRecord,
    existing: McpServerRecord | null
  ) => {
    if (!existing || existing.transport !== next.transport) {
      return true;
    }
    if (next.transport === "stdio" && existing.transport === "stdio") {
      return (
        commandLine(next.command, next.args) !==
        commandLine(existing.command, existing.args)
      );
    }
    return next.transport === "http" && existing.transport === "http"
      ? next.url !== existing.url
      : true;
  };

  const confirmLaunch = (server: McpServerRecord): Promise<boolean> =>
    server.transport === "stdio"
      ? deps.confirm({
          confirmLabel: "Allow",
          detail: commandLine(server.command, server.args),
          message: `Conch will start this command whenever a widget reads from ${server.name}.`,
          title: "Run this MCP server?",
        })
      : deps.confirm({
          confirmLabel: "Connect",
          detail: server.url,
          message: `Conch will connect to this address whenever a widget reads from ${server.name}.`,
          title: "Connect to this MCP server?",
        });

  const runTest = async (
    id: string,
    work: () => Promise<Omit<SourceTestResult, "latencyMs">>
  ): Promise<SourceTestResult> => {
    const started = deps.elapsedMs();
    let outcome: Omit<SourceTestResult, "latencyMs">;
    try {
      outcome = await work();
    } catch (error) {
      outcome = { message: DbError.fromUnknown(error).message, ok: false };
    }
    const result = {
      ...outcome,
      latencyMs: Math.round(deps.elapsedMs() - started),
    };
    lastTests.set(id, result);
    return result;
  };

  // A stored secret only stays with the origin it was entered for; moving
  // the endpoint to another host asks for it again.
  const headerAuth = (
    auth: HttpEndpointInputValue["auth"],
    existing: HttpEndpointRecord | null,
    baseUrl: string
  ): HttpEndpointRecord["auth"] => {
    if (auth.kind === "none") {
      return { kind: "none" };
    }
    const sameOrigin =
      existing !== null &&
      new URL(existing.baseUrl).origin === new URL(baseUrl).origin;
    const kept =
      sameOrigin &&
      existing.auth.kind === "header" &&
      existing.auth.name === auth.name
        ? existing.auth.value
        : undefined;
    const value = auth.value ?? kept;
    if (!value) {
      throw invalid(`Enter a value for ${auth.name}.`);
    }
    return { kind: "header", name: auth.name, value };
  };

  return {
    async deleteHttpEndpoint(
      endpointId: string
    ): Promise<{ widgetNames: string[] }> {
      const endpoint = await requireEndpoint(endpointId);
      await deps.endpoints.remove(endpoint.id);
      lastTests.delete(endpoint.id);
      const widgetNames = usersOf(
        await deps.listWidgets(),
        (widget) =>
          widget.source.kind === "http" &&
          widget.source.endpointId === endpoint.id
      );
      return { widgetNames };
    },

    async deleteMcpServer(
      serverId: string
    ): Promise<{ widgetNames: string[] }> {
      const server = await requireServer(serverId);
      await deps.servers.remove(server.id);
      deps.mcp.invalidate(server.id);
      lastTests.delete(server.id);
      const widgetNames = usersOf(
        await deps.listWidgets(),
        (widget) =>
          widget.source.kind === "mcp" && widget.source.serverId === server.id
      );
      return { widgetNames };
    },

    async listHttpEndpoints(): Promise<RedactedHttpEndpoint[]> {
      const endpoints = await deps.endpoints.list();
      return endpoints.map(redactEndpoint);
    },

    async listMcpServers(): Promise<RedactedMcpServer[]> {
      const servers = await deps.servers.list();
      return servers.map(redactServer);
    },

    async listMcpTools(serverId: string): Promise<McpToolSummary[]> {
      const server = await requireServer(serverId);
      const tools = await deps.mcp.listTools(server.id);
      return tools.map((tool) => ({
        description: tool.description,
        inputSchema: tool.inputSchema,
        markedRead: server.readTools.includes(tool.name),
        name: tool.name,
        readEligible: isReadEligible(tool, server),
        readOnlyHint: tool.annotations?.readOnlyHint ?? null,
        title: tool.title,
      }));
    },

    async saveHttpEndpoint(
      input: HttpEndpointInputValue
    ): Promise<RedactedHttpEndpoint> {
      const parsed = HttpEndpointInput.parse(input);
      const existing = parsed.id ? await deps.endpoints.get(parsed.id) : null;
      const stamp = deps.now().toISOString();
      const endpoint = HttpEndpointConfig.parse({
        auth: headerAuth(parsed.auth, existing, parsed.baseUrl),
        baseUrl: parsed.baseUrl,
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? deps.newId(),
        name: parsed.name,
        updatedAt: stamp,
      });
      lastTests.delete(endpoint.id);
      return redactEndpoint(await deps.endpoints.save(endpoint));
    },

    async saveMcpServer(
      input: McpServerInputValue
    ): Promise<RedactedMcpServer | null> {
      const parsed = McpServerInput.parse(input);
      const existing = parsed.id ? await deps.servers.get(parsed.id) : null;
      const stamp = deps.now().toISOString();
      const server = buildServer(parsed, existing, {
        createdAt: existing?.createdAt ?? stamp,
        id: existing?.id ?? deps.newId(),
        updatedAt: stamp,
      });
      if (launchChanged(server, existing) && !(await confirmLaunch(server))) {
        return null;
      }
      await deps.servers.save(server);
      deps.mcp.invalidate(server.id);
      lastTests.delete(server.id);
      return redactServer(server);
    },

    async setMcpToolRead(
      request: SetMcpToolReadValue
    ): Promise<RedactedMcpServer | null> {
      const { read, serverId, tool } = SetMcpToolReadRequest.parse(request);
      const server = await requireServer(serverId);
      const marked = server.readTools.includes(tool);
      if (read === marked) {
        return redactServer(server);
      }
      if (read) {
        const approved = await deps.confirm({
          confirmLabel: "Treat as Read",
          detail: `${server.name} › ${tool}\n\nOnly allow tools that never change data. Widgets call this tool every time they refresh.`,
          message: `${server.name} doesn't mark this tool read-only.`,
          title: `Treat “${tool}” as read?`,
        });
        if (!approved) {
          return null;
        }
      }
      const next = McpServerConfig.parse({
        ...server,
        readTools: read
          ? [...server.readTools, tool]
          : server.readTools.filter((name) => name !== tool),
        updatedAt: deps.now().toISOString(),
      });
      await deps.servers.save(next);
      return redactServer(next);
    },

    async testHttpEndpoint(endpointId: string): Promise<SourceTestResult> {
      const endpoint = await requireEndpoint(endpointId);
      return runTest(endpoint.id, async () => {
        const status = await deps.probeHttp(
          endpoint,
          AbortSignal.timeout(TEST_TIMEOUT_MS)
        );
        return status < 400
          ? { message: `Connected · ${status}`, ok: true }
          : { message: `${endpoint.name} answered ${status}.`, ok: false };
      });
    },

    async testMcpServer(serverId: string): Promise<SourceTestResult> {
      const server = await requireServer(serverId);
      deps.mcp.invalidate(server.id);
      return runTest(server.id, async () => {
        const tools = await deps.mcp.listTools(server.id);
        const readToolCount = tools.filter((tool) =>
          isReadEligible(tool, server)
        ).length;
        return {
          message: `Connected · ${tools.length} tools · ${readToolCount} read`,
          ok: true,
          readToolCount,
          toolCount: tools.length,
        };
      });
    },
  };
};

export type SourceSettingsService = ReturnType<
  typeof createSourceSettingsService
>;
