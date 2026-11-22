import type { ChangeEvent, KeyboardEvent } from "react";

import { useCallback, useMemo, useState } from "react";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { ViewHeader } from "@/components/launcher/view-header";
import { Reveal } from "@/components/motion/reveal";
import { useNow } from "@/hooks/use-now";
import { staggerDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  activitySections,
  filterActivity,
  integrityText,
} from "./activity-model";
import { ActivityRow } from "./activity-row";
import { useActionActivity } from "./use-action-activity";

const EMPTY = "No actions yet. Writes and links you run appear here.";
const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
const NOW_EVERY_MS = 30_000;

const runCount = (count: number): string =>
  count === 1 ? "1 run" : `${count} runs`;

interface ActivityViewProps {
  onBack: () => void;
  onOpen: (executionId: string) => void;
}

export function ActivityView({ onBack, onOpen }: ActivityViewProps) {
  const { load } = useActionActivity();
  const [query, setQuery] = useState("");
  const now = useNow(NOW_EVERY_MS);
  const page = load.status === "ready" ? load.page : null;
  const visible = useMemo(
    () => filterActivity(page?.activity ?? [], query),
    [page, query]
  );
  const sections = useMemo(
    () => activitySections(visible, new Date(now)),
    [now, visible]
  );
  const items = useMemo(
    () =>
      sections
        .flatMap((section) => section.items)
        .map((item) => ({ ...item, id: item.executionId })),
    [sections]
  );
  const { move, select, selected } = useListSelection(items);
  const orderOf = useMemo(
    () =>
      new Map(
        sections
          .flatMap((section) => section.items)
          .map((item, index) => [item.executionId, index])
      ),
    [sections]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const step = STEPS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        move(step);
      } else if (event.key === "Enter" && selected) {
        event.preventDefault();
        onOpen(selected.id);
      }
    },
    [move, onOpen, selected]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Activity">
        {page ? (
          <span
            className={cn(
              "type-meta",
              page.integrity.ok ? "text-panel-muted" : "text-danger-ink"
            )}
            role="status"
          >
            {integrityText(page.integrity)}
          </span>
        ) : null}
      </ViewHeader>
      <div className="px-4 pb-1">
        <input
          aria-activedescendant={selected ? optionId(selected.id) : undefined}
          aria-label="Filter activity"
          autoComplete="off"
          className="h-8 w-full rounded-[8px] bg-row-hover px-2.5 type-body text-foreground outline-none placeholder:text-panel-muted focus-visible:ring-2 focus-visible:ring-primary/50"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Filter by action or target…"
          spellCheck={false}
          type="text"
          value={query}
        />
      </div>
      <LauncherScrollArea className="flex-1">
        {load.status === "loading" ? (
          <p className="px-4 py-4 type-meta text-panel-muted" role="status">
            Loading activity…
          </p>
        ) : null}
        {load.status === "error" ? (
          <p className="px-4 py-4 type-meta text-danger-ink" role="alert">
            {load.message}
          </p>
        ) : null}
        {page && page.activity.length === 0 ? (
          <p className="px-4 py-6 type-body text-panel-muted" role="status">
            {EMPTY}
          </p>
        ) : null}
        <div aria-label="Activity" className="px-2" role="listbox">
          {sections.map((section) => (
            <Reveal key={section.id}>
              <div
                className="px-2.5 pt-2 pb-1 type-micro text-panel-muted"
                role="presentation"
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <Reveal
                  delay={staggerDelay(orderOf.get(item.executionId) ?? 0)}
                  key={item.executionId}
                >
                  <ActivityRow
                    item={item}
                    now={now}
                    onHover={select}
                    onOpen={onOpen}
                    selected={selected?.id === item.executionId}
                  />
                </Reveal>
              ))}
            </Reveal>
          ))}
        </div>
      </LauncherScrollArea>
      <LauncherFooter
        actionLabel={selected ? "Open" : null}
        status={
          <span aria-live="polite">
            {page ? runCount(page.activity.length) : "Activity"}
          </span>
        }
      />
    </div>
  );
}
