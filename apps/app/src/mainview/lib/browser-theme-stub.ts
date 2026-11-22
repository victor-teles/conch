import type {
  ImportThemeResult,
  Theme as ThemeRecord,
  ThemeFile as ThemeFileRecord,
  ThemeState,
} from "@conch/rpc";

import {
  DEFAULT_THEME_STATE,
  findTheme,
  isBuiltinThemeId,
  MAX_THEME_FILE_BYTES,
  Theme,
  ThemeDraft,
  ThemeFile,
  themeForAppearance,
  themeProblems,
  ThemeSettings,
} from "@conch/rpc";
import { z } from "zod";

const STATE_KEY = "conch-theme-state";

const StoredState = z.object({
  custom: z.array(Theme),
  settings: ThemeSettings,
});

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code, name: "DbError" });

const readState = (): ThemeState => {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = raw ? StoredState.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : DEFAULT_THEME_STATE;
  } catch {
    return DEFAULT_THEME_STATE;
  }
};

const repaired = (state: ThemeState): ThemeState => ({
  ...state,
  settings: {
    ...state.settings,
    darkThemeId: themeForAppearance(state, "dark").id,
    lightThemeId: themeForAppearance(state, "light").id,
  },
});

const readable = (theme: ThemeFileRecord): boolean =>
  themeProblems(theme).length === 0;

const uniqueName = (name: string, custom: readonly ThemeRecord[]): string => {
  const taken = new Set(custom.map((theme) => theme.name));
  let candidate = name;
  for (let n = 2; taken.has(candidate); n += 1) {
    candidate = `${name.slice(0, 56)} ${n}`;
  }
  return candidate;
};

const parseImport = (text: unknown): ThemeFileRecord | null => {
  if (typeof text !== "string" || text.length > MAX_THEME_FILE_BYTES) {
    return null;
  }
  try {
    const parsed = ThemeFile.safeParse(JSON.parse(text));
    return parsed.success && readable(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
};

// Bun's theme service, in localStorage. e2e imports by setting
// `globalThis.__conchThemeImport` to a theme file's JSON text.
export const createThemeEmulator = (emit: (state: ThemeState) => void) => {
  const commit = (state: ThemeState): ThemeState => {
    const next = repaired(state);
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    emit(next);
    return next;
  };

  const insert = (file: ThemeFileRecord): ThemeRecord => {
    const state = readState();
    const theme: ThemeRecord = {
      ...file,
      id: `theme_${crypto.randomUUID()}`,
      name: uniqueName(file.name, state.custom),
    };
    commit({ ...state, custom: [...state.custom, theme] });
    return theme;
  };

  return {
    deleteTheme: ({ themeId }: { themeId: string }): ThemeState => {
      const state = readState();
      return commit({
        ...state,
        custom: state.custom.filter((theme) => theme.id !== themeId),
      });
    },
    exportTheme: ({ themeId }: { themeId: string }) => {
      const theme = findTheme(readState().custom, themeId);
      if (!theme) {
        throw failure("THEME_NOT_FOUND", "This theme no longer exists.");
      }
      return { fileName: `${theme.name}.conch-theme.json`, savedId: "stub" };
    },
    getThemeState: (): ThemeState => repaired(readState()),
    importTheme: (): ImportThemeResult => {
      const file = parseImport(
        (globalThis as { __conchThemeImport?: unknown }).__conchThemeImport
      );
      return file
        ? { ok: true, theme: insert(file) }
        : { ok: false, reason: "not-a-theme" };
    },
    saveTheme: ({ theme: raw }: { theme: unknown }): ThemeRecord => {
      const { id, ...file } = ThemeDraft.parse(raw);
      if (!readable(file)) {
        throw failure("THEME_UNREADABLE", "Text would be hard to read.");
      }
      if (id === undefined) {
        return insert(file);
      }
      if (isBuiltinThemeId(id)) {
        throw failure("THEME_BUILTIN", "Built-in themes can't be changed.");
      }
      const state = readState();
      const existing = state.custom.find((theme) => theme.id === id);
      if (!existing) {
        throw failure("THEME_NOT_FOUND", "This theme no longer exists.");
      }
      const theme = { ...file, appearance: existing.appearance, id };
      commit({
        ...state,
        custom: state.custom.map((item) => (item.id === id ? theme : item)),
      });
      return theme;
    },
    setThemeSettings: ({ settings }: { settings: unknown }): ThemeState =>
      commit({ ...readState(), settings: ThemeSettings.parse(settings) }),
  };
};
