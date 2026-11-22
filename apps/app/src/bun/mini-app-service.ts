import type {
  ActionDef,
  ActionOutcome,
  ActionPreview,
  ParamDef,
  ParamValues,
  Source,
} from "@conch/rpc";
import type {
  AppActionDraft,
  MiniApp as MiniAppValue,
  MiniAppDraft as MiniAppDraftValue,
  MiniAppSourceRun,
  MiniAppTarget as MiniAppTargetValue,
} from "@conch/rpc/mini-app";

import { CancellationRegistry, compileSqlTemplate, DbError } from "@conch/core";
import { createMiniAppStore } from "@conch/core/mini-apps";
import {
  canonicalJson,
  effectLabel,
  paramValueSchema,
  sharedKey,
  writeTargetOf,
} from "@conch/rpc";
import {
  actionTemplateText,
  bindSourceLines,
  cardElements,
  cardSourceName,
  inputValuesOf,
  MAX_APP_INPUT_OPTIONS,
  MINI_APP_VERSION,
  MiniApp,
  MiniAppActionRequest,
  MiniAppInputOptionsRequest,
  needsReview,
  paramsForSource,
  parseStoredMiniApp,
  RunMiniAppSourceRequest,
  SaveMiniAppRequest,
  sourceOf,
} from "@conch/rpc/mini-app";
import { z } from "zod";

import type { ActionOwner } from "./action-compile.ts";
import type { ActionService } from "./action-service.ts";
import type { ConfirmNative } from "./native-confirm.ts";
import type { RunCache } from "./run-cache.ts";
import type { SourceRunner } from "./source-runner.ts";
import type { WritePermissions } from "./write-permissions.ts";

import { guardTemplate, templateValues } from "./source-runner.ts";

const OPTIONS_TTL_MS = 60_000;
const MAX_TOKENS = 50;

export type MiniAppStore = ReturnType<typeof createMiniAppStore<MiniAppValue>>;

export const defaultMiniAppStore = (): MiniAppStore =>
  createMiniAppStore(parseStoredMiniApp);

export interface MiniAppServiceDeps {
  store: MiniAppStore;
  draftOf(genId: string): MiniAppDraftValue | null;
  runner: Pick<SourceRunner, "run" | "check">;
  runCache: Pick<RunCache, "record">;
  actions: Pick<
    ActionService,
    "effectOf" | "prepareFor" | "reviewHashOf" | "stampReviewed"
  >;
  permissions: Pick<WritePermissions, "isAllowed">;
  confirm: ConfirmNative;
  now(): Date;
  newId(): string;
  onChanged(appId: string): void;
  onRefresh(appId: string, sources: string[]): void;
}

type AppLike = Pick<
  MiniAppDraftValue,
  "inputs" | "inputOptions" | "sources" | "values" | "layout"
>;

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const AppId = z.string().min(1).max(100);

// Row values for a mini-app action come from bun's own run of the source a
// card shows, so the run cache keys each run by app and source.
export const miniAppRunOwner = (appId: string, sourceName: string): string =>
  `app:${appId}/${sourceName}`;

const firstColumnStrings = (rows: unknown[][]): string[] => [
  ...new Set(
    rows
      .map((row) => row[0])
      .filter((cell) => cell !== null && cell !== undefined)
      .map(String)
  ),
];

const sourcesShowingAction = (app: AppLike, actionId: string): Set<string> =>
  new Set(
    cardElements(app.layout)
      .filter(([, card]) => card.props.rowActions.includes(actionId))
      .map(([, card]) => cardSourceName(card))
  );

export const appOwner = (
  app: AppLike & { id?: string },
  actionId: string
): ActionOwner => {
  const sources = sourcesShowingAction(app, actionId);
  const appId = app.id ?? "";
  return {
    id: appId,
    lastValues: inputValuesOf(app.inputs, app.values),
    noun: "app",
    ownsRun: (runOwnerId) =>
      [...sources].some(
        (source) => runOwnerId === miniAppRunOwner(appId, source)
      ),
    params: app.inputs,
  };
};

const keptValues = (
  inputs: readonly ParamDef[],
  values: Readonly<Record<string, unknown>>
): ParamValues =>
  Object.fromEntries(
    inputs.flatMap((input) => {
      const key = sharedKey(input);
      const parsed = paramValueSchema(input).safeParse(values[key]);
      return Object.hasOwn(values, key) && parsed.success
        ? [[key, parsed.data]]
        : [];
    })
  );

interface ResolvedTarget {
  app: AppLike;
  appId: string | null;
  cacheKey: string;
}

export const STAGE_GAP_MS = 1000;
export const STAGE_WINDOW_MS = 60_000;
export const MAX_STAGES_PER_WINDOW = 20;

export interface StageOrigin {
  appId: string;
  focused: boolean;
}

export type SaveOrigin =
  | { kind: "launcher" }
  | { kind: "window"; appId: string };

const LAUNCHER: SaveOrigin = { kind: "launcher" };

const sameJson = (a: unknown, b: unknown): boolean =>
  canonicalJson(a) === canonicalJson(b);

const inputKept = (input: ParamDef, known: readonly ParamDef[]): boolean =>
  known.some(
    (item) =>
      sameJson({ ...input, fixed: undefined }, { ...item, fixed: undefined }) &&
      (input.fixed === true || !item.fixed)
  );

const actionShape = ({ bind, id, label, scope, target }: AppActionDraft) => ({
  bind,
  id,
  label,
  scope,
  target,
});

export const createMiniAppService = (deps: MiniAppServiceDeps) => {
  const runs = new CancellationRegistry();
  const optionCache = new Map<string, { options: string[]; at: number }>();
  const prepared = new Map<string, { appId: string; actionId: string }>();
  const stages = new Map<string, number[]>();

  // An app window may rearrange, rename, retire inputs and drop parts, but
  // every source, action and input it saves must already be in the stored
  // app or in a draft bun itself generated for this app.
  const assertWindowEdit = (
    draft: MiniAppDraftValue,
    existing: MiniAppValue | null,
    appId: string,
    fromGenId: string | undefined
  ): void => {
    if (!(existing && draft.id === appId)) {
      throw failure(
        "NOT_THIS_WINDOW",
        "This window can only change its own app."
      );
    }
    const generated = fromGenId ? deps.draftOf(fromGenId) : null;
    if (fromGenId && generated?.id !== appId) {
      throw failure("DRAFT_GONE", "This change has ended. Ask for it again.");
    }
    const known = [existing, ...(generated ? [generated] : [])];
    for (const [name, source] of Object.entries(draft.sources)) {
      if (!known.some((app) => sameJson(sourceOf(app, name), source))) {
        throw failure(
          "WINDOW_EDIT_REFUSED",
          `${name} is new here; change it from the launcher.`
        );
      }
    }
    for (const action of draft.actions) {
      const shape = actionShape(action);
      const matches = known.some((app) =>
        app.actions.some((item) => sameJson(actionShape(item), shape))
      );
      if (!matches) {
        throw failure(
          "WINDOW_EDIT_REFUSED",
          `“${action.label}” is new here; change it from the launcher.`
        );
      }
    }
    for (const input of draft.inputs) {
      if (!known.some((app) => inputKept(input, app.inputs))) {
        throw failure(
          "WINDOW_EDIT_REFUSED",
          `${input.label} is new here; change it from the launcher.`
        );
      }
    }
  };

  const requireApp = async (appId: string): Promise<MiniAppValue> => {
    const app = await deps.store.getMiniApp(AppId.parse(appId));
    if (!app) {
      throw failure("APP_NOT_FOUND", "This app no longer exists.");
    }
    return app;
  };

  // Bun never runs a definition the renderer sends: a saved app is read
  // from mini-apps.enc, a preview from the draft bun generated itself.
  const resolveTarget = async (
    target: MiniAppTargetValue
  ): Promise<ResolvedTarget> => {
    if (target.kind === "saved") {
      const app = await requireApp(target.appId);
      return { app, appId: app.id, cacheKey: `saved:${app.id}` };
    }
    const draft = deps.draftOf(target.genId);
    if (!draft) {
      throw failure(
        "DRAFT_GONE",
        "This preview has ended. Build the app again to run it."
      );
    }
    return { app: draft, appId: null, cacheKey: `draft:${target.genId}` };
  };

  const requireSource = (app: AppLike, name: string): Source => {
    const source = sourceOf(app, name);
    if (!source) {
      throw failure("SOURCE_NOT_FOUND", `The app has no source named ${name}.`);
    }
    return source;
  };

  const runSource = (
    resolved: ResolvedTarget,
    source: Source,
    values: ParamValues,
    signal: AbortSignal
  ) => {
    const params = paramsForSource(source, resolved.app.inputs);
    return deps.runner.run({ now: deps.now(), params, source, values }, signal);
  };

  const optionsFor = async (
    resolved: ResolvedTarget,
    input: ParamDef & { type: "select" }
  ): Promise<string[] | null> => {
    const sourceName = Object.hasOwn(resolved.app.inputOptions, input.name)
      ? resolved.app.inputOptions[input.name]
      : undefined;
    if (!sourceName) {
      return input.options ?? null;
    }
    const key = `${resolved.cacheKey}:${input.name}`;
    const cached = optionCache.get(key);
    if (cached && Date.now() - cached.at < OPTIONS_TTL_MS) {
      return cached.options;
    }
    const source = requireSource(resolved.app, sourceName);
    const defaults = inputValuesOf(resolved.app.inputs, resolved.app.values);
    const { result } = await runSource(
      resolved,
      source,
      defaults,
      new AbortController().signal
    );
    const options = firstColumnStrings(result.rows).slice(
      0,
      MAX_APP_INPUT_OPTIONS
    );
    optionCache.set(key, { at: Date.now(), options });
    return options;
  };

  const resolveValues = async (
    resolved: ResolvedTarget,
    params: readonly ParamDef[],
    requested: Readonly<Record<string, unknown>>
  ): Promise<ParamValues> => {
    const names = new Set(resolved.app.inputs.map((input) => input.name));
    const stray = Object.keys(requested).filter((name) => !names.has(name));
    if (stray.length > 0) {
      throw failure("INVALID_INPUT", `Unknown input: ${stray.join(", ")}.`);
    }
    const stored = inputValuesOf(resolved.app.inputs, resolved.app.values);
    const values: ParamValues = {};
    for (const param of params) {
      const raw = param.fixed
        ? param.default
        : (requested[param.name] ?? stored[param.name] ?? param.default);
      const allowed =
        param.type === "select" ? await optionsFor(resolved, param) : null;
      const parsed = paramValueSchema(param, allowed ?? undefined).safeParse(
        raw
      );
      if (!parsed.success) {
        throw failure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
        );
      }
      values[param.name] = parsed.data;
    }
    return values;
  };

  const checkSources = async (draft: MiniAppDraftValue): Promise<void> => {
    for (const [name, source] of Object.entries(draft.sources)) {
      const params = paramsForSource(source, draft.inputs);
      try {
        if (source.kind === "sql") {
          guardTemplate(source.sqlTemplate, source.dialect);
          compileSqlTemplate(
            source.sqlTemplate,
            templateValues(params, {}, deps.now()),
            source.dialect
          );
        } else {
          await deps.runner.check(source, params, deps.now());
        }
      } catch (error) {
        const problem = DbError.fromUnknown(error);
        throw failure(problem.code, `${name}: ${problem.message}`);
      }
    }
  };

  // An action the person already reviewed keeps its stamp; anything new or
  // changed that writes needs their tick, the target's opt-in and 019's
  // native review before it is saved.
  const reviewAction = async (
    draft: AppActionDraft,
    app: MiniAppDraftValue & { id: string },
    existing: ActionDef | null,
    reviewedIds: ReadonlySet<string>
  ): Promise<ActionDef> => {
    if (existing && existing.reviewHash === deps.actions.reviewHashOf(draft)) {
      return existing;
    }
    if (needsReview(draft.target) && !reviewedIds.has(draft.id)) {
      throw failure(
        "ACTION_NOT_REVIEWED",
        `Review “${draft.label}” before saving the app.`
      );
    }
    const { effect, targetName } = await deps.actions.effectOf(draft.target);
    if (effect === "write") {
      const ref = writeTargetOf(draft.target);
      if (!(ref && (await deps.permissions.isAllowed(ref.kind, ref.id)))) {
        throw failure(
          "WRITES_NOT_ALLOWED",
          `“${draft.label}” writes to ${targetName}, where write actions are off. Turn on Allow write actions in its settings, or remove the action.`
        );
      }
    }
    const stamped = await deps.actions.stampReviewed(
      draft,
      appOwner(app, draft.id),
      existing
    );
    return { ...stamped, id: draft.id };
  };

  // Ticks come from the renderer, so a window can't vouch for itself: any
  // action it adds or changes that does more than copy needs a native
  // confirm a webview can't click, Cancel by default.
  const confirmWindowActions = async (
    draft: MiniAppDraftValue,
    existing: MiniAppValue | null,
    reviewed: ReadonlySet<string>
  ): Promise<void> => {
    const lines: string[] = [];
    for (const action of draft.actions) {
      if (!needsReview(action.target)) {
        continue;
      }
      const stored = existing?.actions.find((item) => item.id === action.id);
      const { effect } = await deps.actions.effectOf(action.target);
      const unchanged =
        stored?.reviewHash === deps.actions.reviewHashOf(action) &&
        stored.effect === effect;
      if (!unchanged && !reviewed.has(action.id)) {
        throw failure(
          "ACTION_NOT_REVIEWED",
          `Review “${action.label}” before saving the app.`
        );
      }
      if (!unchanged) {
        const values = bindSourceLines(action.bind);
        lines.push(
          [
            `${action.label} — ${effectLabel(effect)}`,
            actionTemplateText(action.target),
            ...(values.length > 0 ? [`Values: ${values.join("; ")}`] : []),
          ].join("\n")
        );
      }
    }
    if (lines.length === 0) {
      return;
    }
    const accepted = await deps.confirm({
      confirmLabel: "Save App",
      detail: lines.join("\n\n"),
      message: `Save “${draft.name}” with ${lines.length === 1 ? "this new action" : `these ${lines.length} new actions`}?`,
      title: "Save app actions",
    });
    if (!accepted) {
      throw failure(
        "REVIEW_DECLINED",
        "Not saved. The app's new actions need your approval."
      );
    }
  };

  const appTarget = (appId: string, actionId: string) => ({
    reload: async () => {
      const app = await deps.store.getMiniApp(appId);
      return app?.actions.find((action) => action.id === actionId) ?? null;
    },
  });

  const remember = (token: string, appId: string, actionId: string) => {
    prepared.set(token, { actionId, appId });
    while (prepared.size > MAX_TOKENS) {
      const [oldest] = prepared.keys();
      if (oldest === undefined) {
        return;
      }
      prepared.delete(oldest);
    }
  };

  return {
    // Bun knows which tokens it issued for an app; a finished one re-runs
    // the sources the app lists for that action.
    async afterExecute(token: string, outcome: ActionOutcome): Promise<void> {
      const entry = prepared.get(token);
      prepared.delete(token);
      if (!(entry && outcome.ok)) {
        return;
      }
      const app = await deps.store.getMiniApp(entry.appId);
      const refreshed = app?.refreshAfter[entry.actionId] ?? [];
      deps.onRefresh(entry.appId, [...refreshed]);
    },

    cancelRun(runId: unknown): void {
      runs.cancel(z.string().max(100).parse(runId));
    },

    async deleteMiniApp(appId: unknown): Promise<void> {
      const id = AppId.parse(appId);
      await deps.store.deleteMiniApp(id);
      deps.onChanged(id);
    },

    async duplicateMiniApp(appId: unknown): Promise<MiniAppValue> {
      const app = await requireApp(AppId.parse(appId));
      const stamp = deps.now().toISOString();
      const copy = MiniApp.parse({
        ...app,
        createdAt: stamp,
        id: deps.newId(),
        lastOpenedAt: null,
        name: `${app.name} copy`.slice(0, 60),
        updatedAt: stamp,
      });
      await deps.store.saveMiniApp(copy);
      deps.onChanged(copy.id);
      return copy;
    },

    getMiniApp: (appId: unknown): Promise<MiniAppValue | null> =>
      deps.store.getMiniApp(AppId.parse(appId)),

    async listMiniApps(): Promise<MiniAppValue[]> {
      const apps = await deps.store.listMiniApps();
      return apps.toSorted((a, b) =>
        (b.lastOpenedAt ?? b.updatedAt).localeCompare(
          a.lastOpenedAt ?? a.updatedAt
        )
      );
    },

    async loadInputOptions(request: unknown): Promise<string[]> {
      const { target, inputName } = MiniAppInputOptionsRequest.parse(request);
      const resolved = await resolveTarget(target);
      const input = resolved.app.inputs.find((item) => item.name === inputName);
      if (input?.type !== "select") {
        throw failure("INVALID_INPUT", `${inputName} isn't a select input.`);
      }
      return (await optionsFor(resolved, input)) ?? [];
    },

    async markOpened(appId: unknown): Promise<void> {
      const stamp = deps.now().toISOString();
      await deps.store.updateMiniApp(AppId.parse(appId), (app) => ({
        ...app,
        lastOpenedAt: stamp,
      }));
    },

    async prepareAction(request: unknown): Promise<ActionPreview> {
      const { appId, actionId, context } = MiniAppActionRequest.parse(request);
      const app = await requireApp(appId);
      const action = app.actions.find((item) => item.id === actionId);
      if (!action) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      const preview = await deps.actions.prepareFor(action, context, {
        auditWidgetId: null,
        owner: appOwner(app, actionId),
        ...appTarget(app.id, actionId),
      });
      remember(preview.token, app.id, actionId);
      return preview;
    },

    // A window only stages an action: bun checks it exists and the launcher
    // prepares and confirms it.
    async runSource(request: unknown): Promise<MiniAppSourceRun> {
      const { target, sourceName, values, runId } =
        RunMiniAppSourceRequest.parse(request);
      const resolved = await resolveTarget(target);
      const source = requireSource(resolved.app, sourceName);
      const params = paramsForSource(source, resolved.app.inputs);
      const resolvedValues = await resolveValues(resolved, params, values);
      const controller = runs.register(runId);
      try {
        const { compiled, result } = await runSource(
          resolved,
          source,
          resolvedValues,
          controller.signal
        );
        if (resolved.appId) {
          deps.runCache.record(
            runId,
            miniAppRunOwner(resolved.appId, sourceName),
            result
          );
        }
        return { compiled, result, values: resolvedValues };
      } finally {
        runs.remove(runId);
      }
    },

    async saveMiniApp(
      request: unknown,
      origin: SaveOrigin = LAUNCHER
    ): Promise<MiniAppValue> {
      const { draft, reviewedActionIds, fromGenId } =
        SaveMiniAppRequest.parse(request);
      const existing = draft.id ? await deps.store.getMiniApp(draft.id) : null;
      if (origin.kind === "window") {
        assertWindowEdit(draft, existing, origin.appId, fromGenId);
      }
      const id = existing?.id ?? deps.newId();
      await checkSources(draft);
      const reviewed = new Set(reviewedActionIds);
      if (origin.kind === "window") {
        await confirmWindowActions(draft, existing, reviewed);
      }
      const withId = { ...draft, id };
      const actions: ActionDef[] = [];
      for (const action of draft.actions) {
        const stored =
          existing?.actions.find((item) => item.id === action.id) ?? null;
        actions.push(await reviewAction(action, withId, stored, reviewed));
      }
      const stamp = deps.now().toISOString();
      const app = MiniApp.parse({
        ...draft,
        actions,
        createdAt: existing?.createdAt ?? stamp,
        id,
        lastOpenedAt: existing?.lastOpenedAt ?? null,
        updatedAt: stamp,
        values: keptValues(draft.inputs, draft.values),
        version: MINI_APP_VERSION,
      });
      await deps.store.saveMiniApp(app);
      deps.onChanged(app.id);
      return app;
    },

    async setValues(request: unknown): Promise<MiniAppValue | null> {
      const { appId, values } = z
        .object({ appId: AppId, values: z.record(z.string(), z.unknown()) })
        .parse(request);
      const updated = await deps.store.updateMiniApp(appId, (app) => ({
        ...app,
        values: { ...app.values, ...keptValues(app.inputs, values) },
      }));
      if (updated) {
        deps.onChanged(appId);
      }
      return updated;
    },

    // Only the app's own window, while it has (or just had) focus, may
    // stage its actions, and no faster than a person can click.
    async stageAction(request: unknown, from: StageOrigin) {
      const parsed = MiniAppActionRequest.parse(request);
      if (parsed.appId !== from.appId) {
        throw failure(
          "NOT_THIS_WINDOW",
          "Only the app's own window can run it."
        );
      }
      if (!from.focused) {
        throw failure(
          "WINDOW_NOT_FOCUSED",
          "Click the action in the app window."
        );
      }
      const now = deps.now().getTime();
      const recent = (stages.get(parsed.appId) ?? []).filter(
        (at) => now - at < STAGE_WINDOW_MS
      );
      const last = recent.at(-1);
      if (
        (last !== undefined && now - last < STAGE_GAP_MS) ||
        recent.length >= MAX_STAGES_PER_WINDOW
      ) {
        throw failure(
          "STAGE_TOO_FAST",
          "Wait a moment before running another action."
        );
      }
      stages.set(parsed.appId, [...recent, now]);
      const app = await requireApp(parsed.appId);
      if (!app.actions.some((action) => action.id === parsed.actionId)) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      return parsed;
    },
  };
};

export type MiniAppService = ReturnType<typeof createMiniAppService>;
