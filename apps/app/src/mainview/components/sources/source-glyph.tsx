import type { SourceKind } from "@/lib/ipc";

import { cn } from "@/lib/utils";

const LABELS: Record<Exclude<SourceKind, "sql">, string> = {
  http: "HTTP",
  mcp: "MCP",
};

interface SourceGlyphProps {
  kind: Exclude<SourceKind, "sql">;
  name: string | null;
  className?: string;
}

export function SourceGlyph({ kind, name, className }: SourceGlyphProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-label={name ? `${name} · ${LABELS[kind]}` : LABELS[kind]}
      className={cn(
        "relative grid size-6 shrink-0 place-items-center rounded-[7px] bg-row-hover text-[12px] font-semibold text-foreground",
        className
      )}
      data-source-kind={kind}
      role="img"
    >
      {initial}
      <span className="absolute -right-1 -bottom-1 rounded-[4px] bg-primary px-[3px] text-[7px] leading-[11px] font-bold tracking-wide text-primary-foreground">
        {LABELS[kind]}
      </span>
    </span>
  );
}
