import type { ReactNode } from "react";

import { AnimatePresence, motion } from "motion/react";
import { use } from "react";

import { useMotionPreset } from "@/lib/motion";

import { ListLayoutContext } from "./list-layout";

interface RowTrailingProps {
  kind: string;
  children?: ReactNode;
}

export function RowTrailing({ kind, children }: RowTrailingProps) {
  const layout = use(ListLayoutContext);
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  return (
    <span className="relative flex shrink-0 items-center gap-2 type-meta whitespace-nowrap text-panel-muted tabular-nums">
      {children}
      <AnimatePresence initial={false}>
        {layout === "flat" ? (
          <motion.span
            animate={{ opacity: 1 }}
            data-motion={reduced ? "instant" : "fade"}
            data-slot="row-kind"
            exit={{ opacity: 0, transition: fadeOut }}
            initial={reduced ? false : { opacity: 0 }}
            key="kind"
            transition={fadeIn}
          >
            {kind}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
