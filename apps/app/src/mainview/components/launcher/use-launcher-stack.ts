import { useCallback, useReducer } from "react";

import type {
  ActionEditTarget,
  ActionReviewTarget,
} from "@/components/actions/action-targets";
import type { BoardNameTarget } from "@/components/launcher/views/board-name-view";
import type { GenerateTarget } from "@/components/mini-app/generate/generate-target";
import type { ThemeEditSource } from "@/components/themes/theme-edit-source";
import type {
  LookupValue,
  MiniApp,
  MiniAppActionRequest,
  ParamValues,
  SourceTarget,
  WidgetDraft,
} from "@/lib/ipc";

export interface SourceEditTarget {
  type: SourceTarget["type"];
  id: string | null;
}

export type LauncherView =
  | { kind: "root" }
  | { kind: "settings" }
  | { kind: "ask" }
  | { kind: "history"; query?: string }
  | { kind: "lookup"; value: LookupValue; connectionId: string }
  | { kind: "connection-edit"; connectionId: string | null }
  | { kind: "widget-run"; widgetId: string; values: ParamValues }
  | { kind: "widget-inputs"; draft: WidgetDraft; mode: "create" | "edit" }
  | { kind: "board-picker"; widgetId: string }
  | { kind: "board-name"; target: BoardNameTarget }
  | { kind: "import" }
  | { kind: "watch"; widgetId: string }
  | { kind: "watches" }
  | { kind: "agents" }
  | { kind: "agents-audit" }
  | { kind: "source-edit"; target: SourceEditTarget }
  | { kind: "source-picker" }
  | { kind: "source-draft"; target: SourceTarget }
  | { kind: "action-edit"; target: ActionEditTarget }
  | { kind: "action-review"; target: ActionReviewTarget }
  | {
      kind: "widget-actions";
      target: Omit<ActionEditTarget, "actionId" | "draft">;
    }
  | { kind: "activity" }
  | { kind: "activity-entry"; executionId: string }
  | { kind: "mini-app-generate"; target: GenerateTarget }
  | { kind: "mini-app-action"; request: MiniAppActionRequest }
  | { kind: "mini-app-name"; app: MiniApp }
  | { kind: "themes"; selectedId?: string }
  | { kind: "theme-edit"; source: ThemeEditSource };

export type StackDirection = 1 | -1;

export interface LauncherStackState {
  stack: [LauncherView, ...LauncherView[]];
  direction: StackDirection;
}

export type LauncherStackAction =
  | { type: "push"; view: LauncherView }
  | { type: "pop" }
  | { type: "returnTo"; view: LauncherView }
  | { type: "reset" };

export const ROOT_VIEW: LauncherView = { kind: "root" };

export const initialStackState: LauncherStackState = {
  direction: 1,
  stack: [ROOT_VIEW],
};

export const launcherStackReducer = (
  state: LauncherStackState,
  action: LauncherStackAction
): LauncherStackState => {
  switch (action.type) {
    case "push": {
      const top = state.stack.at(-1);
      if (top?.kind === action.view.kind) {
        return state;
      }
      return { direction: 1, stack: [...state.stack, action.view] };
    }
    case "pop": {
      if (state.stack.length === 1) {
        return state;
      }
      const [root, ...rest] = state.stack;
      return { direction: -1, stack: [root, ...rest.slice(0, -1)] };
    }
    case "returnTo": {
      const popped = launcherStackReducer(state, { type: "pop" });
      const [root, ...rest] = popped.stack;
      if (popped === state || rest.at(-1)?.kind !== action.view.kind) {
        return popped;
      }
      return { ...popped, stack: [root, ...rest.slice(0, -1), action.view] };
    }
    case "reset": {
      return state.stack.length === 1
        ? state
        : { direction: -1, stack: [ROOT_VIEW] };
    }
    default: {
      return state;
    }
  }
};

export const useLauncherStack = () => {
  const [state, dispatch] = useReducer(launcherStackReducer, initialStackState);
  const current = state.stack.at(-1) ?? ROOT_VIEW;
  const push = useCallback(
    (view: LauncherView) => dispatch({ type: "push", view }),
    []
  );
  const pop = useCallback(() => dispatch({ type: "pop" }), []);
  const returnTo = useCallback(
    (view: LauncherView) => dispatch({ type: "returnTo", view }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return {
    current,
    depth: state.stack.length,
    direction: state.direction,
    pop,
    push,
    reset,
    returnTo,
  };
};
