import { z } from "zod";

import {
  AMBER_DARK,
  AMBER_LIGHT,
  CONCH_DARK,
  CONCH_LIGHT,
} from "./theme-builtins.ts";
import { isThemeColor } from "./theme-color.ts";

export const THEME_VERSION = 1;
export const MAX_CUSTOM_THEMES = 50;
export const MAX_THEME_FILE_BYTES = 64 * 1024;
export const THEME_FILE_EXTENSION = "conch-theme.json";

const token = <const N extends string>(
  name: N,
  label: string,
  alpha = false
) => ({ alpha, label, name });

export const THEME_TOKEN_GROUPS = [
  {
    id: "surfaces",
    label: "Surfaces",
    tokens: [
      token("background", "Background"),
      token("card", "Card"),
      token("muted", "Muted"),
      token("secondary", "Secondary"),
      token("accent", "Accent"),
      token("input", "Input border"),
      token("border", "Border", true),
      token("panel", "Panel", true),
      token("panel-solid", "Solid panel", true),
      token("panel-raised", "Raised panel", true),
      token("panel-border", "Panel border", true),
      token("panel-highlight", "Panel highlight", true),
      token("scrim", "Dialog backdrop", true),
      token("shadow", "Shadow", true),
    ],
  },
  {
    id: "text",
    label: "Text",
    tokens: [
      token("foreground", "Text"),
      token("muted-foreground", "Muted text"),
      token("secondary-foreground", "Secondary text"),
      token("accent-foreground", "Accent text"),
      token("panel-muted", "Panel muted text"),
    ],
  },
  {
    id: "controls",
    label: "Controls",
    tokens: [
      token("primary", "Primary"),
      token("primary-foreground", "Primary text"),
      token("ring", "Focus ring"),
      token("row-hover", "Hovered row", true),
      token("row-active", "Selected row", true),
      token("kbd", "Keycap", true),
      token("control-thumb", "Control thumb", true),
    ],
  },
  {
    id: "brand",
    label: "Brand",
    tokens: [token("brand", "Brand")],
  },
  {
    id: "status",
    label: "Status",
    tokens: [
      token("destructive", "Destructive"),
      token("destructive-foreground", "Destructive text"),
      token("warning", "Warning"),
      token("warning-foreground", "Warning text"),
      token("success", "Success"),
      token("success-foreground", "Success text"),
      token("danger-ink", "Danger ink"),
      token("warning-ink", "Warning ink"),
      token("success-ink", "Success ink"),
    ],
  },
  {
    id: "charts",
    label: "Charts",
    tokens: [
      token("chart-1", "Chart 1"),
      token("chart-2", "Chart 2"),
      token("chart-3", "Chart 3"),
      token("chart-4", "Chart 4"),
      token("chart-5", "Chart 5"),
      token("chart-6", "Chart 6"),
    ],
  },
  {
    id: "connections",
    label: "Connections",
    tokens: [
      token("conn-honey", "Honey"),
      token("conn-denim", "Denim"),
      token("conn-moss", "Moss"),
      token("conn-plum", "Plum"),
      token("conn-clay", "Clay"),
      token("conn-stone", "Stone"),
    ],
  },
] as const;

type TokenGroup = (typeof THEME_TOKEN_GROUPS)[number];
export type ThemeTokenName = TokenGroup["tokens"][number]["name"];
export interface ThemeTokenInfo {
  name: ThemeTokenName;
  label: string;
  alpha: boolean;
}

export const THEME_TOKENS: readonly ThemeTokenInfo[] =
  THEME_TOKEN_GROUPS.flatMap(
    (group): readonly ThemeTokenInfo[] => group.tokens
  );

const [firstToken, ...otherTokens] = THEME_TOKENS.map((info) => info.name);
export const ThemeTokenName = z.enum([
  firstToken ?? "background",
  ...otherTokens,
]);

export const ThemeColor = z.string().max(64).refine(isThemeColor, {
  message: "Use #rrggbb, #rrggbbaa or oklch(L C H / A).",
});

export const THEME_APPEARANCES = ["dark", "light"] as const;
export const ThemeAppearance = z.enum(THEME_APPEARANCES);
export type ThemeAppearance = z.infer<typeof ThemeAppearance>;

export const THEME_MODES = ["system", "dark", "light"] as const;
export const ThemeMode = z.enum(THEME_MODES);
export type ThemeMode = z.infer<typeof ThemeMode>;

export const ThemeTokens = z.record(ThemeTokenName, ThemeColor);
export type ThemeTokens = Record<ThemeTokenName, string>;

const ThemeId = z.string().min(1).max(100);

export const ThemeFile = z
  .object({
    appearance: ThemeAppearance,
    name: z.string().trim().min(1).max(60),
    tokens: ThemeTokens,
    version: z.literal(THEME_VERSION),
  })
  .strict();
export type ThemeFile = z.infer<typeof ThemeFile>;

export const Theme = ThemeFile.extend({ id: ThemeId }).strict();
export type Theme = z.infer<typeof Theme>;

export const ThemeDraft = ThemeFile.extend({ id: ThemeId.optional() }).strict();
export type ThemeDraft = z.infer<typeof ThemeDraft>;

export const ThemeSettings = z
  .object({
    darkThemeId: ThemeId,
    lightThemeId: ThemeId,
    mode: ThemeMode,
  })
  .strict();
export type ThemeSettings = z.infer<typeof ThemeSettings>;

export interface ThemeState {
  settings: ThemeSettings;
  custom: Theme[];
}

export type ImportThemeResult =
  | { ok: true; theme: Theme }
  | { ok: false; reason: "cancelled" | "not-a-theme" | "unreadable" };

export const parseStoredTheme = (raw: unknown): Theme | null =>
  Theme.safeParse(raw).data ?? null;

const builtin = (
  id: string,
  name: string,
  appearance: ThemeAppearance,
  tokens: ThemeTokens
): Theme => ({ appearance, id, name, tokens, version: THEME_VERSION });

export const BUILTIN_THEMES: readonly Theme[] = [
  builtin("conch-dark", "Conch Dark", "dark", CONCH_DARK),
  builtin("conch-light", "Conch Light", "light", CONCH_LIGHT),
  builtin("amber-dark", "Amber Dark", "dark", AMBER_DARK),
  builtin("amber-light", "Amber Light", "light", AMBER_LIGHT),
];

export const DEFAULT_THEME_IDS: Record<ThemeAppearance, string> = {
  dark: "conch-dark",
  light: "conch-light",
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  darkThemeId: DEFAULT_THEME_IDS.dark,
  lightThemeId: DEFAULT_THEME_IDS.light,
  mode: "dark",
};

export const isBuiltinThemeId = (id: string): boolean =>
  BUILTIN_THEMES.some((theme) => theme.id === id);

export const defaultThemeFor = (appearance: ThemeAppearance): Theme => {
  const theme = BUILTIN_THEMES.find(
    (candidate) => candidate.id === DEFAULT_THEME_IDS[appearance]
  );
  if (!theme) {
    throw new Error(`No default ${appearance} theme`);
  }
  return theme;
};

export const findTheme = (custom: readonly Theme[], id: string): Theme | null =>
  BUILTIN_THEMES.find((theme) => theme.id === id) ??
  custom.find((theme) => theme.id === id) ??
  null;

export const themeIdFor = (
  settings: ThemeSettings,
  appearance: ThemeAppearance
): string =>
  appearance === "dark" ? settings.darkThemeId : settings.lightThemeId;

export const appearanceOf = (
  mode: ThemeMode,
  systemAppearance: ThemeAppearance
): ThemeAppearance => (mode === "system" ? systemAppearance : mode);

export const themeForAppearance = (
  state: ThemeState,
  appearance: ThemeAppearance
): Theme => {
  const theme = findTheme(state.custom, themeIdFor(state.settings, appearance));
  return theme?.appearance === appearance ? theme : defaultThemeFor(appearance);
};

export const resolveTheme = (
  state: ThemeState,
  systemAppearance: ThemeAppearance
): Theme =>
  themeForAppearance(
    state,
    appearanceOf(state.settings.mode, systemAppearance)
  );

export const DEFAULT_THEME_STATE: ThemeState = {
  custom: [],
  settings: DEFAULT_THEME_SETTINGS,
};
