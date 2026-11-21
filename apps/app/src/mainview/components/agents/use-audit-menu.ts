import { useState } from "react";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";

import type { AuditAction, AuditActionId } from "./audit-actions";

interface UseAuditMenuOptions {
  canOpen: boolean;
  commands: Record<AuditActionId, () => unknown>;
  focusList: () => void;
}

export const useAuditMenu = ({
  canOpen,
  commands,
  focusList,
}: UseAuditMenuOptions) => {
  const [open, setOpen] = useState(false);
  const { arm, armed, disarm } = useArmedConfirm();

  const close = () => {
    disarm();
    setOpen(false);
    focusList();
  };

  const toggle = () => {
    if (open) {
      close();
    } else if (canOpen) {
      disarm();
      setOpen(true);
    }
  };

  const run = (action: AuditAction) => {
    if (action.id === "clear" && !armed) {
      arm();
      return;
    }
    close();
    commands[action.id]();
  };

  return { armed, close, open: open && canOpen, run, toggle };
};
