import { sourceOf } from "@conch/rpc/mini-app";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { MiniAppStateStore } from "@/components/mini-app/mini-app-state";
import type {
  CompiledSource,
  MiniAppDraft,
  MiniAppGenEvent,
  ParamDef,
  Source,
} from "@/lib/ipc";

import { REPAIRING } from "@/components/mini-app/elements/card-failure";
import {
  dispatchSource,
  setInputs,
} from "@/components/mini-app/mini-app-state";
import { getErrorMessage } from "@/lib/error-message";
import {
  cancelMiniAppGeneration,
  generateMiniApp,
  onMiniAppGenEvent,
} from "@/lib/ipc";

import type { GenAction, GenState } from "./mini-app-gen-reducer";

import { genReducer, initialGen, startingDraft } from "./mini-app-gen-reducer";

export interface GenerationRequest {
  prompt: string;
  base: MiniAppDraft | null;
  baseAppId: string | null;
  connectionId: string | null;
  database: string | null;
}

// What a preview card shows as "the call" before bun has compiled anything.
const uncompiled = (source: Source): CompiledSource => {
  switch (source.kind) {
    case "sql": {
      return { kind: "sql", sql: source.sqlTemplate };
    }
    case "mcp": {
      return {
        args: source.args,
        kind: "mcp",
        server: source.serverId,
        tool: source.tool,
      };
    }
    case "http": {
      return { endpoint: source.endpointId, kind: "http", url: source.path };
    }
    default: {
      throw new Error(`Unknown source ${source satisfies never}`);
    }
  }
};

const withDefaults = (
  store: MiniAppStateStore,
  inputs: readonly ParamDef[]
) => {
  const current = store.get().inputs;
  const missing = inputs.filter((input) => !Object.hasOwn(current, input.name));
  if (missing.length > 0) {
    setInputs(store, {
      ...current,
      ...Object.fromEntries(
        missing.map((input) => [input.name, input.default])
      ),
    });
  }
};

const routeToStore = (
  store: MiniAppStateStore,
  state: GenState,
  event: MiniAppGenEvent
) => {
  if (event.type !== "sourceResult" && event.type !== "sourceError") {
    return;
  }
  const runId = crypto.randomUUID();
  dispatchSource(store, event.name, { runId, type: "start", values: {} });
  if (event.type === "sourceError") {
    dispatchSource(store, event.name, {
      failure: {
        code: event.repairing ? REPAIRING : "SOURCE_FAILED",
        message: event.message,
      },
      runId,
      type: "failure",
    });
    return;
  }
  const source = sourceOf(state.draft, event.name);
  if (source) {
    dispatchSource(store, event.name, {
      outcome: {
        compiled: uncompiled(source),
        result: event.result,
        values: {},
      },
      runId,
      type: "success",
    });
  }
};

// A failed build never repairs again, so cards still waiting on a repair
// show their error instead of "Fixing this query…".
const settleRepairs = (store: MiniAppStateStore) => {
  for (const [name, run] of Object.entries(store.get().sources)) {
    if (run.failure?.code !== REPAIRING) {
      continue;
    }
    const runId = crypto.randomUUID();
    dispatchSource(store, name, { runId, type: "start", values: {} });
    dispatchSource(store, name, {
      failure: { code: "SOURCE_FAILED", message: run.failure.message },
      runId,
      type: "failure",
    });
  }
};

const stopGeneration = async (genId: string): Promise<void> => {
  try {
    await cancelMiniAppGeneration(genId);
  } catch (error) {
    console.error("[app] could not stop the build", error);
  }
};

// Streams one build from bun and applies its patches at most once per frame.
export const useMiniAppGeneration = (
  request: GenerationRequest,
  store: MiniAppStateStore
) => {
  const { prompt, base, baseAppId, connectionId, database } = request;
  const [genId, setGenId] = useState(() => crypto.randomUUID());
  const latest = useRef<GenState>(initialGen(startingDraft(prompt, base)));
  const [state, setState] = useState(latest.current);

  const apply = useEffectEvent((action: GenAction) => {
    latest.current = genReducer(latest.current, action);
    setState(latest.current);
    withDefaults(store, latest.current.draft.inputs);
    if (action.type === "events") {
      for (const event of action.events) {
        routeToStore(store, latest.current, event);
      }
    }
    if (latest.current.status === "failed") {
      settleRepairs(store);
    }
  });

  useEffect(() => {
    const pending: MiniAppGenEvent[] = [];
    let frame = 0;
    const flush = () => {
      frame = 0;
      apply({
        at: performance.now(),
        events: pending.splice(0),
        type: "events",
      });
    };
    const unsubscribe = onMiniAppGenEvent(genId, (event) => {
      pending.push(event);
      if (frame === 0) {
        frame = requestAnimationFrame(flush);
      }
    });
    const begin = async () => {
      try {
        await generateMiniApp({
          baseAppId,
          connectionId,
          database,
          genId,
          prompt,
        });
      } catch (error) {
        apply({
          code: "AI_NETWORK",
          message: getErrorMessage(error, "The build could not start."),
          type: "fail",
        });
      }
    };
    begin();
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      stopGeneration(genId);
    };
  }, [baseAppId, connectionId, database, genId, prompt]);

  const retry = useCallback(() => {
    latest.current = initialGen(startingDraft(prompt, base));
    setState(latest.current);
    store.set(() => ({ inputs: {}, sources: {} }));
    setGenId(crypto.randomUUID());
  }, [base, prompt, store]);

  return { genId, retry, state };
};
