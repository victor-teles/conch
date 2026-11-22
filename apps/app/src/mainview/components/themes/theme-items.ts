import type { Theme, ThemeAppearance, ThemeState } from "@conch/rpc";

import { BUILTIN_THEMES, isBuiltinThemeId, themeIdFor } from "@conch/rpc";

import { rankByTerms } from "@/lib/fuzzy-match";

export interface ThemeItem {
  id: string;
  theme: Theme;
  builtin: boolean;
  inUse: boolean;
}

export interface ThemeSection {
  appearance: ThemeAppearance;
  label: string;
  items: ThemeItem[];
}

const SECTIONS: readonly { appearance: ThemeAppearance; label: string }[] = [
  { appearance: "dark", label: "Dark" },
  { appearance: "light", label: "Light" },
];

const kindLabel = (builtin: boolean) => (builtin ? "Built-in" : "Custom");

export const themeKindLabel = (item: ThemeItem): string =>
  kindLabel(item.builtin);

const termsOf = (item: ThemeItem) => [
  item.theme.name,
  item.theme.appearance,
  kindLabel(item.builtin),
];

export const themeSections = (
  state: ThemeState | null,
  query: string
): ThemeSection[] => {
  const themes = [...BUILTIN_THEMES, ...(state?.custom ?? [])];
  const items = themes.map(
    (theme): ThemeItem => ({
      builtin: isBuiltinThemeId(theme.id),
      id: theme.id,
      inUse:
        state !== null &&
        themeIdFor(state.settings, theme.appearance) === theme.id,
      theme,
    })
  );
  const ranked = rankByTerms(items, query, termsOf).map((entry) => entry.item);
  return SECTIONS.map((section) => ({
    ...section,
    items: ranked.filter(
      (item) => item.theme.appearance === section.appearance
    ),
  })).filter((section) => section.items.length > 0);
};

export const duplicateName = (name: string): string =>
  `${name.slice(0, 55)} copy`;
