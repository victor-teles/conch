import type { BindValue } from "@conch/core/client";

import {
  collectParamRefs,
  pathParamRefs,
  tokenizeSqlTemplate,
} from "@conch/core/client";
import { z } from "zod";

import type { ParamValues } from "./widget.ts";

import {
  ArgTemplate,
  Dialect,
  Ident,
  MAX_QUERY_KEYS,
  PathTemplate,
  QueryLeaf,
} from "./source.ts";
import { ParamValue } from "./widget.ts";

export type { BindValue } from "@conch/core/client";

export const ACTION_EFFECTS = ["read", "write", "external"] as const;
export const ActionEffect = z.enum(ACTION_EFFECTS);
export type ActionEffect = z.infer<typeof ActionEffect>;

export const ACTION_TARGET_KINDS = [
  "copy",
  "open-url",
  "sql",
  "mcp",
  "http",
] as const;
export type ActionTargetKind = (typeof ACTION_TARGET_KINDS)[number];

export const HTTP_ACTION_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type HttpActionMethod = (typeof HTTP_ACTION_METHODS)[number];

export const MAX_ACTION_BINDS = 12;
export const MAX_ACTIONS_PER_WIDGET = 20;
export const DEFAULT_MAX_AFFECTED_ROWS = 1;
export const MAX_AFFECTED_ROWS = 100;
export const ACTION_TOKEN_TTL_MS = 120_000;
export const MAX_ACTION_RESPONSE_CHARS = 16_384;

export const isSafeLinkUrl = (value: string): boolean => {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.hostname.length > 0 &&
    !url.username &&
    !url.password &&
    !value.includes("#") &&
    !value.includes("?")
  );
};

export const SafeLinkUrl = z.string().trim().max(2000).refine(isSafeLinkUrl, {
  message: "Use an https:// address without a username, ? or #.",
});

const BindLiteral = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const BindSource = z.discriminatedUnion("from", [
  z.object({ column: z.string().min(1).max(200), from: z.literal("row") }),
  z.object({ from: z.literal("input"), name: Ident }),
  z.object({ from: z.literal("literal"), value: BindLiteral }),
]);
export type BindSource = z.infer<typeof BindSource>;

const ActionQuery = z
  .record(z.string().min(1).max(64), QueryLeaf)
  .refine((query) => Object.keys(query).length <= MAX_QUERY_KEYS, {
    message: `Use at most ${MAX_QUERY_KEYS} query values.`,
  });

const TargetId = z.string().min(1).max(100);

export const OpenUrlTarget = z.object({
  baseUrl: SafeLinkUrl,
  kind: z.literal("open-url"),
  path: PathTemplate,
  query: ActionQuery,
});

export const CopyTarget = z.object({
  kind: z.literal("copy"),
  template: z.string().min(1).max(2000),
});

export const SqlTarget = z.object({
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  dialect: Dialect,
  kind: z.literal("sql"),
  maxAffectedRows: z.number().int().min(1).max(MAX_AFFECTED_ROWS),
  statementTemplate: z.string().min(1).max(4000),
});

export const McpTarget = z.object({
  args: z.record(z.string().max(64), ArgTemplate),
  kind: z.literal("mcp"),
  serverId: TargetId,
  tool: z.string().min(1).max(128),
});

export const HttpTarget = z.object({
  body: ArgTemplate.nullable(),
  endpointId: TargetId,
  kind: z.literal("http"),
  method: z.enum(HTTP_ACTION_METHODS),
  path: PathTemplate,
  query: ActionQuery,
});

export const ActionTarget = z.discriminatedUnion("kind", [
  OpenUrlTarget,
  CopyTarget,
  SqlTarget,
  McpTarget,
  HttpTarget,
]);
export type ActionTarget = z.infer<typeof ActionTarget>;

export const ACTION_SCOPES = ["row", "widget"] as const;
export const ActionScope = z.enum(ACTION_SCOPES);
export type ActionScope = z.infer<typeof ActionScope>;

const ActionBinds = z
  .record(Ident, BindSource)
  .refine((bind) => Object.keys(bind).length <= MAX_ACTION_BINDS, {
    message: `Bind at most ${MAX_ACTION_BINDS} values.`,
  });

export interface Placeholder {
  name: string;
  ranged: boolean;
}

const COPY_PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g;

const copyPlaceholders = (template: string): Placeholder[] => {
  const names = [...template.matchAll(COPY_PLACEHOLDER)].map((match) => ({
    name: match[1] ?? "",
    ranged: false,
  }));
  const leftover = template.replaceAll(COPY_PLACEHOLDER, "");
  if (leftover.includes("{{") || leftover.includes("}}")) {
    throw new Error("Write inputs as {{name}}.");
  }
  return names;
};

const refPlaceholders = (refs: { $param: string; part?: string }[]) =>
  refs.map((ref) => ({ name: ref.$param, ranged: ref.part !== undefined }));

const sqlPlaceholders = (target: z.infer<typeof SqlTarget>): Placeholder[] => {
  try {
    return tokenizeSqlTemplate(target.statementTemplate, target.dialect)
      .filter((segment) => segment.kind === "placeholder")
      .map((segment) => ({
        name: segment.name,
        ranged: segment.part !== null,
      }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
};

// Every placeholder a target uses, in order and with repeats.
export const targetPlaceholders = (target: ActionTarget): Placeholder[] => {
  switch (target.kind) {
    case "copy": {
      return copyPlaceholders(target.template);
    }
    case "open-url": {
      return refPlaceholders([
        ...pathParamRefs(target.path),
        ...collectParamRefs(target.query),
      ]);
    }
    case "sql": {
      return sqlPlaceholders(target);
    }
    case "mcp": {
      return refPlaceholders(collectParamRefs(target.args));
    }
    case "http": {
      return refPlaceholders([
        ...pathParamRefs(target.path),
        ...collectParamRefs(target.query),
        ...collectParamRefs(target.body),
      ]);
    }
    default: {
      throw new Error(`Unknown action target ${target satisfies never}`);
    }
  }
};

export const placeholderNames = (target: ActionTarget): string[] => {
  try {
    return [...new Set(targetPlaceholders(target).map((item) => item.name))];
  } catch {
    return [];
  }
};

interface ActionShape {
  scope: ActionScope;
  target: ActionTarget;
  bind: Record<string, BindSource>;
}

export const actionProblems = ({ scope, target, bind }: ActionShape) => {
  let placeholders: Placeholder[];
  try {
    placeholders = targetPlaceholders(target);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const problems: string[] = [];
  if (placeholders.some((item) => item.ranged)) {
    problems.push("Actions bind whole values; leave out .from and .to.");
  }
  const used = new Set(placeholders.map((item) => item.name));
  for (const name of used) {
    if (!Object.hasOwn(bind, name)) {
      problems.push(`Choose a value for "${name}".`);
    }
  }
  for (const [name, source] of Object.entries(bind)) {
    if (!used.has(name)) {
      problems.push(`"${name}" isn't used by the action.`);
    }
    if (source.from === "row" && scope !== "row") {
      problems.push(`"${name}" reads a row, so the action must act on rows.`);
    }
  }
  return problems;
};

export const actionRules = (value: ActionShape, ctx: z.RefinementCtx): void => {
  for (const message of actionProblems(value)) {
    ctx.addIssue({ code: "custom", message, path: ["bind"] });
  }
};

const ActionLabel = z.string().trim().min(1).max(40);
const ActionId = z.string().min(1).max(100);

const ActionFields = z.object({
  bind: ActionBinds,
  createdAt: z.string().max(40),
  effect: ActionEffect,
  id: ActionId,
  label: ActionLabel,
  reviewHash: z.string().regex(/^[0-9a-f]{64}$/),
  reviewedAt: z.string().max(40),
  scope: ActionScope,
  target: ActionTarget,
  updatedAt: z.string().max(40),
});

export const ActionDef = ActionFields.superRefine(actionRules);
export type ActionDef = z.infer<typeof ActionDef>;

export const WidgetAction = ActionFields.extend({
  widgetId: z.string().min(1).max(100),
}).superRefine(actionRules);
export type WidgetAction = z.infer<typeof WidgetAction>;

export const ActionDraft = z
  .object({
    bind: ActionBinds,
    id: ActionId.optional(),
    label: ActionLabel,
    scope: ActionScope,
    target: ActionTarget,
  })
  .superRefine(actionRules);
export type ActionDraft = z.infer<typeof ActionDraft>;

const EFFECT_RANK: Record<ActionEffect, number> = {
  external: 1,
  read: 0,
  write: 2,
};

export const understates = (
  stored: ActionEffect,
  derived: ActionEffect
): boolean => EFFECT_RANK[stored] < EFFECT_RANK[derived];

// Only a server's own readOnlyHint makes a tool a read; a user's "Treat as
// read" lets a tool feed a widget but never skips the confirm sheet.
export const deriveEffect = (
  target: ActionTarget,
  toolReadOnlyHint: boolean | null
): ActionEffect => {
  switch (target.kind) {
    case "copy": {
      return "read";
    }
    case "open-url": {
      return "external";
    }
    case "http": {
      return target.method === "GET" ? "read" : "write";
    }
    case "mcp": {
      return toolReadOnlyHint === true ? "read" : "write";
    }
    case "sql": {
      return "write";
    }
    default: {
      throw new Error(`Unknown action target ${target satisfies never}`);
    }
  }
};

export const isAudited = (effect: ActionEffect): boolean => effect !== "read";

const sortedJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortedJson);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [
          key,
          sortedJson((value as Record<string, unknown>)[key]),
        ])
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string =>
  JSON.stringify(sortedJson(value) ?? null);

export const canonicalActionJson = (def: ActionShape): string =>
  canonicalJson({ bind: def.bind, scope: def.scope, target: def.target });

export const ActionContext = z.object({
  rowIndex: z.number().int().min(0).max(100_000).nullable(),
  runId: z.string().min(1).max(100),
  values: z.record(z.string().max(64), ParamValue),
});
export interface ActionContext {
  runId: string;
  rowIndex: number | null;
  values: ParamValues;
}

export type CompiledAction =
  | { kind: "open-url"; url: string }
  | { kind: "copy"; text: string }
  | { kind: "sql"; statement: string; params: BindValue[] }
  | { kind: "mcp"; tool: string; args: unknown }
  | { kind: "http"; method: HttpActionMethod; url: string; body: unknown };

export type BindOrigin = BindSource["from"];

export interface BoundValue {
  name: string;
  value: BindValue;
  from: BindOrigin;
  detail: string;
}

export interface ActionTargetSummary {
  kind: ActionTargetKind;
  name: string;
  environment: string | null;
}

export interface ActionReview {
  effect: ActionEffect;
  label: string;
  target: ActionTargetSummary;
  compiled: CompiledAction;
  bound: BoundValue[];
  limits: { maxAffectedRows?: number };
}

export interface ActionPreview extends ActionReview {
  token: string;
  expiresAt: string;
}

export type ActionOutcome =
  | {
      ok: true;
      summary: string;
      affectedRows?: number;
      status?: number;
      response?: unknown;
      durationMs: number;
    }
  | { ok: false; code: string; message: string; durationMs: number };

export interface ListedAction {
  action: WidgetAction;
  effect: ActionEffect;
  targetName: string;
  subtitle: string;
}

export const ACTION_ERROR_CODES = {
  notReviewed: "ACTION_NOT_REVIEWED",
  reviewDeclined: "REVIEW_DECLINED",
  runExpired: "RUN_EXPIRED",
  tokenExpired: "TOKEN_EXPIRED",
  tokenUnknown: "TOKEN_UNKNOWN",
  tooManyRows: "TOO_MANY_ROWS",
  understated: "EFFECT_UNDERSTATED",
  writesOff: "WRITES_NOT_ALLOWED",
  writesUnsupported: "WRITES_UNSUPPORTED",
} as const;

export const WRITE_TARGET_KINDS = ["connection", "mcp", "http"] as const;
export const WriteTargetKind = z.enum(WRITE_TARGET_KINDS);
export type WriteTargetKind = z.infer<typeof WriteTargetKind>;

export const writePermissionId = (kind: WriteTargetKind, id: string): string =>
  `${kind}:${id}`;

export const WritePermission = z.object({
  allowedAt: z.string().max(40),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  id: z.string().min(1).max(300),
  kind: WriteTargetKind,
  targetId: z.string().min(1).max(200),
});
export type WritePermission = z.infer<typeof WritePermission>;

export const SetWriteActionsRequest = z.object({
  allowed: z.boolean(),
  id: z.string().min(1).max(200),
  kind: WriteTargetKind,
});
export type SetWriteActionsRequest = z.infer<typeof SetWriteActionsRequest>;

export const writeTargetOf = (
  target: ActionTarget
): { kind: WriteTargetKind; id: string } | null => {
  switch (target.kind) {
    case "sql": {
      return { id: target.connectionId, kind: "connection" };
    }
    case "mcp": {
      return { id: target.serverId, kind: "mcp" };
    }
    case "http": {
      return { id: target.endpointId, kind: "http" };
    }
    default: {
      return null;
    }
  }
};

export const AUDIT_ZERO_HASH = "0".repeat(64);

export const AuditEntry = z.object({
  actionId: z.string(),
  actionLabel: z.string(),
  at: z.string(),
  bound: z.array(z.unknown()),
  compiled: z.unknown(),
  durationMs: z.number().nullable(),
  effect: ActionEffect,
  environment: z.string().nullable(),
  executionId: z.string(),
  id: z.string(),
  outcome: z.unknown().nullable(),
  phase: z.enum(["started", "finished"]),
  prevHash: z.string().length(64),
  targetKind: z.string(),
  targetName: z.string(),
  widgetId: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export type AuditIntegrity =
  | { ok: true; entries: number; archived: number }
  | { ok: false; brokenAt: number; entries: number; archived: number };

export type ActivityStatus = "ok" | "failed" | "interrupted";

export interface ActionActivity {
  executionId: string;
  at: string;
  actionLabel: string;
  widgetId: string | null;
  effect: ActionEffect;
  targetKind: string;
  targetName: string;
  environment: string | null;
  compiled: unknown;
  bound: unknown[];
  outcome: ActionOutcome | null;
  durationMs: number | null;
  status: ActivityStatus;
}

export interface ActionActivityPage {
  activity: ActionActivity[];
  integrity: AuditIntegrity;
}

const OutcomeShape = z.union([
  z.object({
    affectedRows: z.number().optional(),
    durationMs: z.number(),
    ok: z.literal(true),
    response: z.unknown().optional(),
    status: z.number().optional(),
    summary: z.string(),
  }),
  z.object({
    code: z.string(),
    durationMs: z.number(),
    message: z.string(),
    ok: z.literal(false),
  }),
]);

const statusOf = (outcome: ActionOutcome | null): ActivityStatus => {
  if (!outcome) {
    return "interrupted";
  }
  return outcome.ok ? "ok" : "failed";
};

// Pairs each started entry with its finished entry; newest first.
export const activityOf = (
  entries: readonly AuditEntry[]
): ActionActivity[] => {
  const finished = new Map(
    entries
      .filter((entry) => entry.phase === "finished")
      .map((entry) => [entry.executionId, entry])
  );
  return entries
    .filter((entry) => entry.phase === "started")
    .map((started) => {
      const end = finished.get(started.executionId);
      const parsed = OutcomeShape.safeParse(end?.outcome);
      const outcome = parsed.success ? parsed.data : null;
      return {
        actionLabel: started.actionLabel,
        at: started.at,
        bound: started.bound,
        compiled: started.compiled,
        durationMs: end?.durationMs ?? null,
        effect: started.effect,
        environment: started.environment,
        executionId: started.executionId,
        outcome,
        status: statusOf(outcome),
        targetKind: started.targetKind,
        targetName: started.targetName,
        widgetId: started.widgetId,
      };
    })
    .toSorted((a, b) => b.at.localeCompare(a.at));
};

export const PrepareActionRequest = z.object({
  actionId: ActionId,
  context: ActionContext,
});
export type PrepareActionRequest = z.infer<typeof PrepareActionRequest>;

export const ReviewActionRequest = z.object({
  context: ActionContext,
  draft: ActionDraft,
  widgetId: z.string().min(1).max(100),
});
export type ReviewActionRequest = z.infer<typeof ReviewActionRequest>;

export const SaveActionRequest = z.object({
  draft: ActionDraft,
  widgetId: z.string().min(1).max(100),
});
export type SaveActionRequest = z.infer<typeof SaveActionRequest>;

export const ActionToken = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

export const ProposeActionRequest = z.object({
  prompt: z.string().trim().min(1).max(1000),
  scope: ActionScope,
  target: z.discriminatedUnion("kind", [
    z.object({ id: z.string().min(1).max(200), kind: z.literal("sql") }),
    z.object({ id: TargetId, kind: z.literal("mcp") }),
    z.object({ id: TargetId, kind: z.literal("http") }),
  ]),
  widgetId: z.string().min(1).max(100),
});
export type ProposeActionRequest = z.infer<typeof ProposeActionRequest>;

export type ActionProposal = { draft: ActionDraft } | { error: string };

export const effectLabel = (effect: ActionEffect): string => {
  switch (effect) {
    case "read": {
      return "Read";
    }
    case "external": {
      return "Opens link";
    }
    case "write": {
      return "Writes";
    }
    default: {
      throw new Error(`Unknown effect ${effect satisfies never}`);
    }
  }
};

export const rowsPhrase = (count: number): string =>
  count === 1 ? "1 row" : `${count} rows`;
