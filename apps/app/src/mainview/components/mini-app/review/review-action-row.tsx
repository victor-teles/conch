import { motion } from "motion/react";
import { useCallback } from "react";

import type { AppActionDraft } from "@/lib/ipc";

import { Reveal } from "@/components/motion/reveal";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { bindLines, draftEffect, targetText } from "./review-draft";

export type ReviewGate = "none" | "needs-review" | "writes-off";

interface ReviewActionRowProps {
  action: AppActionDraft;
  gate: ReviewGate;
  targetName: string;
  reviewed: boolean;
  onToggle: (actionId: string) => void;
  onOpenSettings: () => void;
}

const EFFECT_TEXT = {
  external: "Opens link",
  read: "Read",
  write: "Writes",
} as const;

const reviewLine = (effect: string, targetName: string): string => {
  switch (effect) {
    case "write": {
      return `I reviewed this. It writes to ${targetName}.`;
    }
    case "external": {
      return "I reviewed this. It opens the address above.";
    }
    default: {
      return `I reviewed this. It calls ${targetName}.`;
    }
  }
};

export function ReviewActionRow({
  action,
  gate,
  targetName,
  reviewed,
  onToggle,
  onOpenSettings,
}: ReviewActionRowProps) {
  const { snappy, reduced } = useMotionPreset();
  const effect = draftEffect(action);
  const checkboxId = `review-${action.id}`;
  const binds = bindLines(action);
  const handleToggle = useCallback(
    () => onToggle(action.id),
    [action.id, onToggle]
  );
  return (
    <li
      data-gate={gate}
      className={cn(
        "flex flex-col gap-1.5 rounded-[10px] border border-panel-border px-3 py-2",
        gate === "writes-off" && "opacity-70"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate type-body text-foreground">
          {action.label}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 type-micro",
            effect === "write"
              ? "bg-warning-ink/15 text-warning-ink"
              : "bg-row-hover text-panel-muted"
          )}
        >
          {EFFECT_TEXT[effect]}
        </span>
      </div>
      {gate === "none" ? null : (
        <Reveal className="flex flex-col gap-1.5">
          <pre className="max-h-24 overflow-auto rounded-[8px] bg-row-hover px-2 py-1.5 font-mono type-micro break-all whitespace-pre-wrap text-foreground">
            {targetText(action.target)}
          </pre>
          {binds.length > 0 ? (
            <ul
              aria-label={`Values for ${action.label}`}
              className="flex flex-col gap-0.5 font-mono type-micro text-panel-muted"
            >
              {binds.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {gate === "writes-off" ? (
            <p className="flex items-center gap-2 type-meta text-panel-muted">
              Writes are off for {targetName}.
              <button
                className="text-foreground underline underline-offset-2"
                onClick={onOpenSettings}
                type="button"
              >
                Open Settings
              </button>
            </p>
          ) : (
            <label
              className="flex items-center gap-2 type-meta text-foreground"
              htmlFor={checkboxId}
            >
              <motion.input
                animate={{ scale: reviewed && !reduced ? [0.9, 1] : 1 }}
                checked={reviewed}
                className="size-4 accent-[var(--warning-ink)]"
                id={checkboxId}
                onChange={handleToggle}
                transition={snappy}
                type="checkbox"
              />
              {reviewLine(effect, targetName)}
            </label>
          )}
        </Reveal>
      )}
    </li>
  );
}
