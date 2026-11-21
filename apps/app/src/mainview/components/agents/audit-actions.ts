import { CopyIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { McpAuditEntry } from "@/lib/ipc";

export type AuditActionId = "copy-sql" | "copy-question" | "clear";

export interface AuditAction extends MenuAction {
  id: AuditActionId;
}

export const auditActions = (entry: McpAuditEntry): AuditAction[] => [
  ...(entry.sql
    ? [
        {
          icon: CopyIcon,
          id: "copy-sql" as const,
          keys: ["↩"],
          label: "Copy SQL",
          tone: "default" as const,
        },
      ]
    : []),
  ...(entry.question
    ? [
        {
          icon: MessageSquareTextIcon,
          id: "copy-question" as const,
          label: "Copy Question",
          tone: "default" as const,
        },
      ]
    : []),
  {
    icon: Trash2Icon,
    id: "clear",
    label: "Clear Activity",
    tone: "destructive",
  },
];
