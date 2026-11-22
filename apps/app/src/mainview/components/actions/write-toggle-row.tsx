import { motion } from "motion/react";

import type { WriteTargetKind } from "@/lib/ipc";

import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { useWritePermission } from "./use-write-permission";

const DESCRIPTION =
  "Saved actions can change data here. Every write asks you first.";

interface WriteToggleRowProps {
  kind: WriteTargetKind;
  id: string;
}

export function WriteToggleRow({ kind, id }: WriteToggleRowProps) {
  const { state, toggle } = useWritePermission(kind, id);
  const { snappy } = useMotionPreset();
  const ready = state.status === "ready";
  const on = ready && state.allowed;
  const error = ready ? state.error : null;
  return (
    <SettingRow
      description={
        <span aria-live="polite" className={cn(error && "text-danger-ink")}>
          {error ?? DESCRIPTION}
        </span>
      }
      label="Allow write actions"
    >
      <button
        aria-busy={ready && state.asking}
        aria-checked={on}
        aria-label="Allow write actions"
        className={cn(
          "relative flex h-5 w-9 items-center rounded-full border border-panel-border p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-50",
          on ? "justify-end bg-warning-ink" : "justify-start bg-row-hover"
        )}
        disabled={!ready}
        onClick={toggle}
        role="switch"
        type="button"
      >
        <motion.span
          className={cn(
            "size-3.5 rounded-full shadow-sm",
            on ? "bg-background" : "bg-panel-muted"
          )}
          layout
          transition={snappy}
        />
      </button>
    </SettingRow>
  );
}
