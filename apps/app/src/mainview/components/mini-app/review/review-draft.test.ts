import { describe, expect, it } from "vitest";

import type { ActionTarget, Source } from "@/lib/ipc";

import { deskAction, deskDraft } from "@/test/mini-app-fixtures";

import {
  draftEffect,
  reviewedDraft,
  sourceText,
  targetText,
  writeKeyOf,
  writesAllowed,
} from "./review-draft";

const refund = deskAction("refund");
const copy = deskAction("copy-region");

describe("reviewedDraft", () => {
  it("renames and fixes removed inputs without dropping them", () => {
    const draft = reviewedDraft(deskDraft(), {
      name: "  Refunds ",
      removedInputs: new Set(["region"]),
    });
    expect(draft.name).toBe("Refunds");
    expect(draft.inputs).toHaveLength(2);
    expect(draft.inputs).toContainEqual(
      expect.objectContaining({ fixed: true, name: "region" })
    );
  });

  it("keeps the generated name when the field is left blank", () => {
    expect(
      reviewedDraft(deskDraft(), { name: " ", removedInputs: new Set() }).name
    ).toBe("Refund desk");
  });
});

describe("write gating", () => {
  it("derives effects conservatively", () => {
    expect(draftEffect(refund)).toBe("write");
    expect(draftEffect(copy)).toBe("read");
  });

  it("names the write target and checks its opt-in", () => {
    expect(writeKeyOf(refund.target)).toBe("connection:analytics");
    expect(writeKeyOf(copy.target)).toBeNull();
    expect(
      writesAllowed(refund, new Set(["connection:analytics"]))
    ).toBeTruthy();
    expect(writesAllowed(refund, new Set())).toBeFalsy();
  });
});

describe("review text", () => {
  it.each<[ActionTarget, string]>([
    [
      { args: { id: 1 }, kind: "mcp", serverId: "s", tool: "refund" },
      'refund {"id":1}',
    ],
    [
      {
        body: null,
        endpointId: "e",
        kind: "http",
        method: "POST",
        path: "/x",
        query: {},
      },
      "POST /x",
    ],
    [
      { baseUrl: "https://a.example", kind: "open-url", path: "/o", query: {} },
      "https://a.example/o",
    ],
    [{ kind: "copy", template: "t" }, "t"],
  ])("prints the %o target", (target, text) => {
    expect(targetText(target)).toBe(text);
  });

  it.each<[Source, string]>([
    [
      { args: {}, kind: "mcp", select: "$", serverId: "s", tool: "list" },
      "list {}",
    ],
    [
      {
        endpointId: "e",
        kind: "http",
        method: "GET",
        path: "/p",
        query: {},
        select: "$",
      },
      "GET /p",
    ],
  ])("prints the %o source", (source, text) => {
    expect(sourceText(source)).toBe(text);
  });
});
