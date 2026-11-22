import type { Theme } from "@conch/rpc";

import { isThemeColor, THEME_TOKENS } from "@conch/rpc";

export const applyTheme = (
  theme: Theme,
  root: HTMLElement = document.documentElement
): void => {
  root.classList.toggle("dark", theme.appearance === "dark");
  root.classList.toggle("light", theme.appearance === "light");
  root.style.colorScheme = theme.appearance;
  for (const { name } of THEME_TOKENS) {
    const value = theme.tokens[name];
    if (isThemeColor(value)) {
      root.style.setProperty(`--${name}`, value);
    }
  }
};
