import type { KeyboardEvent } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input, textarea, select, [tabindex="0"]';

const trapTab = (event: KeyboardEvent<HTMLElement>) => {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
  ];
  const [first] = items;
  const last = items.at(-1);
  if (!(first && last)) {
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

interface ConfirmSheetKeys {
  onConfirm: (() => void) | null;
  onClose: () => void;
  onCopy: (() => void) | null;
}

// Esc closes, ⌘↵ confirms, ⌘C copies the outcome, Tab stays inside. Plain
// ↵ is left to the focused button, and the confirm button ignores it.
export const useConfirmSheetHotkeys =
  ({ onConfirm, onClose, onCopy }: ConfirmSheetKeys) =>
  (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      trapTab(event);
      return;
    }
    if (event.key === "Enter" && event.metaKey) {
      event.preventDefault();
      onConfirm?.();
      return;
    }
    if (event.key === "c" && event.metaKey && onCopy) {
      event.preventDefault();
      onCopy();
    }
  };
