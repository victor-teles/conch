import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId } from "react";

import type { SheetState } from "@/components/actions/action-run-reducer";

import { ErrorNotice } from "@/components/ask/error-notice";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { copyText } from "@/lib/clipboard";
import { useMotionPreset } from "@/lib/motion";

import type { SheetButtonsState } from "./sheet-buttons";

import { CONFIRM_DESCRIPTION_ID, ConfirmBody } from "./confirm-body";
import { SheetButtons } from "./sheet-buttons";
import {
  outcomeAnnouncement,
  outcomeText,
  SheetOutcome,
} from "./sheet-outcome";
import { useSheetPresence } from "./sheet-presence";
import { useConfirmSheetHotkeys } from "./use-confirm-sheet-hotkeys";
import { useEnabledAfter } from "./use-enabled-after";

export const SHEET_MIN_HEIGHT = 440;
const SCRIM_OPACITY = 0.6;

interface ConfirmSheetProps {
  state: SheetState;
  onConfirm: () => void;
  onClose: () => void;
  onClosed: () => void;
}

const buttonsState = (state: SheetState): SheetButtonsState => {
  if (state.phase === "confirm") {
    return "confirm";
  }
  return state.phase === "running" ? "running" : "done";
};

const writes = (state: SheetState): boolean =>
  state.phase !== "failed" || state.preview?.effect === "write";

const labelOf = (state: SheetState): string =>
  state.phase === "failed" ? state.label : state.preview.label;

function SheetBody({ state }: { state: SheetState }) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced ? { opacity: 0 } : { filter: "blur(2px)", opacity: 0 };
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ filter: "blur(0px)", opacity: 1 }}
        exit={{ ...hidden, transition: fadeOut }}
        initial={hidden}
        key={state.phase === "running" ? "confirm" : state.phase}
        transition={fadeIn}
      >
        {state.phase === "outcome" ? (
          <SheetOutcome outcome={state.outcome} />
        ) : null}
        {state.phase === "failed" ? (
          <ErrorNotice
            action={null}
            detail={state.failure.code}
            title={state.failure.message}
          />
        ) : null}
        {state.phase === "confirm" || state.phase === "running" ? (
          <ConfirmBody review={state.preview} />
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

// A modal alert over the widget body. Focus starts on Cancel and returns to
// the row that asked; only ⌘↵ or a real click on Run write confirms.
export function ConfirmSheet({
  state,
  onConfirm,
  onClose,
  onClosed,
}: ConfirmSheetProps) {
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  const titleId = useId();
  const enabled = useEnabledAfter();
  useSheetPresence();
  const canConfirm = enabled && state.phase === "confirm";
  const outcome = state.phase === "outcome" ? state.outcome : null;
  const copyOutcome = useCallback(() => {
    if (outcome) {
      copyText(outcomeText(outcome));
    }
  }, [outcome]);
  const handleKeyDown = useConfirmSheetHotkeys({
    onClose,
    onConfirm: canConfirm ? onConfirm : null,
    onCopy: outcome ? copyOutcome : null,
  });

  useEffect(() => onClosed, [onClosed]);

  const offscreen = reduced ? { opacity: 0 } : { opacity: 1, y: "100%" };
  return (
    <motion.div
      aria-describedby={CONFIRM_DESCRIPTION_ID}
      aria-labelledby={titleId}
      aria-modal="true"
      className="absolute inset-0 z-40 flex flex-col justify-end"
      onKeyDown={handleKeyDown}
      role="alertdialog"
    >
      <motion.div
        animate={{ opacity: SCRIM_OPACITY }}
        aria-hidden
        className="absolute inset-0 bg-(--panel-solid)"
        exit={{ opacity: 0, transition: fadeOut }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        transition={fadeIn}
      />
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative flex max-h-full flex-col overflow-y-auto rounded-t-[14px] popover-material px-4 pt-3 pb-14"
        data-motion={reduced ? "fade" : "slide"}
        exit={{ ...offscreen, transition: { ...soft, opacity: fadeOut } }}
        initial={offscreen}
        transition={soft}
      >
        <AnimatePresence>
          {state.phase === "running" ? <ProgressHairline /> : null}
        </AnimatePresence>
        <header className="flex items-center gap-2 pb-2">
          <h2
            className="min-w-0 flex-1 truncate type-title text-foreground"
            id={titleId}
          >
            {labelOf(state)}
          </h2>
          {writes(state) ? (
            <span className="rounded-full bg-warning-ink/15 px-2 py-0.5 type-micro text-warning-ink">
              Writes
            </span>
          ) : null}
        </header>
        <SheetBody state={state} />
        <p aria-live="polite" className="sr-only" role="status">
          {outcome ? outcomeAnnouncement(outcome) : ""}
          {state.phase === "failed"
            ? `Write failed: ${state.failure.message}`
            : ""}
        </p>
        <SheetButtons
          enabled={enabled}
          onClose={onClose}
          onConfirm={onConfirm}
          state={buttonsState(state)}
        />
      </motion.section>
    </motion.div>
  );
}
