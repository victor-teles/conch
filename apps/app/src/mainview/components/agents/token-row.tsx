import { useCallback, useState } from "react";

import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { cn } from "@/lib/utils";

const IDLE_NOTE = "Disconnects every client. Copy the config again after.";
const ROTATED_NOTE = "Clients disconnected";

interface TokenRowProps {
  onRotate: () => Promise<boolean>;
}

export function TokenRow({ onRotate }: TokenRowProps) {
  const { arm, armed, disarm } = useArmedConfirm();
  const [rotated, setRotated] = useState(false);
  const handlePress = useCallback(async () => {
    if (!armed) {
      setRotated(false);
      arm();
      return;
    }
    disarm();
    setRotated(await onRotate());
  }, [arm, armed, disarm, onRotate]);
  return (
    <SettingRow
      description={
        <span aria-live="polite">
          <SwapText value={rotated ? ROTATED_NOTE : IDLE_NOTE} />
        </span>
      }
      label="Rotate token"
    >
      <Pressable
        className={cn(
          "flex h-7 items-center rounded-[8px] px-2.5 type-meta focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none",
          armed
            ? "bg-destructive/14 text-danger-ink"
            : "bg-row-hover text-foreground hover:bg-row-active"
        )}
        data-armed={armed || undefined}
        onBlur={disarm}
        onClick={handlePress}
      >
        <SwapText value={armed ? "Press again to rotate" : "Rotate"} />
      </Pressable>
    </SettingRow>
  );
}
