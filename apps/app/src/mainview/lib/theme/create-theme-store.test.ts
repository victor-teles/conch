import type {
  Theme,
  ThemeAppearance,
  ThemeSettings,
  ThemeState,
} from "@conch/rpc";

import { BUILTIN_THEMES, DEFAULT_THEME_STATE } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import {
  createThemeStore,
  LEGACY_THEME_KEY,
  THEME_CACHE_KEY,
} from "./create-theme-store";

const byId = (id: string): Theme => {
  const theme = BUILTIN_THEMES.find((candidate) => candidate.id === id);
  if (!theme) {
    throw new Error(id);
  }
  return theme;
};

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    items,
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
};

interface SetupOptions {
  storage?: Record<string, string>;
  state?: ThemeState;
  isLauncher?: boolean;
  system?: ThemeAppearance;
}

const setup = (options: SetupOptions = {}) => {
  const storage = memoryStorage(options.storage);
  const applied: Theme[] = [];
  const listeners: {
    system?: (appearance: ThemeAppearance) => void;
    changed?: (state: ThemeState) => void;
  } = {};
  let state = options.state ?? DEFAULT_THEME_STATE;
  const setThemeSettings = vi.fn((settings: ThemeSettings) => {
    state = { ...state, settings };
    return Promise.resolve(state);
  });
  const store = createThemeStore({
    apply: (theme) => applied.push(theme),
    getThemeState: () => {
      const current = state;
      return Promise.resolve(current);
    },
    isLauncher: options.isLauncher ?? true,
    onSystemAppearance: (listener) => {
      listeners.system = listener;
    },
    onThemeChanged: (listener) => {
      listeners.changed = listener;
    },
    setThemeSettings,
    storage,
    systemAppearance: () => options.system ?? "dark",
  });
  return { applied, listeners, setThemeSettings, storage, store };
};

const withSettings = (settings: Partial<ThemeSettings>): ThemeState => ({
  ...DEFAULT_THEME_STATE,
  settings: { ...DEFAULT_THEME_STATE.settings, ...settings },
});

describe("theme store", () => {
  it("paints the cached theme first, then the resolved one", async () => {
    const { applied, store } = setup({
      state: withSettings({ darkThemeId: "amber-dark" }),
      storage: { [THEME_CACHE_KEY]: JSON.stringify(byId("conch-light")) },
    });
    const init = store.init();
    expect(applied.map((theme) => theme.id)).toStrictEqual(["conch-light"]);
    await init;
    expect(store.getSnapshot().applied.id).toBe("amber-dark");
  });

  it("ignores a cache that does not parse", async () => {
    const { applied, store } = setup({
      storage: { [THEME_CACHE_KEY]: '{"tokens":{"panel":"url(x)"}}' },
    });
    const init = store.init();
    expect(applied[0]?.id).toBe("conch-dark");
    await init;
  });

  it("caches the applied theme but never a preview", async () => {
    const { storage, store } = setup();
    await store.init();
    store.setPreview(byId("amber-dark"));
    expect(store.getSnapshot().applied.id).toBe("amber-dark");
    expect(storage.getItem(THEME_CACHE_KEY)).toContain('"id":"conch-dark"');
    store.setPreview(null);
    expect(store.getSnapshot().applied.id).toBe("conch-dark");
  });

  it("releases only the preview it set", async () => {
    const { store } = setup();
    await store.init();
    const amber = byId("amber-dark");
    store.setPreview(amber);
    store.releasePreview(byId("conch-light"));
    expect(store.getSnapshot().preview).toBe(amber);
    store.releasePreview(amber);
    expect(store.getSnapshot().preview).toBeNull();
  });

  it("follows the system appearance and broadcasts", async () => {
    const { listeners, store } = setup({
      state: withSettings({ mode: "system" }),
    });
    await store.init();
    listeners.system?.("light");
    expect(store.getSnapshot().applied.id).toBe("conch-light");
    listeners.changed?.(
      withSettings({ lightThemeId: "amber-light", mode: "system" })
    );
    expect(store.getSnapshot().applied.id).toBe("amber-light");
  });

  it("switches the mode to the appearance of a theme it uses", async () => {
    const { setThemeSettings, store } = setup();
    await store.init();
    await store.selectTheme("amber-light");
    expect(setThemeSettings).toHaveBeenLastCalledWith({
      darkThemeId: "conch-dark",
      lightThemeId: "amber-light",
      mode: "light",
    });
    expect(store.getSnapshot().applied.id).toBe("amber-light");
  });

  it("keeps System mode when using a theme", async () => {
    const { setThemeSettings, store } = setup({
      state: withSettings({ mode: "system" }),
    });
    await store.init();
    await store.selectTheme("amber-light");
    expect(setThemeSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ lightThemeId: "amber-light", mode: "system" })
    );
    await store.selectTheme("nope");
    expect(setThemeSettings).toHaveBeenCalledOnce();
    await store.setMode("dark");
    expect(store.getSnapshot().state?.settings.mode).toBe("dark");
  });

  it("migrates the legacy mode once, in the launcher only", async () => {
    const launcher = setup({ storage: { [LEGACY_THEME_KEY]: "light" } });
    await launcher.store.init();
    expect(launcher.setThemeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "light" })
    );
    expect(launcher.storage.items.has(LEGACY_THEME_KEY)).toBeFalsy();

    const board = setup({
      isLauncher: false,
      storage: { [LEGACY_THEME_KEY]: "light" },
    });
    await board.store.init();
    expect(board.setThemeSettings).not.toHaveBeenCalled();
    expect(board.storage.items.has(LEGACY_THEME_KEY)).toBeTruthy();
  });

  it("drops a legacy value it does not understand", async () => {
    const { setThemeSettings, storage, store } = setup({
      storage: { [LEGACY_THEME_KEY]: "sepia" },
    });
    await store.init();
    expect(setThemeSettings).not.toHaveBeenCalled();
    expect(storage.items.has(LEGACY_THEME_KEY)).toBeFalsy();
  });

  it("notifies subscribers until they leave", async () => {
    const { store } = setup();
    const listener = vi.fn();
    const leave = store.subscribe(listener);
    await store.init();
    expect(listener).toHaveBeenCalledWith();
    leave();
    listener.mockClear();
    store.setPreview(byId("amber-dark"));
    expect(listener).not.toHaveBeenCalled();
  });
});
