import {
  ActivityIcon,
  CornerDownLeftIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlugZapIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { DatabaseConnection } from "@/lib/connections";

import {
  PRIMARY_KEYS,
  SECOND_KEYS,
} from "@/components/launcher/actions/menu-action";

export type ConnectionActionId =
  | "use"
  | "edit"
  | "test"
  | "pin"
  | "disconnect"
  | "delete";

export interface ConnectionAction extends MenuAction {
  id: ConnectionActionId;
}

export const connectionActions = (
  connection: DatabaseConnection,
  live: boolean
): ConnectionAction[] => [
  {
    icon: CornerDownLeftIcon,
    id: "use",
    keys: PRIMARY_KEYS,
    label: live ? "Use" : "Connect",
    tone: "default",
  },
  {
    icon: PencilIcon,
    id: "edit",
    keys: SECOND_KEYS,
    label: "Edit",
    tone: "default",
  },
  { icon: ActivityIcon, id: "test", label: "Test Connection", tone: "default" },
  connection.pinned
    ? { icon: PinOffIcon, id: "pin", label: "Unpin", tone: "default" }
    : { icon: PinIcon, id: "pin", label: "Pin", tone: "default" },
  ...(live
    ? [
        {
          icon: PlugZapIcon,
          id: "disconnect",
          label: "Disconnect",
          tone: "default",
        } satisfies ConnectionAction,
      ]
    : []),
  { icon: Trash2Icon, id: "delete", label: "Delete", tone: "destructive" },
];
