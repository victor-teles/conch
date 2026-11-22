import type { SourceTestResult } from "@/lib/ipc";

export type EditorPhase =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "testing" }
  | { kind: "tested"; result: SourceTestResult }
  | { kind: "saved" }
  | { kind: "declined" }
  | { kind: "failed"; message: string };

export const IDLE: EditorPhase = { kind: "idle" };

export const isBusy = (phase: EditorPhase): boolean =>
  phase.kind === "saving" || phase.kind === "testing";

export const phaseText = (phase: EditorPhase): string | null => {
  switch (phase.kind) {
    case "testing": {
      return "Testing…";
    }
    case "saving": {
      return "Saving…";
    }
    case "tested": {
      return phase.result.ok
        ? `${phase.result.message} · ${phase.result.latencyMs} ms`
        : phase.result.message;
    }
    case "saved": {
      return "Saved";
    }
    case "declined": {
      return "Not saved. The system dialog was cancelled.";
    }
    case "failed": {
      return phase.message;
    }
    default: {
      return null;
    }
  }
};

export const phaseTone = (phase: EditorPhase): "ok" | "error" | "muted" => {
  if (phase.kind === "failed" || phase.kind === "declined") {
    return "error";
  }
  if (phase.kind === "tested") {
    return phase.result.ok ? "ok" : "error";
  }
  return "muted";
};
