import type { Theme, ThemeAppearance, ThemeTokenName } from "@conch/rpc";

import { useCallback, useState } from "react";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { getErrorMessage } from "@/lib/error-message";
import { saveTheme } from "@/lib/ipc";
import { useThemePreview } from "@/lib/theme/theme-store";

import type { ThemeEditSource } from "./theme-edit-source";

import { contrastSummary, summaryText } from "./contrast-notes";
import { draftPayload, useThemeDraft } from "./use-theme-draft";

interface UseThemeEditorOptions {
  source: ThemeEditSource;
  onBack: () => void;
  onSaved: (theme: Theme) => void;
}

export const useThemeEditor = ({
  source,
  onBack,
  onSaved,
}: UseThemeEditorOptions) => {
  const { dirty, dispatch, draft, report, theme } = useThemeDraft(source);
  const { arm, armed, disarm } = useArmedConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = contrastSummary(report);
  const blocked = summary.kind === "blocked";
  const named = draft.name.trim().length > 0;
  const canSave = named && !blocked && !saving;
  // An unreadable draft shows only in the preview strip, never on the launcher.
  useThemePreview(blocked ? null : theme);

  const save = useCallback(async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveTheme(draftPayload(draft, source)));
    } catch (error) {
      setError(getErrorMessage(error, "The theme could not be saved."));
    } finally {
      setSaving(false);
    }
  }, [canSave, draft, onSaved, source]);

  const requestBack = useCallback(() => {
    if (dirty && !armed) {
      arm();
      return;
    }
    disarm();
    onBack();
  }, [arm, armed, dirty, disarm, onBack]);

  const setName = useCallback(
    (name: string) => dispatch({ name, type: "name" }),
    [dispatch]
  );
  const setAppearance = useCallback(
    (appearance: ThemeAppearance) =>
      dispatch({ appearance, type: "appearance" }),
    [dispatch]
  );
  const setToken = useCallback(
    (name: ThemeTokenName, value: string) => {
      disarm();
      dispatch({ name, type: "token", value });
    },
    [disarm, dispatch]
  );

  const statusText = (): string => {
    if (armed) {
      return "Press Esc again to discard";
    }
    if (error) {
      return error;
    }
    return named ? summaryText(summary) : "Name the theme to save";
  };

  return {
    blocked: blocked && !armed,
    canSave,
    draft,
    report,
    requestBack,
    save,
    setAppearance,
    setName,
    setToken,
    status: statusText(),
    theme,
  };
};
