import type { ActionActivity, BoundValue, CompiledAction } from "@/lib/ipc";

import { BoundValues } from "@/components/actions/confirm-sheet/bound-values";
import { ExactCall } from "@/components/actions/confirm-sheet/exact-call";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

import { outcomeLabel } from "./activity-model";
import { useActionActivity } from "./use-action-activity";

const BACK_KEYS = ["esc"] as const;
const WHEN = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
});

const COMPILED_KINDS = new Set(["copy", "open-url", "sql", "mcp", "http"]);

// The audit stores what ran as plain JSON; only a recognised call renders.
const compiledOf = (value: unknown): CompiledAction | null =>
  typeof value === "object" &&
  value !== null &&
  COMPILED_KINDS.has(String((value as { kind?: unknown }).kind))
    ? (value as CompiledAction)
    : null;

const boundOf = (values: readonly unknown[]): BoundValue[] =>
  values.flatMap((value) =>
    typeof value === "object" && value !== null && "name" in value
      ? [value as BoundValue]
      : []
  );

function EntryDetail({ item }: { item: ActionActivity }) {
  const compiled = compiledOf(item.compiled);
  return (
    <Reveal className="flex flex-col gap-3">
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 type-meta">
        <dt className="text-panel-muted">Target</dt>
        <dd className={cn(item.effect === "write" && "text-warning-ink")}>
          {item.targetName}
          {item.environment ? ` · ${item.environment}` : ""}
        </dd>
        <dt className="text-panel-muted">When</dt>
        <dd className="text-foreground">{WHEN.format(new Date(item.at))}</dd>
        <dt className="text-panel-muted">Outcome</dt>
        <dd
          className={
            item.status === "ok" ? "text-foreground" : "text-danger-ink"
          }
        >
          {outcomeLabel(item)}
        </dd>
        <dt className="text-panel-muted">Duration</dt>
        <dd className="text-foreground">
          {item.durationMs === null ? "—" : `${item.durationMs} ms`}
        </dd>
      </dl>
      {compiled ? <ExactCall compiled={compiled} /> : null}
      <BoundValues bound={boundOf(item.bound)} />
    </Reveal>
  );
}

interface ActivityEntryViewProps {
  executionId: string;
  onBack: () => void;
}

export function ActivityEntryView({
  executionId,
  onBack,
}: ActivityEntryViewProps) {
  const { load } = useActionActivity();
  const item =
    load.status === "ready"
      ? load.page.activity.find((entry) => entry.executionId === executionId)
      : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title={item?.actionLabel ?? "Activity"} />
      <div className="min-h-0 flex-1 launcher-body overflow-y-auto px-4 pt-1">
        {item ? <EntryDetail item={item} /> : null}
        {load.status === "ready" && !item ? (
          <p className="py-4 type-meta text-panel-muted" role="status">
            This entry is no longer in the log.
          </p>
        ) : null}
        {load.status === "loading" ? (
          <p className="py-4 type-meta text-panel-muted" role="status">
            Loading…
          </p>
        ) : null}
        {load.status === "error" ? (
          <p className="py-4 type-meta text-danger-ink" role="alert">
            {load.message}
          </p>
        ) : null}
      </div>
      <LauncherFooter actionKeys={BACK_KEYS} actionLabel="Back" status={null} />
    </div>
  );
}
