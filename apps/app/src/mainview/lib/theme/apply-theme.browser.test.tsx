import { BUILTIN_THEMES, defaultThemeFor } from "@conch/rpc";
import { afterEach, describe, expect, it } from "vitest";

import { applyTheme } from "./apply-theme";

const amberLight = BUILTIN_THEMES.find((theme) => theme.id === "amber-light");
if (!amberLight) {
  throw new Error("amber-light is missing");
}

describe("applyTheme", () => {
  afterEach(() => {
    applyTheme(defaultThemeFor("dark"));
  });

  it("sets the class, color scheme and every token", () => {
    const root = document.documentElement;
    applyTheme(amberLight);
    expect(root.classList.contains("light")).toBeTruthy();
    expect(root.classList.contains("dark")).toBeFalsy();
    expect(root.style.colorScheme).toBe("light");
    expect(root.style.getPropertyValue("--primary")).toBe(
      "oklch(0.4341 0.0392 41.9938)"
    );
    expect(getComputedStyle(document.body).color).not.toBe("");
  });

  it("never writes a value outside the color grammar", () => {
    const root = document.createElement("div");
    const theme = defaultThemeFor("dark");
    applyTheme(
      { ...theme, tokens: { ...theme.tokens, panel: "red; x: url(y)" } },
      root
    );
    expect(root.style.getPropertyValue("--panel")).toBe("");
    expect(root.style.getPropertyValue("--background")).toBe(
      theme.tokens.background
    );
  });
});
