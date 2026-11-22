import { emptyDraftState } from "@conch/rpc/mini-app";
import { describe, expect, it } from "vitest";

import { deskDraft } from "@/test/mini-app-fixtures";

import { genReducer, initialGen, startingDraft } from "./mini-app-gen-reducer";

const start = () => initialGen(emptyDraftState("refund desk"));

describe("genReducer", () => {
  it("applies patches as they land and skips invalid ones", () => {
    const state = genReducer(start(), {
      at: 1,
      events: [
        {
          ops: [
            { op: "add", path: "/name", value: "Refunds" },
            { op: "add", path: "/id", value: "stolen" },
            { op: "add", path: "/layout/root", value: "main" },
          ],
          type: "patch",
        },
      ],
      type: "events",
    });
    expect(state.draft.name).toBe("Refunds");
    expect(state.draft.layout.root).toBe("main");
    expect(state.draft).not.toHaveProperty("id");
  });

  it("marks elements a later patch replaces", () => {
    const { layout } = deskDraft();
    const added = genReducer(start(), {
      at: 1,
      events: [
        {
          ops: [
            {
              op: "add",
              path: "/layout/elements/title",
              value: layout.elements.title,
            },
          ],
          type: "patch",
        },
      ],
      type: "events",
    });
    expect(added.changed).toStrictEqual({});
    const replaced = genReducer(added, {
      at: 42,
      events: [
        {
          ops: [
            {
              op: "replace",
              path: "/layout/elements/title",
              value: {
                children: [],
                props: { text: "Refunds" },
                type: "Heading",
              },
            },
          ],
          type: "patch",
        },
      ],
      type: "events",
    });
    expect(replaced.changed).toStrictEqual({ title: 42 });
  });

  it("tracks phases, then readiness with notes", () => {
    const state = genReducer(start(), {
      at: 1,
      events: [
        { detail: "Checking orders…", phase: "sources", type: "phase" },
        { draft: deskDraft(), notes: ["Review Refund."], type: "done" },
      ],
      type: "events",
    });
    expect(state.status).toBe("ready");
    expect(state.detail).toBe("Ready · ⌘S to save");
    expect(state.notes).toStrictEqual(["Review Refund."]);
    expect(state.result?.name).toBe("Refund desk");
    expect(state.draft.name).toBe("Refund desk");
  });

  it("fails on an error event or a failed start, and restarts clean", () => {
    const failed = genReducer(start(), {
      at: 1,
      events: [
        { detail: "Checking the app…", phase: "check", type: "phase" },
        { code: "INVALID_APP", message: "orders failed", type: "error" },
      ],
      type: "events",
    });
    expect(failed).toMatchObject({
      detail: "",
      error: { code: "INVALID_APP", message: "orders failed" },
      status: "failed",
    });
    const refused = genReducer(start(), {
      code: "AI_NETWORK",
      message: "offline",
      type: "fail",
    });
    expect(refused).toMatchObject({
      detail: "",
      error: { code: "AI_NETWORK" },
    });
    expect(
      genReducer(failed, { draft: emptyDraftState("x"), type: "restart" })
        .status
    ).toBe("building");
  });

  it("starts from an existing app when changing one", () => {
    expect(startingDraft("x", deskDraft()).name).toBe("Refund desk");
    expect(startingDraft("x", null).name).toBe("");
  });
});
