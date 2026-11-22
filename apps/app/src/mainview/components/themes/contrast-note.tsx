import type { ContrastEntry, ThemeTokenName } from "@conch/rpc";

import { cn } from "@/lib/utils";

import { noteText } from "./contrast-notes";

interface ContrastNoteProps {
  entry: ContrastEntry;
  token: ThemeTokenName;
}

export function ContrastNote({ entry, token }: ContrastNoteProps) {
  return (
    <span
      className={cn(
        "truncate type-meta",
        entry.level === "block" ? "text-danger-ink" : "text-warning-ink"
      )}
      data-level={entry.level}
    >
      {noteText(entry, token)}
    </span>
  );
}
