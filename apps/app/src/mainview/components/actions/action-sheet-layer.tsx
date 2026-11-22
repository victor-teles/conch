import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import { ProgressHairline } from "@/components/motion/progress-hairline";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { ActionRun } from "./use-action-run";

import { sheetStateOf } from "./action-run-reducer";
import { ConfirmSheet } from "./confirm-sheet/confirm-sheet";

interface ActionSheetLayerProps {
  run: ActionRun;
  onClosed: () => void;
}

// The hairline while an action prepares, then the confirm sheet for a write.
export function ActionSheetLayer({ run, onClosed }: ActionSheetLayerProps) {
  const { state, close, confirm: handleConfirm } = run;
  // Focus leaves the sheet as it starts to exit, so keys reach the row
  // again instead of the closing sheet.
  const handleClose = useCallback(() => {
    close();
    onClosed();
  }, [close, onClosed]);
  const preparing = useDelayedVisibility(state.phase === "preparing");
  const sheet = sheetStateOf(state);
  return (
    <>
      <AnimatePresence>
        {preparing ? <ProgressHairline /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {sheet ? (
          <ConfirmSheet
            onClose={handleClose}
            onClosed={onClosed}
            onConfirm={handleConfirm}
            state={sheet}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
