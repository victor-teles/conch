import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { cn } from "@/lib/utils";

export function ClearActivityButton({ onClear }: { onClear: () => unknown }) {
  const { arm, armed, disarm } = useArmedConfirm();
  const handlePress = useCallback(() => {
    if (!armed) {
      arm();
      return;
    }
    disarm();
    onClear();
  }, [arm, armed, disarm, onClear]);
  return (
    <Pressable
      className={cn(
        "flex h-7 shrink-0 items-center rounded-[8px] px-2.5 type-meta focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none",
        armed
          ? "bg-destructive/14 text-danger-ink"
          : "text-panel-muted hover:bg-row-hover hover:text-foreground"
      )}
      onBlur={disarm}
      onClick={handlePress}
    >
      <SwapText value={armed ? "Press again to clear" : "Clear activity"} />
    </Pressable>
  );
}
