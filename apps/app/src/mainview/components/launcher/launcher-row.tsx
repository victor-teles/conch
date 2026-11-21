import type { ReactNode } from "react";

import { motion } from "motion/react";
import { useCallback, useRef } from "react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { useRowInView } from "./use-row-in-view";

export const optionId = (id: string) => `launcher-option-${id}`;

export type RowTone = "default" | "destructive";
export type RowSize = "default" | "tall";

const ROW_HEIGHT: Record<RowSize, string> = { default: "h-10", tall: "h-14" };

interface LauncherRowProps {
  id: string;
  selected: boolean;
  tone?: RowTone;
  size?: RowSize;
  describedBy?: string;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
  children: ReactNode;
}

export function LauncherRow({
  id,
  selected,
  tone = "default",
  size = "default",
  describedBy,
  onHover,
  onRun,
  children,
}: LauncherRowProps) {
  const { spring, snappy, fadeIn, fadeOut, pressed, press } = useMotionPreset();
  const handleClick = useCallback(() => onRun(id), [onRun, id]);
  const handlePointerMove = useCallback(() => onHover(id), [onHover, id]);
  const rowRef = useRef<HTMLDivElement>(null);
  useRowInView(rowRef, selected);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-describedby={describedBy}
      aria-selected={selected}
      className={cn(
        "relative flex cursor-default items-center gap-3 px-2.5",
        ROW_HEIGHT[size]
      )}
      data-tone={tone}
      exit={{ opacity: 0, transition: fadeOut }}
      id={optionId(id)}
      initial={{ opacity: 0 }}
      layout="position"
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      ref={rowRef}
      role="option"
      transition={{ layout: spring, opacity: fadeIn }}
      whileTap={{ ...pressed, transition: press }}
    >
      {selected ? (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-[10px]",
            tone === "destructive" ? "bg-destructive/14" : "bg-row-active"
          )}
          layoutId="launcher-selection"
          transition={snappy}
        />
      ) : null}
      {children}
    </motion.div>
  );
}
