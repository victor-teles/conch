import type { MouseEvent } from "react";

import { motion } from "motion/react";
import { useCallback } from "react";

import { KeyCombo } from "@/components/launcher/key-combo";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

const CONFIRM_KEYS = ["⌘", "↩"] as const;
const BUTTON =
  "flex h-8 items-center gap-2 rounded-[8px] px-3 type-body outline-none focus-visible:ring-2 focus-visible:ring-primary/70";

export type SheetButtonsState = "confirm" | "running" | "done";

interface SheetButtonsProps {
  state: SheetButtonsState;
  enabled: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// ↵ and Space reach a focused button as a click with no pointer detail;
// the confirm button only answers a real click or ⌘↵.
export function SheetButtons({
  state,
  enabled,
  onConfirm,
  onClose,
}: SheetButtonsProps) {
  const { reduced, fadeIn } = useMotionPreset();
  const handleConfirm = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail > 0 && enabled && state === "confirm") {
        onConfirm();
      }
    },
    [enabled, onConfirm, state]
  );
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <Pressable
        autoFocus
        className={cn(
          BUTTON,
          "bg-row-hover text-foreground hover:bg-row-active"
        )}
        onClick={onClose}
      >
        {state === "done" ? "Done" : "Cancel"}
        <KeyCombo keys={["esc"]} />
      </Pressable>
      {state === "done" ? null : (
        <motion.div
          animate={{ opacity: enabled ? 1 : 0.5 }}
          initial={false}
          transition={reduced ? { duration: 0 } : fadeIn}
        >
          <Pressable
            aria-disabled={!enabled || state === "running"}
            aria-keyshortcuts="Meta+Enter"
            className={cn(
              BUTTON,
              "bg-warning-ink text-background hover:opacity-90"
            )}
            data-testid="confirm-write"
            onClick={handleConfirm}
          >
            <SwapText value={state === "running" ? "Running…" : "Run write"} />
            <KeyCombo className="text-background/80" keys={CONFIRM_KEYS} />
          </Pressable>
        </motion.div>
      )}
    </div>
  );
}
