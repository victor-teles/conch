import type { McpAuditEntry, McpTool } from "@conch/rpc";

import { useCallback } from "react";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { FreshPulse } from "@/components/motion/fresh-pulse";
import { cn } from "@/lib/utils";

import { auditLine, isQuietOutcome } from "./agents-copy";

const TOOL_TITLES: Record<McpTool, string> = {
  ask: "Asked a question",
  describe_schema: "Read a schema",
  list_connections: "Listed connections",
  list_widgets: "Listed widgets",
  run_widget: "Ran a widget",
};

interface AuditRowProps {
  entry: McpAuditEntry;
  connectionName: string | null;
  selected: boolean;
  fresh: boolean;
  onHover: (id: string) => void;
  onSettled: (id: string) => void;
}

export function AuditRow({
  entry,
  connectionName,
  selected,
  fresh,
  onHover,
  onSettled,
}: AuditRowProps) {
  const quiet = isQuietOutcome(entry.outcome);
  const handleSettled = useCallback(
    () => onSettled(entry.id),
    [entry.id, onSettled]
  );
  return (
    <LauncherRow
      id={entry.id}
      onHover={onHover}
      onRun={onHover}
      selected={selected}
      size="tall"
    >
      {fresh ? <FreshPulse onDone={handleSettled} /> : null}
      <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate type-body text-foreground">
          {entry.question ?? TOOL_TITLES[entry.tool]}
        </span>
        <span
          className={cn(
            "truncate type-meta tabular-nums",
            quiet ? "text-panel-muted" : "text-danger-ink"
          )}
          data-outcome={entry.outcome}
        >
          {auditLine(entry, connectionName)}
        </span>
      </span>
    </LauncherRow>
  );
}
