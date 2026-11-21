import type { ReactNode } from "react";

import { AnimatePresence, motion } from "motion/react";

import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { KeyCombo } from "./key-combo";

export interface FooterHint {
  label: string;
  keys: readonly string[];
  disabled?: boolean;
}

interface LauncherFooterProps {
  status: ReactNode;
  actionLabel: string | null;
  actionKeys?: readonly string[];
  hints?: readonly FooterHint[];
}

interface FooterActionsProps {
  actionLabel: string | null;
  actionKeys: readonly string[];
  hints: readonly FooterHint[];
}

function FooterActions({ actionLabel, actionKeys, hints }: FooterActionsProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="pointer-events-auto ml-auto flex h-8 shrink-0 items-center gap-3 rounded-full capsule-material pr-1.5 pl-3"
      data-motion={reduced ? "fade" : "pop"}
      data-slot="footer-actions"
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      transition={fadeIn}
    >
      {actionLabel ? (
        <div className="flex items-center gap-2">
          <SwapText className="text-foreground" value={actionLabel} />
          <KeyCombo keys={actionKeys} />
        </div>
      ) : null}
      {hints.map((hint, index) => (
        <div
          aria-disabled={hint.disabled || undefined}
          className={cn(
            "flex items-center gap-2",
            (actionLabel || index > 0) && "border-l border-panel-border pl-3",
            hint.disabled && "opacity-50"
          )}
          key={hint.label}
        >
          <span>{hint.label}</span>
          <KeyCombo keys={hint.keys} />
        </div>
      ))}
    </motion.div>
  );
}

export function LauncherFooter({
  status,
  actionLabel,
  actionKeys = ["↩"],
  hints = [],
}: LauncherFooterProps) {
  const hasActions = actionLabel !== null || hints.length > 0;
  return (
    // Pulled up over the body by its own height, so it overlaps the body's
    // clearance without needing a positioned ancestor.
    <footer className="pointer-events-none relative z-20 -mt-(--launcher-footer-clearance) flex h-(--launcher-footer-clearance) shrink-0 items-end gap-2 px-2 pb-2 type-meta text-panel-muted">
      {/* An empty status stays mounted (only transparent) so its live region keeps announcing. */}
      <div
        className="pointer-events-auto flex h-8 min-w-0 items-center gap-2 rounded-full capsule-material px-3 transition-opacity duration-150 empty:pointer-events-none empty:opacity-0 motion-reduce:transition-none [&:has(>:only-child:empty)]:pointer-events-none [&:has(>:only-child:empty)]:opacity-0"
        data-slot="footer-status"
      >
        {status}
      </div>
      <AnimatePresence initial={false}>
        {hasActions ? (
          <FooterActions
            actionKeys={actionKeys}
            actionLabel={actionLabel}
            hints={hints}
            key="actions"
          />
        ) : null}
      </AnimatePresence>
    </footer>
  );
}
