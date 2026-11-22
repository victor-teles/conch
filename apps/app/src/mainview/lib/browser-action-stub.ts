import type { TabularResult, TemplateValue } from "@conch/core/client";
import type {
  ActionActivity,
  ActionActivityPage,
  ActionContext,
  ActionDraft as ActionDraftValue,
  ActionOutcome,
  ActionPreview,
  ActionProposal,
  ActionReview,
  ActionTarget,
  BindValue,
  BoundValue,
  CompiledAction,
  ListedAction,
  McpToolSummary,
  ProposeActionRequest,
  Widget,
  WidgetAction as WidgetActionValue,
  WriteTargetKind,
} from "@conch/rpc";

import {
  bindArgs,
  buildRequestUrl,
  compileSqlTemplate,
  DbError,
} from "@conch/core/client";
import {
  ActionDraft,
  deriveEffect,
  isAudited,
  rowsPhrase,
  targetPlaceholders,
  toTemplateValue,
  WidgetAction,
  writeTargetOf,
} from "@conch/rpc";

const ACTIONS_KEY = "conch-actions";
const PERMISSIONS_KEY = "conch-write-permissions";
const ACTIVITY_KEY = "conch-action-activity";
const TOKEN_TTL_MS = 120_000;
const RUN_MS = 260;
const COPY_PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g;

const failure = (code: string, message: string) => new DbError(code, message);

const wait = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

const readList = <T>(key: string, parse: (raw: unknown) => T | null): T[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.flatMap((raw) => {
          const item = parse(raw);
          return item === null ? [] : [item];
        })
      : [];
  } catch {
    return [];
  }
};

const write = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

const parseAction = (raw: unknown) => WidgetAction.safeParse(raw).data ?? null;
const asString = (raw: unknown) => (typeof raw === "string" ? raw : null);
const asActivity = (raw: unknown) =>
  typeof raw === "object" && raw !== null ? (raw as ActionActivity) : null;

const stubHash = (text: string): string => {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return hash.toString(16).padStart(64, "0").slice(-64);
};

const stubToken = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 22);

interface StubTargets {
  widgetById(id: string): Widget | null;
  connectionName(id: string): { name: string; environment: string | null };
  serverName(id: string): string | null;
  toolsOf(serverId: string): McpToolSummary[];
  endpointOf(id: string): { name: string; baseUrl: string } | null;
}

interface StubRun {
  widgetId: string;
  columns: string[];
  rows: unknown[][];
}

interface StubPending {
  action: WidgetActionValue;
  review: ActionReview;
}

const cellValue = (cell: unknown): BindValue => {
  if (cell === null || cell === undefined) {
    return null;
  }
  return typeof cell === "object" ? JSON.stringify(cell) : (cell as BindValue);
};

const outcomeOf = (pending: StubPending): ActionOutcome => {
  const { compiled } = pending.review;
  switch (compiled.kind) {
    case "sql": {
      return {
        affectedRows: 1,
        durationMs: 42,
        ok: true,
        summary: "1 row changed",
      };
    }
    case "open-url": {
      return { durationMs: 3, ok: true, summary: "Opened in browser" };
    }
    case "http": {
      return {
        durationMs: 88,
        ok: true,
        status: 200,
        summary: `${compiled.method} answered 200`,
      };
    }
    default: {
      return {
        durationMs: 64,
        ok: true,
        summary: `${pending.action.label} finished`,
      };
    }
  }
};
// Browser mode stands in for bun so e2e can walk the flow; every native
// dialog is treated as accepted and nothing leaves the page.
export const createActionEmulator = (
  targets: StubTargets,
  now: () => Date = () => new Date()
) => {
  const runs = new Map<string, StubRun>();
  const tokens = new Map<string, StubPending & { expiresAt: number }>();
  const actions = () => readList(ACTIONS_KEY, parseAction);
  const permissions = () => readList(PERMISSIONS_KEY, asString);

  const hintOf = (target: ActionTarget): boolean | null => {
    if (target.kind !== "mcp") {
      return null;
    }
    const tool = targets
      .toolsOf(target.serverId)
      .find((item) => item.name === target.tool);
    return tool?.readOnlyHint ?? null;
  };

  const summaryOf = (target: ActionTarget) => {
    switch (target.kind) {
      case "copy": {
        return { environment: null, kind: target.kind, name: "Clipboard" };
      }
      case "open-url": {
        return {
          environment: null,
          kind: target.kind,
          name: new URL(target.baseUrl).host,
        };
      }
      case "sql": {
        return {
          kind: target.kind,
          ...targets.connectionName(target.connectionId),
        };
      }
      case "mcp": {
        return {
          environment: null,
          kind: target.kind,
          name: targets.serverName(target.serverId) ?? target.serverId,
        };
      }
      case "http": {
        return {
          environment: null,
          kind: target.kind,
          name: targets.endpointOf(target.endpointId)?.name ?? "API",
        };
      }
      default: {
        throw new Error(`Unknown target ${target satisfies never}`);
      }
    }
  };

  const bindOne = (
    name: string,
    action: Pick<WidgetActionValue, "bind">,
    widget: Widget,
    context: ActionContext
  ): BoundValue => {
    const source = action.bind[name];
    if (!source) {
      throw failure("INVALID_INPUT", `Choose a value for "${name}".`);
    }
    if (source.from === "literal") {
      return { detail: "literal", from: "literal", name, value: source.value };
    }
    if (source.from === "row") {
      const run = runs.get(context.runId);
      const row =
        context.rowIndex === null ? null : run?.rows[context.rowIndex];
      if (!(run && row) || run.widgetId !== widget.id) {
        throw failure(
          "RUN_EXPIRED",
          "Run the widget again to act on its rows."
        );
      }
      return {
        detail: `row.${source.column}`,
        from: "row",
        name,
        value: cellValue(row[run.columns.indexOf(source.column)]),
      };
    }
    const param = widget.params.find((item) => item.name === source.name);
    if (!param || param.type === "dateRange") {
      throw failure(
        "INVALID_INPUT",
        `The widget has no input named ${source.name}.`
      );
    }
    const value = toTemplateValue(
      param,
      context.values[source.name] ??
        widget.lastValues[source.name] ??
        param.default,
      now()
    );
    return {
      detail: `input ${param.label}`,
      from: "input",
      name,
      value: value.kind === "dateRange" ? null : value.value,
    };
  };

  const compile = (
    target: ActionTarget,
    bound: readonly BoundValue[]
  ): CompiledAction => {
    const values = Object.fromEntries(
      bound.map((item) => [item.name, item.value])
    );
    const asTemplate: Record<string, TemplateValue> = Object.fromEntries(
      bound.map((item) => [item.name, { kind: "value", value: item.value }])
    );
    switch (target.kind) {
      case "copy": {
        return {
          kind: "copy",
          text: target.template.replaceAll(
            COPY_PLACEHOLDER,
            (_m, key: string) => String(values[key] ?? "")
          ),
        };
      }
      case "open-url": {
        return {
          kind: "open-url",
          url: buildRequestUrl(
            target.baseUrl,
            target.path,
            target.query,
            asTemplate
          ).toString(),
        };
      }
      case "sql": {
        const { params, sql } = compileSqlTemplate(
          target.statementTemplate,
          asTemplate,
          target.dialect
        );
        return { kind: "sql", params, statement: sql };
      }
      case "mcp": {
        return {
          args: bindArgs(target.args, asTemplate),
          kind: "mcp",
          tool: target.tool,
        };
      }
      case "http": {
        const base =
          targets.endpointOf(target.endpointId)?.baseUrl ??
          "https://api.example.com";
        return {
          body: target.body === null ? null : bindArgs(target.body, asTemplate),
          kind: "http",
          method: target.method,
          url: buildRequestUrl(
            base,
            target.path,
            target.query,
            asTemplate
          ).toString(),
        };
      }
      default: {
        throw new Error(`Unknown target ${target satisfies never}`);
      }
    }
  };

  const review = (
    action: Pick<WidgetActionValue, "bind" | "label" | "scope" | "target">,
    widget: Widget,
    context: ActionContext
  ): ActionReview => {
    const names = [
      ...new Set(targetPlaceholders(action.target).map((item) => item.name)),
    ];
    const bound = names.map((name) => bindOne(name, action, widget, context));
    return {
      bound,
      compiled: compile(action.target, bound),
      effect: deriveEffect(action.target, hintOf(action.target)),
      label: action.label,
      limits:
        action.target.kind === "sql"
          ? { maxAffectedRows: action.target.maxAffectedRows }
          : {},
      target: summaryOf(action.target),
    };
  };

  const listed = (action: WidgetActionValue): ListedAction => {
    const summary = summaryOf(action.target);
    const { target } = action;
    const subtitles: Record<ActionTarget["kind"], string> = {
      copy: "Copies to the clipboard",
      http:
        target.kind === "http"
          ? `${target.method} ${summary.name}${target.path}`
          : "",
      mcp:
        target.kind === "mcp" ? `Calls ${target.tool} on ${summary.name}` : "",
      "open-url":
        target.kind === "open-url" ? `${summary.name}${target.path}` : "",
      sql:
        target.kind === "sql"
          ? `Writes to ${summary.name} · at most ${rowsPhrase(target.maxAffectedRows)}`
          : "",
    };
    return {
      action,
      effect: deriveEffect(target, hintOf(target)),
      subtitle: subtitles[target.kind],
      targetName: summary.name,
    };
  };

  const requireWidget = (id: string): Widget => {
    const widget = targets.widgetById(id);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const recordActivity = (pending: StubPending, outcome: ActionOutcome) => {
    const entry: ActionActivity = {
      actionLabel: pending.action.label,
      at: now().toISOString(),
      bound: pending.review.bound,
      compiled: pending.review.compiled,
      durationMs: outcome.durationMs,
      effect: pending.review.effect,
      environment: pending.review.target.environment,
      executionId: crypto.randomUUID(),
      outcome,
      status: outcome.ok ? "ok" : "failed",
      targetKind: pending.review.target.kind,
      targetName: pending.review.target.name,
      widgetId: pending.action.widgetId,
    };
    write(ACTIVITY_KEY, [entry, ...readList(ACTIVITY_KEY, asActivity)]);
  };

  return {
    deleteAction: ({ actionId }: { actionId: string }) =>
      write(
        ACTIONS_KEY,
        actions().filter((action) => action.id !== actionId)
      ),

    discardActionToken: ({ token }: { token: string }) => {
      tokens.delete(token);
    },

    executeAction: async ({
      token,
    }: {
      token: string;
    }): Promise<ActionOutcome> => {
      const pending = tokens.get(token);
      tokens.delete(token);
      if (!pending || pending.expiresAt <= now().getTime()) {
        throw failure(
          "TOKEN_UNKNOWN",
          "This confirmation is no longer valid. Run the action again."
        );
      }
      if (pending.review.effect === "write") {
        const ref = writeTargetOf(pending.action.target);
        if (!(ref && permissions().includes(`${ref.kind}:${ref.id}`))) {
          throw failure(
            "WRITES_NOT_ALLOWED",
            `Write actions are off for ${pending.review.target.name}.`
          );
        }
      }
      await wait(RUN_MS);
      const outcome = outcomeOf(pending);
      if (isAudited(pending.review.effect)) {
        recordActivity(pending, outcome);
      }
      return outcome;
    },

    listActionActivity: (): ActionActivityPage => {
      const activity = readList(ACTIVITY_KEY, asActivity);
      return {
        activity,
        integrity: { archived: 0, entries: activity.length * 2, ok: true },
      };
    },

    listActions: ({ widgetId }: { widgetId: string }): ListedAction[] =>
      actions()
        .filter((action) => action.widgetId === widgetId)
        .map(listed),

    listWritePermissions: (): { kind: WriteTargetKind; id: string }[] =>
      permissions().flatMap((key) => {
        const [kind, ...rest] = key.split(":");
        return kind === "connection" || kind === "mcp" || kind === "http"
          ? [{ id: rest.join(":"), kind }]
          : [];
      }),

    prepareAction: ({
      actionId,
      context,
    }: {
      actionId: string;
      context: ActionContext;
    }): ActionPreview => {
      const action = actions().find((item) => item.id === actionId);
      if (!action) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      const result = review(action, requireWidget(action.widgetId), context);
      if (result.effect === "write") {
        const ref = writeTargetOf(action.target);
        if (!(ref && permissions().includes(`${ref.kind}:${ref.id}`))) {
          throw failure(
            "WRITES_NOT_ALLOWED",
            `Write actions are off for ${result.target.name}. Turn on Allow write actions in its settings.`
          );
        }
      }
      const token = stubToken();
      const expiresAt = now().getTime() + TOKEN_TTL_MS;
      tokens.set(token, { action, expiresAt, review: result });
      return { ...result, expiresAt: new Date(expiresAt).toISOString(), token };
    },

    proposeAction: async (
      request: ProposeActionRequest
    ): Promise<ActionProposal> => {
      await wait(RUN_MS);
      if (request.target.kind !== "sql") {
        return { error: "Suggestions in browser mode cover SQL actions only." };
      }
      return {
        draft: {
          bind: {
            region: { column: "region", from: "row" },
            status: { from: "literal", value: "reviewed" },
          },
          label: request.prompt.slice(0, 40),
          scope: "row",
          target: {
            connectionId: request.target.id,
            database: null,
            dialect: "postgresql",
            kind: "sql",
            maxAffectedRows: 1,
            statementTemplate:
              "UPDATE regions SET status = {{status}} WHERE name = {{region}}",
          },
        },
      };
    },

    recordRun: (runId: string, widgetId: string, result: TabularResult) => {
      runs.set(runId, {
        columns: result.columns.map((column) => column.name),
        rows: result.rows,
        widgetId,
      });
    },

    reviewAction: ({
      context,
      draft,
      widgetId,
    }: {
      context: ActionContext;
      draft: ActionDraftValue;
      widgetId: string;
    }): ActionReview =>
      review(ActionDraft.parse(draft), requireWidget(widgetId), context),

    saveAction: ({
      draft: input,
      widgetId,
    }: {
      draft: ActionDraftValue;
      widgetId: string;
    }): ListedAction => {
      const draft = ActionDraft.parse(input);
      requireWidget(widgetId);
      const existing = actions().find((item) => item.id === draft.id);
      const stamp = now().toISOString();
      const action = WidgetAction.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        effect: deriveEffect(draft.target, hintOf(draft.target)),
        id: existing?.id ?? crypto.randomUUID(),
        reviewHash: stubHash(JSON.stringify([draft.target, draft.bind])),
        reviewedAt: stamp,
        updatedAt: stamp,
        widgetId,
      });
      write(ACTIONS_KEY, [
        ...actions().filter((item) => item.id !== action.id),
        action,
      ]);
      return listed(action);
    },

    setWriteActionsAllowed: ({
      allowed,
      id,
      kind,
    }: {
      allowed: boolean;
      id: string;
      kind: WriteTargetKind;
    }) => {
      const key = `${kind}:${id}`;
      const others = permissions().filter((item) => item !== key);
      write(PERMISSIONS_KEY, allowed ? [...others, key] : others);
      return { allowed };
    },
  };
};

export type ActionEmulator = ReturnType<typeof createActionEmulator>;
