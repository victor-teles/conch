import { useCallback } from "react";

import type { EditorState } from "./action-draft-model";

type Section = "copy" | "link" | "sql" | "mcp" | "http";
type TextKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

export type EditorUpdate = (
  change: (current: EditorState) => EditorState
) => void;

// One setter factory per target section, so each field binds by key.
export const useSectionSetter = <S extends Section>(
  section: S,
  update: EditorUpdate
) =>
  useCallback(
    (key: TextKeys<EditorState[S]>) => (value: string) =>
      update((current) => ({
        ...current,
        [section]: { ...current[section], [key]: value },
      })),
    [section, update]
  );
