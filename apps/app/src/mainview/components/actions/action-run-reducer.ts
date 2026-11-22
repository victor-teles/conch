import type { ActionOutcome, ActionPreview } from "@/lib/ipc";

export interface ActionFailure {
  code: string;
  message: string;
}

export type ActionRunState =
  | { phase: "idle" }
  | { phase: "preparing"; label: string }
  | { phase: "confirm"; preview: ActionPreview }
  | { phase: "running"; preview: ActionPreview }
  | { phase: "outcome"; preview: ActionPreview; outcome: ActionOutcome }
  | {
      phase: "failed";
      label: string;
      preview: ActionPreview | null;
      failure: ActionFailure;
    };

export type ActionRunEvent =
  | { type: "prepare"; label: string }
  | { type: "review"; preview: ActionPreview }
  | { type: "run" }
  | { type: "finish"; outcome: ActionOutcome }
  | { type: "fail"; failure: ActionFailure }
  | { type: "close" };

export const IDLE: ActionRunState = { phase: "idle" };

export const actionRunReducer = (
  state: ActionRunState,
  event: ActionRunEvent
): ActionRunState => {
  switch (event.type) {
    case "prepare": {
      return { label: event.label, phase: "preparing" };
    }
    case "review": {
      return state.phase === "preparing"
        ? { phase: "confirm", preview: event.preview }
        : state;
    }
    case "run": {
      return state.phase === "confirm"
        ? { phase: "running", preview: state.preview }
        : state;
    }
    case "finish": {
      return state.phase === "running"
        ? { outcome: event.outcome, phase: "outcome", preview: state.preview }
        : state;
    }
    case "fail": {
      if (state.phase === "idle" || state.phase === "outcome") {
        return state;
      }
      const preview = "preview" in state ? state.preview : null;
      const label = preview?.label ?? ("label" in state ? state.label : "");
      return { failure: event.failure, label, phase: "failed", preview };
    }
    case "close": {
      return IDLE;
    }
    default: {
      return state;
    }
  }
};

export type SheetState = Extract<
  ActionRunState,
  { phase: "confirm" | "running" | "outcome" | "failed" }
>;

export const sheetStateOf = (state: ActionRunState): SheetState | null =>
  state.phase === "idle" || state.phase === "preparing" ? null : state;
