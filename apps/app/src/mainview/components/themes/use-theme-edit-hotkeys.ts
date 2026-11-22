import type { KeyboardEvent } from "react";

interface UseThemeEditHotkeysOptions {
  onSave: () => void;
  onBack: () => void;
}

const inPopover = (target: EventTarget) =>
  target instanceof Element &&
  target.closest("[data-slot='popover-content']") !== null;

export const useThemeEditHotkeys =
  ({ onSave, onBack }: UseThemeEditHotkeysOptions) =>
  (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey && event.key === "s") {
      event.preventDefault();
      onSave();
      return;
    }
    // Esc in the color picker closes the picker, not the editor.
    if (event.key === "Escape" && !inPopover(event.target)) {
      event.preventDefault();
      onBack();
    }
  };
