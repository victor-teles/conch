import type { BindValue, TemplateValue } from "@conch/core";
import type {
  ActionContext,
  ActionScope,
  ActionTarget,
  BindSource,
  BoundValue,
  CompiledAction,
  HttpEndpointConfig,
  ParamDef,
  ParamValues,
  Widget,
} from "@conch/rpc";

import {
  bindArgs,
  buildRequestUrl,
  collectParamRefs,
  compileSqlTemplate,
  DbError,
  pathParamRefs,
  redactPii,
} from "@conch/core";
import {
  paramValueSchema,
  targetPlaceholders,
  toTemplateValue,
} from "@conch/rpc";

import type { ResolvedCall } from "./action-executor.ts";
import type { CachedRow } from "./run-cache.ts";

const COPY_PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g;

export const runExpired = (): DbError =>
  new DbError("RUN_EXPIRED", "Run the widget again to act on its rows.");

const invalidInput = (message: string): DbError =>
  new DbError("INVALID_INPUT", message);

export const bindValueOf = (cell: unknown): BindValue => {
  if (cell === null || cell === undefined) {
    return null;
  }
  if (
    typeof cell === "string" ||
    typeof cell === "boolean" ||
    (typeof cell === "number" && Number.isFinite(cell))
  ) {
    return cell;
  }
  return JSON.stringify(cell);
};

interface BindAction {
  scope: ActionScope;
  target: ActionTarget;
  bind: Record<string, BindSource>;
}

// What an action acts for: a widget, or a mini-app whose cards list it.
export interface ActionOwner {
  id: string;
  noun: "widget" | "app";
  params: readonly ParamDef[];
  lastValues: ParamValues;
  ownsRun(runOwnerId: string): boolean;
}

export const widgetOwner = (widget: Widget): ActionOwner => ({
  id: widget.id,
  lastValues: widget.lastValues,
  noun: "widget",
  ownsRun: (runOwnerId) => runOwnerId === widget.id,
  params: widget.params,
});

export interface BindInputs {
  owner: ActionOwner;
  context: ActionContext;
  row: CachedRow | null;
  now: Date;
}

const rowValue = (
  name: string,
  column: string,
  { row, owner }: BindInputs
): BoundValue => {
  if (!(row && owner.ownsRun(row.ownerId))) {
    throw runExpired();
  }
  const index = row.columns.indexOf(column);
  if (index === -1) {
    throw new DbError(
      "COLUMN_MISSING",
      `The result no longer has a column named ${column}.`
    );
  }
  return {
    detail: `row.${column}`,
    from: "row",
    name,
    value: bindValueOf(row.row[index]),
  };
};

export const inputParam = (owner: ActionOwner, name: string): ParamDef => {
  const param = owner.params.find((item) => item.name === name);
  if (!param) {
    throw invalidInput(`The ${owner.noun} has no input named ${name}.`);
  }
  if (param.type === "dateRange") {
    throw invalidInput(
      `"${name}" is a date range; an action binds one value at a time.`
    );
  }
  return param;
};

const inputValue = (
  name: string,
  inputName: string,
  { context, now, owner }: BindInputs
): BoundValue => {
  const param = inputParam(owner, inputName);
  const raw = param.fixed
    ? param.default
    : (context.values[inputName] ??
      owner.lastValues[inputName] ??
      param.default);
  const parsed = paramValueSchema(param).safeParse(raw);
  if (!parsed.success) {
    throw invalidInput(
      parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
    );
  }
  const value = toTemplateValue(param, parsed.data, now);
  if (value.kind === "dateRange") {
    throw invalidInput(`"${inputName}" is a date range.`);
  }
  return {
    detail: `input ${param.label}`,
    from: "input",
    name,
    value: value.value,
  };
};

// Values in placeholder order, so the sheet lists them as the call reads.
export const resolveBinds = (
  action: BindAction,
  inputs: BindInputs
): BoundValue[] => {
  const names = [
    ...new Set(targetPlaceholders(action.target).map((item) => item.name)),
  ];
  return names.map((name) => {
    const source = action.bind[name];
    if (!source) {
      throw invalidInput(`Choose a value for "${name}".`);
    }
    switch (source.from) {
      case "row": {
        if (action.scope !== "row") {
          throw invalidInput(`"${name}" reads a row on a widget action.`);
        }
        return rowValue(name, source.column, inputs);
      }
      case "input": {
        return inputValue(name, source.name, inputs);
      }
      case "literal": {
        return {
          detail: "literal",
          from: "literal",
          name,
          value: source.value,
        };
      }
      default: {
        throw new Error(`Unknown binding ${source satisfies never}`);
      }
    }
  });
};

const asTemplateValues = (
  values: Readonly<Record<string, BindValue>>
): Record<string, TemplateValue> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      { kind: "value", value },
    ])
  );

const copyText = (value: BindValue | undefined): string =>
  value === null || value === undefined ? "" : String(value);

const assertUrlValues = (
  path: string,
  query: unknown,
  values: Readonly<Record<string, BindValue>>
): void => {
  const refs = [...pathParamRefs(path), ...collectParamRefs(query)];
  const empty = refs.find((ref) => (values[ref.$param] ?? null) === null);
  if (empty) {
    throw new DbError(
      "BIND_EMPTY",
      `"${empty.$param}" is empty, so the address can't be built.`
    );
  }
};

export interface CompiledCall {
  compiled: CompiledAction;
  call: ResolvedCall | null;
}

export const compileCall = (
  target: ActionTarget,
  values: Readonly<Record<string, BindValue>>,
  endpoint: HttpEndpointConfig | null
): CompiledCall => {
  const bound = asTemplateValues(values);
  switch (target.kind) {
    case "copy": {
      const text = target.template.replaceAll(
        COPY_PLACEHOLDER,
        (_match, name: string) => copyText(values[name])
      );
      return { call: null, compiled: { kind: "copy", text } };
    }
    case "open-url": {
      assertUrlValues(target.path, target.query, values);
      const url = buildRequestUrl(
        target.baseUrl,
        target.path,
        target.query,
        bound
      );
      if (url.protocol !== "https:") {
        throw new DbError("SOURCE_BAD_URL", "Links open https addresses only.");
      }
      const href = url.toString();
      return {
        call: { kind: "open-url", url: href },
        compiled: { kind: "open-url", url: href },
      };
    }
    case "sql": {
      const { params, sql } = compileSqlTemplate(
        target.statementTemplate,
        bound,
        target.dialect
      );
      return {
        call: {
          connectionId: target.connectionId,
          database: target.database,
          kind: "sql",
          maxAffectedRows: target.maxAffectedRows,
          params,
          statement: sql,
        },
        compiled: { kind: "sql", params, statement: sql },
      };
    }
    case "mcp": {
      const args = Object.fromEntries(
        Object.entries(target.args).map(([key, value]) => [
          key,
          bindArgs(value, bound),
        ])
      );
      return {
        call: {
          args,
          kind: "mcp",
          serverId: target.serverId,
          tool: target.tool,
        },
        compiled: { args, kind: "mcp", tool: target.tool },
      };
    }
    case "http": {
      if (!endpoint) {
        throw new DbError(
          "TARGET_MISSING",
          "This action's endpoint no longer exists."
        );
      }
      assertUrlValues(target.path, target.query, values);
      const url = buildRequestUrl(
        endpoint.baseUrl,
        target.path,
        target.query,
        bound
      ).toString();
      const body = target.body === null ? null : bindArgs(target.body, bound);
      return {
        call: {
          body,
          endpointId: target.endpointId,
          kind: "http",
          method: target.method,
          url,
        },
        compiled: { body, kind: "http", method: target.method, url },
      };
    }
    default: {
      throw new Error(`Unknown action target ${target satisfies never}`);
    }
  }
};

export const valuesOf = (
  bound: readonly BoundValue[]
): Record<string, BindValue> =>
  Object.fromEntries(bound.map((item) => [item.name, item.value]));

export interface RedactSettings {
  enabled: boolean;
  customPatterns?: string[];
}

export const redactDeep = (
  value: unknown,
  settings: RedactSettings
): unknown => {
  if (!settings.enabled) {
    return value;
  }
  if (typeof value === "string") {
    return redactPii(value, { customPatterns: settings.customPatterns }).text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, settings));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactDeep(item, settings),
      ])
    );
  }
  return value;
};
