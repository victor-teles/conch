// oxlint-disable jest/require-hook -- a standalone server process the tests spawn, not a test file
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "stdio-fixture", version: "1.0.0" });

server.registerTool(
  "environment",
  {
    annotations: { readOnlyHint: true },
    description: "Report which environment variables the process can see.",
  },
  () => {
    const env = {
      fixtureToken: process.env.FIXTURE_TOKEN ?? null,
      hasPath: typeof process.env.PATH === "string",
      parentSecret: process.env.CONCH_PARENT_SECRET ?? null,
    };
    return {
      content: [{ text: JSON.stringify(env), type: "text" }],
      structuredContent: env,
    };
  }
);

await server.connect(new StdioServerTransport());
