import {
  applyDraftPatch,
  draftStateOf,
  emptyDraftState,
} from "@conch/rpc/mini-app";

import type {
  DraftState,
  MiniAppDraft,
  MiniAppGenErrorCode,
  MiniAppGenEvent,
  MiniAppGenPhase,
} from "@/lib/ipc";

export type GenStatus = "building" | "ready" | "failed";

export interface GenState {
  draft: DraftState;
  status: GenStatus;
  phase: MiniAppGenPhase;
  detail: string;
  notes: string[];
  error: { code: MiniAppGenErrorCode; message: string } | null;
  result: MiniAppDraft | null;
  changed: Readonly<Record<string, number>>;
}

export type GenAction =
  | { type: "restart"; draft: DraftState }
  | { type: "events"; events: readonly MiniAppGenEvent[]; at: number }
  | { type: "fail"; code: MiniAppGenErrorCode; message: string };

export const initialGen = (draft: DraftState): GenState => ({
  changed: {},
  detail: "Choosing data…",
  draft,
  error: null,
  notes: [],
  phase: "plan",
  result: null,
  status: "building",
});

export const startingDraft = (
  prompt: string,
  base: MiniAppDraft | null
): DraftState => (base ? draftStateOf(base) : emptyDraftState(prompt));

const ELEMENT_PATH = /^\/layout\/elements\/([^/]+)$/;

const applyEvent = (
  state: GenState,
  event: MiniAppGenEvent,
  at: number
): GenState => {
  switch (event.type) {
    case "phase": {
      return { ...state, detail: event.detail, phase: event.phase };
    }
    case "patch": {
      let { draft } = state;
      const changed = { ...state.changed };
      for (const op of event.ops) {
        const result = applyDraftPatch(draft, op);
        if (!result.ok) {
          continue;
        }
        ({ draft } = result);
        const key = ELEMENT_PATH.exec(op.path)?.[1];
        if (key && op.op === "replace") {
          changed[key] = at;
        }
      }
      return { ...state, changed, draft };
    }
    case "done": {
      return {
        ...state,
        detail: "Ready · ⌘S to save",
        draft: draftStateOf(event.draft),
        notes: event.notes,
        result: event.draft,
        status: "ready",
      };
    }
    case "error": {
      return {
        ...state,
        detail: "",
        error: { code: event.code, message: event.message },
        status: "failed",
      };
    }
    default: {
      return state;
    }
  }
};

export const genReducer = (state: GenState, action: GenAction): GenState => {
  switch (action.type) {
    case "restart": {
      return initialGen(action.draft);
    }
    case "events": {
      let current = state;
      for (const event of action.events) {
        current = applyEvent(current, event, action.at);
      }
      return current;
    }
    case "fail": {
      return {
        ...state,
        detail: "",
        error: { code: action.code, message: action.message },
        status: "failed",
      };
    }
    default: {
      return state;
    }
  }
};
