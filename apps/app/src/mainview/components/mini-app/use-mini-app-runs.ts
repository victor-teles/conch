import { useCallback, useEffectEvent, useState } from "react";

import type { MiniAppTarget, ParamValues } from "@/lib/ipc";

import { failureOf } from "@/components/widgets/use-widget-run";
import { useRunQueue } from "@/hooks/use-run-queue";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { cancelMiniAppRun, runMiniAppSource } from "@/lib/ipc";

import type { MiniAppStateStore } from "./mini-app-state";

import { dispatchSource } from "./mini-app-state";

export const MAX_CONCURRENT_SOURCES = 4;

interface UseMiniAppRunsOptions {
  target: MiniAppTarget | null;
  sourceNames: readonly string[];
  store: MiniAppStateStore;
  refreshMs: number | null;
}

const stopOnBun = async (runId: string): Promise<void> => {
  try {
    await cancelMiniAppRun(runId);
  } catch (error) {
    console.error("[app] cancel failed", error);
  }
};

// Runs never call the AI: each one asks bun to run a stored (or bun-held
// draft) source by name with the panel's current inputs.
export const useMiniAppRuns = ({
  target,
  sourceNames,
  store,
  refreshMs,
}: UseMiniAppRunsOptions) => {
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const start = useEffectEvent(
    async (
      sourceName: string,
      runId: string,
      values: ParamValues,
      isCurrent: () => boolean
    ) => {
      if (!target) {
        return;
      }
      dispatchSource(store, sourceName, { runId, type: "start", values });
      try {
        const outcome = await runMiniAppSource({
          runId,
          sourceName,
          target,
          values,
        });
        dispatchSource(store, sourceName, { outcome, runId, type: "success" });
        if (isCurrent()) {
          setUpdatedAt(Date.now());
        }
      } catch (error) {
        dispatchSource(store, sourceName, {
          failure: failureOf(error),
          runId,
          type: "failure",
        });
      }
    }
  );

  const { enqueue } = useRunQueue<ParamValues>({
    cancel: stopOnBun,
    max: MAX_CONCURRENT_SOURCES,
    start,
  });

  const refresh = useCallback(
    (names: readonly string[]) => enqueue(names, store.get().inputs),
    [enqueue, store]
  );

  const refreshAll = useCallback(
    () => refresh(sourceNames),
    [refresh, sourceNames]
  );

  useVisibleInterval({ onTick: refreshAll, refreshMs, updatedAt });

  return { refresh, refreshAll, updatedAt };
};

export type MiniAppRuns = ReturnType<typeof useMiniAppRuns>;
