import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface DraftHotkeys {
  onPreview: () => void;
  onSave: () => void;
  onRun: (() => void) | null;
}

export const useSourceDraftHotkeys = ({
  onPreview,
  onSave,
  onRun,
}: DraftHotkeys) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Enter" && event.altKey && onRun) {
        event.preventDefault();
        onRun();
      } else if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        onPreview();
      } else if (event.key === "s" && event.metaKey) {
        event.preventDefault();
        onSave();
      }
    },
    [onPreview, onRun, onSave]
  );
