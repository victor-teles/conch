import { useCallback, useEffect, useState } from "react";

import type { ListedAction } from "@/lib/ipc";

import { listActions } from "@/lib/ipc";

import { onActionsChanged } from "./actions-changed";

const NONE: ListedAction[] = [];

// A widget's saved actions with the effect bun derived from live data.
export const useListedActions = (widgetId: string) => {
  const [listed, setListed] = useState<ListedAction[]>(NONE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await listActions(widgetId);
        if (!cancelled) {
          setListed(next);
        }
      } catch (error) {
        console.error("[actions] could not list actions", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt, widgetId]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(
    () =>
      onActionsChanged((changed) => {
        if (changed === widgetId) {
          refresh();
        }
      }),
    [refresh, widgetId]
  );

  return { listed, refresh };
};
