import type { LanguageModel, ProposeActionTarget } from "@conch/agent";
import type { DatabaseConnection, DialectType, SchemaInfo } from "@conch/core";
import type {
  ActionActivityPage,
  ActionContext,
  ActionDef,
  ActionDraft as ActionDraftValue,
  ActionEffect,
  ActionOutcome,
  ActionPreview,
  ActionProposal,
  ActionReview,
  ActionTarget,
  ActionTargetSummary,
  AuditIntegrity,
  BoundValue,
  CompiledAction,
  HttpEndpointConfig,
  ListedAction,
  McpServerConfig,
  Widget,
  WidgetAction as WidgetActionValue,
} from "@conch/rpc";

import { assertGuardedWrite, proposeAction } from "@conch/agent";
import { DbError } from "@conch/core";
import {
  ACTION_TOKEN_TTL_MS,
  ActionToken,
  activityOf,
  AuditEntry,
  canonicalActionJson,
  canonicalJson,
  deriveEffect,
  isAudited,
  MAX_ACTIONS_PER_WIDGET,
  PrepareActionRequest,
  ProposeActionRequest,
  ReviewActionRequest,
  rowsPhrase,
  SaveActionRequest,
  understates,
  WidgetAction,
  writeTargetOf,
} from "@conch/rpc";
import { z } from "zod";

import type { ActionOwner } from "./action-compile.ts";
import type { ActionExecutor, ResolvedCall } from "./action-executor.ts";
import type { McpToolInfo } from "./mcp-clients.ts";
import type { ConfirmNative } from "./native-confirm.ts";
import type { RunCache } from "./run-cache.ts";
import type { WritePermissions } from "./write-permissions.ts";

import {
  compileCall,
  inputParam,
  redactDeep,
  resolveBinds,
  valuesOf,
  widgetOwner,
} from "./action-compile.ts";
import { writesUnavailable } from "./action-executor.ts";

const PROPOSE_TIMEOUT_MS = 30_000;
const MAX_ACTIVITY = 500;

export interface ActionStore {
  get(id: string): Promise<WidgetActionValue | null>;
  listForWidget(widgetId: string): Promise<WidgetActionValue[]>;
  save(action: WidgetActionValue): Promise<WidgetActionValue>;
  remove(id: string): Promise<void>;
}

export interface ConnectionInspection {
  dialect: DialectType | null;
  writable: boolean;
  schema: string;
}

export interface ActionAudit {
  append(entry: object): Promise<void>;
  read(limit: number): Promise<unknown[]>;
  verify(): Promise<AuditIntegrity>;
}

export interface ActionServiceDeps {
  actions: ActionStore;
  permissions: Pick<WritePermissions, "isAllowed">;
  getWidget(id: string): Promise<Widget | null>;
  runCache: Pick<RunCache, "rowAt" | "columnsFor">;
  findConnection(id: string): Promise<DatabaseConnection | null>;
  inspectConnection(
    connection: DatabaseConnection,
    database: string | null
  ): Promise<ConnectionInspection>;
  mcpServer(id: string): Promise<McpServerConfig | null>;
  httpEndpoint(id: string): Promise<HttpEndpointConfig | null>;
  listTools(serverId: string): Promise<McpToolInfo[]>;
  confirm: ConfirmNative;
  executor: Pick<ActionExecutor, "run">;
  audit: ActionAudit;
  loadModel(): Promise<LanguageModel | null>;
  loadSchema(connectionId: string, schema: string): Promise<SchemaInfo>;
  now(): Date;
  newId(): string;
  newToken(): string;
  sha256(text: string): string;
}

interface TargetContext {
  summary: ActionTargetSummary;
  readOnlyHint: boolean | null;
  connection: DatabaseConnection | null;
  endpoint: HttpEndpointConfig | null;
  tool: McpToolInfo | null;
}

type ReviewedAction = Pick<
  ActionDef,
  "bind" | "effect" | "id" | "label" | "reviewHash" | "scope" | "target"
>;

// Where a prepared action came from: bun reloads it from there at execute,
// so a token never outlives a change to the reviewed definition.
export interface PrepareSource {
  owner: ActionOwner;
  auditWidgetId: string | null;
  reload(): Promise<ReviewedAction | null>;
}

interface Pending {
  actionId: string;
  auditWidgetId: string | null;
  reload: PrepareSource["reload"];
  label: string;
  reviewHash: string;
  effect: ActionEffect;
  summary: ActionTargetSummary;
  bound: BoundValue[];
  compiled: CompiledAction;
  call: ResolvedCall | null;
  callHash: string;
  expiresAt: number;
  redact: { enabled: boolean; customPatterns?: string[] };
}

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const WidgetId = z.string().min(1).max(100);

const urlLabel = (target: Extract<ActionTarget, { kind: "open-url" }>) => {
  const base = new URL(target.baseUrl);
  return `${base.host}${base.pathname.replace(/\/$/, "")}${target.path}`;
};

export const actionSubtitle = (
  target: ActionTarget,
  targetName: string
): string => {
  switch (target.kind) {
    case "copy": {
      return "Copies to the clipboard";
    }
    case "open-url": {
      return urlLabel(target);
    }
    case "sql": {
      return `Writes to ${targetName} · at most ${rowsPhrase(target.maxAffectedRows)}`;
    }
    case "mcp": {
      return `Calls ${target.tool} on ${targetName}`;
    }
    case "http": {
      return `${target.method} ${targetName}${target.path}`;
    }
    default: {
      throw new Error(`Unknown action target ${target satisfies never}`);
    }
  }
};

const environmentText = (environment: string | null): string =>
  environment ? ` (${environment})` : "";

const reviewDetail = (target: ActionTarget, ctx: TargetContext): string => {
  switch (target.kind) {
    case "sql": {
      return `${target.statementTemplate}\n\nChanges at most ${rowsPhrase(target.maxAffectedRows)} per run.`;
    }
    case "mcp": {
      return `${target.tool} ${JSON.stringify(target.args, null, 2)}`;
    }
    case "http": {
      const base = ctx.endpoint?.baseUrl ?? "";
      const body =
        target.body === null ? "" : `\n${JSON.stringify(target.body, null, 2)}`;
      const query = Object.keys(target.query).length
        ? ` ${JSON.stringify(target.query)}`
        : "";
      return `${target.method} ${base.replace(/\/$/, "")}${target.path}${query}${body}`;
    }
    default: {
      return actionSubtitle(target, ctx.summary.name);
    }
  }
};

const bindDetail = (bind: ActionDraftValue["bind"]): string => {
  const lines = Object.entries(bind).map(([name, source]) => {
    switch (source.from) {
      case "row": {
        return `${name} ← row ${source.column}`;
      }
      case "input": {
        return `${name} ← input ${source.name}`;
      }
      default: {
        return `${name} ← ${JSON.stringify(source.value)}`;
      }
    }
  });
  return lines.length > 0 ? `\n\nValues:\n${lines.join("\n")}` : "";
};

const withoutResponse = (outcome: ActionOutcome): ActionOutcome => {
  if (!outcome.ok) {
    return outcome;
  }
  const { response: _response, ...rest } = outcome;
  return rest;
};

const redactionFor = (ctx: TargetContext) => ({
  customPatterns: ctx.connection?.customPiiPatterns,
  enabled: ctx.connection?.piiRedaction === true,
});

export const createActionService = (deps: ActionServiceDeps) => {
  const tokens = new Map<string, Pending>();

  const hashOf = (value: unknown): string => deps.sha256(canonicalJson(value));
  const reviewHashOf = (action: Parameters<typeof canonicalActionJson>[0]) =>
    deps.sha256(canonicalActionJson(action));

  const pruneTokens = (): void => {
    const now = deps.now().getTime();
    for (const [token, pending] of tokens) {
      if (pending.expiresAt <= now) {
        tokens.delete(token);
      }
    }
  };

  const requireWidget = async (id: string): Promise<Widget> => {
    const widget = await deps.getWidget(id);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const toolOf = async (
    server: McpServerConfig,
    name: string
  ): Promise<McpToolInfo> => {
    const tools = await deps.listTools(server.id);
    const tool = tools.find((item) => item.name === name);
    if (!tool) {
      throw failure(
        "TOOL_MISSING",
        `${server.name} no longer has a tool named ${name}.`
      );
    }
    return tool;
  };

  // Every effect is derived here from live data: the tool's current
  // readOnlyHint, never a stored field or a user's "Treat as read".
  const describeTarget = async (
    target: ActionTarget
  ): Promise<TargetContext> => {
    const base = {
      connection: null,
      endpoint: null,
      readOnlyHint: null,
      tool: null,
    };
    switch (target.kind) {
      case "copy": {
        return {
          ...base,
          summary: { environment: null, kind: "copy", name: "Clipboard" },
        };
      }
      case "open-url": {
        return {
          ...base,
          summary: {
            environment: null,
            kind: "open-url",
            name: new URL(target.baseUrl).host,
          },
        };
      }
      case "sql": {
        const connection = await deps.findConnection(target.connectionId);
        if (!connection) {
          throw failure(
            "TARGET_MISSING",
            "This action's connection no longer exists."
          );
        }
        return {
          ...base,
          connection,
          summary: {
            environment: connection.environment ?? null,
            kind: "sql",
            name: connection.name,
          },
        };
      }
      case "mcp": {
        const server = await deps.mcpServer(target.serverId);
        if (!server) {
          throw failure(
            "TARGET_MISSING",
            "This action's server no longer exists."
          );
        }
        const tool = await toolOf(server, target.tool);
        return {
          ...base,
          readOnlyHint: tool.annotations?.readOnlyHint ?? null,
          summary: { environment: null, kind: "mcp", name: server.name },
          tool,
        };
      }
      case "http": {
        const endpoint = await deps.httpEndpoint(target.endpointId);
        if (!endpoint) {
          throw failure(
            "TARGET_MISSING",
            "This action's endpoint no longer exists."
          );
        }
        return {
          ...base,
          endpoint,
          summary: { environment: null, kind: "http", name: endpoint.name },
        };
      }
      default: {
        throw new Error(`Unknown action target ${target satisfies never}`);
      }
    }
  };

  const guardStatement = (target: ActionTarget): void => {
    if (target.kind !== "sql") {
      return;
    }
    const verdict = assertGuardedWrite(
      target.statementTemplate,
      target.dialect
    );
    if (!verdict.ok) {
      throw failure("NOT_A_GUARDED_WRITE", verdict.reason);
    }
  };

  const assertWritableEngine = async (
    target: ActionTarget,
    ctx: TargetContext
  ): Promise<void> => {
    if (target.kind !== "sql" || !ctx.connection) {
      return;
    }
    const inspected = await deps.inspectConnection(
      ctx.connection,
      target.database
    );
    if (!inspected.writable) {
      throw writesUnavailable();
    }
    if (inspected.dialect !== target.dialect) {
      throw failure(
        "DIALECT_MISMATCH",
        `${ctx.summary.name} speaks ${inspected.dialect ?? "another language"}, not ${target.dialect}.`
      );
    }
  };

  const assertWritesAllowed = async (
    target: ActionTarget,
    ctx: TargetContext
  ): Promise<void> => {
    const ref = writeTargetOf(target);
    if (!(ref && (await deps.permissions.isAllowed(ref.kind, ref.id)))) {
      throw failure(
        "WRITES_NOT_ALLOWED",
        `Write actions are off for ${ctx.summary.name}. Turn on Allow write actions in its settings.`
      );
    }
    guardStatement(target);
    await assertWritableEngine(target, ctx);
  };

  const evaluate = async (
    action: Pick<WidgetActionValue, "bind" | "label" | "scope" | "target">,
    owner: ActionOwner,
    context: ActionContext
  ) => {
    const ctx = await describeTarget(action.target);
    const effect = deriveEffect(action.target, ctx.readOnlyHint);
    const row =
      context.rowIndex === null
        ? null
        : deps.runCache.rowAt(context.runId, context.rowIndex);
    const bound = resolveBinds(action, {
      context,
      now: deps.now(),
      owner,
      row,
    });
    const { call, compiled } = compileCall(
      action.target,
      valuesOf(bound),
      ctx.endpoint
    );
    const review: ActionReview = {
      bound,
      compiled,
      effect,
      label: action.label,
      limits:
        action.target.kind === "sql"
          ? { maxAffectedRows: action.target.maxAffectedRows }
          : {},
      target: ctx.summary,
    };
    return { call, ctx, effect, review };
  };

  const requireReviewed = (action: ReviewedAction): void => {
    if (reviewHashOf(action) !== action.reviewHash) {
      throw failure(
        "ACTION_NOT_REVIEWED",
        "This action changed after it was reviewed. Open it and save it again."
      );
    }
  };

  const listed = async (action: WidgetActionValue): Promise<ListedAction> => {
    try {
      const ctx = await describeTarget(action.target);
      return {
        action,
        effect: deriveEffect(action.target, ctx.readOnlyHint),
        subtitle: actionSubtitle(action.target, ctx.summary.name),
        targetName: ctx.summary.name,
      };
    } catch {
      return {
        action,
        effect: deriveEffect(action.target, null),
        subtitle: "Unavailable right now",
        targetName: "Unavailable",
      };
    }
  };

  const checkInputs = (draft: ActionDraftValue, owner: ActionOwner): void => {
    for (const source of Object.values(draft.bind)) {
      if (source.from === "input") {
        inputParam(owner, source.name);
      }
    }
  };

  // Placeholder values only test that the call builds; nothing runs.
  const checkBuilds = (draft: ActionDraftValue, ctx: TargetContext): void => {
    const sample = Object.fromEntries(
      Object.keys(draft.bind).map((name) => [name, "sample"])
    );
    try {
      compileCall(draft.target, sample, ctx.endpoint);
    } catch (error) {
      throw failure("INVALID_TEMPLATE", DbError.fromUnknown(error).message);
    }
  };

  const confirmWriteSave = async (
    draft: ActionDraftValue,
    ctx: TargetContext
  ): Promise<void> => {
    const accepted = await deps.confirm({
      confirmLabel: "Save Action",
      detail: `${reviewDetail(draft.target, ctx)}${bindDetail(draft.bind)}`,
      message: `Save “${draft.label}”? It writes to ${ctx.summary.name}${environmentText(ctx.summary.environment)}.`,
      title: "Save write action",
    });
    if (!accepted) {
      throw failure(
        "REVIEW_DECLINED",
        "Not saved. The action needs your approval to write."
      );
    }
  };

  const existingFor = async (
    draft: ActionDraftValue,
    widgetId: string
  ): Promise<WidgetActionValue | null> => {
    if (!draft.id) {
      return null;
    }
    const existing = await deps.actions.get(draft.id);
    if (existing && existing.widgetId !== widgetId) {
      throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
    }
    return existing;
  };

  const auditEntry = (
    pending: Pending,
    executionId: string,
    phase: "started" | "finished",
    outcome: ActionOutcome | null
  ) => ({
    actionId: pending.actionId,
    actionLabel: pending.label,
    at: deps.now().toISOString(),
    bound: redactDeep(pending.bound, pending.redact),
    compiled: redactDeep(pending.compiled, pending.redact),
    durationMs: outcome?.durationMs ?? null,
    effect: pending.effect,
    environment: pending.summary.environment,
    executionId,
    id: deps.newId(),
    outcome: outcome ? withoutResponse(outcome) : null,
    phase,
    targetKind: pending.summary.kind,
    targetName: pending.summary.name,
    widgetId: pending.auditWidgetId,
  });

  const recheck = async (pending: Pending): Promise<ResolvedCall> => {
    const action = await pending.reload();
    if (!action || action.reviewHash !== pending.reviewHash) {
      throw failure(
        "ACTION_NOT_REVIEWED",
        "This action changed after you reviewed it. Run it again."
      );
    }
    requireReviewed(action);
    const ctx = await describeTarget(action.target);
    const effect = deriveEffect(action.target, ctx.readOnlyHint);
    if (effect !== pending.effect) {
      throw failure(
        "EFFECT_CHANGED",
        "What this action does has changed. Run it again to review it."
      );
    }
    if (effect === "write") {
      await assertWritesAllowed(action.target, ctx);
    }
    const { call } = compileCall(
      action.target,
      valuesOf(pending.bound),
      ctx.endpoint
    );
    if (!call || hashOf(call) !== pending.callHash) {
      throw failure(
        "CALL_CHANGED",
        "The call changed after you reviewed it. Run it again."
      );
    }
    return call;
  };

  const proposalTarget = async (
    request: z.infer<typeof ProposeActionRequest>,
    widget: Widget
  ): Promise<ProposeActionTarget> => {
    const { target } = request;
    switch (target.kind) {
      case "sql": {
        const connection = await deps.findConnection(target.id);
        if (!connection) {
          throw failure("TARGET_MISSING", "This connection no longer exists.");
        }
        const database =
          widget.source.kind === "sql" &&
          widget.source.connectionId === connection.id
            ? widget.source.database
            : null;
        const inspected = await deps.inspectConnection(connection, database);
        if (!(inspected.writable && inspected.dialect)) {
          throw writesUnavailable();
        }
        return {
          connectionId: connection.id,
          connectionName: connection.name,
          database,
          dialect: inspected.dialect,
          kind: "sql",
          schema: await deps.loadSchema(connection.id, inspected.schema),
        };
      }
      case "mcp": {
        const server = await deps.mcpServer(target.id);
        if (!server) {
          throw failure("TARGET_MISSING", "This server no longer exists.");
        }
        const tools = await deps.listTools(server.id);
        return {
          kind: "mcp",
          serverId: server.id,
          serverName: server.name,
          tools: tools.map((tool) => ({
            description: tool.description,
            inputSchema: tool.inputSchema,
            name: tool.name,
            readOnlyHint: tool.annotations?.readOnlyHint ?? null,
          })),
        };
      }
      case "http": {
        const endpoint = await deps.httpEndpoint(target.id);
        if (!endpoint) {
          throw failure("TARGET_MISSING", "This endpoint no longer exists.");
        }
        return {
          baseUrl: endpoint.baseUrl,
          endpointId: endpoint.id,
          kind: "http",
          name: endpoint.name,
        };
      }
      default: {
        throw new Error(`Unknown target ${target satisfies never}`);
      }
    }
  };

  const prepareFor = async (
    action: ReviewedAction,
    context: ActionContext,
    source: PrepareSource
  ): Promise<ActionPreview> => {
    requireReviewed(action);
    const { call, ctx, effect, review } = await evaluate(
      action,
      source.owner,
      context
    );
    if (understates(action.effect, effect)) {
      throw failure(
        "EFFECT_UNDERSTATED",
        "This action now changes data. Open it and save it again to review it."
      );
    }
    if (effect === "write") {
      await assertWritesAllowed(action.target, ctx);
    }
    pruneTokens();
    const token = deps.newToken();
    const expiresAt = deps.now().getTime() + ACTION_TOKEN_TTL_MS;
    tokens.set(token, {
      actionId: action.id,
      auditWidgetId: source.auditWidgetId,
      bound: review.bound,
      call,
      callHash: call ? hashOf(call) : "",
      compiled: review.compiled,
      effect,
      expiresAt,
      label: action.label,
      redact: redactionFor(ctx),
      reload: source.reload,
      reviewHash: action.reviewHash,
      summary: ctx.summary,
    });
    return {
      ...review,
      expiresAt: new Date(expiresAt).toISOString(),
      token,
    };
  };

  // 019's save-time review: the guard, a build check and, for a write, the
  // native dialog. A definition that already carries a matching review hash
  // keeps it without asking again.
  const stampReviewed = async (
    draft: ActionDraftValue,
    owner: ActionOwner,
    existing: ActionDef | null
  ): Promise<ActionDef> => {
    checkInputs(draft, owner);
    guardStatement(draft.target);
    const ctx = await describeTarget(draft.target);
    await assertWritableEngine(draft.target, ctx);
    checkBuilds(draft, ctx);
    const effect = deriveEffect(draft.target, ctx.readOnlyHint);
    if (effect === "write") {
      await confirmWriteSave(draft, ctx);
    }
    const stamp = deps.now().toISOString();
    return {
      bind: draft.bind,
      createdAt: existing?.createdAt ?? stamp,
      effect,
      id: existing?.id ?? deps.newId(),
      label: draft.label,
      reviewHash: reviewHashOf(draft),
      reviewedAt: stamp,
      scope: draft.scope,
      target: draft.target,
      updatedAt: stamp,
    };
  };

  return {
    async deleteAction(actionId: unknown): Promise<void> {
      await deps.actions.remove(z.string().min(1).max(100).parse(actionId));
    },

    discardToken(token: unknown): void {
      tokens.delete(String(token));
    },

    async effectOf(
      target: ActionTarget
    ): Promise<{ effect: ActionEffect; targetName: string }> {
      const ctx = await describeTarget(target);
      return {
        effect: deriveEffect(target, ctx.readOnlyHint),
        targetName: ctx.summary.name,
      };
    },

    async executeAction(request: { token: unknown }): Promise<ActionOutcome> {
      const parsed = ActionToken.safeParse(request.token);
      const pending = parsed.success ? tokens.get(parsed.data) : undefined;
      if (parsed.success) {
        tokens.delete(parsed.data);
      }
      if (!pending) {
        throw failure(
          "TOKEN_UNKNOWN",
          "This confirmation is no longer valid. Run the action again."
        );
      }
      if (deps.now().getTime() >= pending.expiresAt) {
        throw failure(
          "TOKEN_EXPIRED",
          "This confirmation expired. Run the action again."
        );
      }
      if (!pending.call) {
        throw failure("COPY_IN_LAUNCHER", "Copy actions run in the launcher.");
      }
      const call = await recheck(pending);
      const executionId = deps.newId();
      const audited = isAudited(pending.effect);
      if (audited) {
        try {
          await deps.audit.append(
            auditEntry(pending, executionId, "started", null)
          );
        } catch {
          throw failure(
            "AUDIT_FAILED",
            "The activity log couldn't be written, so nothing ran."
          );
        }
      }
      const outcome = await deps.executor.run(
        call,
        new AbortController().signal
      );
      if (audited) {
        try {
          await deps.audit.append(
            auditEntry(pending, executionId, "finished", outcome)
          );
        } catch (error) {
          console.error(
            `[actions] could not record the end of ${executionId}: ${DbError.fromUnknown(error).code}`
          );
        }
      }
      return outcome;
    },

    async listActions(widgetId: unknown): Promise<ListedAction[]> {
      const actions = await deps.actions.listForWidget(
        WidgetId.parse(widgetId)
      );
      return Promise.all(actions.map(listed));
    },

    async listActivity(request: {
      limit?: unknown;
    }): Promise<ActionActivityPage> {
      const limit = z
        .number()
        .int()
        .min(1)
        .max(MAX_ACTIVITY)
        .default(200)
        .parse(request.limit);
      const raw = await deps.audit.read(limit * 2);
      const entries = raw.flatMap((item) => {
        const parsed = AuditEntry.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
      return {
        activity: activityOf(entries).slice(0, limit),
        integrity: await deps.audit.verify(),
      };
    },

    async prepareAction(request: unknown): Promise<ActionPreview> {
      const { actionId, context } = PrepareActionRequest.parse(request);
      const action = await deps.actions.get(actionId);
      if (!action) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      const widget = await requireWidget(action.widgetId);
      return prepareFor(action, context, {
        auditWidgetId: action.widgetId,
        owner: widgetOwner(widget),
        reload: () => deps.actions.get(actionId),
      });
    },

    prepareFor,

    async proposeAction(request: unknown): Promise<ActionProposal> {
      const parsed = ProposeActionRequest.parse(request);
      const widget = await requireWidget(parsed.widgetId);
      const model = await deps.loadModel();
      if (!model) {
        return {
          error:
            "Add an AI provider in Settings, or fill the action in by hand.",
        };
      }
      return proposeAction({
        columns: deps.runCache.columnsFor(widget.id),
        inputs: widget.params
          .filter((param) => param.type !== "dateRange")
          .map((param) => param.name),
        model,
        prompt: parsed.prompt,
        scope: parsed.scope,
        signal: AbortSignal.timeout(PROPOSE_TIMEOUT_MS),
        target: await proposalTarget(parsed, widget),
      });
    },

    async reviewAction(request: unknown): Promise<ActionReview> {
      const { context, draft, widgetId } = ReviewActionRequest.parse(request);
      const owner = widgetOwner(await requireWidget(widgetId));
      checkInputs(draft, owner);
      guardStatement(draft.target);
      const { review } = await evaluate(draft, owner, context);
      return review;
    },

    reviewHashOf,

    async saveAction(request: unknown): Promise<ListedAction> {
      const { draft, widgetId } = SaveActionRequest.parse(request);
      const widget = await requireWidget(widgetId);
      const existing = await existingFor(draft, widget.id);
      if (!existing) {
        const saved = await deps.actions.listForWidget(widget.id);
        if (saved.length >= MAX_ACTIONS_PER_WIDGET) {
          throw failure(
            "TOO_MANY_ACTIONS",
            `A widget holds at most ${MAX_ACTIONS_PER_WIDGET} actions.`
          );
        }
      }
      const reviewed = await stampReviewed(
        draft,
        widgetOwner(widget),
        existing
      );
      const action = WidgetAction.parse({ ...reviewed, widgetId: widget.id });
      await deps.actions.save(action);
      return listed(action);
    },

    stampReviewed,
  };
};

export type ActionService = ReturnType<typeof createActionService>;
