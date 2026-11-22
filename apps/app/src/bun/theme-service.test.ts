import type { Theme, ThemeSettings, ThemeState } from "@conch/rpc";

import { BUILTIN_THEMES, MAX_CUSTOM_THEMES } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { ThemeFileOut, ThemeStore } from "./theme-service.ts";

import { createThemeService } from "./theme-service.ts";

const conchDark = BUILTIN_THEMES[0] as Theme;
const amberLight = BUILTIN_THEMES[3] as Theme;

const custom = (id: string, overrides: Partial<Theme> = {}): Theme => ({
  ...conchDark,
  id,
  name: `Theme ${id}`,
  ...overrides,
});

const memoryStore = (initial: Theme[]): ThemeStore => {
  let items = [...initial];
  return {
    deleteTheme: (id) => {
      items = items.filter((theme) => theme.id !== id);
      return Promise.resolve();
    },
    getTheme: (id) => {
      const found = items.find((theme) => theme.id === id) ?? null;
      return Promise.resolve(found);
    },
    listThemes: () => {
      const all = [...items];
      return Promise.resolve(all);
    },
    saveTheme: (theme) => {
      const index = items.findIndex((item) => item.id === theme.id);
      items =
        index === -1
          ? [...items, theme]
          : items.map((item) => (item.id === theme.id ? theme : item));
      return Promise.resolve(theme);
    },
  };
};

interface SetupOptions {
  themes?: Theme[];
  settings?: unknown;
  picked?: string | null;
  fileText?: string | null;
}

const setup = (options: SetupOptions = {}) => {
  let { settings } = options;
  let ids = 0;
  const broadcasts: ThemeState[] = [];
  const saved: ThemeFileOut[] = [];
  const fileText = options.fileText ?? null;
  const picked = options.picked ?? null;
  const readFile = vi
    .fn<(path: string, max: number) => Promise<string | null>>()
    .mockResolvedValue(fileText);
  const writeSettings = vi.fn((next: ThemeSettings) => {
    settings = next;
    return Promise.resolve();
  });
  const service = createThemeService({
    broadcast: (state) => broadcasts.push(state),
    newId: () => {
      ids += 1;
      return String(ids);
    },
    pickFile: vi.fn<() => Promise<string | null>>().mockResolvedValue(picked),
    readFile,
    readSettings: () => {
      const stored = settings;
      return Promise.resolve(stored);
    },
    saveFile: (file) => {
      saved.push(file);
      return Promise.resolve({ fileName: "x", savedId: "s1" });
    },
    store: memoryStore(options.themes ?? []),
    writeSettings,
  });
  return { broadcasts, readFile, saved, service, writeSettings };
};

const draftOf = (theme: Theme) => {
  const { id: _id, ...draft } = theme;
  return draft;
};

describe("theme service", () => {
  it("defaults when nothing is stored or the shape is wrong", async () => {
    const { service } = setup({ settings: { mode: "sepia" } });
    await expect(service.getState()).resolves.toStrictEqual({
      custom: [],
      settings: {
        darkThemeId: "conch-dark",
        lightThemeId: "conch-light",
        mode: "dark",
      },
    });
  });

  it("repairs a dangling id and writes it back", async () => {
    const { service, writeSettings } = setup({
      settings: {
        darkThemeId: "theme_gone",
        lightThemeId: "amber-light",
        mode: "system",
      },
    });
    const state = await service.getState();
    expect(state.settings).toStrictEqual({
      darkThemeId: "conch-dark",
      lightThemeId: "amber-light",
      mode: "system",
    });
    expect(writeSettings).toHaveBeenCalledWith(state.settings);
  });

  it("saves valid settings and broadcasts", async () => {
    const { broadcasts, service } = setup();
    const settings = {
      darkThemeId: "amber-dark",
      lightThemeId: "conch-light",
      mode: "light" as const,
    };
    await expect(service.setSettings(settings)).resolves.toMatchObject({
      settings,
    });
    expect(broadcasts).toHaveLength(1);
  });

  it("rejects an unknown id and a dark theme in the light slot", async () => {
    const { service } = setup();
    await expect(
      service.setSettings({
        darkThemeId: "nope",
        lightThemeId: "conch-light",
        mode: "dark",
      })
    ).rejects.toMatchObject({ code: "THEME_NOT_FOUND" });
    await expect(
      service.setSettings({
        darkThemeId: "conch-dark",
        lightThemeId: "amber-dark",
        mode: "dark",
      })
    ).rejects.toMatchObject({ code: "THEME_NOT_FOUND" });
  });

  it("assigns an id to a new theme", async () => {
    const { broadcasts, service } = setup();
    const theme = await service.saveTheme({
      ...draftOf(conchDark),
      name: "Ink",
    });
    expect(theme.id).toBe("theme_1");
    expect(broadcasts.at(-1)?.custom).toStrictEqual([theme]);
  });

  it("updates an existing theme but keeps its appearance", async () => {
    const { service } = setup({ themes: [custom("theme_a")] });
    const theme = await service.saveTheme({
      ...amberLight,
      id: "theme_a",
      name: "Renamed",
      tokens: conchDark.tokens,
    });
    expect(theme).toMatchObject({ appearance: "dark", name: "Renamed" });
  });

  it("refuses built-in ids, unknown ids and unreadable themes", async () => {
    const { service } = setup();
    await expect(service.saveTheme(conchDark)).rejects.toMatchObject({
      code: "THEME_BUILTIN",
    });
    await expect(
      service.saveTheme({ ...conchDark, id: "theme_x" })
    ).rejects.toMatchObject({ code: "THEME_NOT_FOUND" });
    await expect(
      service.saveTheme({
        ...draftOf(conchDark),
        tokens: {
          ...conchDark.tokens,
          foreground: conchDark.tokens.background,
        },
      })
    ).rejects.toMatchObject({ code: "THEME_UNREADABLE" });
    await expect(
      service.saveTheme({ ...draftOf(conchDark), tokens: { panel: "red" } })
    ).rejects.toThrow(/Use #rrggbb/);
  });

  it(`keeps at most ${MAX_CUSTOM_THEMES} custom themes`, async () => {
    const themes = Array.from({ length: MAX_CUSTOM_THEMES }, (_, n) =>
      custom(`theme_${n}`)
    );
    const { service } = setup({ themes });
    await expect(service.saveTheme(draftOf(conchDark))).rejects.toMatchObject({
      code: "THEME_LIMIT",
    });
  });

  it("falls back when the theme in use is deleted", async () => {
    const { broadcasts, service } = setup({
      settings: {
        darkThemeId: "theme_a",
        lightThemeId: "conch-light",
        mode: "dark",
      },
      themes: [custom("theme_a")],
    });
    const state = await service.deleteTheme("theme_a");
    expect(state.settings.darkThemeId).toBe("conch-dark");
    expect(broadcasts.at(-1)).toStrictEqual(state);
    await expect(service.deleteTheme("conch-dark")).rejects.toMatchObject({
      code: "THEME_BUILTIN",
    });
  });

  it("exports a theme without its id", async () => {
    const { saved, service } = setup({
      themes: [custom("theme_a", { name: "Night Ink" })],
    });
    await service.exportTheme("theme_a");
    await service.exportTheme("amber-dark");
    expect(saved.map((file) => file.baseName)).toStrictEqual([
      "night-ink",
      "amber-dark",
    ]);
    expect(saved.map((file) => file.extension)).toStrictEqual([
      "conch-theme.json",
      "conch-theme.json",
    ]);
    expect(
      saved.map((file) => Object.hasOwn(JSON.parse(file.content), "id"))
    ).toStrictEqual([false, false]);
    await expect(service.exportTheme("gone")).rejects.toMatchObject({
      code: "THEME_NOT_FOUND",
    });
  });

  it("imports a theme with a new id and a free name", async () => {
    const file = JSON.stringify({ ...draftOf(conchDark), name: "Theme a" });
    const { readFile, service } = setup({
      fileText: file,
      picked: "/tmp/a.conch-theme.json",
      themes: [custom("a")],
    });
    const result = await service.importTheme();
    expect(result).toMatchObject({
      ok: true,
      theme: { id: "theme_1", name: "Theme a 2" },
    });
    expect(readFile).toHaveBeenCalledWith("/tmp/a.conch-theme.json", 65_536);
  });

  it.each([
    ["cancelled", { picked: null }],
    ["unreadable", { fileText: null, picked: "/big" }],
    ["not-a-theme", { fileText: "not json", picked: "/x" }],
    ["not-a-theme", { fileText: '{"name":"x"}', picked: "/x" }],
    [
      "not-a-theme",
      {
        fileText: JSON.stringify({
          ...draftOf(conchDark),
          tokens: {
            ...conchDark.tokens,
            "primary-foreground": conchDark.tokens.primary,
          },
        }),
        picked: "/x",
      },
    ],
  ] as const)("reports %s imports", async (reason, options) => {
    const { service } = setup(options);
    await expect(service.importTheme()).resolves.toStrictEqual({
      ok: false,
      reason,
    });
  });
});
