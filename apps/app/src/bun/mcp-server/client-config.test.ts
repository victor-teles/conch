import { describe, expect, it } from "vitest";

import { clientConfig, displayClientName } from "./client-config.ts";

const INPUT = {
  bridgePath:
    "/Applications/Conch Beta.app/Contents/Resources/app/bun/mcp-bridge.js",
  bunPath: "/Applications/Conch Beta.app/Contents/MacOS/bun",
  socketPath: "/Users/ada/.config/conch/run/mcp.sock",
  token: "tok_abc'def",
};

describe("clientConfig", () => {
  it("builds JSON that parses and names the socket", () => {
    const parsed: unknown = JSON.parse(clientConfig("json", INPUT));
    expect(parsed).toStrictEqual({
      mcpServers: {
        conch: {
          args: [INPUT.bridgePath, "--socket", INPUT.socketPath],
          command: INPUT.bunPath,
          env: { CONCH_MCP_TOKEN: INPUT.token },
        },
      },
    });
    expect(clientConfig("cursor", INPUT)).toBe(clientConfig("json", INPUT));
  });

  it("quotes paths with spaces in the Claude Code command", () => {
    expect(clientConfig("claude-code", INPUT)).toBe(
      String.raw`claude mcp add conch --scope user -e 'CONCH_MCP_TOKEN=tok_abc'\''def' -- '/Applications/Conch Beta.app/Contents/MacOS/bun' '/Applications/Conch Beta.app/Contents/Resources/app/bun/mcp-bridge.js' --socket '/Users/ada/.config/conch/run/mcp.sock'`
    );
  });
});

describe("displayClientName", () => {
  it.each([
    ["claude-code", "Claude Code"],
    ["Cursor-VSCode", "Cursor"],
    ["  my-agent  ", "my-agent"],
    ["", "unknown"],
  ])("shows %s as %s", (name, expected) => {
    expect(displayClientName(name)).toBe(expected);
  });
});
