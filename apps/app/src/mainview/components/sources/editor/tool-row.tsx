import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { McpToolSummary } from "@/lib/ipc";

import { CheckDraw } from "@/components/motion/check-draw";
import { staggerDelay, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const READ_CAUTION =
  "Only mark tools that never change data. You'll confirm this in a system dialog.";
export const MARKED_NOTE =
  "You marked this tool read-only. Widgets call it on every refresh.";

interface ToolRowProps {
  tool: McpToolSummary;
  index: number;
  pending: boolean;
  onToggle: (tool: McpToolSummary) => void;
}

const cautionOf = (tool: McpToolSummary, pending: boolean): string | null => {
  if (pending) {
    return READ_CAUTION;
  }
  return tool.markedRead ? MARKED_NOTE : null;
};

function ReadBadge() {
  const { reduced, fadeIn } = useMotionPreset();
  return (
    <motion.span
      animate={{ opacity: 1 }}
      className="shrink-0 rounded-[5px] bg-success-ink/12 px-1.5 type-micro text-success-ink"
      initial={{ opacity: 0 }}
      transition={reduced ? { duration: 0 } : fadeIn}
    >
      Read-only
    </motion.span>
  );
}

function TreatAsRead({ tool, pending, onToggle }: Omit<ToolRowProps, "index">) {
  const handleChange = useCallback(
    (_event: ChangeEvent<HTMLInputElement>) => onToggle(tool),
    [onToggle, tool]
  );
  return (
    <label className="relative flex shrink-0 cursor-default items-center gap-1.5 rounded-[7px] px-1.5 py-0.5 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/70">
      <input
        aria-label={`Treat ${tool.name} as read`}
        checked={tool.markedRead}
        className="absolute inset-0 cursor-default appearance-none rounded-[7px] opacity-0"
        disabled={pending}
        onChange={handleChange}
        type="checkbox"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 place-items-center rounded-[4px] border",
          tool.markedRead
            ? "border-primary bg-primary/15"
            : "border-panel-border"
        )}
      >
        {tool.markedRead ? (
          <CheckDraw className="size-3 text-primary" label="Marked" />
        ) : null}
      </span>
      Treat as read
    </label>
  );
}

export function ToolRow({ tool, index, pending, onToggle }: ToolRowProps) {
  const { reduced, fadeIn, soft, fadeOut } = useMotionPreset();
  const caution = cautionOf(tool, pending);
  const instant = { duration: 0 };
  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-[8px] px-2 py-1.5"
      data-tool={tool.name}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
      layout="position"
      transition={{
        ...fadeIn,
        delay: reduced ? 0 : staggerDelay(index),
        layout: reduced ? instant : soft,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-foreground">
          {tool.name}
        </span>
        <span className="min-w-0 flex-1 truncate type-meta text-panel-muted">
          {tool.description}
        </span>
        {tool.readOnlyHint === true ? (
          <ReadBadge />
        ) : (
          <TreatAsRead onToggle={onToggle} pending={pending} tool={tool} />
        )}
      </div>
      <AnimatePresence initial={false}>
        {caution ? (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="pt-1 type-micro text-warning-ink"
            exit={{ opacity: 0, transition: reduced ? instant : fadeOut }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
            key={caution}
            layout="position"
            transition={reduced ? instant : { ...fadeIn, y: soft }}
          >
            {caution}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}
