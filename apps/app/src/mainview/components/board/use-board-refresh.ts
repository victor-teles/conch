import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
} from "react";

import type { BoardTile, ParamValues } from "@/lib/ipc";

import { failureOf } from "@/components/widgets/use-widget-run";
import { useRunQueue } from "@/hooks/use-run-queue";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { cancelWidgetRun, runWidget } from "@/lib/ipc";

import type { WidgetsById } from "./board-inputs";

import { tileValues } from "./board-inputs";
import { boardRunsReducer } from "./board-runs";

export const MAX_CONCURRENT_RUNS = 4;

interface UseBoardRefreshOptions {
  tiles: readonly BoardTile[];
  widgets: WidgetsById;
  sharedValues: ParamValues;
  refreshMs: number | null;
}

const stopOnBun = async (runId: string): Promise<void> => {
  try {
    await cancelWidgetRun(runId);
  } catch (error) {
    console.error("[board] cancel failed", error);
  }
};

export const useBoardRefresh = ({
  tiles,
  widgets,
  sharedValues,
  refreshMs,
}: UseBoardRefreshOptions) => {
  const [runs, dispatch] = useReducer(boardRunsReducer, {});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const start = useEffectEvent(
    async (
      tileId: string,
      runId: string,
      shared: ParamValues | null,
      isCurrent: () => boolean
    ) => {
      const tile = tiles.find((item) => item.id === tileId);
      const widget = tile ? widgets.get(tile.widgetId) : undefined;
      if (!widget) {
        return;
      }
      const values = tileValues(widget, shared ?? sharedValues);
      dispatch({
        action: { runId, type: "start", values },
        tileId,
        type: "tile",
      });
      try {
        const outcome = await runWidget({ runId, values, widgetId: widget.id });
        dispatch({
          action: { outcome, runId, type: "success" },
          tileId,
          type: "tile",
        });
        if (isCurrent()) {
          setUpdatedAt(Date.now());
        }
      } catch (error) {
        dispatch({
          action: { failure: failureOf(error), runId, type: "failure" },
          tileId,
          type: "tile",
        });
      }
    }
  );

  const queue = useRunQueue<ParamValues | null>({
    cancel: stopOnBun,
    max: MAX_CONCURRENT_RUNS,
    start,
  });
  const { enqueue, isBusy, keepOnly } = queue;

  const refresh = useCallback(
    (tileIds: readonly string[], shared: ParamValues | null = null) =>
      enqueue(tileIds, shared),
    [enqueue]
  );

  const tileIds = tiles.map((tile) => tile.id);
  const tileKey = tileIds.join(",");

  const refreshAll = () => refresh(tileIds);

  const syncTiles = useEffectEvent(() => {
    dispatch({ keep: tileIds, type: "prune" });
    keepOnly(tileIds);
    const fresh = tileIds.filter((id) => !(id in runs) && !isBusy(id));
    if (fresh.length > 0) {
      refresh(fresh);
    }
  });

  useEffect(() => {
    syncTiles();
  }, [tileKey]);

  useVisibleInterval({ onTick: () => refresh(tileIds), refreshMs, updatedAt });

  return { refresh, refreshAll, runs, updatedAt };
};

export type BoardRefresh = ReturnType<typeof useBoardRefresh>;
