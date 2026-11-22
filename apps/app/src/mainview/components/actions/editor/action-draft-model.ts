import type { DialectType } from "@conch/core/client";

import {
  actionProblems,
  ActionTarget as ActionTargetSchema,
  DEFAULT_MAX_AFFECTED_ROWS,
  deriveEffect,
  placeholderNames,
} from "@conch/rpc";

import type { DatabaseConnection } from "@/lib/connections";
import type {
  ActionDraft,
  ActionEffect,
  ActionScope,
  ActionTarget,
  ActionTargetKind,
  BindSource,
  McpToolSummary,
  ParamDef,
} from "@/lib/ipc";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EditorState {
  id: string | null;
  label: string;
  scope: ActionScope;
  kind: ActionTargetKind;
  copy: { template: string };
  link: { baseUrl: string; path: string };
  sql: { connectionId: string; statement: string; maxRows: number };
  mcp: { serverId: string; tool: string; argsText: string };
  http: {
    endpointId: string;
    method: HttpMethod;
    path: string;
    bodyText: string;
  };
  bind: Record<string, BindSource>;
}

export interface EditorDefaults {
  connectionId: string;
  serverId: string;
  endpointId: string;
  scope: ActionScope;
}

const WRITE_DIALECTS: Partial<Record<DatabaseConnection["type"], DialectType>> =
  {
    duckdb: "duckdb",
    mssql: "tsql",
    mysql: "mysql",
    postgresql: "postgresql",
    sqlite: "sqlite",
  };

export const dialectForType = (
  type: DatabaseConnection["type"] | undefined
): DialectType | null => (type ? (WRITE_DIALECTS[type] ?? null) : null);

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export const emptyEditor = (defaults: EditorDefaults): EditorState => ({
  bind: {},
  copy: { template: "{{value}}" },
  http: {
    bodyText: "",
    endpointId: defaults.endpointId,
    method: "POST",
    path: "/",
  },
  id: null,
  kind: "sql",
  label: "",
  link: { baseUrl: "https://", path: "/{{id}}" },
  mcp: { argsText: "{}", serverId: defaults.serverId, tool: "" },
  scope: defaults.scope,
  sql: {
    connectionId: defaults.connectionId,
    maxRows: DEFAULT_MAX_AFFECTED_ROWS,
    statement: "",
  },
});

export const editorFromDraft = (
  draft: ActionDraft,
  defaults: EditorDefaults
): EditorState => {
  const base = {
    ...emptyEditor(defaults),
    bind: draft.bind,
    id: draft.id ?? null,
    kind: draft.target.kind,
    label: draft.label,
    scope: draft.scope,
  };
  const { target } = draft;
  switch (target.kind) {
    case "copy": {
      return { ...base, copy: { template: target.template } };
    }
    case "open-url": {
      return { ...base, link: { baseUrl: target.baseUrl, path: target.path } };
    }
    case "sql": {
      return {
        ...base,
        sql: {
          connectionId: target.connectionId,
          maxRows: target.maxAffectedRows,
          statement: target.statementTemplate,
        },
      };
    }
    case "mcp": {
      return {
        ...base,
        mcp: {
          argsText: json(target.args),
          serverId: target.serverId,
          tool: target.tool,
        },
      };
    }
    case "http": {
      return {
        ...base,
        http: {
          bodyText: target.body === null ? "" : json(target.body),
          endpointId: target.endpointId,
          method: target.method,
          path: target.path,
        },
      };
    }
    default: {
      throw new Error(`Unknown target ${target satisfies never}`);
    }
  }
};

const parseJson = (text: string, what: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what} isn't valid JSON.`);
  }
};

const rawTarget = (
  state: EditorState,
  connections: readonly DatabaseConnection[]
): unknown => {
  switch (state.kind) {
    case "copy": {
      return { kind: "copy", template: state.copy.template };
    }
    case "open-url": {
      return {
        baseUrl: state.link.baseUrl,
        kind: "open-url",
        path: state.link.path,
        query: {},
      };
    }
    case "sql": {
      const connection = connections.find(
        (item) => item.id === state.sql.connectionId
      );
      const dialect = dialectForType(connection?.type);
      if (!dialect) {
        throw new Error("Write actions aren't available for this database.");
      }
      return {
        connectionId: state.sql.connectionId,
        database: null,
        dialect,
        kind: "sql",
        maxAffectedRows: state.sql.maxRows,
        statementTemplate: state.sql.statement,
      };
    }
    case "mcp": {
      if (!state.mcp.serverId) {
        throw new Error("Add an MCP server in Settings first.");
      }
      if (!state.mcp.tool) {
        throw new Error("Choose a tool.");
      }
      return {
        args: parseJson(state.mcp.argsText || "{}", "The arguments"),
        kind: "mcp",
        serverId: state.mcp.serverId,
        tool: state.mcp.tool,
      };
    }
    case "http": {
      if (!state.http.endpointId) {
        throw new Error("Add an HTTP endpoint in Settings first.");
      }
      return {
        body: state.http.bodyText.trim()
          ? parseJson(state.http.bodyText, "The body")
          : null,
        endpointId: state.http.endpointId,
        kind: "http",
        method: state.http.method,
        path: state.http.path,
        query: {},
      };
    }
    default: {
      throw new Error(`Unknown target ${state.kind satisfies never}`);
    }
  }
};

export type TargetParse =
  | { ok: true; target: ActionTarget }
  | { ok: false; error: string };

export const targetOf = (
  state: EditorState,
  connections: readonly DatabaseConnection[]
): TargetParse => {
  let raw: unknown;
  try {
    raw = rawTarget(state, connections);
  } catch (error) {
    return { error: (error as Error).message, ok: false };
  }
  const parsed = ActionTargetSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, target: parsed.data }
    : {
        error: parsed.error.issues[0]?.message ?? "The target isn't complete.",
        ok: false,
      };
};

const defaultSource = (
  scope: ActionScope,
  columns: readonly string[]
): BindSource =>
  scope === "row" && columns[0]
    ? { column: columns[0], from: "row" }
    : { from: "literal", value: "" };

// Every placeholder gets a binding, kept from before when it still exists.
export const syncedBind = (
  names: readonly string[],
  bind: Readonly<Record<string, BindSource>>,
  scope: ActionScope,
  columns: readonly string[]
): Record<string, BindSource> =>
  Object.fromEntries(
    names.map((name) => {
      const current = bind[name];
      const usable = current && (current.from !== "row" || scope === "row");
      return [name, usable ? current : defaultSource(scope, columns)];
    })
  );

export const bindableInputs = (params: readonly ParamDef[]): ParamDef[] =>
  params.filter((param) => param.type !== "dateRange");

export interface DraftCheck {
  draft: ActionDraft | null;
  problem: string | null;
  names: string[];
}

// Ids chosen before the lists loaded fall back to the first loaded choice.
export const withDefaults = (
  state: EditorState,
  defaults: EditorDefaults
): EditorState => ({
  ...state,
  http: {
    ...state.http,
    endpointId: state.http.endpointId || defaults.endpointId,
  },
  mcp: { ...state.mcp, serverId: state.mcp.serverId || defaults.serverId },
  sql: {
    ...state.sql,
    connectionId: state.sql.connectionId || defaults.connectionId,
  },
});

export const checkDraft = (
  state: EditorState,
  connections: readonly DatabaseConnection[],
  columns: readonly string[]
): DraftCheck => {
  const parsed = targetOf(state, connections);
  if (!state.label.trim()) {
    const names = parsed.ok ? placeholderNames(parsed.target) : [];
    return { draft: null, names, problem: "Give the action a label." };
  }
  if (!parsed.ok) {
    return { draft: null, names: [], problem: parsed.error };
  }
  const names = placeholderNames(parsed.target);
  const bind = syncedBind(names, state.bind, state.scope, columns);
  const draft: ActionDraft = {
    bind,
    ...(state.id ? { id: state.id } : {}),
    label: state.label.trim(),
    scope: state.scope,
    target: parsed.target,
  };
  const [problem] = actionProblems(draft);
  return { draft: problem ? null : draft, names, problem: problem ?? null };
};

export const draftEffect = (
  target: ActionTarget,
  tools: readonly McpToolSummary[]
): ActionEffect =>
  deriveEffect(
    target,
    target.kind === "mcp"
      ? (tools.find((tool) => tool.name === target.tool)?.readOnlyHint ?? null)
      : null
  );
