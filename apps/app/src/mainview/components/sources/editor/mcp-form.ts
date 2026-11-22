import type { McpServerInput, RedactedMcpServer } from "@/lib/ipc";

import type { SecretRowState } from "./secret-form";

import { secretInputs, secretRowsOf } from "./secret-form";

export type McpTransport = "stdio" | "http";

export interface McpFormState {
  name: string;
  transport: McpTransport;
  command: string;
  args: string;
  url: string;
  secrets: SecretRowState[];
}

export const mcpFormOf = (server: RedactedMcpServer | null): McpFormState => {
  if (!server) {
    return {
      args: "",
      command: "",
      name: "",
      secrets: [],
      transport: "stdio",
      url: "",
    };
  }
  return server.transport === "stdio"
    ? {
        args: server.args.join("\n"),
        command: server.command,
        name: server.name,
        secrets: secretRowsOf(server.env),
        transport: "stdio",
        url: "",
      }
    : {
        args: "",
        command: "",
        name: server.name,
        secrets: secretRowsOf(server.headers),
        transport: "http",
        url: server.url,
      };
};

// One argument per line, so arguments may contain spaces.
const argsOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

export const mcpInputOf = (
  form: McpFormState,
  id: string | null
): McpServerInput => {
  const base = { name: form.name.trim(), ...(id ? { id } : {}) };
  return form.transport === "stdio"
    ? {
        ...base,
        args: argsOf(form.args),
        command: form.command.trim(),
        env: secretInputs(form.secrets),
        transport: "stdio",
      }
    : {
        ...base,
        headers: secretInputs(form.secrets),
        transport: "http",
        url: form.url.trim(),
      };
};

export const mcpFormProblem = (form: McpFormState): string | null => {
  if (!form.name.trim()) {
    return "Give the server a name.";
  }
  if (form.transport === "stdio" && !form.command.trim()) {
    return "Enter the command that starts the server.";
  }
  if (form.transport === "http" && !form.url.trim()) {
    return "Enter the server's URL.";
  }
  return null;
};
