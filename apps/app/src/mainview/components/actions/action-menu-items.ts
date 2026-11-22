import type { LucideIcon } from "lucide-react";

import {
  BracesIcon,
  ClipboardCopyIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilLineIcon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { ActionEffect, ListedAction } from "@/lib/ipc";

export const EFFECT_ICONS: Record<ActionEffect, LucideIcon> = {
  external: ExternalLinkIcon,
  read: EyeIcon,
  write: PencilLineIcon,
};

export type BuiltinRowAction = "copy-value" | "copy-row-json";

export interface DeclaredMenuAction extends MenuAction {
  kind: "declared";
  listed: ListedAction;
}

export interface BuiltinMenuAction extends MenuAction {
  kind: "builtin";
  builtin: BuiltinRowAction;
}

export type ActionMenuEntry = DeclaredMenuAction | BuiltinMenuAction;

const ACTION_PREFIX = "action:";

export const isActionMenuEntry = (
  action: MenuAction
): action is ActionMenuEntry =>
  action.id.startsWith(ACTION_PREFIX) || action.id.startsWith("row:");

const declared = (listed: ListedAction): DeclaredMenuAction => ({
  accent: listed.effect === "write",
  detail: listed.subtitle,
  icon:
    listed.action.target.kind === "copy"
      ? CopyIcon
      : EFFECT_ICONS[listed.effect],
  id: `${ACTION_PREFIX}${listed.action.id}`,
  kind: "declared",
  label: listed.action.label,
  listed,
  tone: "default",
});

const BUILTINS: BuiltinMenuAction[] = [
  {
    builtin: "copy-value",
    icon: ClipboardCopyIcon,
    id: "row:copy-value",
    kind: "builtin",
    label: "Copy Value",
    tone: "default",
  },
  {
    builtin: "copy-row-json",
    icon: BracesIcon,
    id: "row:copy-row-json",
    kind: "builtin",
    label: "Copy Row as JSON",
    tone: "default",
  },
];

// Row actions lead when a row is selected, then the built-in copies, then
// the actions that act on the whole widget.
export const actionMenuEntries = (
  listed: readonly ListedAction[],
  hasRow: boolean
): ActionMenuEntry[] => {
  const rows = listed.filter((item) => item.action.scope === "row");
  const widget = listed.filter((item) => item.action.scope === "widget");
  return [
    ...(hasRow ? [...rows.map(declared), ...BUILTINS] : []),
    ...widget.map(declared),
  ];
};
