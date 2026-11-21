import type { ReactNode } from "react";

import { DatabaseIcon } from "lucide-react";

import { SwapText } from "@/components/motion/swap-text";

import type { AskIndicatorState } from "./ask-indicator";

import { AskIndicator } from "./ask-indicator";

interface AskHeaderProps {
  heading: string;
  segments: readonly string[];
  indicator: AskIndicatorState;
  children: ReactNode;
}

export function AskHeader({
  heading,
  segments,
  indicator,
  children,
}: AskHeaderProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 px-4">
      <DatabaseIcon
        aria-hidden
        className="size-3.5 shrink-0 text-panel-muted"
      />
      <h2 className="type-meta font-semibold text-foreground">{heading}</h2>
      <p className="ml-1 flex min-w-0 items-center gap-3 truncate type-meta text-panel-muted tabular-nums">
        {segments.map((segment, index) => (
          // Segments are positional slots that swap their own text.
          // oxlint-disable-next-line react/no-array-index-key
          <SwapText key={index} value={segment} />
        ))}
      </p>
      <div className="ml-auto flex items-center gap-0.5">
        <AskIndicator state={indicator} />
        {children}
      </div>
    </div>
  );
}
