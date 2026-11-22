import { describe, expect, it } from "vitest";

import type { Theme, ThemeState } from "./theme.ts";

import {
  BUILTIN_THEMES,
  DEFAULT_THEME_SETTINGS,
  isBuiltinThemeId,
  parseStoredTheme,
  resolveTheme,
  Theme as ThemeSchema,
  THEME_TOKENS,
  ThemeDraft,
} from "./theme.ts";

const builtin = (id: string): Theme => {
  const theme = BUILTIN_THEMES.find((candidate) => candidate.id === id);
  if (!theme) {
    throw new Error(id);
  }
  return theme;
};

const conchDark = builtin("conch-dark");
const custom = (overrides: Partial<Theme>): Theme => ({
  ...conchDark,
  id: "theme_1",
  name: "Mine",
  ...overrides,
});

const state = (
  settings: Partial<ThemeState["settings"]>,
  themes: Theme[] = []
): ThemeState => ({
  custom: themes,
  settings: { ...DEFAULT_THEME_SETTINGS, ...settings },
});

describe("theme contract", () => {
  it("has 48 tokens", () => {
    expect(THEME_TOKENS).toHaveLength(48);
    expect(new Set(THEME_TOKENS.map((token) => token.name)).size).toBe(48);
  });

  it.each(BUILTIN_THEMES.map((theme) => [theme.id, theme] as const))(
    "built-in %s has all 48 tokens and parses",
    (_id, theme) => {
      expect(Object.keys(theme.tokens)).toHaveLength(48);
      expect(ThemeSchema.parse(theme)).toStrictEqual(theme);
    }
  );

  it("knows the built-in ids", () => {
    expect(BUILTIN_THEMES.map((theme) => theme.id)).toStrictEqual([
      "conch-dark",
      "conch-light",
      "amber-dark",
      "amber-light",
    ]);
    expect(isBuiltinThemeId("amber-dark")).toBeTruthy();
    expect(isBuiltinThemeId("theme_1")).toBeFalsy();
  });

  it("rejects a missing token", () => {
    const { brand: _brand, ...tokens } = conchDark.tokens;
    expect(parseStoredTheme({ ...conchDark, tokens })).toBeNull();
  });

  it("rejects an extra token", () => {
    const tokens = { ...conchDark.tokens, sidebar: "#000000" };
    expect(parseStoredTheme({ ...conchDark, tokens })).toBeNull();
  });

  it("rejects extra fields and a wrong version", () => {
    expect(parseStoredTheme({ ...conchDark, css: "x" })).toBeNull();
    expect(parseStoredTheme({ ...conchDark, version: 2 })).toBeNull();
  });

  it.each(["", "   ", "x".repeat(61)])("rejects the name %j", (name) => {
    expect(parseStoredTheme({ ...conchDark, name })).toBeNull();
  });

  it("trims names", () => {
    expect(parseStoredTheme({ ...conchDark, name: "  Ink  " })?.name).toBe(
      "Ink"
    );
  });

  it.each(["red", "var(--x)", "url(x)", "#12", "oklch(1 0 0);x"])(
    "rejects the color %s",
    (value) => {
      const tokens = { ...conchDark.tokens, panel: value };
      expect(parseStoredTheme({ ...conchDark, tokens })).toBeNull();
    }
  );

  it("accepts a draft without an id", () => {
    const { id: _id, ...draft } = conchDark;
    expect(ThemeDraft.safeParse(draft).success).toBeTruthy();
  });
});

describe("resolveTheme", () => {
  it("follows the mode", () => {
    expect(resolveTheme(state({ mode: "dark" }), "light").id).toBe(
      "conch-dark"
    );
    expect(resolveTheme(state({ mode: "light" }), "dark").id).toBe(
      "conch-light"
    );
    expect(resolveTheme(state({ mode: "system" }), "light").id).toBe(
      "conch-light"
    );
    expect(
      resolveTheme(state({ darkThemeId: "amber-dark", mode: "system" }), "dark")
        .id
    ).toBe("amber-dark");
  });

  it("finds custom themes", () => {
    const mine = custom({});
    expect(resolveTheme(state({ darkThemeId: mine.id }, [mine]), "dark")).toBe(
      mine
    );
  });

  it("falls back when the id is missing", () => {
    expect(resolveTheme(state({ darkThemeId: "gone" }), "dark").id).toBe(
      "conch-dark"
    );
  });

  it("falls back when the appearance does not match", () => {
    expect(
      resolveTheme(state({ lightThemeId: "amber-dark", mode: "light" }), "dark")
        .id
    ).toBe("conch-light");
  });
});
