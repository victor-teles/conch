import { PlusIcon } from "lucide-react";

import type { FormState } from "@/components/connection-form/connection-form-state";

import { LauncherRow } from "@/components/launcher/launcher-row";

interface DraftRowProps {
  id: string;
  draft: FormState;
  selected: boolean;
  tone: "default" | "destructive";
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export const draftSubtitle = (draft: FormState): string =>
  draft.name.trim() || draft.host.trim() || "Unsaved";

export function DraftRow({
  id,
  draft,
  selected,
  tone,
  onHover,
  onRun,
}: DraftRowProps) {
  return (
    <LauncherRow
      id={id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
      tone={tone}
    >
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <PlusIcon aria-hidden className="size-3.5" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">
          New Connection
        </span>
        <span className="truncate type-meta text-panel-muted">
          {draftSubtitle(draft)}
        </span>
      </span>
      <span className="relative shrink-0 type-meta text-primary">Draft</span>
    </LauncherRow>
  );
}
