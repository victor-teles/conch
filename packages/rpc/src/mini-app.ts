import type { TabularResult } from "@conch/core/client";

import { templateInputNames } from "@conch/core/client";
import { z } from "zod";

import type { ActionTarget, BindSource } from "./action.ts";
import type { PanelElement as PanelElementValue } from "./panel-spec.ts";
import type { Source as SourceValue } from "./source.ts";
import type {
  ParamDef as ParamDefValue,
  ParamValues,
  WidgetRunResult,
} from "./widget.ts";

import { ActionContext, ActionDef, ActionDraft } from "./action.ts";
import { RefreshInterval, sharedKey } from "./board.ts";
import {
  cardElements,
  cardSourceName,
  isReservedKey,
  PanelSpec,
  removeElement,
} from "./panel-spec.ts";
import { Ident, ParamRef, Source, sourceParamRefs } from "./source.ts";
import {
  MAX_WIDGET_PARAMS,
  ParamDef,
  ParamValue,
  sourceParamProblems,
} from "./widget.ts";

export const MINI_APP_VERSION = 1;
export const MAX_APP_SOURCES = 8;
export const MAX_APP_ACTIONS = 12;
export const MAX_APP_INPUT_OPTIONS = 200;

export const AppName = z.string().trim().min(1).max(60);
export const SourceName = Ident.refine((name) => !isReservedKey(name), {
  message: "That name is reserved.",
});
export const AppActionId = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,47}$/)
  .refine((id) => !isReservedKey(id), { message: "That id is reserved." });
const AppId = z.string().min(1).max(100);

// What the model proposes: a person reviews every write before it is saved
// as a 019 ActionDef with its review hash.
export const AppActionDraft = ActionDraft.safeExtend({ id: AppActionId });
export type AppActionDraft = z.infer<typeof AppActionDraft>;

export interface ReferencedApp {
  inputs: readonly ParamDefValue[];
  inputOptions: Readonly<Record<string, string>>;
  sources: Readonly<Record<string, SourceValue>>;
  actions: readonly {
    id: string;
    scope: "row" | "widget";
    bind: Readonly<Record<string, { from: string; name?: string }>>;
  }[];
  refreshAfter: Readonly<Record<string, readonly string[]>>;
  layout: {
    root: string;
    elements: Readonly<Record<string, PanelElementValue>>;
  };
}

const hasSource = (app: Pick<ReferencedApp, "sources">, name: string) =>
  Object.hasOwn(app.sources, name);

export const sourceOf = (
  app: Pick<ReferencedApp, "sources">,
  name: string
): SourceValue | null =>
  hasSource(app, name) ? (app.sources[name] ?? null) : null;

const inputProblems = (app: ReferencedApp): string[] => {
  const problems: string[] = [];
  const names = app.inputs.map((input) => input.name);
  if (new Set(names).size !== names.length) {
    problems.push("Input names must be unique.");
  }
  for (const input of app.inputs) {
    if (input.type === "select" && input.optionsSql) {
      problems.push(
        `"${input.name}" takes its options from a source, not optionsSql.`
      );
    }
  }
  for (const [inputName, sourceName] of Object.entries(app.inputOptions)) {
    const input = app.inputs.find((item) => item.name === inputName);
    if (input?.type !== "select") {
      problems.push(`Options go to select inputs; "${inputName}" isn't one.`);
    }
    if (!hasSource(app, sourceName)) {
      problems.push(`"${inputName}" takes options from a missing source.`);
    }
  }
  return problems;
};

const visibilityProblem = (
  app: ReferencedApp,
  key: string,
  element: PanelElementValue
): string | null => {
  const path = element.visible?.$state;
  if (!path) {
    return null;
  }
  const [, area, name = ""] = path.split("/");
  const known =
    area === "inputs"
      ? app.inputs.some((input) => input.name === name)
      : hasSource(app, name);
  return known ? null : `"${key}" shows or hides on a missing ${path}.`;
};

const layoutProblems = (app: ReferencedApp): string[] => {
  const problems: string[] = [];
  const actions = new Map(app.actions.map((action) => [action.id, action]));
  for (const [key, element] of Object.entries(app.layout.elements)) {
    const visibility = visibilityProblem(app, key, element);
    if (visibility) {
      problems.push(visibility);
    }
    if (element.type === "Card") {
      const source = cardSourceName(element);
      if (!hasSource(app, source)) {
        problems.push(`"${key}" shows the missing source "${source}".`);
      }
      for (const id of element.props.rowActions) {
        const action = actions.get(id);
        if (!action) {
          problems.push(`"${key}" lists the missing action "${id}".`);
        } else if (action.scope !== "row") {
          problems.push(
            `"${id}" acts on the app, so it can't be a row action.`
          );
        }
      }
    }
    if (element.type === "ActionButton") {
      const action = actions.get(element.props.action);
      if (!action) {
        problems.push(
          `"${key}" runs the missing action "${element.props.action}".`
        );
      } else if (action.scope !== "widget") {
        problems.push(
          `"${action.id}" reads a row, so it belongs in a card's rowActions.`
        );
      }
    }
  }
  return problems;
};

const actionProblems = (app: ReferencedApp): string[] => {
  const problems: string[] = [];
  const ids = app.actions.map((action) => action.id);
  if (new Set(ids).size !== ids.length) {
    problems.push("Action ids must be unique.");
  }
  for (const action of app.actions) {
    for (const bind of Object.values(action.bind)) {
      if (
        bind.from === "input" &&
        !app.inputs.some((input) => input.name === bind.name)
      ) {
        problems.push(`"${action.id}" reads the missing input "${bind.name}".`);
      }
    }
  }
  for (const [actionId, sources] of Object.entries(app.refreshAfter)) {
    if (!ids.includes(actionId)) {
      problems.push(`refreshAfter names the missing action "${actionId}".`);
    }
    for (const source of sources) {
      if (!hasSource(app, source)) {
        problems.push(
          `"${actionId}" refreshes the missing source "${source}".`
        );
      }
    }
  }
  return problems;
};

const sourceProblems = (app: ReferencedApp): string[] => {
  const names = Object.keys(app.sources);
  const problems =
    names.length > MAX_APP_SOURCES
      ? [`Use at most ${MAX_APP_SOURCES} sources.`]
      : [];
  for (const name of names) {
    const source = sourceOf(app, name);
    if (source && source.kind !== "sql") {
      const params = paramsForSource(source, app.inputs);
      problems.push(
        ...sourceParamProblems({ params, source }).map(
          (problem) => `${name}: ${problem}`
        )
      );
    }
  }
  return problems;
};

export const miniAppProblems = (app: ReferencedApp): string[] => [
  ...inputProblems(app),
  ...sourceProblems(app),
  ...layoutProblems(app),
  ...actionProblems(app),
];

const checkMiniAppReferences = (app: ReferencedApp, ctx: z.RefinementCtx) => {
  for (const message of miniAppProblems(app)) {
    ctx.addIssue({ code: "custom", message });
  }
};

const appFields = {
  description: z.string().max(280),
  emoji: z.string().max(8).optional(),
  inputOptions: z.record(Ident, SourceName).default({}),
  inputs: z.array(ParamDef).max(MAX_WIDGET_PARAMS),
  layout: PanelSpec,
  name: AppName,
  prompt: z.string().max(4000),
  refresh: RefreshInterval,
  refreshAfter: z.record(z.string(), z.array(SourceName)).default({}),
  sources: z.record(SourceName, Source),
  values: z.record(z.string(), ParamValue),
};

const MiniAppShape = z.object({
  ...appFields,
  actions: z.array(ActionDef).max(MAX_APP_ACTIONS),
  createdAt: z.string(),
  id: AppId,
  lastOpenedAt: z.string().nullable(),
  updatedAt: z.string(),
  version: z.literal(MINI_APP_VERSION),
});

export const MiniApp = MiniAppShape.superRefine(checkMiniAppReferences);
export type MiniApp = z.infer<typeof MiniApp>;

export const MiniAppDraft = z
  .object({
    ...appFields,
    actions: z.array(AppActionDraft).max(MAX_APP_ACTIONS),
    id: AppId.optional(),
    version: z.literal(MINI_APP_VERSION),
  })
  .superRefine(checkMiniAppReferences);
export type MiniAppDraft = z.infer<typeof MiniAppDraft>;

// v1 is the only shape; a later version adds its upgrade here.
export const migrateMiniApp = (raw: unknown): unknown => raw;

export const parseStoredMiniApp = (raw: unknown): MiniApp | null => {
  const parsed = MiniApp.safeParse(migrateMiniApp(raw));
  return parsed.success ? parsed.data : null;
};

export const draftOfApp = (app: MiniApp): MiniAppDraft => ({
  actions: app.actions.map(({ bind, id, label, scope, target }) => ({
    bind,
    id,
    label,
    scope,
    target,
  })),
  description: app.description,
  ...(app.emoji === undefined ? {} : { emoji: app.emoji }),
  id: app.id,
  inputOptions: app.inputOptions,
  inputs: app.inputs,
  layout: app.layout,
  name: app.name,
  prompt: app.prompt,
  refresh: app.refresh,
  refreshAfter: app.refreshAfter,
  sources: app.sources,
  values: app.values,
  version: MINI_APP_VERSION,
});

export const sourceInputNames = (source: SourceValue): string[] => {
  if (source.kind !== "sql") {
    return [...new Set(sourceParamRefs(source).map((ref) => ref.$param))];
  }
  try {
    return templateInputNames(source.sqlTemplate, source.dialect);
  } catch {
    return [];
  }
};

// A source is compiled with only the inputs it uses, since a template that
// is handed an unused value refuses to compile.
export const paramsForSource = (
  source: SourceValue,
  inputs: readonly ParamDefValue[]
): ParamDefValue[] => {
  const used = new Set(sourceInputNames(source));
  return inputs.filter((input) => used.has(input.name));
};

export const sourcesUsing = (
  app: Pick<ReferencedApp, "sources">,
  inputName: string
): string[] =>
  Object.entries(app.sources)
    .filter(([, source]) => sourceInputNames(source).includes(inputName))
    .map(([name]) => name);

export const inputValuesOf = (
  inputs: readonly ParamDefValue[],
  values: Readonly<Record<string, ParamValue>>
): ParamValues =>
  Object.fromEntries(
    inputs.flatMap((input) => {
      const key = sharedKey(input);
      return Object.hasOwn(values, key) && values[key] !== undefined
        ? [[input.name, values[key]]]
        : [];
    })
  );

export const removeSource = <A extends ReferencedApp>(
  app: A,
  name: string
): A => {
  if (!hasSource(app, name)) {
    return app;
  }
  const bound = cardElements(app.layout)
    .filter(([, card]) => cardSourceName(card) === name)
    .map(([key]) => key);
  let { layout } = app;
  for (const key of bound) {
    layout = removeElement(layout, key);
  }
  const { [name]: _removed, ...sources } = app.sources;
  return {
    ...app,
    inputOptions: Object.fromEntries(
      Object.entries(app.inputOptions).filter(([, source]) => source !== name)
    ),
    layout,
    refreshAfter: Object.fromEntries(
      Object.entries(app.refreshAfter).map(([id, names]) => [
        id,
        names.filter((source) => source !== name),
      ])
    ),
    sources,
  };
};

export const removeAction = <A extends ReferencedApp>(
  app: A,
  actionId: string
): A => {
  const buttons = Object.entries(app.layout.elements)
    .filter(
      ([, element]) =>
        element.type === "ActionButton" && element.props.action === actionId
    )
    .map(([key]) => key);
  let { layout } = app;
  for (const key of buttons) {
    layout = removeElement(layout, key);
  }
  const elements = Object.fromEntries(
    Object.entries(layout.elements).map(([key, element]) => [
      key,
      element.type === "Card"
        ? {
            ...element,
            props: {
              ...element.props,
              rowActions: element.props.rowActions.filter(
                (id) => id !== actionId
              ),
            },
          }
        : element,
    ])
  );
  const { [actionId]: _refresh, ...refreshAfter } = app.refreshAfter;
  return {
    ...app,
    actions: app.actions.filter((action) => action.id !== actionId),
    layout: { ...layout, elements },
    refreshAfter,
  };
};

export const cardsUsingSource = (
  app: Pick<ReferencedApp, "layout">,
  name: string
): string[] =>
  cardElements(app.layout)
    .filter(([, card]) => cardSourceName(card) === name)
    .map(([key]) => key);

export const MiniAppTarget = z.discriminatedUnion("kind", [
  z.object({ appId: AppId, kind: z.literal("saved") }),
  z.object({ genId: z.string().min(1).max(100), kind: z.literal("draft") }),
]);
export type MiniAppTarget = z.infer<typeof MiniAppTarget>;

const RenderValues = z.record(z.string().max(64), ParamValue);

export const RunMiniAppSourceRequest = z.object({
  runId: z.string().min(1).max(100),
  sourceName: SourceName,
  target: MiniAppTarget,
  values: RenderValues,
});
export type RunMiniAppSourceRequest = z.infer<typeof RunMiniAppSourceRequest>;

export const MiniAppInputOptionsRequest = z.object({
  inputName: Ident,
  target: MiniAppTarget,
});
export type MiniAppInputOptionsRequest = z.infer<
  typeof MiniAppInputOptionsRequest
>;

export const SaveMiniAppRequest = z.object({
  draft: MiniAppDraft,
  fromGenId: z.string().min(1).max(100).optional(),
  reviewedActionIds: z.array(AppActionId).max(MAX_APP_ACTIONS),
});
export type SaveMiniAppRequest = z.infer<typeof SaveMiniAppRequest>;

export const GenerateMiniAppRequest = z.object({
  baseAppId: AppId.nullable(),
  connectionId: z.string().min(1).max(200).nullable(),
  database: z.string().max(500).nullable(),
  genId: z.string().min(1).max(100),
  prompt: z.string().trim().min(1).max(4000),
});
export type GenerateMiniAppRequest = z.infer<typeof GenerateMiniAppRequest>;

export const MiniAppActionRequest = z.object({
  actionId: AppActionId,
  appId: AppId,
  context: ActionContext,
});
export type MiniAppActionRequest = z.infer<typeof MiniAppActionRequest>;

export type MiniAppSourceRun = WidgetRunResult;

// Anything that writes, leaves Conch or calls another service waits for a
// person's tick before it is saved; only copy-to-clipboard doesn't.
export const needsReview = (target: { kind: string }): boolean =>
  target.kind !== "copy";

export type MiniAppGenPhase = "plan" | "sources" | "layout" | "check";
export type MiniAppGenErrorCode =
  | "NO_AI_SETTINGS"
  | "AI_AUTH"
  | "AI_RATE_LIMIT"
  | "AI_NETWORK"
  | "INVALID_APP"
  | "TIMEOUT"
  | "CANCELLED";

export type DraftPatch =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

export type MiniAppGenEvent =
  | { type: "phase"; phase: MiniAppGenPhase; detail: string }
  | { type: "patch"; ops: DraftPatch[] }
  | { type: "sourceResult"; name: string; result: TabularResult }
  | { type: "sourceError"; name: string; message: string; repairing: boolean }
  | { type: "error"; code: MiniAppGenErrorCode; message: string }
  | { type: "done"; draft: MiniAppDraft; notes: string[] };

export interface MiniAppGenEventMessage {
  genId: string;
  event: MiniAppGenEvent;
}

export const sourceKindsOf = (app: Pick<ReferencedApp, "sources">) => [
  ...new Set(Object.values(app.sources).map((source) => source.kind)),
];

const leafText = (leaf: unknown): string => {
  const ref = ParamRef.safeParse(leaf);
  if (!ref.success) {
    return String(leaf);
  }
  const part = ref.data.part ? `.${ref.data.part}` : "";
  return `{{${ref.data.$param}${part}}}`;
};

const queryText = (query: Readonly<Record<string, unknown>>): string => {
  const entries = Object.entries(query);
  return entries.length === 0
    ? ""
    : `?${entries.map(([key, leaf]) => `${key}=${leafText(leaf)}`).join("&")}`;
};

// The whole template a person approves: path, every query value and, for
// HTTP, the body, with each input or row slot written as {{name}}.
export const actionTemplateText = (target: ActionTarget): string => {
  switch (target.kind) {
    case "sql": {
      return target.statementTemplate;
    }
    case "mcp": {
      return `${target.tool} ${JSON.stringify(target.args)}`;
    }
    case "http": {
      const body =
        target.body === null ? "" : ` ${JSON.stringify(target.body)}`;
      return `${target.method} ${target.path}${queryText(target.query)}${body}`;
    }
    case "copy": {
      return target.template;
    }
    case "open-url": {
      return `${target.baseUrl}${target.path}${queryText(target.query)}`;
    }
    default: {
      throw new Error(`Unknown action target ${target satisfies never}`);
    }
  }
};

export const bindSourceLines = (
  bind: Readonly<Record<string, BindSource>>
): string[] =>
  Object.entries(bind).map(([name, source]) => {
    switch (source.from) {
      case "row": {
        return `${name} ← the row's ${source.column}`;
      }
      case "input": {
        return `${name} ← input ${source.name}`;
      }
      default: {
        return `${name} ← ${JSON.stringify(source.value)}`;
      }
    }
  });
