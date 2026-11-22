import type { ThemeAppearance } from "@conch/rpc";
import type { ChangeEvent } from "react";

import { ChevronLeftIcon } from "lucide-react";
import { useCallback } from "react";

import type { SegmentOption } from "@/components/ui/segmented-control";

import { Pressable } from "@/components/motion/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";

const APPEARANCES: readonly SegmentOption<ThemeAppearance>[] = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

interface ThemeEditHeaderProps {
  name: string;
  appearance: ThemeAppearance;
  canChangeAppearance: boolean;
  onName: (name: string) => void;
  onAppearance: (appearance: ThemeAppearance) => void;
  onBack: () => void;
}

export function ThemeEditHeader({
  name,
  appearance,
  canChangeAppearance,
  onName,
  onAppearance,
  onBack,
}: ThemeEditHeaderProps) {
  const handleName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onName(event.target.value),
    [onName]
  );
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3">
      <Pressable
        aria-label="Back"
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        onClick={onBack}
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
      </Pressable>
      <input
        aria-label="Theme name"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the editor opens to name the theme
        autoFocus
        className="h-8 min-w-0 flex-1 rounded-[8px] bg-transparent px-2 type-title text-foreground caret-brand outline-none focus-visible:bg-row-hover"
        maxLength={60}
        onChange={handleName}
        placeholder="Theme name"
        spellCheck={false}
        value={name}
      />
      {canChangeAppearance ? (
        <SegmentedControl
          label="Appearance"
          onChange={onAppearance}
          options={APPEARANCES}
          value={appearance}
        />
      ) : null}
    </header>
  );
}
