import type { ReactNode } from "react";

interface EditorFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export function EditorField({ label, children, hint }: EditorFieldProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-1.5">
      <span className="w-24 shrink-0 pt-1.5 type-meta text-panel-muted">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {children}
        {hint ? (
          <span className="type-micro text-panel-muted">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

export const FIELD_INPUT =
  "h-8 w-full min-w-0 rounded-[8px] border border-panel-border bg-row-hover px-2.5 font-mono text-[12px] text-foreground outline-none placeholder:font-sans placeholder:text-panel-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export const EDITOR_BUTTON =
  "flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none disabled:opacity-50";
