import { ChevronRightIcon } from "lucide-react";
import { motion } from "motion/react";
import { useCallback } from "react";

import type { SourceEditTarget } from "@/components/launcher/use-launcher-stack";
import type { SourceTestResult } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { SourceGlyph } from "@/components/sources/source-glyph";
import { staggerDelay, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SourceRowModel {
  id: string;
  key: string;
  kind: "mcp" | "http";
  name: string;
  detail: string;
  lastTest: SourceTestResult | null;
}

interface SourceRowProps {
  row: SourceRowModel;
  index: number;
  onOpen: (target: SourceEditTarget) => void;
}

const statusOf = (test: SourceTestResult | null): string =>
  test ? test.message : "Not tested";

export function SourceRow({ row, index, onOpen }: SourceRowProps) {
  const { reduced, fadeIn } = useMotionPreset();
  const handleOpen = useCallback(
    () => onOpen({ id: row.id, type: row.kind }),
    [onOpen, row.id, row.kind]
  );
  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
      transition={{ ...fadeIn, delay: reduced ? 0 : staggerDelay(index) }}
    >
      <Pressable
        aria-label={`Edit ${row.name}`}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-row-hover focus-visible:bg-row-hover focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none focus-visible:ring-inset"
        data-source-row={row.key}
        onClick={handleOpen}
      >
        <SourceGlyph kind={row.kind} name={row.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-body text-foreground">{row.name}</span>
          <span className="truncate font-mono text-[11px] text-panel-muted">
            {row.detail}
          </span>
        </span>
        <span
          className={cn(
            "max-w-56 shrink-0 truncate type-meta",
            row.lastTest?.ok === false ? "text-danger-ink" : "text-panel-muted"
          )}
        >
          {statusOf(row.lastTest)}
        </span>
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 text-panel-muted"
        />
      </Pressable>
    </motion.li>
  );
}
