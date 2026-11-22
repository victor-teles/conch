import type { ReactNode } from "react";

import { AnimatePresence } from "motion/react";
import { useId } from "react";

interface LauncherListboxProps {
  id: string;
  label: string;
  children: ReactNode;
}

export function LauncherListbox({ id, label, children }: LauncherListboxProps) {
  return (
    <div
      aria-label={label}
      className="flex flex-col px-2"
      id={id}
      role="listbox"
    >
      {children}
    </div>
  );
}

interface LauncherSectionProps {
  label: string;
  count?: number;
  children: ReactNode;
}

export function LauncherSection({
  label,
  count,
  children,
}: LauncherSectionProps) {
  const headingId = useId();
  return (
    <div aria-labelledby={headingId} role="group">
      <div
        className="px-2.5 pt-2 pb-1.5 type-micro text-panel-muted"
        id={headingId}
      >
        {label}
        {count === undefined ? null : (
          <span className="ml-1.5 tabular-nums">{count}</span>
        )}
      </div>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}
