import { describe, expect, it } from "vitest";

import { themeContrastReport, themeProblems } from "./theme-contrast.ts";
import { BUILTIN_THEMES, defaultThemeFor } from "./theme.ts";

const conchDark = defaultThemeFor("dark");

describe("theme contrast", () => {
  it.each(BUILTIN_THEMES.map((theme) => [theme.id, theme] as const))(
    "%s passes every contrast pair",
    (_id, theme) => {
      const failing = themeContrastReport(theme).filter(
        (entry) => entry.level !== "ok"
      );
      expect(failing).toStrictEqual([]);
    }
  );

  it("blocks a theme whose text matches its background", () => {
    const theme = {
      ...conchDark,
      tokens: { ...conchDark.tokens, foreground: conchDark.tokens.background },
    };
    const problems = themeProblems(theme);
    expect(problems.map((entry) => entry.pair.id)).toContain(
      "foreground/background"
    );
  });

  it("only warns about low-contrast muted text", () => {
    const theme = {
      ...conchDark,
      tokens: { ...conchDark.tokens, "panel-muted": "#3a3a3a" },
    };
    const report = themeContrastReport(theme);
    expect(themeProblems(theme)).toStrictEqual([]);
    expect(
      report.filter((entry) => entry.level === "warn").map((e) => e.pair.fg)
    ).toContain("panel-muted");
  });

  it("measures the panel over the reference wallpaper", () => {
    const entry = themeContrastReport(conchDark).find(
      (candidate) => candidate.pair.id === "foreground/panel"
    );
    expect(entry?.ratio).toBeCloseTo(16.05, 1);
  });
});
