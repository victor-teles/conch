import type { SourceKind } from "@/lib/ipc";

const LABELS: Record<Exclude<SourceKind, "sql">, string> = {
  http: "HTTP",
  mcp: "MCP",
};

// Board tiles carry the kind only; SQL tiles stay as they were.
export function SourceBadge({ kind }: { kind: SourceKind }) {
  if (kind === "sql") {
    return null;
  }
  return (
    <span
      className="rounded-[5px] border border-panel-border px-1.5 type-micro text-panel-muted"
      data-source-kind={kind}
    >
      {LABELS[kind]}
    </span>
  );
}
