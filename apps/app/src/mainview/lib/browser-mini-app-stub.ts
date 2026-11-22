import type { BindValue } from "@conch/core/client";
import type { ActionOutcome, ActionPreview, RpcSchema } from "@conch/rpc";
import type {
  AppActionDraft,
  MiniApp as MiniAppRecord,
  MiniAppDraft as MiniAppDraftRecord,
  MiniAppGenEvent,
  MiniAppSourceRun,
} from "@conch/rpc/mini-app";

import { DbError } from "@conch/core/client";
import { deriveEffect, ParamValue, sharedKey, writeTargetOf } from "@conch/rpc";
import {
  cardElements,
  cardSourceName,
  MiniApp,
  MiniAppDraft,
  needsReview,
  paramsForSource,
  sourceOf,
} from "@conch/rpc/mini-app";

import {
  recordedGeneration,
  recordedResult,
} from "./browser-mini-app-recordings";

type RpcMessages = RpcSchema["messages"];
type Emit = <M extends keyof RpcMessages>(
  name: M,
  payload: RpcMessages[M]
) => void;

const APPS_KEY = "conch-mini-apps";
const RUNS_KEY = "conch-mini-app-runs";
const PERMISSIONS_KEY = "conch-write-permissions";
const CHANNEL = "conch-stub";
const STEP_MS = 70;
const MAX_RUNS = 20;

interface StubRun {
  appId: string;
  source: string;
  columns: string[];
  rows: unknown[][];
}

type CrossTab =
  | { kind: "navigate"; view: RpcMessages["launcherNavigate"]["view"] }
  | { kind: "refresh"; appId: string; sources: string[] }
  | { kind: "changed"; appId: string };

const failure = (code: string, message: string) => new DbError(code, message);

const readJson = (key: string, fallback: unknown): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const readApps = (): MiniAppRecord[] => {
  const raw = readJson(APPS_KEY, []);
  return Array.isArray(raw)
    ? raw.flatMap((item) => {
        const parsed = MiniApp.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
};

const writeApps = (apps: MiniAppRecord[]) =>
  localStorage.setItem(APPS_KEY, JSON.stringify(apps));

const readRuns = (): Record<string, StubRun> => {
  const raw = readJson(RUNS_KEY, {});
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, StubRun>)
    : {};
};

const permissions = (): string[] => {
  const raw = readJson(PERMISSIONS_KEY, []);
  return Array.isArray(raw)
    ? raw.filter((item) => typeof item === "string")
    : [];
};

const stubToken = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 22);

const cell = (value: unknown): BindValue =>
  value === null || value === undefined || typeof value === "object"
    ? JSON.stringify(value ?? null)
    : (value as BindValue);

const effectOf = (action: AppActionDraft) => deriveEffect(action.target, null);

// Browser mode stands in for bun so e2e can walk the build → save → open →
// act flow. Runs replay recordings; nothing here asks a model.
export const createMiniAppEmulator = (
  emit: Emit,
  now: () => Date = () => new Date()
) => {
  const drafts = new Map<string, MiniAppDraftRecord>();
  const timers = new Map<string, number[]>();
  const tokens = new Map<
    string,
    { appId: string; actionId: string; preview: ActionPreview }
  >();
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CHANNEL);

  const share = (message: CrossTab) => {
    channel?.postMessage(message);
  };

  const requireApp = (appId: string): MiniAppRecord => {
    const app = readApps().find((item) => item.id === appId);
    if (!app) {
      throw failure("APP_NOT_FOUND", "This app no longer exists.");
    }
    return app;
  };

  const changed = (appId: string) => {
    emit("miniAppChanged", { appId });
    share({ appId, kind: "changed" });
  };

  const put = (app: MiniAppRecord): MiniAppRecord => {
    writeApps([app, ...readApps().filter((item) => item.id !== app.id)]);
    changed(app.id);
    return app;
  };

  const stamp = (
    draft: MiniAppDraftRecord,
    existing: MiniAppRecord | null,
    reviewed: ReadonlySet<string>
  ): MiniAppRecord => {
    const at = now().toISOString();
    const actions = draft.actions.map((action) => {
      const kept = existing?.actions.find((item) => item.id === action.id);
      if (
        kept &&
        JSON.stringify(kept.target) === JSON.stringify(action.target)
      ) {
        return kept;
      }
      const effect = effectOf(action);
      if (needsReview(action.target) && !reviewed.has(action.id)) {
        throw failure(
          "ACTION_NOT_REVIEWED",
          `Review “${action.label}” before saving the app.`
        );
      }
      if (effect === "write") {
        const ref = writeTargetOf(action.target);
        if (!(ref && permissions().includes(`${ref.kind}:${ref.id}`))) {
          throw failure(
            "WRITES_NOT_ALLOWED",
            `“${action.label}” writes where write actions are off.`
          );
        }
      }
      return {
        ...action,
        createdAt: at,
        effect,
        reviewHash: "f".repeat(64),
        reviewedAt: at,
        updatedAt: at,
      };
    });
    return MiniApp.parse({
      ...draft,
      actions,
      createdAt: existing?.createdAt ?? at,
      id: existing?.id ?? draft.id ?? crypto.randomUUID(),
      lastOpenedAt: existing?.lastOpenedAt ?? null,
      updatedAt: at,
    });
  };

  const appOf = (
    target: { kind: "saved"; appId: string } | { kind: "draft"; genId: string }
  ) => {
    if (target.kind === "saved") {
      return requireApp(target.appId);
    }
    const draft = drafts.get(target.genId);
    if (!draft) {
      throw failure(
        "DRAFT_GONE",
        "This preview has ended. Build the app again to run it."
      );
    }
    return draft;
  };

  const recordRun = (runId: string, run: StubRun) => {
    const runs = Object.entries({ ...readRuns(), [runId]: run }).slice(
      -MAX_RUNS
    );
    localStorage.setItem(RUNS_KEY, JSON.stringify(Object.fromEntries(runs)));
  };

  const rowFor = (
    app: MiniAppRecord,
    actionId: string,
    runId: string,
    rowIndex: number
  ) => {
    const run = readRuns()[runId];
    const showing = new Set(
      cardElements(app.layout)
        .filter(([, item]) => item.props.rowActions.includes(actionId))
        .map(([, item]) => cardSourceName(item))
    );
    const row = run?.rows[rowIndex];
    if (!(run && row && run.appId === app.id && showing.has(run.source))) {
      throw failure("RUN_EXPIRED", "Run the widget again to act on its rows.");
    }
    return { columns: run.columns, row };
  };

  channel?.addEventListener("message", (event: MessageEvent<CrossTab>) => {
    const message = event.data;
    if (message.kind === "navigate") {
      emit("launcherNavigate", { view: message.view });
    } else if (message.kind === "refresh") {
      emit("miniAppRefresh", {
        appId: message.appId,
        sources: message.sources,
      });
    } else {
      emit("miniAppChanged", { appId: message.appId });
    }
  });

  return {
    cancel: ({ genId }: { genId: string }) => {
      for (const timer of timers.get(genId) ?? []) {
        window.clearTimeout(timer);
      }
      timers.delete(genId);
    },

    deleteMiniApp: ({ appId }: { appId: string }) => {
      writeApps(readApps().filter((app) => app.id !== appId));
      changed(appId);
    },

    discard: (token: string): boolean => tokens.delete(token),

    duplicateMiniApp: ({ appId }: { appId: string }) => {
      const app = requireApp(appId);
      return put({
        ...app,
        id: crypto.randomUUID(),
        lastOpenedAt: null,
        name: `${app.name} copy`.slice(0, 60),
      });
    },

    execute: (token: string): ActionOutcome | null => {
      const pending = tokens.get(token);
      if (!pending) {
        return null;
      }
      tokens.delete(token);
      const app = requireApp(pending.appId);
      const sources = app.refreshAfter[pending.actionId] ?? [];
      emit("miniAppRefresh", { appId: app.id, sources });
      share({ appId: app.id, kind: "refresh", sources });
      return pending.preview.compiled.kind === "sql"
        ? {
            affectedRows: 1,
            durationMs: 42,
            ok: true,
            summary: "1 row changed",
          }
        : {
            durationMs: 8,
            ok: true,
            summary: `${pending.preview.label} finished`,
          };
    },

    generate: ({
      genId,
      prompt,
      connectionId,
    }: {
      genId: string;
      prompt: string;
      connectionId: string | null;
    }) => {
      const events: MiniAppGenEvent[] = recordedGeneration(
        prompt,
        connectionId ?? "analytics"
      );
      timers.set(
        genId,
        events.map((event, index) =>
          window.setTimeout(
            () => {
              if (event.type === "done") {
                drafts.set(genId, event.draft);
              }
              emit("miniAppGenEvent", { event, genId });
            },
            (index + 1) * STEP_MS
          )
        )
      );
    },

    getMiniApp: ({ appId }: { appId: string }) =>
      readApps().find((app) => app.id === appId) ?? null,

    listMiniApps: () => readApps(),

    loadInputOptions: ({
      target,
      inputName,
    }: {
      target:
        | { kind: "saved"; appId: string }
        | { kind: "draft"; genId: string };
      inputName: string;
    }) => {
      const app = appOf(target);
      const source = app.inputOptions[inputName];
      return source
        ? recordedResult(source, {}).rows.map((row) => String(row[0]))
        : [];
    },

    open: ({ appId }: { appId: string }) => {
      const app = requireApp(appId);
      put({ ...app, lastOpenedAt: now().toISOString() });
      window.open(`#/app/${encodeURIComponent(appId)}`, "_blank");
    },

    prepare: ({
      appId,
      actionId,
      context,
    }: {
      appId: string;
      actionId: string;
      context: {
        runId: string;
        rowIndex: number | null;
        values: Record<string, unknown>;
      };
    }): ActionPreview => {
      const app = requireApp(appId);
      const action = app.actions.find((item) => item.id === actionId);
      if (!action) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      const row =
        context.rowIndex === null
          ? null
          : rowFor(app, actionId, context.runId, context.rowIndex);
      const bound = Object.entries(action.bind).map(([name, bind]) => {
        if (bind.from === "row") {
          const index = row?.columns.indexOf(bind.column) ?? -1;
          return {
            detail: `row.${bind.column}`,
            from: "row" as const,
            name,
            value: cell(row?.row[index]),
          };
        }
        if (bind.from === "input") {
          const value = ParamValue.safeParse(context.values[bind.name]);
          return {
            detail: `input ${bind.name}`,
            from: "input" as const,
            name,
            value: value.success ? cell(value.data) : null,
          };
        }
        return {
          detail: "literal",
          from: "literal" as const,
          name,
          value: bind.value,
        };
      });
      const { target } = action;
      const compiled =
        target.kind === "sql"
          ? {
              kind: "sql" as const,
              params: bound.map((item) => item.value),
              statement: target.statementTemplate.replaceAll(
                /\{\{\s*\w+\s*\}\}/g,
                "$1"
              ),
            }
          : {
              kind: "copy" as const,
              text:
                target.kind === "copy"
                  ? target.template.replaceAll(
                      /\{\{\s*(\w+)\s*\}\}/g,
                      (_match, key: string) =>
                        String(
                          bound.find((item) => item.name === key)?.value ?? ""
                        )
                    )
                  : action.label,
            };
      const preview: ActionPreview = {
        bound,
        compiled,
        effect: action.effect,
        expiresAt: new Date(now().getTime() + 120_000).toISOString(),
        label: action.label,
        limits:
          target.kind === "sql"
            ? { maxAffectedRows: target.maxAffectedRows }
            : {},
        target: {
          environment: null,
          kind: target.kind,
          name: target.kind === "sql" ? target.connectionId : "Clipboard",
        },
        token: stubToken(),
      };
      tokens.set(preview.token, { actionId, appId, preview });
      return preview;
    },

    run: ({
      target,
      sourceName,
      values,
      runId,
    }: {
      target:
        | { kind: "saved"; appId: string }
        | { kind: "draft"; genId: string };
      sourceName: string;
      values: Record<string, unknown>;
      runId: string;
    }): MiniAppSourceRun => {
      const app = appOf(target);
      const source = sourceOf(app, sourceName);
      if (!source) {
        throw failure(
          "SOURCE_NOT_FOUND",
          `The app has no source named ${sourceName}.`
        );
      }
      const used = Object.fromEntries(
        paramsForSource(source, app.inputs).map((input) => {
          const stored = app.values[sharedKey(input)];
          return [input.name, values[input.name] ?? stored ?? input.default];
        })
      );
      const result = recordedResult(sourceName, used);
      if (target.kind === "saved") {
        recordRun(runId, {
          appId: target.appId,
          columns: result.columns.map((column) => column.name),
          rows: result.rows,
          source: sourceName,
        });
      }
      return {
        compiled: {
          kind: "sql",
          sql:
            source.kind === "sql"
              ? source.sqlTemplate.replaceAll(/\{\{[^}]+\}\}/g, "$1")
              : sourceName,
        },
        result,
        values: Object.fromEntries(
          Object.entries(used).flatMap(([name, value]) => {
            const parsed = ParamValue.safeParse(value);
            return parsed.success ? [[name, parsed.data]] : [];
          })
        ),
      };
    },

    save: ({
      draft,
      reviewedActionIds,
    }: {
      draft: unknown;
      reviewedActionIds: string[];
    }) => {
      const parsed = MiniAppDraft.parse(draft);
      const existing = parsed.id
        ? (readApps().find((app) => app.id === parsed.id) ?? null)
        : null;
      return put(stamp(parsed, existing, new Set(reviewedActionIds)));
    },

    setValues: ({
      appId,
      values,
    }: {
      appId: string;
      values: Record<string, unknown>;
    }) => {
      const app = requireApp(appId);
      const kept = Object.fromEntries(
        Object.entries(values).flatMap(([key, value]) => {
          const parsed = ParamValue.safeParse(value);
          return parsed.success ? [[key, parsed.data]] : [];
        })
      );
      return put({ ...app, values: { ...app.values, ...kept } });
    },

    stage: (request: {
      appId: string;
      actionId: string;
      context: {
        runId: string;
        rowIndex: number | null;
        values: Record<string, ParamValue>;
      };
    }) => {
      const app = requireApp(request.appId);
      if (!app.actions.some((action) => action.id === request.actionId)) {
        throw failure("ACTION_NOT_FOUND", "This action no longer exists.");
      }
      const view = { kind: "mini-app-action" as const, request };
      emit("launcherNavigate", { view });
      share({ kind: "navigate", view });
    },
  };
};

export type MiniAppEmulator = ReturnType<typeof createMiniAppEmulator>;
