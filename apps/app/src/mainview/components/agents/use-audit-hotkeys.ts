import type { KeyboardEvent } from "react";

import { useCallback } from "react";

interface UseAuditHotkeysOptions {
  move: (delta: number) => void;
  onCopy: () => void;
  onToggleMenu: () => void;
}

export const useAuditHotkeys = ({
  move,
  onCopy,
  onToggleMenu,
}: UseAuditHotkeysOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        onToggleMenu();
        return;
      }
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
          break;
        }
        case "Enter": {
          event.preventDefault();
          onCopy();
          break;
        }
        default: {
          break;
        }
      }
    },
    [move, onCopy, onToggleMenu]
  );
