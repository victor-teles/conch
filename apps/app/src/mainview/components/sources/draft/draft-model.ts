import { ExternalSource, McpArgs } from "@conch/rpc";

import type {
  ExternalSource as ExternalSourceValue,
  QueryLeaf,
  SourceTarget,
} from "@/lib/ipc";

export interface QueryRow {
  key: string;
  name: string;
  value: string;
}

export type CallFields =
  | { kind: "mcp"; tool: string; argsText: string; select: string }
  | { kind: "http"; path: string; query: QueryRow[]; select: string };

export type BuiltSource =
  | { ok: true; source: ExternalSourceValue }
  | { ok: false; message: string };

export const newQueryRow = (name = "", value = ""): QueryRow => ({
  key: crypto.randomUUID(),
  name,
  value,
});

export const emptyFields = (target: SourceTarget): CallFields =>
  target.type === "mcp"
    ? { argsText: "{}", kind: "mcp", select: "$", tool: "" }
    : { kind: "http", path: "/", query: [], select: "$" };

const REFERENCE = /^\{\{\s*([a-z][a-z0-9_]{0,31})(?:\.(from|to))?\s*\}\}$/;

// In a query row, {{name}} binds an input; anything else is sent as typed.
const leafOf = (text: string): QueryLeaf => {
  const [, name, part] = REFERENCE.exec(text.trim()) ?? [];
  if (!name) {
    return text;
  }
  return part === "from" || part === "to"
    ? { $param: name, part }
    : { $param: name };
};

const textOf = (leaf: QueryLeaf): string =>
  typeof leaf === "object"
    ? `{{${leaf.$param}${leaf.part ? `.${leaf.part}` : ""}}}`
    : String(leaf);

export const fieldsOf = (source: ExternalSourceValue): CallFields =>
  source.kind === "mcp"
    ? {
        argsText: JSON.stringify(source.args, null, 2),
        kind: "mcp",
        select: source.select,
        tool: source.tool,
      }
    : {
        kind: "http",
        path: source.path,
        query: Object.entries(source.query).map(([name, leaf]) =>
          newQueryRow(name, textOf(leaf))
        ),
        select: source.select,
      };

const parseArgs = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const argsProblem = (text: string): string | null => {
  const parsed = parseArgs(text);
  if (parsed === undefined) {
    return "The arguments aren't valid JSON.";
  }
  const checked = McpArgs.safeParse(parsed);
  return checked.success
    ? null
    : (checked.error.issues[0]?.message ?? "The arguments aren't valid.");
};

const candidateOf = (target: SourceTarget, fields: CallFields): unknown => {
  if (fields.kind === "mcp") {
    return {
      args: parseArgs(fields.argsText),
      kind: "mcp",
      select: fields.select.trim(),
      serverId: target.id,
      tool: fields.tool,
    };
  }
  return {
    endpointId: target.id,
    kind: "http",
    method: "GET",
    path: fields.path.trim(),
    query: Object.fromEntries(
      fields.query
        .filter((row) => row.name.trim() !== "")
        .map((row) => [row.name.trim(), leafOf(row.value)])
    ),
    select: fields.select.trim(),
  };
};

export const buildSource = (
  target: SourceTarget,
  fields: CallFields
): BuiltSource => {
  if (fields.kind === "mcp") {
    if (!fields.tool) {
      return { message: "Choose a tool.", ok: false };
    }
    const problem = argsProblem(fields.argsText);
    if (problem) {
      return { message: problem, ok: false };
    }
  }
  const parsed = ExternalSource.safeParse(candidateOf(target, fields));
  return parsed.success
    ? { ok: true, source: parsed.data }
    : {
        message: parsed.error.issues[0]?.message ?? "The call isn't valid.",
        ok: false,
      };
};
