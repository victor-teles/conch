import { timeAgo } from "@conch/rpc";
import { CheckIcon, XIcon } from "lucide-react";

import type { ActionActivity } from "@/lib/ipc";

import { EFFECT_ICONS } from "@/components/actions/action-menu-items";
import { LauncherRow } from "@/components/launcher/launcher-row";
import { cn } from "@/lib/utils";

interface ActivityRowProps {
  item: ActionActivity;
  selected: boolean;
  now: number;
  onHover: (id: string) => void;
  onOpen: (id: string) => void;
}

export function ActivityRow({
  item,
  selected,
  now,
  onHover,
  onOpen,
}: ActivityRowProps) {
  const Icon = EFFECT_ICONS[item.effect];
  const write = item.effect === "write";
  return (
    <LauncherRow
      id={item.executionId}
      onHover={onHover}
      onRun={onOpen}
      selected={selected}
    >
      <Icon
        aria-hidden
        className={cn(
          "relative size-4 shrink-0 text-panel-muted",
          write && "text-warning-ink"
        )}
      />
      <span className="relative min-w-0 flex-1 truncate type-body text-foreground">
        {item.actionLabel}
        <span
          className={cn(
            "ml-2 type-meta",
            write ? "text-warning-ink" : "text-panel-muted"
          )}
        >
          {item.targetName}
        </span>
      </span>
      {item.status === "ok" ? (
        <CheckIcon
          aria-label="Succeeded"
          className="relative size-3.5 text-success-ink"
        />
      ) : (
        <XIcon
          aria-label={item.status === "failed" ? "Failed" : "No result"}
          className="relative size-3.5 text-danger-ink"
        />
      )}
      <span className="relative w-16 shrink-0 text-right type-meta text-panel-muted">
        {timeAgo(Date.parse(item.at), now)}
      </span>
    </LauncherRow>
  );
}
