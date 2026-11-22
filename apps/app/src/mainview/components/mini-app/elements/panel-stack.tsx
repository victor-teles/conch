import type { ReactNode } from "react";

import type { PanelElementOf } from "@/lib/ipc";

import { cn } from "@/lib/utils";

type StackProps = PanelElementOf<"Stack">["props"];

const GAPS: Record<StackProps["gap"], string> = {
  l: "gap-6",
  m: "gap-4",
  s: "gap-2",
};

interface PanelStackProps extends StackProps {
  children: ReactNode;
}

export function PanelStack({ direction, gap, children }: PanelStackProps) {
  return (
    <div
      className={cn(
        "flex min-w-0",
        direction === "vertical"
          ? "flex-col"
          : "flex-row flex-wrap items-start",
        GAPS[gap]
      )}
      data-element="stack"
    >
      {children}
    </div>
  );
}
