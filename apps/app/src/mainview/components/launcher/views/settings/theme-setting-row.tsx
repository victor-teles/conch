import { ChevronRightIcon } from "lucide-react";

import { Pressable } from "@/components/motion/pressable";
import { useAppliedTheme } from "@/lib/theme/theme-store";

import { SettingRow } from "./setting-row";

export function ThemeSettingRow({ onOpen }: { onOpen: () => void }) {
  const theme = useAppliedTheme();
  return (
    <SettingRow description={theme.name} label="Theme">
      <Pressable
        aria-label="Open themes"
        className="flex h-7 items-center gap-1 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
        onClick={onOpen}
      >
        Open
        <ChevronRightIcon aria-hidden className="size-3" />
      </Pressable>
    </SettingRow>
  );
}
