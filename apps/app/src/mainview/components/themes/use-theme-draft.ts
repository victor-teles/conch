import type {
  Theme,
  ThemeAppearance,
  ThemeDraft,
  ThemeTokenName,
  ThemeTokens,
} from "@conch/rpc";

import { THEME_TOKENS, THEME_VERSION, themeContrastReport } from "@conch/rpc";
import { useMemo, useReducer, useState } from "react";

import type { ThemeEditSource } from "./theme-edit-source";

import { duplicateName } from "./theme-items";

export interface DraftState {
  name: string;
  appearance: ThemeAppearance;
  tokens: ThemeTokens;
}

export type DraftAction =
  | { type: "token"; name: ThemeTokenName; value: string }
  | { type: "name"; name: string }
  | { type: "appearance"; appearance: ThemeAppearance };

export const initialDraft = (source: ThemeEditSource): DraftState => {
  const theme = source.kind === "new" ? source.from : source.theme;
  return {
    appearance: theme.appearance,
    name: source.kind === "new" ? duplicateName(theme.name) : theme.name,
    tokens: theme.tokens,
  };
};

export const draftReducer = (
  state: DraftState,
  action: DraftAction
): DraftState => {
  switch (action.type) {
    case "token": {
      return state.tokens[action.name] === action.value
        ? state
        : {
            ...state,
            tokens: { ...state.tokens, [action.name]: action.value },
          };
    }
    case "name": {
      return { ...state, name: action.name };
    }
    case "appearance": {
      return { ...state, appearance: action.appearance };
    }
    default: {
      return state;
    }
  }
};

export const isDirty = (draft: DraftState, initial: DraftState): boolean =>
  draft.name !== initial.name ||
  draft.appearance !== initial.appearance ||
  THEME_TOKENS.some(({ name }) => draft.tokens[name] !== initial.tokens[name]);

export const PREVIEW_ID = "theme-draft";

export const draftPayload = (
  draft: DraftState,
  source: ThemeEditSource
): ThemeDraft => ({
  appearance: draft.appearance,
  ...(source.kind === "existing" ? { id: source.theme.id } : {}),
  name: draft.name.trim(),
  tokens: draft.tokens,
  version: THEME_VERSION,
});

export const useThemeDraft = (source: ThemeEditSource) => {
  const [initial] = useState(() => initialDraft(source));
  const [draft, dispatch] = useReducer(draftReducer, source, initialDraft);
  const theme = useMemo(
    (): Theme => ({
      appearance: draft.appearance,
      id: source.kind === "existing" ? source.theme.id : PREVIEW_ID,
      name: draft.name,
      tokens: draft.tokens,
      version: THEME_VERSION,
    }),
    [draft, source]
  );
  const report = useMemo(() => themeContrastReport(draft), [draft]);
  return {
    dirty: isDirty(draft, initial),
    dispatch,
    draft,
    report,
    theme,
  };
};
