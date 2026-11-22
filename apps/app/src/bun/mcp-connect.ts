import type { McpServerConfig } from "@conch/rpc";
import type {
  FetchLike,
  Transport,
} from "@modelcontextprotocol/sdk/shared/transport.js";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { McpConnection } from "./mcp-clients.ts";

import { searchPath } from "./command-path.ts";

const MAX_TOOL_PAGES = 5;

// The child gets a minimal environment plus what the user configured, never
// the app's own environment.
export const stdioEnvironment = (
  configured: Readonly<Record<string, string>>,
  base: Readonly<Record<string, string>> = getDefaultEnvironment()
): Record<string, string> => ({
  ...base,
  PATH: searchPath(base.PATH),
  ...configured,
});

// A redirect would carry the configured headers to another origin.
const noRedirectFetch: FetchLike = async (input, init) => {
  const response = await fetch(input, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const target = response.headers.get("location") ?? "another address";
    throw new Error(
      `The server redirected to ${target}; Conch doesn't follow redirects.`
    );
  }
  return response;
};

export const transportFor = (server: McpServerConfig): Transport =>
  server.transport === "stdio"
    ? new StdioClientTransport({
        args: server.args,
        command: server.command,
        env: stdioEnvironment(server.env),
        stderr: "ignore",
      })
    : new StreamableHTTPClientTransport(new URL(server.url), {
        fetch: noRedirectFetch,
        requestInit: { headers: server.headers },
      });

export const connectWith = async (
  transport: Transport,
  clientVersion: string
): Promise<McpConnection> => {
  const client = new Client({ name: "conch", version: clientVersion });
  await client.connect(transport);
  return {
    async callTool(tool, args, { signal, timeoutMs }) {
      return await client.callTool({ arguments: args, name: tool }, undefined, {
        signal,
        timeout: timeoutMs,
      });
    },
    close: () => client.close(),
    async listTools(signal) {
      const tools: unknown[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
        const listing = await client.listTools(
          cursor ? { cursor } : undefined,
          {
            signal,
          }
        );
        tools.push(...listing.tools);
        cursor = listing.nextCursor;
        if (!cursor) {
          break;
        }
      }
      return tools;
    },
  };
};

export const connectMcpServer =
  (clientVersion: string) =>
  (server: McpServerConfig): Promise<McpConnection> =>
    connectWith(transportFor(server), clientVersion);
