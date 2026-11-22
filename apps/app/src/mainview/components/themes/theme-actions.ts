import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";

import type { ThemeItem } from "./theme-items";

export type ThemeActionId =
  | "use"
  | "edit"
  | "duplicate"
  | "export"
  | "new"
  | "import"
  | "delete";

export interface ThemeAction extends MenuAction {
  id: ThemeActionId;
}

export const NEW_THEME_KEYS = ["⌘", "N"] as const;
export const IMPORT_THEME_KEYS = ["⌘", "O"] as const;
export const EDIT_THEME_KEYS = ["⌘", "E"] as const;
export const DELETE_THEME_KEYS = ["⌃", "X"] as const;

export const themeActions = (item: ThemeItem): ThemeAction[] => [
  {
    icon: CheckIcon,
    id: "use",
    keys: ["↩"],
    label: "Use Theme",
    tone: "default",
  },
  ...(item.builtin
    ? []
    : [
        {
          icon: PencilIcon,
          id: "edit",
          keys: EDIT_THEME_KEYS,
          label: "Edit",
          tone: "default",
        } satisfies ThemeAction,
      ]),
  {
    icon: CopyIcon,
    id: "duplicate",
    label: "Duplicate",
    tone: "default",
  },
  { icon: DownloadIcon, id: "export", label: "Export", tone: "default" },
  {
    icon: PlusIcon,
    id: "new",
    keys: NEW_THEME_KEYS,
    label: "New Theme",
    tone: "default",
  },
  {
    icon: UploadIcon,
    id: "import",
    keys: IMPORT_THEME_KEYS,
    label: "Import Theme",
    tone: "default",
  },
  ...(item.builtin
    ? []
    : [
        {
          icon: Trash2Icon,
          id: "delete",
          keys: DELETE_THEME_KEYS,
          label: "Delete",
          tone: "destructive",
        } satisfies ThemeAction,
      ]),
];
