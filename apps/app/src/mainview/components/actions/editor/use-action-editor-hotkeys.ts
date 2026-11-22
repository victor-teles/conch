import type { KeyboardEvent } from "react";

interface EditorKeys {
  onSubmit: () => void;
  onSuggest: () => void;
}

// ⌘↵ goes on (review for writes, save otherwise); ⌘⇧S asks for a draft.
export const useActionEditorHotkeys =
  ({ onSubmit, onSuggest }: EditorKeys) =>
  (event: KeyboardEvent<HTMLElement>) => {
    if (!event.metaKey) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    } else if (event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSuggest();
    }
  };
