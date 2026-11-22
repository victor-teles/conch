import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface EditorHotkeys {
  onSave: () => void;
  onTest: () => void;
}

export const useSourceEditorHotkeys = ({ onSave, onTest }: EditorHotkeys) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!event.metaKey || event.defaultPrevented) {
        return;
      }
      if (event.key === "s") {
        event.preventDefault();
        onSave();
      } else if (event.key === "t") {
        event.preventDefault();
        onTest();
      }
    },
    [onSave, onTest]
  );
