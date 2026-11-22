import { describe, expect, it } from "vitest";

import type { ActionPreview } from "@/lib/ipc";

import { actionRunReducer, IDLE, sheetStateOf } from "./action-run-reducer";

const preview = { label: "Mark shipped", token: "t" } as ActionPreview;
const outcome = { durationMs: 4, ok: true as const, summary: "1 row changed" };

describe("actionRunReducer", () => {
  it("walks prepare → confirm → run → outcome", () => {
    const preparing = actionRunReducer(IDLE, {
      label: "Mark shipped",
      type: "prepare",
    });
    const confirm = actionRunReducer(preparing, { preview, type: "review" });
    expect(confirm).toStrictEqual({ phase: "confirm", preview });
    const running = actionRunReducer(confirm, { type: "run" });
    expect(running.phase).toBe("running");
    expect(
      actionRunReducer(running, { outcome, type: "finish" })
    ).toStrictEqual({ outcome, phase: "outcome", preview });
  });

  it("ignores a stray run or finish", () => {
    expect(actionRunReducer(IDLE, { type: "run" })).toBe(IDLE);
    expect(actionRunReducer(IDLE, { outcome, type: "finish" })).toBe(IDLE);
    expect(
      actionRunReducer(
        { label: "x", phase: "preparing" },
        {
          outcome,
          type: "finish",
        }
      ).phase
    ).toBe("preparing");
  });

  it("keeps the label and preview when a step fails", () => {
    const failure = { code: "RUN_EXPIRED", message: "Run again." };
    expect(
      actionRunReducer(
        { label: "Mark shipped", phase: "preparing" },
        { failure, type: "fail" }
      )
    ).toStrictEqual({
      failure,
      label: "Mark shipped",
      phase: "failed",
      preview: null,
    });
    expect(
      actionRunReducer({ phase: "running", preview }, { failure, type: "fail" })
    ).toMatchObject({ phase: "failed", preview });
    expect(actionRunReducer(IDLE, { failure, type: "fail" })).toBe(IDLE);
  });

  it("closes from any phase and knows when the sheet shows", () => {
    expect(
      actionRunReducer({ phase: "confirm", preview }, { type: "close" })
    ).toBe(IDLE);
    expect(sheetStateOf({ phase: "confirm", preview })).toStrictEqual({
      phase: "confirm",
      preview,
    });
    expect(sheetStateOf({ label: "x", phase: "preparing" })).toBeNull();
    expect(sheetStateOf(IDLE)).toBeNull();
  });
});
