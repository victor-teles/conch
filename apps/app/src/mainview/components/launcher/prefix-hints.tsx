import type { MouseEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import { Kbd } from "@/components/ui/kbd";
import { useMotionPreset } from "@/lib/motion";

import { SQL_PREFIX } from "./input-mode";

const HINTS = [
  { key: ">", label: "SQL", prefix: SQL_PREFIX },
  { key: "#", label: "Tables", prefix: "#" },
] as const;

const keepFocus = (event: MouseEvent<HTMLButtonElement>) =>
  event.preventDefault();

interface PrefixHintsProps {
  visible: boolean;
  onPick: (prefix: string) => void;
}

// Out of the tab order: typing the prefix is the keyboard path, and Tab
// belongs to the root list.
export function PrefixHints({ visible, onPick }: PrefixHintsProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { prefix } = event.currentTarget.dataset;
      if (prefix) {
        onPick(prefix);
      }
    },
    [onPick]
  );
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, x: 4 };
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="flex shrink-0 items-center gap-0.5"
          exit={{ ...hidden, transition: fadeOut }}
          initial={hidden}
          transition={fadeIn}
        >
          {HINTS.map((hint) => (
            <button
              aria-label={`${hint.label} mode (type ${hint.key})`}
              className="flex h-6.5 items-center gap-1.5 rounded-[7px] pr-2 pl-1 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground"
              data-prefix={hint.prefix}
              key={hint.key}
              onClick={handleClick}
              onMouseDown={keepFocus}
              tabIndex={-1}
              type="button"
            >
              <Kbd>{hint.key}</Kbd>
              {hint.label}
            </button>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
