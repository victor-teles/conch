import { ArrowUpRightIcon } from "lucide-react";

import type { PanelAction } from "@/components/mini-app/panel-controls";

import { Pressable } from "@/components/motion/pressable";
import { cn } from "@/lib/utils";

interface PanelActionButtonProps {
  action: PanelAction | null;
  locked: string | null;
  onPress: () => void;
}

export function PanelActionButton({
  action,
  locked,
  onPress,
}: PanelActionButtonProps) {
  if (!action) {
    return null;
  }
  const disabled = locked !== null;
  return (
    <Pressable
      aria-disabled={disabled || undefined}
      className={cn(
        "flex h-8 w-fit items-center gap-2 rounded-[8px] border border-panel-border bg-row-hover px-3 type-body text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none",
        disabled && "cursor-not-allowed opacity-60"
      )}
      data-element="action"
      onClick={disabled ? undefined : onPress}
      title={locked ?? undefined}
    >
      {action.label}
      {action.effect === "write" ? (
        <span className="type-micro text-warning-ink">Writes</span>
      ) : null}
      {action.effect === "external" ? (
        <ArrowUpRightIcon
          aria-label="Opens a link"
          className="size-3.5 text-panel-muted"
        />
      ) : null}
    </Pressable>
  );
}
