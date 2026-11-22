import type { KeyboardEvent } from "react";

import type { ThemeActionId } from "./theme-actions";

interface UseThemesHotkeysOptions {
  move: (delta: number) => void;
  run: (id: ThemeActionId) => void;
  openMenu: () => void;
}

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const META_ACTIONS: Partial<Record<string, ThemeActionId>> = {
  e: "edit",
  n: "new",
  o: "import",
};

const actionOf = (event: KeyboardEvent): ThemeActionId | null => {
  if (event.key === "Enter" && !event.metaKey) {
    return "use";
  }
  if (event.ctrlKey && event.key === "x") {
    return "delete";
  }
  return event.metaKey ? (META_ACTIONS[event.key] ?? null) : null;
};

export const useThemesHotkeys =
  ({ move, run, openMenu }: UseThemesHotkeysOptions) =>
  (event: KeyboardEvent<HTMLInputElement>) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      move(step);
      return;
    }
    if (event.metaKey && event.key === "k") {
      event.preventDefault();
      openMenu();
      return;
    }
    const action = actionOf(event);
    if (action) {
      event.preventDefault();
      run(action);
    }
  };
