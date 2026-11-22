import type { LanguageModel } from "@conch/agent";
import type {
  CardResult,
  CompiledSource,
  ParamDef,
  ParamValues,
  PreviewSourceRequest,
  ProposeParamsRequest,
  ProposeParamsResult,
  RecentAsk as RecentAskRecord,
  RunSample,
  RunWidgetRequest,
  SourcePreviewResult,
  SourceProposal,
  SourceTarget as SourceTargetValue,
  Widget as WidgetRecord,
  WidgetDraft as WidgetDraftRecord,
  WidgetRunResult,
  WidgetTrend,
} from "@conch/rpc";

import { inferCardSpec, proposeParams, proposeSource } from "@conch/agent";
import {
  CancellationRegistry,
  compileSqlTemplate,
  createRecentAskStore,
  createRunLogStore,
  createWidgetStore,
  DbError,
} from "@conch/core";
import {
  Dialect,
  editableParams,
  MAX_RUN_LOG_ENTRIES_PER_WIDGET,
  MAX_SAMPLES,
  MAX_SELECT_OPTIONS,
  ParamDef as ParamDefSchema,
  parseStoredWidget,
  paramValueSchema,
  RecentAsk,
  RunLogEntry,
  Source,
  SourceTarget,
  sourceParamProblems,
  sqlSourceOf,
  trendOfEntry,
  Widget,
  WIDGET_VERSION,
  WidgetDraft,
} from "@conch/rpc";
import { z } from "zod";

import type { RunCache } from "./run-cache.ts";
import type { SourceRunner } from "./source-runner.ts";

import { sampleOf, valuesKeyOf } from "./run-samples.ts";
import { guardTemplate, templateValues } from "./source-runner.ts";

export const WIDGET_MAX_ROWS = 2000;
const WIDGET_TIMEOUT_MS = 30_000;
const OPTIONS_TTL_MS = 60_000;

const runRequestSchema = z.object({
  runId: z.string().min(1).max(100),
  values: z.record(z.string(), z.unknown()),
  widgetId: z.string().min(1).max(100),
});

const proposeRequestSchema = z.object({
  dialect: Dialect,
  prompt: z.string().max(4000),
  sql: z.string().trim().min(1).max(20_000),
});

const listRecentRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
});

const askIdSchema = z.string().min(1).max(100);

const previewRequestSchema = z.object({
  params: z.array(ParamDefSchema).max(6),
  prompt: z.string().max(4000).optional(),
  runId: z.string().min(1).max(100),
  source: Source,
  values: z.record(z.string(), z.unknown()),
});

const proposeSourceRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  target: SourceTarget,
});

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): T | null => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };

export type WidgetStore = ReturnType<typeof createWidgetStore<WidgetRecord>>;
export type RecentAskStore = ReturnType<
  typeof createRecentAskStore<RecentAskRecord>
>;

export type RunLogStore = ReturnType<typeof createRunLogStore<RunSample>>;

export const defaultWidgetStore = (): WidgetStore =>
  createWidgetStore(parseStoredWidget);
export const defaultRecentAskStore = (): RecentAskStore =>
  createRecentAskStore(parseWith(RecentAsk));
export const defaultRunLogStore = (): RunLogStore =>
  createRunLogStore(parseWith(RunLogEntry), {
    maxEntriesPerWidget: MAX_RUN_LOG_ENTRIES_PER_WIDGET,
    maxSamples: MAX_SAMPLES,
  });

export interface WidgetServiceDeps {
  runner: SourceRunner;
  widgets: WidgetStore;
  recents: RecentAskStore;
  runLog: RunLogStore;
  loadModel(): Promise<LanguageModel | null>;
  now(): Date;
  onSampled(widgetId: string, valuesKey: string): void;
  runCache: Pick<RunCache, "record">;
}

export interface DetachedRun {
  widget: WidgetRecord;
  result: CardResult & { executionTimeMs: number };
  compiled: CompiledSource;
  values: ParamValues;
  valuesKey: string;
  sample: RunSample;
  previous: RunSample | null;
}

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const keptValues = (
  params: readonly ParamDef[],
  values: ParamValues
): ParamValues =>
  Object.fromEntries(
    params.flatMap((param) => {
      const value = values[param.name];
      return value !== undefined &&
        paramValueSchema(param).safeParse(value).success
        ? [[param.name, value]]
        : [];
    })
  );

const rawValues = (
  params: readonly ParamDef[],
  requested: Record<string, unknown>,
  fallback: ParamValues
): Record<string, unknown> =>
  Object.fromEntries(
    params.map((param) => [
      param.name,
      param.fixed
        ? param.default
        : (requested[param.name] ?? fallback[param.name] ?? param.default),
    ])
  );

const editableNames = (widget: WidgetRecord): Set<string> =>
  new Set(editableParams(widget.params).map((param) => param.name));

// A watch snapshots its inputs, so a background run drops inputs the widget
// no longer has and never falls back to the last interactive values.
const detachedValues = (
  widget: WidgetRecord,
  values: ParamValues
): Record<string, unknown> => {
  const names = editableNames(widget);
  const kept = Object.fromEntries(
    Object.entries(values).filter(([name]) => names.has(name))
  );
  return rawValues(widget.params, kept, {});
};

const byRecency = (a: WidgetRecord, b: WidgetRecord): number =>
  (b.lastRunAt ?? b.createdAt).localeCompare(a.lastRunAt ?? a.createdAt);

const firstColumnStrings = (rows: unknown[][]): string[] => [
  ...new Set(
    rows
      .map((row) => row[0])
      .filter((cell) => cell !== null && cell !== undefined)
      .map(String)
  ),
];

export const createWidgetService = (deps: WidgetServiceDeps) => {
  const runs = new CancellationRegistry();
  const optionCache = new Map<string, { options: string[]; at: number }>();

  const requireWidget = async (id: string): Promise<WidgetRecord> => {
    const widget = await deps.widgets.getWidget(id);
    if (!widget) {
      throw failure("WIDGET_NOT_FOUND", "This widget no longer exists.");
    }
    return widget;
  };

  const queryOptions = async (
    widget: WidgetRecord,
    param: ParamDef & { type: "select" }
  ): Promise<string[]> => {
    const source = sqlSourceOf(widget);
    if (!(param.optionsSql && source)) {
      return param.options ?? [];
    }
    const key = `${widget.id}:${param.name}`;
    const cached = optionCache.get(key);
    if (cached && Date.now() - cached.at < OPTIONS_TTL_MS) {
      return cached.options;
    }
    const result = await deps.runner.readSql(
      source,
      param.optionsSql,
      MAX_SELECT_OPTIONS,
      new AbortController().signal
    );
    const options = firstColumnStrings(result.rows);
    optionCache.set(key, { at: Date.now(), options });
    return options;
  };

  const rejectStray = (
    widget: WidgetRecord,
    requested: Record<string, unknown>
  ): void => {
    const names = editableNames(widget);
    const stray = Object.keys(requested).filter((name) => !names.has(name));
    if (stray.length > 0) {
      throw failure("INVALID_INPUT", `Unknown input: ${stray.join(", ")}.`);
    }
  };

  const parseValues = async (
    params: readonly ParamDef[],
    raws: Record<string, unknown>,
    allowedFor: (
      param: ParamDef & { type: "select" }
    ) => Promise<string[] | null> = () => {
      const none = null;
      return Promise.resolve(none);
    }
  ): Promise<ParamValues> => {
    const resolved: ParamValues = {};
    for (const param of params) {
      const allowed = param.type === "select" ? await allowedFor(param) : null;
      const parsed = paramValueSchema(param, allowed ?? undefined).safeParse(
        raws[param.name]
      );
      if (!parsed.success) {
        throw failure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message ?? `${param.label} isn't valid.`
        );
      }
      resolved[param.name] = parsed.data;
    }
    return resolved;
  };

  const resolveValues = (
    widget: WidgetRecord,
    raws: Record<string, unknown>
  ): Promise<ParamValues> =>
    parseValues(widget.params, raws, async (param) =>
      param.optionsSql ? await queryOptions(widget, param) : null
    );

  const execute = async (
    widget: WidgetRecord,
    raws: Record<string, unknown>,
    now: Date,
    signal: AbortSignal
  ) => {
    const resolved = await resolveValues(widget, raws);
    const { compiled, result } = await deps.runner.run(
      { now, params: widget.params, source: widget.source, values: resolved },
      signal
    );
    return { compiled, resolved, result };
  };

  const appendSample = async (
    widget: WidgetRecord,
    valuesKey: string,
    sample: RunSample
  ) => {
    try {
      const entry = await deps.runLog.append(widget.id, valuesKey, sample);
      deps.onSampled(widget.id, valuesKey);
      return entry;
    } catch (error) {
      console.error(
        `[widgets] could not record a run of ${widget.id}: ${String(error)}`
      );
      return null;
    }
  };

  const checkDraft = async (draft: WidgetDraftRecord): Promise<void> => {
    const { source } = draft;
    if (source.kind !== "sql") {
      await deps.runner.check(source, draft.params, deps.now());
      return;
    }
    guardTemplate(source.sqlTemplate, source.dialect);
    try {
      compileSqlTemplate(
        source.sqlTemplate,
        templateValues(draft.params, {}, deps.now()),
        source.dialect
      );
    } catch (error) {
      throw failure("INVALID_TEMPLATE", DbError.fromUnknown(error).message);
    }
  };

  return {
    cancelRun(runId: string): void {
      runs.cancel(runId);
    },

    clearRecentAsks: () => deps.recents.clearRecentAsks(),

    async deleteRecentAsk(askId: string): Promise<void> {
      await deps.recents.removeRecentAsk(askIdSchema.parse(askId));
    },

    async deleteWidget(widgetId: string): Promise<void> {
      const id = z.string().min(1).parse(widgetId);
      await deps.widgets.deleteWidget(id);
      await deps.runLog.removeForWidget(id);
    },

    async lastSampleFor(
      widgetId: string,
      values: ParamValues
    ): Promise<RunSample | null> {
      const widget = await deps.widgets.getWidget(widgetId);
      if (!widget) {
        return null;
      }
      const key = valuesKeyOf(detachedValues(widget, values));
      const entry = await deps.runLog.entry(widget.id, key);
      return entry?.samples.at(-1) ?? null;
    },

    async listRecentAsks(
      request: { limit?: number } = {}
    ): Promise<RecentAskRecord[]> {
      const { limit } = listRecentRequestSchema.parse(request);
      return await deps.recents.listRecentAsks(limit);
    },

    async listWidgetTrends(
      widgetIds: readonly string[]
    ): Promise<Record<string, WidgetTrend>> {
      const ids = z.array(z.string().min(1).max(100)).max(500).parse(widgetIds);
      const latest = await deps.runLog.latestFor(ids);
      return Object.fromEntries(
        Object.entries(latest).map(([id, entry]) => [id, trendOfEntry(entry)])
      );
    },

    async listWidgets(): Promise<WidgetRecord[]> {
      const widgets = await deps.widgets.listWidgets();
      return widgets.toSorted(byRecency);
    },

    async loadParamOptions(
      widgetId: string,
      paramName: string
    ): Promise<string[]> {
      const widget = await requireWidget(widgetId);
      const param = widget.params.find((item) => item.name === paramName);
      if (param?.type !== "select") {
        throw failure("INVALID_INPUT", `"${paramName}" has no options.`);
      }
      return queryOptions(widget, param);
    },

    async previewSource(
      request: PreviewSourceRequest
    ): Promise<SourcePreviewResult> {
      const { params, prompt, runId, source, values } =
        previewRequestSchema.parse(request);
      const [problem] = sourceParamProblems({ params, source });
      if (problem) {
        throw failure("INVALID_TEMPLATE", problem);
      }
      const controller = runs.register(runId);
      try {
        const resolved = await parseValues(
          params,
          rawValues(params, values, {})
        );
        const { compiled, result } = await deps.runner.run(
          { now: deps.now(), params, source, values: resolved },
          controller.signal
        );
        const spec = inferCardSpec(result, { prompt: prompt ?? "", sql: "" });
        return { compiled, result, spec, values: resolved };
      } finally {
        runs.remove(runId);
      }
    },

    async proposeParams(
      request: ProposeParamsRequest
    ): Promise<ProposeParamsResult> {
      const { sql, prompt, dialect } = proposeRequestSchema.parse(request);
      const model = await deps.loadModel();
      if (!model) {
        return { error: "Add an AI provider in Settings to find inputs." };
      }
      return proposeParams({
        dialect,
        model,
        now: deps.now(),
        prompt,
        signal: AbortSignal.timeout(WIDGET_TIMEOUT_MS),
        sql,
      });
    },

    async proposeSource(request: {
      target: SourceTargetValue;
      prompt: string;
    }): Promise<SourceProposal> {
      const { prompt, target } = proposeSourceRequestSchema.parse(request);
      const model = await deps.loadModel();
      if (!model) {
        return {
          error: "Add an AI provider in Settings, or fill the call in by hand.",
        };
      }
      return proposeSource({
        model,
        now: deps.now(),
        prompt,
        signal: AbortSignal.timeout(WIDGET_TIMEOUT_MS),
        target: await deps.runner.proposalTarget(target),
      });
    },

    rememberAsk: (ask: RecentAskRecord) => deps.recents.pushRecentAsk(ask),

    async runDetached(
      widgetId: string,
      values: ParamValues,
      signal: AbortSignal,
      { record = true }: { record?: boolean } = {}
    ): Promise<DetachedRun> {
      const widget = await requireWidget(widgetId);
      const now = deps.now();
      const { compiled, resolved, result } = await execute(
        widget,
        detachedValues(widget, values),
        now,
        signal
      );
      const valuesKey = valuesKeyOf(resolved);
      const sample = sampleOf(widget.spec, result, now);
      const entry = record
        ? await appendSample(widget, valuesKey, sample)
        : null;
      return {
        compiled,
        previous: entry?.samples.at(-2) ?? null,
        result,
        sample,
        values: resolved,
        valuesKey,
        widget,
      };
    },

    // Only launcher runs are kept for row actions; boards pass cacheRun false.
    async runWidget(
      request: RunWidgetRequest,
      { cacheRun = false }: { cacheRun?: boolean } = {}
    ): Promise<WidgetRunResult> {
      const { runId, values, widgetId } = runRequestSchema.parse(request);
      const widget = await requireWidget(widgetId);
      rejectStray(widget, values);
      const now = deps.now();
      const controller = runs.register(runId);
      try {
        const { compiled, resolved, result } = await execute(
          widget,
          rawValues(widget.params, values, widget.lastValues),
          now,
          controller.signal
        );
        if (cacheRun) {
          deps.runCache.record(runId, widget.id, result);
        }
        await deps.widgets.updateWidget(widget.id, (current) => ({
          ...current,
          lastRunAt: now.toISOString(),
          lastValues: resolved,
        }));
        const entry = await appendSample(
          widget,
          valuesKeyOf(resolved),
          sampleOf(widget.spec, result, now)
        );
        return {
          compiled,
          result,
          trend: entry ? trendOfEntry(entry) : null,
          values: resolved,
        };
      } finally {
        runs.remove(runId);
      }
    },

    async saveWidget(input: WidgetDraftRecord): Promise<WidgetRecord> {
      const draft = WidgetDraft.parse(input);
      await checkDraft(draft);
      const existing = draft.id ? await deps.widgets.getWidget(draft.id) : null;
      const stamp = deps.now().toISOString();
      const widget = Widget.parse({
        ...draft,
        createdAt: existing?.createdAt ?? stamp,
        id: draft.id ?? crypto.randomUUID(),
        lastRunAt: existing?.lastRunAt ?? null,
        lastValues: keptValues(draft.params, draft.lastValues),
        updatedAt: stamp,
        version: WIDGET_VERSION,
      });
      return deps.widgets.saveWidget(widget);
    },
  };
};

export type WidgetService = ReturnType<typeof createWidgetService>;
