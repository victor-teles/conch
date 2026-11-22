import type { createThemeStore } from "@conch/core/themes";
import type {
  ImportThemeResult,
  Theme as ThemeRecord,
  ThemeAppearance,
  ThemeFile as ThemeFileRecord,
  ThemeSettings as ThemeSettingsRecord,
  ThemeState,
} from "@conch/rpc";

import { DbError } from "@conch/core";
import {
  DEFAULT_THEME_IDS,
  DEFAULT_THEME_SETTINGS,
  findTheme,
  isBuiltinThemeId,
  MAX_CUSTOM_THEMES,
  MAX_THEME_FILE_BYTES,
  THEME_FILE_EXTENSION,
  ThemeDraft,
  ThemeFile,
  themeProblems,
  ThemeSettings,
} from "@conch/rpc";
import { z } from "zod";

import type { SaveResult } from "./downloads.ts";

import { slugBaseName } from "./downloads.ts";

export type ThemeStore = ReturnType<typeof createThemeStore<ThemeRecord>>;

export interface ThemeFileOut {
  baseName: string;
  extension: typeof THEME_FILE_EXTENSION;
  content: string;
}

export interface ThemeServiceDeps {
  store: ThemeStore;
  readSettings(): Promise<unknown>;
  writeSettings(settings: ThemeSettingsRecord): Promise<void>;
  pickFile(): Promise<string | null>;
  readFile(path: string, maxBytes: number): Promise<string | null>;
  saveFile(file: ThemeFileOut): Promise<SaveResult>;
  newId(): string;
  broadcast(state: ThemeState): void;
}

const Id = z.string().min(1).max(100);

const failure = (code: string, message: string): DbError =>
  new DbError(code, message);

const slotOf = (appearance: ThemeAppearance) =>
  appearance === "dark" ? "darkThemeId" : "lightThemeId";

const resolves = (
  custom: readonly ThemeRecord[],
  id: string,
  appearance: ThemeAppearance
): boolean => findTheme(custom, id)?.appearance === appearance;

const repaired = (
  settings: ThemeSettingsRecord,
  custom: readonly ThemeRecord[]
): ThemeSettingsRecord => ({
  ...settings,
  darkThemeId: resolves(custom, settings.darkThemeId, "dark")
    ? settings.darkThemeId
    : DEFAULT_THEME_IDS.dark,
  lightThemeId: resolves(custom, settings.lightThemeId, "light")
    ? settings.lightThemeId
    : DEFAULT_THEME_IDS.light,
});

const sameSettings = (a: ThemeSettingsRecord, b: ThemeSettingsRecord) =>
  a.mode === b.mode &&
  a.darkThemeId === b.darkThemeId &&
  a.lightThemeId === b.lightThemeId;

const uniqueName = (name: string, taken: ReadonlySet<string>): string => {
  if (!taken.has(name)) {
    return name;
  }
  for (let n = 2; ; n += 1) {
    const suffix = ` ${n}`;
    const candidate = `${name.slice(0, 60 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
};

const assertReadable = (theme: ThemeFileRecord): void => {
  const [problem] = themeProblems(theme);
  if (problem) {
    throw failure(
      "THEME_UNREADABLE",
      `Text would be hard to read (${problem.ratio.toFixed(1)}:1 for ${problem.pair.id}).`
    );
  }
};

const parseImported = (text: string): ThemeFileRecord | null => {
  try {
    const parsed = ThemeFile.safeParse(JSON.parse(text));
    return parsed.success && themeProblems(parsed.data).length === 0
      ? parsed.data
      : null;
  } catch {
    return null;
  }
};

export const createThemeService = (deps: ThemeServiceDeps) => {
  const listCustom = () => deps.store.listThemes();

  const readSettings = async (): Promise<ThemeSettingsRecord> => {
    const parsed = ThemeSettings.safeParse(await deps.readSettings());
    return parsed.success ? parsed.data : DEFAULT_THEME_SETTINGS;
  };

  const getState = async (): Promise<ThemeState> => {
    const custom = await listCustom();
    const stored = await readSettings();
    const settings = repaired(stored, custom);
    if (!sameSettings(settings, stored)) {
      await deps.writeSettings(settings);
    }
    return { custom, settings };
  };

  const changed = async (): Promise<ThemeState> => {
    const state = await getState();
    deps.broadcast(state);
    return state;
  };

  const insert = async (file: ThemeFileRecord): Promise<ThemeRecord> => {
    const custom = await listCustom();
    if (custom.length >= MAX_CUSTOM_THEMES) {
      throw failure(
        "THEME_LIMIT",
        `You can keep up to ${MAX_CUSTOM_THEMES} custom themes.`
      );
    }
    const theme: ThemeRecord = { ...file, id: `theme_${deps.newId()}` };
    return deps.store.saveTheme(theme);
  };

  return {
    async deleteTheme(rawId: unknown): Promise<ThemeState> {
      const id = Id.parse(rawId);
      if (isBuiltinThemeId(id)) {
        throw failure("THEME_BUILTIN", "Built-in themes can't be deleted.");
      }
      await deps.store.deleteTheme(id);
      return changed();
    },

    async exportTheme(rawId: unknown): Promise<SaveResult> {
      const id = Id.parse(rawId);
      const theme = findTheme(await listCustom(), id);
      if (!theme) {
        throw failure("THEME_NOT_FOUND", "This theme no longer exists.");
      }
      const { id: _id, ...file } = theme;
      return deps.saveFile({
        baseName: slugBaseName(theme.name) || "theme",
        content: `${JSON.stringify(file, null, 2)}\n`,
        extension: THEME_FILE_EXTENSION,
      });
    },

    getState,

    async importTheme(): Promise<ImportThemeResult> {
      const path = await deps.pickFile();
      if (!path) {
        return { ok: false, reason: "cancelled" };
      }
      const text = await deps.readFile(path, MAX_THEME_FILE_BYTES);
      if (text === null) {
        return { ok: false, reason: "unreadable" };
      }
      const file = parseImported(text);
      if (!file) {
        return { ok: false, reason: "not-a-theme" };
      }
      const custom = await listCustom();
      const taken = new Set(custom.map((theme) => theme.name));
      const theme = await insert({
        ...file,
        name: uniqueName(file.name, taken),
      });
      await changed();
      return { ok: true, theme };
    },

    async saveTheme(rawDraft: unknown): Promise<ThemeRecord> {
      const { id, ...file } = ThemeDraft.parse(rawDraft);
      if (id === undefined) {
        assertReadable(file);
        const theme = await insert(file);
        await changed();
        return theme;
      }
      if (isBuiltinThemeId(id)) {
        throw failure("THEME_BUILTIN", "Built-in themes can't be changed.");
      }
      const existing = await deps.store.getTheme(id);
      if (!existing) {
        throw failure("THEME_NOT_FOUND", "This theme no longer exists.");
      }
      const next: ThemeRecord = {
        ...file,
        appearance: existing.appearance,
        id,
      };
      assertReadable(next);
      const theme = await deps.store.saveTheme(next);
      await changed();
      return theme;
    },

    async setSettings(rawSettings: unknown): Promise<ThemeState> {
      const settings = ThemeSettings.parse(rawSettings);
      const custom = await listCustom();
      for (const appearance of ["dark", "light"] as const) {
        if (!resolves(custom, settings[slotOf(appearance)], appearance)) {
          throw failure(
            "THEME_NOT_FOUND",
            `That theme can't be used in ${appearance} mode.`
          );
        }
      }
      await deps.writeSettings(settings);
      return changed();
    },
  };
};

export type ThemeService = ReturnType<typeof createThemeService>;
