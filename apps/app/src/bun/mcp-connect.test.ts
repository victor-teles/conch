// @vitest-environment node
import type { McpServerConfig } from "@conch/rpc";

import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { COMMON_BIN_DIRS, resolveCommand, searchPath } from "./command-path.ts";
import { connectWith, stdioEnvironment, transportFor } from "./mcp-connect.ts";

const FIXTURE = fileURLToPath(
  new URL("test-stdio-server.mjs", import.meta.url)
);

const stdioServer: McpServerConfig = {
  args: [FIXTURE],
  command: process.execPath,
  createdAt: "",
  env: { FIXTURE_TOKEN: "configured-token" },
  id: "stdio",
  name: "Fixture",
  readTools: [],
  transport: "stdio",
  updatedAt: "",
};

describe("stdio servers", () => {
  afterEach(() => {
    delete process.env.CONCH_PARENT_SECRET;
  });

  it("spawns the command with only a minimal environment plus its own values", async () => {
    process.env.CONCH_PARENT_SECRET = "never-inherited";
    const connection = await connectWith(transportFor(stdioServer), "test");
    try {
      const tools = await connection.listTools(AbortSignal.timeout(10_000));
      expect(tools).toMatchObject([
        { annotations: { readOnlyHint: true }, name: "environment" },
      ]);
      const result = await connection.callTool(
        "environment",
        {},
        {
          signal: AbortSignal.timeout(10_000),
          timeoutMs: 10_000,
        }
      );
      expect(result).toMatchObject({
        structuredContent: {
          fixtureToken: "configured-token",
          hasPath: true,
          parentSecret: null,
        },
      });
    } finally {
      await connection.close();
    }
  }, 20_000);

  it("puts the common install folders on the child's PATH", () => {
    const env = stdioEnvironment(
      { API_KEY: "k" },
      { HOME: "/Users/me", PATH: "/usr/bin" }
    );
    expect(env).toStrictEqual({
      API_KEY: "k",
      HOME: "/Users/me",
      PATH: [...COMMON_BIN_DIRS].join(":"),
    });
    expect(
      stdioEnvironment({ PATH: "/custom" }, { PATH: "/usr/bin" }).PATH
    ).toBe("/custom");
  });
});

const which = (command: string, { PATH }: { PATH: string }) =>
  command === "npx" && PATH.startsWith("/opt/homebrew/bin")
    ? "/opt/homebrew/bin/npx"
    : null;

describe("resolveCommand", () => {
  it("resolves bare commands over the common folders and the user's PATH", () => {
    expect(resolveCommand("npx", "/Users/me/bin", which)).toBe(
      "/opt/homebrew/bin/npx"
    );
    expect(searchPath("/Users/me/bin:/usr/bin")).toBe(
      "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/me/bin"
    );
  });

  it("keeps absolute paths and refuses relative ones", () => {
    expect(resolveCommand("/usr/local/bin/mcp", undefined, which)).toBe(
      "/usr/local/bin/mcp"
    );
    expect(resolveCommand("./mcp", undefined, which)).toBeNull();
    expect(resolveCommand("missing", undefined, which)).toBeNull();
  });
});
