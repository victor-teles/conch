import type {
  Theme as ThemeRecord,
  ThemeAppearance,
  ThemeMode,
  ThemeSettings,
  ThemeState,
} from "@conch/rpc";

import { defaultThemeFor, findTheme, resolveTheme, Theme } from "@conch/rpc";

export const THEME_CACHE_KEY = "conch-theme";
export const LEGACY_THEME_KEY = "vite-ui-theme";

export interface ThemeSnapshot {
  state: ThemeState | null;
  preview: ThemeRecord | null;
  applied: ThemeRecord;
  systemAppearance: ThemeAppearance;
}

export interface ThemeStoreDeps {
  apply(theme: ThemeRecord): void;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  systemAppearance(): ThemeAppearance;
  onSystemAppearance(listener: (appearance: ThemeAppearance) => void): void;
  getThemeState(): Promise<ThemeState>;
  setThemeSettings(settings: ThemeSettings): Promise<ThemeState>;
  onThemeChanged(listener: (state: ThemeState) => void): void;
  isLauncher: boolean;
}

const safely = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

// Storage can be missing or refuse writes (private mode); the theme still applies.
const attempt = (write: () => void): void => {
  safely(() => {
    write();
    return true;
  }, false);
};

const readCache = (storage: ThemeStoreDeps["storage"]): ThemeRecord | null =>
  safely(() => {
    const raw = storage?.getItem(THEME_CACHE_KEY);
    return raw ? (Theme.safeParse(JSON.parse(raw)).data ?? null) : null;
  }, null);

const isMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "dark" || value === "light";

export const createThemeStore = (deps: ThemeStoreDeps) => {
  const listeners = new Set<() => void>();
  let listening = false;
  let snapshot: ThemeSnapshot = {
    applied: readCache(deps.storage) ?? defaultThemeFor("dark"),
    preview: null,
    state: null,
    systemAppearance: deps.systemAppearance(),
  };

  const appliedOf = (next: Omit<ThemeSnapshot, "applied">): ThemeRecord =>
    next.preview ??
    (next.state
      ? resolveTheme(next.state, next.systemAppearance)
      : snapshot.applied);

  const update = (change: Partial<Omit<ThemeSnapshot, "applied">>): void => {
    const base = { ...snapshot, ...change };
    const applied = appliedOf(base);
    snapshot = { ...base, applied };
    deps.apply(applied);
    if (!base.preview) {
      attempt(() =>
        deps.storage?.setItem(THEME_CACHE_KEY, JSON.stringify(applied))
      );
    }
    for (const listener of listeners) {
      listener();
    }
  };

  const setSettings = async (settings: ThemeSettings): Promise<void> => {
    update({ state: await deps.setThemeSettings(settings) });
  };

  const settingsOrNull = (): ThemeSettings | null =>
    snapshot.state?.settings ?? null;

  const migrateLegacyMode = async (state: ThemeState): Promise<void> => {
    const legacy = safely(
      () => deps.storage?.getItem(LEGACY_THEME_KEY) ?? null,
      null
    );
    if (legacy === null) {
      return;
    }
    attempt(() => deps.storage?.removeItem(LEGACY_THEME_KEY));
    if (isMode(legacy) && legacy !== state.settings.mode) {
      await setSettings({ ...state.settings, mode: legacy });
    }
  };

  return {
    getSnapshot: (): ThemeSnapshot => snapshot,

    async init(): Promise<void> {
      deps.apply(snapshot.applied);
      if (!listening) {
        listening = true;
        deps.onSystemAppearance((systemAppearance) =>
          update({ systemAppearance })
        );
        deps.onThemeChanged((state) => update({ state }));
      }
      const state = await deps.getThemeState();
      update({ preview: null, state });
      if (deps.isLauncher) {
        await migrateLegacyMode(state);
      }
    },

    // A view that unmounts clears only the preview it set, so the next view's
    // preview survives the exit animation.
    releasePreview(preview: ThemeRecord): void {
      if (snapshot.preview === preview) {
        update({ preview: null });
      }
    },

    async selectTheme(id: string): Promise<void> {
      const settings = settingsOrNull();
      const theme = snapshot.state
        ? findTheme(snapshot.state.custom, id)
        : null;
      if (!(settings && theme)) {
        return;
      }
      const slot = theme.appearance === "dark" ? "darkThemeId" : "lightThemeId";
      const mode = settings.mode === "system" ? "system" : theme.appearance;
      await setSettings({ ...settings, [slot]: theme.id, mode });
    },

    async setMode(mode: ThemeMode): Promise<void> {
      const settings = settingsOrNull();
      if (settings) {
        await setSettings({ ...settings, mode });
      }
    },

    setPreview(preview: ThemeRecord | null): void {
      if (preview !== snapshot.preview) {
        update({ preview });
      }
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type ThemeStore = ReturnType<typeof createThemeStore>;
