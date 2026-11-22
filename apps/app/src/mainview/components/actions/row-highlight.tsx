import type { RefObject } from "react";

import { motion } from "motion/react";
import { useLayoutEffect, useState } from "react";

import { useMotionPreset } from "@/lib/motion";

interface Box {
  top: number;
  height: number;
}

interface RowHighlightProps {
  containerRef: RefObject<HTMLElement | null>;
  rowIndex: number;
}

const rowBox = (container: HTMLElement, rowIndex: number): Box | null => {
  const row = container.querySelectorAll("tbody > tr")[rowIndex];
  if (!row) {
    return null;
  }
  const rowRect = row.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    height: rowRect.height,
    top: rowRect.top - containerRect.top + container.scrollTop,
  };
};

// One highlight glides between rows instead of each row lighting up.
export function RowHighlight({ containerRef, rowIndex }: RowHighlightProps) {
  const { reduced, snappy } = useMotionPreset();
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    setBox(container ? rowBox(container, rowIndex) : null);
  }, [containerRef, rowIndex]);

  if (!box) {
    return null;
  }
  return (
    <motion.div
      animate={{ y: box.top }}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 rounded-[6px] bg-row-active"
      data-testid="row-selection"
      initial={false}
      style={{ height: box.height }}
      transition={reduced ? { duration: 0 } : snappy}
    />
  );
}
