import type { KeyboardEvent } from "react";

import { editableParams } from "@conch/rpc";
import { useCallback } from "react";

import type { InputMode } from "@/components/launcher/input-mode";
import type { FooterHint } from "@/components/launcher/launcher-footer";
import type { RootAlert } from "@/components/watches/use-alerts";

import type { RootItem } from "./root-items";

import { isShownAnswer } from "./root-items";
import { SHOW_ANSWER_LABEL } from "./row-actions";

const ACTIONS_HINT: FooterHint = { keys: ["⌘", "K"], label: "Actions" };
const INPUTS_HINT: FooterHint = { keys: ["⇥"], label: "Inputs" };
const COLUMNS_HINT: FooterHint = { keys: ["⌘", "↓"], label: "Columns" };
const DISMISS_HINT: FooterHint = { keys: ["⌫"], label: "Dismiss" };
const DISCARD_HINT: FooterHint = { keys: ["⌃", "X"], label: "Discard" };
const REMOVE_KEYS = ["⌃", "X"] as const;

const movementFor = (event: KeyboardEvent<HTMLInputElement>): number => {
  if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
    return 1;
  }
  if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
    return -1;
  }
  return 0;
};

export interface ModeKeys {
  commit: ((item: RootItem) => void) | null;
  focusDetail: (() => void) | null;
}

interface UseRootKeyboardOptions {
  selected: RootItem | null;
  move: (delta: number) => void;
  onRun: (item: RootItem | null) => void;
  onOpenActions: (item: RootItem) => void;
  onOpenInputs: (widgetId: string) => void;
  onOpenHistory: () => void;
  onDismissAlert: (alert: RootAlert) => void;
  onRowShortcut: (item: RootItem, keys: readonly string[]) => void;
  onRunSecond: (item: RootItem) => void;
  modeKeys: ModeKeys;
}

const hasInputs = (
  item: RootItem | null
): item is RootItem & {
  kind: "widget";
} => item?.kind === "widget" && editableParams(item.widget.params).length > 0;

// Only an empty input dismisses, and holding ⌫ to clear text never does.
const dismissibleAlert = (
  event: KeyboardEvent<HTMLInputElement>,
  selected: RootItem | null
): RootAlert | null =>
  event.key === "Backspace" &&
  !event.repeat &&
  event.currentTarget.value === "" &&
  selected?.kind === "alert"
    ? selected.alert
    : null;

// ↵ runs the row, ⌘↵ its second action (the one its menu labels ⌘↩).
const runEnter = (
  withCommand: boolean,
  selected: RootItem | null,
  onRun: (item: RootItem | null) => void,
  onRunSecond: (item: RootItem) => void
) => {
  if (!withCommand) {
    onRun(selected);
    return;
  }
  if (selected) {
    onRunSecond(selected);
  }
};

const runMetaShortcut = (
  event: KeyboardEvent<HTMLInputElement>,
  openHistory: () => void,
  openActions: () => void
): void => {
  if (!event.metaKey || (event.key !== "y" && event.key !== "k")) {
    return;
  }
  event.preventDefault();
  if (event.key === "y") {
    openHistory();
  } else {
    openActions();
  }
};

export const useRootKeyboard = ({
  selected,
  move,
  onRun,
  onOpenActions,
  onOpenInputs,
  onOpenHistory,
  onDismissAlert,
  onRowShortcut,
  onRunSecond,
  modeKeys,
}: UseRootKeyboardOptions) =>
  useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const { commit, focusDetail } = modeKeys;
      const alert = dismissibleAlert(event, selected);
      if (alert) {
        event.preventDefault();
        onDismissAlert(alert);
        return;
      }
      if (event.ctrlKey && event.key === "x" && selected) {
        event.preventDefault();
        onRowShortcut(selected, REMOVE_KEYS);
        return;
      }
      if (event.key === "ArrowDown" && event.metaKey && focusDetail) {
        event.preventDefault();
        focusDetail();
        return;
      }
      if (event.key === "Tab" && !event.shiftKey && commit && selected) {
        event.preventDefault();
        commit(selected);
        return;
      }
      const delta = movementFor(event);
      if (delta !== 0) {
        event.preventDefault();
        move(delta);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runEnter(event.metaKey, selected, onRun, onRunSecond);
        return;
      }
      if (event.key === "Tab" && !event.shiftKey && hasInputs(selected)) {
        event.preventDefault();
        onOpenInputs(selected.widget.id);
        return;
      }
      runMetaShortcut(
        event,
        () => onOpenHistory(),
        () => {
          if (selected) {
            onOpenActions(selected);
          }
        }
      );
    },
    [
      modeKeys,
      move,
      onDismissAlert,
      onOpenActions,
      onOpenHistory,
      onOpenInputs,
      onRowShortcut,
      onRun,
      onRunSecond,
      selected,
    ]
  );

interface RootFooter {
  actionLabel: string | null;
  hints: FooterHint[];
}

const footerBase = (
  selected: RootItem,
  liveIds: readonly string[],
  mode: InputMode
): RootFooter => {
  switch (selected.kind) {
    case "sql": {
      return { actionLabel: "Run", hints: [] };
    }
    case "lookup": {
      return { actionLabel: "Find", hints: [] };
    }
    case "table": {
      return { actionLabel: "Preview rows", hints: [COLUMNS_HINT] };
    }
    case "ask": {
      return { actionLabel: "Ask", hints: [] };
    }
    case "recent": {
      return { actionLabel: "Ask again", hints: [] };
    }
    case "board": {
      return { actionLabel: "Open", hints: [] };
    }
    case "alert": {
      return { actionLabel: "Open", hints: [DISMISS_HINT] };
    }
    case "widget": {
      return {
        actionLabel: "Run",
        hints: hasInputs(selected) ? [INPUTS_HINT] : [],
      };
    }
    case "draft": {
      return { actionLabel: "Open Draft", hints: [DISCARD_HINT] };
    }
    case "command": {
      return { actionLabel: selected.command.actionLabel, hints: [] };
    }
    default: {
      if (mode === "connection") {
        return { actionLabel: "Switch", hints: [] };
      }
      const live = liveIds.includes(selected.id);
      return { actionLabel: live ? "Use" : "Connect", hints: [] };
    }
  }
};

// Every row has actions, so ⌘K is always on offer while a row is selected.
export const footerFor = (
  selected: RootItem | null,
  liveIds: readonly string[],
  mode: InputMode = "search",
  lastAnswerId: string | null = null
): RootFooter => {
  if (!selected) {
    return { actionLabel: null, hints: [] };
  }
  const base = isShownAnswer(selected, lastAnswerId)
    ? { actionLabel: SHOW_ANSWER_LABEL, hints: [] }
    : footerBase(selected, liveIds, mode);
  return { ...base, hints: [...base.hints, ACTIONS_HINT] };
};
