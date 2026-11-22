import { defaultThemeFor } from "@conch/rpc";
import { describe, expect, it } from "vitest";

import {
  draftPayload,
  draftReducer,
  initialDraft,
  isDirty,
} from "./use-theme-draft";

const dark = defaultThemeFor("dark");
const existing = {
  kind: "existing",
  theme: { ...dark, id: "theme_1" },
} as const;

describe("theme draft", () => {
  it("starts a new theme as a named copy", () => {
    const draft = initialDraft({ from: dark, kind: "new" });
    expect(draft.name).toBe("Conch Dark copy");
    expect(draftPayload(draft, { from: dark, kind: "new" })).not.toHaveProperty(
      "id"
    );
  });

  it("is dirty only while it differs from where it started", () => {
    const initial = initialDraft(existing);
    const edited = draftReducer(initial, {
      name: "row-active",
      type: "token",
      value: "#ff000033",
    });
    expect(isDirty(edited, initial)).toBeTruthy();
    const restored = draftReducer(edited, {
      name: "row-active",
      type: "token",
      value: initial.tokens["row-active"],
    });
    expect(isDirty(restored, initial)).toBeFalsy();
    expect(
      draftReducer(initial, {
        name: "row-active",
        type: "token",
        value: initial.tokens["row-active"],
      })
    ).toBe(initial);
  });

  it("renames, switches appearance and trims the saved name", () => {
    const initial = initialDraft(existing);
    const renamed = draftReducer(initial, { name: "  Ink ", type: "name" });
    const light = draftReducer(renamed, {
      appearance: "light",
      type: "appearance",
    });
    expect(isDirty(light, initial)).toBeTruthy();
    expect(draftPayload(light, existing)).toMatchObject({
      appearance: "light",
      id: "theme_1",
      name: "Ink",
    });
  });
});
