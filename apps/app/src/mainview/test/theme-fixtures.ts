import type { Theme, ThemeSettings } from "@conch/rpc";

import { DEFAULT_THEME_SETTINGS, defaultThemeFor } from "@conch/rpc";

import { initTheme } from "@/lib/theme/theme-store";

import { mockLauncherIpc } from "./launcher-ipc";

export const makeCustomTheme = (overrides: Partial<Theme> = {}): Theme => ({
  ...defaultThemeFor("dark"),
  id: "theme_ink",
  name: "Ink",
  ...overrides,
});

interface ThemeSetup {
  custom?: Theme[];
  settings?: Partial<ThemeSettings>;
}

// Backs the theme requests with browser mode's localStorage emulator and
// loads the renderer's theme store from it.
export const mockThemes = async ({
  custom = [],
  settings = {},
}: ThemeSetup = {}) => {
  localStorage.setItem(
    "conch-theme-state",
    JSON.stringify({
      custom,
      settings: { ...DEFAULT_THEME_SETTINGS, ...settings },
    })
  );
  mockLauncherIpc();
  await initTheme();
};

export const rootToken = (name: string): string =>
  document.documentElement.style.getPropertyValue(`--${name}`);
