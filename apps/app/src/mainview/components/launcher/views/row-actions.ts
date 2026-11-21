import type { LucideIcon } from "lucide-react";

import {
  BellOffIcon,
  ClipboardCopyIcon,
  Columns3Icon,
  CornerDownLeftIcon,
  PlayIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";

import {
  PRIMARY_KEYS,
  SECOND_KEYS,
} from "@/components/launcher/actions/menu-action";

import type { RootItem } from "./root-items";

export type RowActionId =
  | "run"
  | "copy-prompt"
  | "copy-sql"
  | "copy-value"
  | "copy-table"
  | "show-columns"
  | "run-sql"
  | "remove-recent"
  | "dismiss-alert"
  | "discard-draft";

export interface RowAction extends MenuAction {
  id: RowActionId;
}

export type RowMenuItem = Exclude<
  RootItem,
  { kind: "widget" | "board" | "connection" }
>;

export const isRowMenuItem = (item: RootItem): item is RowMenuItem =>
  item.kind !== "widget" && item.kind !== "board" && item.kind !== "connection";

const PRIMARY_LABELS: Record<
  Exclude<RowMenuItem["kind"], "command">,
  string
> = {
  alert: "Open",
  ask: "Ask",
  draft: "Open Draft",
  lookup: "Find",
  recent: "Ask Again",
  sql: "Run",
  table: "Preview Rows",
};

const primary = (item: RowMenuItem): RowAction => {
  const [icon, label]: [LucideIcon, string] =
    item.kind === "command"
      ? [item.command.icon, item.command.actionLabel]
      : [CornerDownLeftIcon, PRIMARY_LABELS[item.kind]];
  return { icon, id: "run", keys: PRIMARY_KEYS, label, tone: "default" };
};

const copy = (
  id: RowActionId,
  label: string,
  keys?: readonly string[]
): RowAction => ({ icon: ClipboardCopyIcon, id, keys, label, tone: "default" });

export const SHOW_ANSWER_LABEL = "Show Answer";

interface RowActionContext {
  sqlRunnable: boolean;
  shownAnswer?: boolean;
}

// The first action is the row's ↵, the one marked ⌘↩ is its ⌘↵.
export const rowActions = (
  item: RowMenuItem,
  { sqlRunnable, shownAnswer = false }: RowActionContext
): RowAction[] => {
  const run = shownAnswer
    ? { ...primary(item), label: SHOW_ANSWER_LABEL }
    : primary(item);
  switch (item.kind) {
    case "ask": {
      return [run, copy("copy-prompt", "Copy Prompt")];
    }
    case "sql": {
      return [run, copy("copy-sql", "Copy SQL", SECOND_KEYS)];
    }
    case "lookup": {
      return [run, copy("copy-value", "Copy Value", SECOND_KEYS)];
    }
    case "table": {
      return [
        run,
        copy("copy-table", "Copy Table Name", SECOND_KEYS),
        {
          icon: Columns3Icon,
          id: "show-columns",
          keys: ["⌘", "↓"],
          label: "Show Columns",
          tone: "default",
        },
      ];
    }
    case "recent": {
      return [
        run,
        {
          disabled: !sqlRunnable,
          icon: PlayIcon,
          id: "run-sql",
          keys: SECOND_KEYS,
          label: "Run SQL (no AI)",
          tone: "default",
        },
        copy("copy-sql", "Copy SQL"),
        copy("copy-prompt", "Copy Prompt"),
        {
          icon: XIcon,
          id: "remove-recent",
          keys: ["⌃", "X"],
          label: "Remove from History",
          tone: "destructive",
        },
      ];
    }
    case "alert": {
      return [
        run,
        {
          icon: BellOffIcon,
          id: "dismiss-alert",
          keys: ["⌫"],
          label: "Dismiss",
          tone: "default",
        },
      ];
    }
    case "draft": {
      return [
        run,
        {
          icon: Trash2Icon,
          id: "discard-draft",
          keys: ["⌃", "X"],
          label: "Discard Draft",
          tone: "destructive",
        },
      ];
    }
    default: {
      return [run];
    }
  }
};

export const rowMenuTitle = (item: RowMenuItem): string => {
  switch (item.kind) {
    case "ask": {
      return item.prompt;
    }
    case "sql": {
      return item.sql;
    }
    case "lookup": {
      return item.value.value;
    }
    case "table": {
      return item.table.name;
    }
    case "recent": {
      return item.ask.prompt;
    }
    case "alert": {
      return item.alert.label;
    }
    case "draft": {
      return "New Connection";
    }
    default: {
      return item.command.title;
    }
  }
};
