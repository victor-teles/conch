import { useSyncExternalStore } from "react";

import type { BoardRunsAction } from "@/components/board/board-runs";
import type {
  WidgetRunAction,
  WidgetRunState,
} from "@/components/widgets/widget-run-reducer";
import type { ParamValues } from "@/lib/ipc";

import { boardRunsReducer } from "@/components/board/board-runs";

export interface PanelState {
  inputs: ParamValues;
  sources: Readonly<Record<string, WidgetRunState>>;
}

export interface MiniAppStateStore {
  get(): PanelState;
  set(change: (state: PanelState) => PanelState): void;
  subscribe(listener: () => void): () => void;
}

export const createMiniAppStore = (initial: PanelState): MiniAppStateStore => {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(change) {
      const next = change(state);
      if (next === state) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const dispatchSource = (
  store: MiniAppStateStore,
  sourceName: string,
  action: WidgetRunAction
): void =>
  store.set((state) => {
    const event: BoardRunsAction = { action, tileId: sourceName, type: "tile" };
    const sources = boardRunsReducer(state.sources, event);
    return sources === state.sources ? state : { ...state, sources };
  });

export const setInputs = (store: MiniAppStateStore, inputs: ParamValues) =>
  store.set((state) => ({ ...state, inputs }));

// Components subscribe to the slice they read, so a source landing only
// re-renders the cards bound to it.
export const usePanelValue = <T>(
  store: MiniAppStateStore,
  select: (state: PanelState) => T
): T => useSyncExternalStore(store.subscribe, () => select(store.get()));
