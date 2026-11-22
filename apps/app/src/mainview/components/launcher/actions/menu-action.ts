import type { LucideIcon } from "lucide-react";

import type { RowTone } from "@/components/launcher/launcher-row";

export interface MenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: RowTone;
  disabled?: boolean;
  keys?: readonly string[];
  detail?: string;
  accent?: boolean;
}

export const DELETE_CONFIRM_LABEL = "Press ↵ again to delete";

export const PRIMARY_KEYS = ["↩"] as const;
export const SECOND_KEYS = ["⌘", "↩"] as const;

// ⌘↵ runs whichever action a menu labels with ⌘↩, so the key and the menu
// can never disagree.
export const secondActionOf = <A extends MenuAction>(
  actions: readonly A[]
): A | null =>
  actions.find((action) => action.keys?.join(" ") === SECOND_KEYS.join(" ")) ??
  null;
