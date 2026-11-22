import type { Theme, ThemeAppearance } from "@conch/rpc";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { getThemeState, onThemeChanged, setThemeSettings } from "@/lib/ipc";

import { applyTheme } from "./apply-theme";
import { createThemeStore } from "./create-theme-store";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const appearanceOf = (dark: boolean): ThemeAppearance =>
  dark ? "dark" : "light";

const storageOrNull = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isPanelWindow = (): boolean => /^#\/(board|app)\//.test(location.hash);

const store = createThemeStore({
  apply: (theme) => applyTheme(theme),
  getThemeState,
  isLauncher: !isPanelWindow(),
  onSystemAppearance: (listener) => {
    window
      .matchMedia(DARK_QUERY)
      .addEventListener("change", (event) =>
        listener(appearanceOf(event.matches))
      );
  },
  onThemeChanged: (listener) => {
    onThemeChanged(listener);
  },
  setThemeSettings,
  storage: storageOrNull(),
  systemAppearance: () => appearanceOf(window.matchMedia(DARK_QUERY).matches),
});

export const initTheme = async (): Promise<void> => {
  try {
    await store.init();
  } catch (error) {
    console.error("[theme] could not load themes", error);
  }
};

// Shows a theme in this window while the caller is mounted; null shows the
// theme in use again.
export const useThemePreview = (theme: Theme | null): void => {
  const shown = useRef<Theme | null>(null);
  useEffect(() => {
    const previous = shown.current;
    shown.current = theme;
    if (theme) {
      store.setPreview(theme);
    } else if (previous) {
      store.releasePreview(previous);
    }
  }, [theme]);
  useEffect(
    () => () => {
      if (shown.current) {
        store.releasePreview(shown.current);
      }
    },
    []
  );
};

export const useThemeSnapshot = () =>
  useSyncExternalStore(store.subscribe, store.getSnapshot);

export const useThemeState = () => useThemeSnapshot().state;

export const useAppliedTheme = (): Theme => useThemeSnapshot().applied;

export const themeActions = {
  releasePreview: store.releasePreview,
  selectTheme: store.selectTheme,
  setMode: store.setMode,
  setPreview: store.setPreview,
};
