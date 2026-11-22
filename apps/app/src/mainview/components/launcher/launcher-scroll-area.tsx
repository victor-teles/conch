import type { ReactNode } from "react";

import { motion } from "motion/react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

import { useScrollEdges } from "./use-scroll-edges";

interface LauncherScrollAreaProps {
  className?: string;
  children: ReactNode;
}

// layoutScroll lets rows that animate their layout tell a scroll from a move.
// The content reserves the footer's clearance so the last row scrolls clear of it.
export function LauncherScrollArea({
  className,
  children,
}: LauncherScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { atStart, atEnd } = useScrollEdges(ref);
  return (
    <motion.div
      className={cn(
        "min-h-0 scroll-pb-(--launcher-footer-clearance) overflow-y-auto scroll-fade",
        className
      )}
      data-fade-end={atEnd ? undefined : ""}
      data-fade-start={atStart ? undefined : ""}
      layoutScroll
      ref={ref}
    >
      <div className="flex min-h-full launcher-body flex-col">{children}</div>
    </motion.div>
  );
}
