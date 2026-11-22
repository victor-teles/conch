import type { TabularResult } from "@conch/core";
import type { ParamDef, Source } from "@conch/rpc";
import type {
  AppActionDraft,
  DraftPatch,
  DraftState,
  MiniAppDraft,
  MiniAppGenErrorCode,
  MiniAppGenEvent,
} from "@conch/rpc/mini-app";
import type { LanguageModel, ModelMessage } from "ai";

import { compileSqlTemplate, DbError } from "@conch/core/client";
import { toTemplateValue } from "@conch/rpc";
import {
  applyDraftPatch,
  cardElements,
  cardSourceName,
  draftStateOf,
  emptyDraftState,
  paramsForSource,
  parseDraftState,
  parsePatchLine,
  sourceInputNames,
  sourceOf,
} from "@conch/rpc/mini-app";

import type { ActionTargetCatalog, SourceCatalog } from "./mini-app-prompt.ts";

import { classifyAIError } from "./ai-errors.ts";
import { checkCardAgainstResult } from "./check-card-spec.ts";
import { computeColumnStats } from "./column-stats.ts";
import {
  catalogBlock,
  panelCatalogPrompt,
  repairMessage,
  requestMessage,
} from "./mini-app-prompt.ts";
import { modelText } from "./model-text.ts";
import { coalesceText } from "./sql-stream.ts";

export const MINI_APP_GEN_TIMEOUT_MS = 90_000;
export const MAX_EARLY_RUNS = 3;
export const MAX_APP_REPAIRS = 2;

export interface MiniAppGenInput {
  prompt: string;
  base: MiniAppDraft | null;
  catalog: SourceCatalog;
  actionTargets: ActionTargetCatalog;
}

export interface MiniAppGenPorts {
  model: LanguageModel;
  runSource(
    source: Source,
    inputs: readonly ParamDef[],
    signal: AbortSignal
  ): Promise<TabularResult>;
  now(): Date;
}

class GenFailure extends Error {
  readonly code: MiniAppGenErrorCode;

  constructor(code: MiniAppGenErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const AI_ERROR_CODES = {
  auth: "AI_AUTH",
  context_length: "AI_NETWORK",
  model_not_found: "AI_AUTH",
  network: "AI_NETWORK",
  provider_error: "AI_NETWORK",
  rate_limit: "AI_RATE_LIMIT",
  unknown: "AI_NETWORK",
} as const satisfies Record<string, MiniAppGenErrorCode>;

const failureOf = (
  error: unknown,
  signal: AbortSignal,
  timeout: AbortSignal
): GenFailure => {
  if (timeout.aborted) {
    return new GenFailure("TIMEOUT", "Building the app took too long.");
  }
  if (signal.aborted) {
    return new GenFailure("CANCELLED", "Stopped.");
  }
  if (error instanceof GenFailure) {
    return error;
  }
  const classified = classifyAIError(error);
  return new GenFailure(
    AI_ERROR_CODES[classified.type],
    `${classified.message} ${classified.suggestion}`
  );
};

// Generation runs a source only when it can't change anything: SQL runs
// through the read-only guard, HTTP sources are GET, and an MCP tool counts
// only with the server's own readOnlyHint.
export const isGenerationRead = (
  source: Source,
  catalog: SourceCatalog
): boolean => {
  if (source.kind !== "mcp") {
    return true;
  }
  const server = catalog.mcpServers.find((item) => item.id === source.serverId);
  const tool = server?.tools.find((item) => item.name === source.tool);
  return tool?.readOnlyHint === true;
};

type RunOutcome =
  | { ok: true; result: TabularResult }
  | { ok: false; message: string };

interface SourceRunsOptions {
  ports: MiniAppGenPorts;
  catalog: SourceCatalog;
  signal: AbortSignal;
  repairsLeft: () => boolean;
}

const runKey = (source: Source, inputs: readonly ParamDef[]) =>
  JSON.stringify({ inputs: paramsForSource(source, inputs), source });

interface QueuedRun {
  name: string;
  key: string;
  source: Source;
  inputs: ParamDef[];
}

const createSourceRuns = ({
  ports,
  catalog,
  signal,
  repairsLeft,
}: SourceRunsOptions) => {
  const outcomes = new Map<string, { key: string; outcome: RunOutcome }>();
  const pending = new Map<string, Promise<void>>();
  const queue: QueuedRun[] = [];
  const ready: MiniAppGenEvent[] = [];
  let active = 0;

  const settle = (name: string, key: string, outcome: RunOutcome) => {
    outcomes.set(name, { key, outcome });
    ready.push(
      outcome.ok
        ? { name, result: outcome.result, type: "sourceResult" }
        : {
            message: outcome.message,
            name,
            repairing: repairsLeft(),
            type: "sourceError",
          }
    );
  };

  const outcomeOf = async (next: QueuedRun): Promise<RunOutcome> => {
    try {
      const result = await ports.runSource(
        next.source,
        paramsForSource(next.source, next.inputs),
        signal
      );
      return { ok: true, result };
    } catch (error) {
      return { message: DbError.fromUnknown(error).message, ok: false };
    }
  };

  const launch = async (next: QueuedRun): Promise<void> => {
    try {
      const outcome = await outcomeOf(next);
      if (!signal.aborted) {
        settle(next.name, next.key, outcome);
      }
    } finally {
      active -= 1;
      pending.delete(next.key);
      pump();
    }
  };

  function pump(): void {
    let next = active < MAX_EARLY_RUNS ? queue.shift() : undefined;
    while (next) {
      active += 1;
      pending.set(next.key, launch(next));
      next = active < MAX_EARLY_RUNS ? queue.shift() : undefined;
    }
  }

  return {
    // A source that isn't a read never runs; the check reports it instead.
    ensure(name: string, source: Source, inputs: readonly ParamDef[]): boolean {
      if (!isGenerationRead(source, catalog)) {
        return false;
      }
      const key = runKey(source, inputs);
      const known = outcomes.get(name);
      const queued = queue.some((item) => item.key === key);
      if (known?.key === key || pending.has(key) || queued) {
        return false;
      }
      queue.push({ inputs: [...inputs], key, name, source });
      pump();
      return true;
    },
    outcomeOf(name: string, source: Source, inputs: readonly ParamDef[]) {
      const known = outcomes.get(name);
      return known?.key === runKey(source, inputs) ? known.outcome : null;
    },
    take(): MiniAppGenEvent[] {
      return ready.splice(0);
    },
    async whenIdle(): Promise<void> {
      while (pending.size > 0 || queue.length > 0) {
        await Promise.all(pending.values());
      }
    },
  };
};

type SourceRuns = ReturnType<typeof createSourceRuns>;

const SOURCE_PATH = /^\/sources\/([a-z][a-z0-9_]{0,31})$/;

interface StreamContext {
  ports: MiniAppGenPorts;
  system: string;
  messages: ModelMessage[];
  runs: SourceRuns;
  signal: AbortSignal;
}

interface StreamResult {
  state: DraftState;
  text: string;
  dropped: string[];
}

const isNoise = (line: string): boolean => {
  const text = line.trim();
  return text === "" || text.startsWith("```");
};

async function* streamOps(
  start: DraftState,
  { ports, system, messages, runs, signal }: StreamContext
): AsyncGenerator<MiniAppGenEvent, StreamResult> {
  let state = start;
  let text = "";
  let buffer = "";
  let lineNumber = 0;
  let laidOut = false;
  let checking = false;
  const dropped: string[] = [];

  const applyLine = (
    line: string,
    ops: DraftPatch[],
    events: MiniAppGenEvent[]
  ) => {
    lineNumber += 1;
    if (isNoise(line)) {
      return;
    }
    const op = parsePatchLine(line);
    if (!op) {
      dropped.push(`Line ${lineNumber} isn't one JSON Patch op.`);
      return;
    }
    const result = applyDraftPatch(state, op);
    if (!result.ok) {
      dropped.push(`Line ${lineNumber} was skipped: ${result.reason}`);
      return;
    }
    state = result.draft;
    ops.push(op);
    const sourceName = SOURCE_PATH.exec(op.path)?.[1];
    const source = sourceName ? sourceOf(state, sourceName) : null;
    if (
      sourceName &&
      source &&
      runs.ensure(sourceName, source, state.inputs) &&
      !checking
    ) {
      checking = true;
      events.push({
        detail: `Checking ${sourceName}…`,
        phase: "sources",
        type: "phase",
      });
    }
    if (op.path.startsWith("/layout/") && !laidOut) {
      laidOut = true;
      events.push({ detail: "Laying out…", phase: "layout", type: "phase" });
    }
  };

  const applyLines = (lines: readonly string[]) => {
    const ops: DraftPatch[] = [];
    const events: MiniAppGenEvent[] = [];
    for (const line of lines) {
      applyLine(line, ops, events);
    }
    return { events, ops };
  };

  const flush = function* flush(lines: readonly string[]) {
    const { events, ops } = applyLines(lines);
    if (ops.length > 0) {
      yield { ops, type: "patch" } satisfies MiniAppGenEvent;
    }
    yield* events;
    yield* runs.take();
  };

  for await (const chunk of coalesceText(
    modelText(ports.model, system, messages, signal)
  )) {
    text += chunk;
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    yield* flush(lines);
  }
  yield* flush([buffer]);
  return { dropped, state, text };
}

const defaultsOf = (inputs: readonly ParamDef[], now: Date) =>
  Object.fromEntries(
    inputs.map((input) => [
      input.name,
      toTemplateValue(input, input.default, now),
    ])
  );

const templateProblem = (
  name: string,
  source: Source,
  inputs: readonly ParamDef[],
  now: Date
): string | null => {
  if (source.kind !== "sql") {
    return null;
  }
  try {
    compileSqlTemplate(
      source.sqlTemplate,
      defaultsOf(paramsForSource(source, inputs), now),
      source.dialect
    );
    const unknown = sourceInputNames(source).filter(
      (input) => !inputs.some((item) => item.name === input)
    );
    return unknown.length > 0
      ? `${name} uses {{${unknown[0]}}}, which isn't an input.`
      : null;
  } catch (error) {
    return `${name}: ${DbError.fromUnknown(error).message}`;
  }
};

const catalogProblem = (
  name: string,
  source: Source,
  catalog: SourceCatalog
): string | null => {
  switch (source.kind) {
    case "sql": {
      return catalog.connection?.id === source.connectionId
        ? null
        : `${name} reads a connection that isn't in the catalog.`;
    }
    case "mcp": {
      const server = catalog.mcpServers.find(
        (item) => item.id === source.serverId
      );
      if (!server?.tools.some((tool) => tool.name === source.tool)) {
        return `${name} calls a tool that isn't in the catalog.`;
      }
      return isGenerationRead(source, catalog)
        ? null
        : `${name} calls ${source.tool}, which can change data; sources only read.`;
    }
    case "http": {
      return catalog.httpEndpoints.some((item) => item.id === source.endpointId)
        ? null
        : `${name} reads an endpoint that isn't in the catalog.`;
    }
    default: {
      throw new Error(`Unknown source ${source satisfies never}`);
    }
  }
};

const unusedInputs = (state: DraftState): string[] => {
  const used = new Set([
    ...Object.values(state.sources).flatMap(sourceInputNames),
    ...state.actions.flatMap((action) =>
      Object.values(action.bind).flatMap((bind) =>
        bind.from === "input" ? [bind.name] : []
      )
    ),
  ]);
  return state.inputs
    .filter((input) => !(input.fixed || used.has(input.name)))
    .map((input) => `The input "${input.name}" isn't used by any source.`);
};

const cardProblems = (state: DraftState, runs: SourceRuns): string[] =>
  cardElements(state.layout).flatMap(([key, card]) => {
    const source = sourceOf(state, cardSourceName(card));
    const outcome = source
      ? runs.outcomeOf(cardSourceName(card), source, state.inputs)
      : null;
    if (!outcome?.ok || outcome.result.rowCount === 0) {
      return [];
    }
    const problem = checkCardAgainstResult(
      card.props.spec,
      computeColumnStats(outcome.result),
      outcome.result.rowCount
    );
    return problem ? [`Card "${key}": ${problem}`] : [];
  });

const sourceProblems = (
  state: DraftState,
  runs: SourceRuns,
  catalog: SourceCatalog,
  now: Date
): string[] =>
  Object.entries(state.sources).flatMap(([name, source]) => {
    const problem =
      catalogProblem(name, source, catalog) ??
      templateProblem(name, source, state.inputs, now);
    if (problem) {
      return [problem];
    }
    const outcome = runs.outcomeOf(name, source, state.inputs);
    return outcome && !outcome.ok ? [`${name} failed: ${outcome.message}`] : [];
  });

const draftProblems = (
  state: DraftState,
  runs: SourceRuns,
  catalog: SourceCatalog,
  now: Date
): string[] => {
  const parsed = parseDraftState(state);
  const shape = parsed.success
    ? []
    : parsed.error.issues.map((issue) =>
        issue.path.length > 0
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message
      );
  return [
    ...shape,
    ...sourceProblems(state, runs, catalog, now),
    ...unusedInputs(state),
    ...cardProblems(state, runs),
  ];
};

const writesData = (
  action: AppActionDraft,
  catalog: SourceCatalog
): boolean => {
  const { target } = action;
  switch (target.kind) {
    case "sql": {
      return true;
    }
    case "http": {
      return target.method !== "GET";
    }
    case "mcp": {
      const server = catalog.mcpServers.find(
        (item) => item.id === target.serverId
      );
      return (
        server?.tools.find((tool) => tool.name === target.tool)
          ?.readOnlyHint !== true
      );
    }
    default: {
      return false;
    }
  }
};

const notesOf = (draft: MiniAppDraft, catalog: SourceCatalog): string[] =>
  draft.actions
    .filter((action) => writesData(action, catalog))
    .map(
      (action) => `“${action.label}” changes data, so it waits for your review.`
    );

async function* pipeline(
  input: MiniAppGenInput,
  ports: MiniAppGenPorts,
  signal: AbortSignal
): AsyncGenerator<MiniAppGenEvent> {
  let round = 0;
  const runs = createSourceRuns({
    catalog: input.catalog,
    ports,
    repairsLeft: () => round < MAX_APP_REPAIRS,
    signal,
  });
  const base = input.base ? draftStateOf(input.base) : null;
  let state = base ?? emptyDraftState(input.prompt);
  const catalog = catalogBlock(
    input.catalog,
    input.actionTargets,
    input.prompt
  );
  const context: StreamContext = {
    messages: [
      { content: requestMessage(input.prompt, catalog, base), role: "user" },
    ],
    ports,
    runs,
    signal,
    system: panelCatalogPrompt(ports.now()),
  };
  yield { detail: "Choosing data…", phase: "plan", type: "phase" };
  for (;;) {
    const streamed = yield* streamOps(state, context);
    ({ state } = streamed);
    for (const [name, source] of Object.entries(state.sources)) {
      runs.ensure(name, source, state.inputs);
    }
    await runs.whenIdle();
    yield* runs.take();
    yield { detail: "Checking the app…", phase: "check", type: "phase" };
    const problems = [
      ...streamed.dropped,
      ...draftProblems(state, runs, input.catalog, ports.now()),
    ];
    const parsed = parseDraftState(state, input.base?.id);
    if (problems.length === 0 && parsed.success) {
      yield {
        draft: parsed.data,
        notes: notesOf(parsed.data, input.catalog),
        type: "done",
      };
      return;
    }
    if (round >= MAX_APP_REPAIRS) {
      throw new GenFailure(
        "INVALID_APP",
        problems[0] ?? "The app didn't pass its checks."
      );
    }
    round += 1;
    yield {
      detail:
        problems.length === 1
          ? "Fixing 1 problem…"
          : `Fixing ${problems.length} problems…`,
      phase: "check",
      type: "phase",
    };
    context.messages.push(
      { content: streamed.text, role: "assistant" },
      { content: repairMessage(state, problems), role: "user" }
    );
  }
}

// Writes the app as patches the renderer can apply as they land. Nothing
// here can run an action: the only port that touches data runs read sources.
export async function* generateMiniApp(
  input: MiniAppGenInput,
  ports: MiniAppGenPorts,
  signal: AbortSignal
): AsyncGenerator<MiniAppGenEvent> {
  const timeout = AbortSignal.timeout(MINI_APP_GEN_TIMEOUT_MS);
  const merged = AbortSignal.any([signal, timeout]);
  try {
    yield* pipeline(input, ports, merged);
  } catch (error) {
    const failure = failureOf(error, signal, timeout);
    yield { code: failure.code, message: failure.message, type: "error" };
  }
}
