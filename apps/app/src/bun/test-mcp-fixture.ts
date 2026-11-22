import type { McpServerConfig } from "@conch/rpc";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpConnection } from "./mcp-clients.ts";

import { connectWith } from "./mcp-connect.ts";

export const DISPUTES = [
  { amount: 1200, id: "dp_1", status: "needs_response" },
  { amount: 450, id: "dp_2", status: "won" },
];

export const STRIPE_SERVER: Extract<McpServerConfig, { transport: "stdio" }> = {
  args: ["--read-only"],
  command: "/opt/homebrew/bin/stripe-mcp",
  createdAt: "2026-11-20T00:00:00.000Z",
  env: { STRIPE_KEY: "sk_test_fixture_secret_9999" },
  id: "stripe",
  name: "Stripe",
  readTools: [],
  transport: "stdio",
  updatedAt: "2026-11-20T00:00:00.000Z",
};

export interface FixtureCall {
  tool: string;
  args: unknown;
}

// A real MCP server over an in-memory transport: one read tool, one write
// tool, one tool without annotations and one that answers with prose.
export const createFixtureMcp = (listReadOnly = true) => {
  const state = { listReadOnly };
  const calls: FixtureCall[] = [];
  let connects = 0;

  const build = () => {
    const server = new McpServer({ name: "fixture", version: "1.0.0" });
    server.registerTool(
      "list_disputes",
      {
        annotations: { readOnlyHint: state.listReadOnly },
        description: "List disputes by status.",
        inputSchema: {
          limit: z.number().optional(),
          period: z.object({ from: z.string(), to: z.string() }).optional(),
          status: z.string(),
        },
      },
      (args) => {
        calls.push({ args, tool: "list_disputes" });
        const data = DISPUTES.filter((item) => item.status === args.status);
        return {
          content: [{ text: JSON.stringify({ data }), type: "text" }],
          structuredContent: { data, has_more: false },
        };
      }
    );
    server.registerTool(
      "refund_charge",
      {
        annotations: { destructiveHint: true, readOnlyHint: false },
        description: "Refund a charge.",
        inputSchema: { charge: z.string() },
      },
      (args) => {
        calls.push({ args, tool: "refund_charge" });
        return { content: [{ text: "refunded", type: "text" }] };
      }
    );
    server.registerTool(
      "search_customers",
      { description: "Search customers.", inputSchema: { q: z.string() } },
      (args) => {
        calls.push({ args, tool: "search_customers" });
        return {
          content: [
            {
              text: JSON.stringify([{ email: "ada@example.com" }]),
              type: "text",
            },
          ],
        };
      }
    );
    server.registerTool(
      "greet",
      { annotations: { readOnlyHint: true }, description: "Say hi." },
      () => ({ content: [{ text: "Hello there", type: "text" }] })
    );
    server.registerTool(
      "broken",
      { annotations: { readOnlyHint: true }, description: "Always fails." },
      () => ({
        content: [{ text: "Upstream rate limit reached", type: "text" }],
        isError: true,
      })
    );
    return server;
  };

  const connect = async (_server: McpServerConfig): Promise<McpConnection> => {
    connects += 1;
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await build().connect(serverSide);
    return connectWith(clientSide, "test");
  };

  return { calls, connect, connects: () => connects, state };
};
