import { motion } from "motion/react";
import { useCallback } from "react";

import type {
  PanelAction,
  PanelRowTarget,
} from "@/components/mini-app/panel-controls";

import { usePanelControls } from "@/components/mini-app/panel-controls";
import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

interface RowActionChipsProps {
  actionIds: readonly string[];
  row: PanelRowTarget;
}

interface RowActionChipProps {
  action: PanelAction;
  row: PanelRowTarget;
  locked: string | null;
  onRun: (actionId: string, row: PanelRowTarget) => void;
}

function RowActionChip({ action, row, locked, onRun }: RowActionChipProps) {
  const handleClick = useCallback(() => {
    if (!locked) {
      onRun(action.id, row);
    }
  }, [action.id, locked, onRun, row]);
  return (
    <Pressable
      aria-disabled={locked ? true : undefined}
      className="h-6 rounded-[6px] bg-row-hover px-2 type-micro text-foreground hover:bg-row-active aria-disabled:opacity-60"
      onClick={handleClick}
      title={locked ?? undefined}
    >
      {action.label}
      {action.effect === "write" ? (
        <span className="ml-1 text-warning-ink">Writes</span>
      ) : null}
    </Pressable>
  );
}

// The selected row's actions; bun reads the row from its own run, so the
// chip only names the run and the row index.
export function RowActionChips({ actionIds, row }: RowActionChipsProps) {
  const { actionOf, actionsLocked, runAction } = usePanelControls();
  const { fadeIn, fadeOut } = useMotionPreset();
  const actions = actionIds.flatMap((id) => {
    const action = actionOf(id);
    return action ? [action] : [];
  });
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex items-center gap-1"
      exit={{ opacity: 0, transition: fadeOut }}
      initial={{ opacity: 0 }}
      transition={fadeIn}
    >
      {actions.map((action) => (
        <RowActionChip
          action={action}
          key={action.id}
          locked={actionsLocked}
          onRun={runAction}
          row={row}
        />
      ))}
    </motion.div>
  );
}
