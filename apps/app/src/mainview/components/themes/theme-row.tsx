import { CheckIcon } from "lucide-react";

import { LauncherRow } from "@/components/launcher/launcher-row";

import type { ThemeItem } from "./theme-items";

import { themeKindLabel } from "./theme-items";
import { ThemeSwatches } from "./theme-swatches";

interface ThemeRowProps {
  item: ThemeItem;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function ThemeRow({ item, selected, onHover, onRun }: ThemeRowProps) {
  return (
    <LauncherRow
      id={item.id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
    >
      <span className="relative">
        <ThemeSwatches theme={item.theme} />
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate type-body text-foreground">
          {item.theme.name}
        </span>
        {item.inUse ? (
          <CheckIcon
            aria-label="In use"
            className="size-3.5 shrink-0 text-foreground"
            role="img"
          />
        ) : null}
      </span>
      <span className="relative shrink-0 type-meta text-panel-muted">
        {themeKindLabel(item)}
      </span>
    </LauncherRow>
  );
}
