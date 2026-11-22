import type { ReactNode, Ref } from "react";

interface PanelGridProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function PanelGrid({ children, ref }: PanelGridProps) {
  return (
    <div
      className="relative grid min-w-0 grid-cols-12 items-start gap-3"
      data-element="grid"
      ref={ref}
    >
      {children}
    </div>
  );
}
