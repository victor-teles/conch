import { DEFAULT_THEME_STATE, defaultThemeFor } from "@conch/rpc";
import { describe, expect, it } from "vitest";

import { duplicateName, themeKindLabel, themeSections } from "./theme-items";

const mine = { ...defaultThemeFor("light"), id: "theme_1", name: "Paper" };

describe("theme sections", () => {
  it("lists built-ins and custom themes under Dark and Light", () => {
    const sections = themeSections(
      { ...DEFAULT_THEME_STATE, custom: [mine] },
      ""
    );
    expect(
      sections.map((section) => [
        section.label,
        section.items.map((item) => item.theme.name),
      ])
    ).toStrictEqual([
      ["Dark", ["Conch Dark", "Amber Dark"]],
      ["Light", ["Conch Light", "Amber Light", "Paper"]],
    ]);
    const [, light] = sections;
    expect(light?.items.map((item) => item.inUse)).toStrictEqual([
      true,
      false,
      false,
    ]);
    expect(light?.items.map(themeKindLabel)).toStrictEqual([
      "Built-in",
      "Built-in",
      "Custom",
    ]);
  });

  it("filters by name, appearance and kind and drops empty sections", () => {
    const state = { ...DEFAULT_THEME_STATE, custom: [mine] };
    expect(
      themeSections(state, "amber").flatMap((section) =>
        section.items.map((item) => item.id)
      )
    ).toStrictEqual(["amber-dark", "amber-light"]);
    expect(themeSections(state, "custom").map((s) => s.label)).toStrictEqual([
      "Light",
    ]);
  });

  it("marks nothing in use before the state loads", () => {
    const sections = themeSections(null, "");
    expect(sections.flatMap((s) => s.items).some((i) => i.inUse)).toBeFalsy();
  });

  it("names a duplicate within the limit", () => {
    expect(duplicateName("Ink")).toBe("Ink copy");
    expect(duplicateName("x".repeat(60))).toHaveLength(60);
  });
});
