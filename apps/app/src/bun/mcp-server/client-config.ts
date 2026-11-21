import type { McpClientKind } from "@conch/rpc";

export const MCP_SERVER_NAME = "conch";
export const MCP_TOKEN_ENV = "CONCH_MCP_TOKEN";

export interface ClientConfigInput {
  bunPath: string;
  bridgePath: string;
  socketPath: string;
  token: string;
}

const shellQuote = (value: string): string =>
  `'${value.replaceAll("'", String.raw`'\''`)}'`;

const jsonConfig = ({
  bunPath,
  bridgePath,
  socketPath,
  token,
}: ClientConfigInput): string =>
  JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          args: [bridgePath, "--socket", socketPath],
          command: bunPath,
          env: { [MCP_TOKEN_ENV]: token },
        },
      },
    },
    null,
    2
  );

const claudeCodeCommand = ({
  bunPath,
  bridgePath,
  socketPath,
  token,
}: ClientConfigInput): string =>
  [
    "claude mcp add",
    MCP_SERVER_NAME,
    "--scope user",
    `-e ${shellQuote(`${MCP_TOKEN_ENV}=${token}`)}`,
    "--",
    shellQuote(bunPath),
    shellQuote(bridgePath),
    "--socket",
    shellQuote(socketPath),
  ].join(" ");

// Cursor reads the same JSON from ~/.cursor/mcp.json; the UI says where.
export const clientConfig = (
  kind: McpClientKind,
  input: ClientConfigInput
): string =>
  kind === "claude-code" ? claudeCodeCommand(input) : jsonConfig(input);

const KNOWN_CLIENTS: Record<string, string> = {
  "claude-ai": "Claude Desktop",
  "claude-code": "Claude Code",
  "cursor-vscode": "Cursor",
};

export const displayClientName = (name: string): string => {
  const trimmed = name.trim().slice(0, 100);
  return KNOWN_CLIENTS[trimmed.toLowerCase()] ?? (trimmed || "unknown");
};
