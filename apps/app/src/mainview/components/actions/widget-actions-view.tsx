import type { KeyboardEvent } from "react";

import { useCallback, useRef } from "react";

import type { ActionEditTarget } from "@/components/actions/action-targets";
import type { ListedAction } from "@/lib/ipc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherRow, optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { ViewHeader } from "@/components/launcher/view-header";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { deleteAction } from "@/lib/ipc";
import { cn } from "@/lib/utils";

import { EFFECT_ICONS } from "./action-menu-items";
import { announceActionsChanged } from "./actions-changed";
import { useListedActions } from "./use-listed-actions";

const HINTS = [{ keys: ["⌃", "X"], label: "Delete" }] as const;

interface Item {
  id: string;
  listed: ListedAction;
}

interface WidgetActionsViewProps {
  target: Omit<ActionEditTarget, "actionId" | "draft">;
  onBack: () => void;
  onEdit: (target: ActionEditTarget) => void;
}

const draftOf = ({ action }: ListedAction) => ({
  bind: action.bind,
  id: action.id,
  label: action.label,
  scope: action.scope,
  target: action.target,
});

export function WidgetActionsView({
  target,
  onBack,
  onEdit,
}: WidgetActionsViewProps) {
  const { listed } = useListedActions(target.widgetId);
  const items: Item[] = listed.map((item) => ({
    id: item.action.id,
    listed: item,
  }));
  const { move, select, selected } = useListSelection(items);
  const { arm, armed, disarm } = useArmedConfirm();
  const listRef = useRef<HTMLDivElement>(null);

  const edit = useCallback(
    (id: string) => {
      const item = listed.find((entry) => entry.action.id === id);
      if (item) {
        onEdit({ ...target, actionId: id, draft: draftOf(item) });
      }
    },
    [listed, onEdit, target]
  );

  const remove = useCallback(async () => {
    if (!selected) {
      return;
    }
    if (!armed) {
      arm();
      return;
    }
    disarm();
    await deleteAction(selected.id);
    announceActionsChanged(target.widgetId);
  }, [arm, armed, disarm, selected, target.widgetId]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        disarm();
        move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" && selected) {
        event.preventDefault();
        edit(selected.id);
      } else if (event.key === "x" && event.ctrlKey) {
        event.preventDefault();
        remove();
      }
    },
    [disarm, edit, move, remove, selected]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Actions" />
      <LauncherScrollArea className="flex-1">
        {items.length === 0 ? (
          <p className="px-4 py-6 type-body text-panel-muted" role="status">
            No actions yet. Add one from the widget&rsquo;s ⌘K menu.
          </p>
        ) : (
          <div
            aria-activedescendant={selected ? optionId(selected.id) : undefined}
            aria-label="Actions"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the list is the view's only control
            autoFocus
            className="px-2 outline-none"
            onKeyDown={handleKeyDown}
            ref={listRef}
            role="listbox"
            tabIndex={0}
          >
            {items.map(({ id, listed: item }) => {
              const Icon = EFFECT_ICONS[item.effect];
              const doomed = armed && selected?.id === id;
              return (
                <LauncherRow
                  id={id}
                  key={id}
                  onHover={select}
                  onRun={edit}
                  selected={selected?.id === id}
                  tone={doomed ? "destructive" : "default"}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "relative size-4 shrink-0 text-panel-muted",
                      item.effect === "write" && "text-warning-ink"
                    )}
                  />
                  <span className="relative min-w-0 flex-1 truncate type-body text-foreground">
                    {doomed ? "Press ⌃X again to delete" : item.action.label}
                  </span>
                  <span className="relative max-w-[55%] truncate type-meta text-panel-muted">
                    {item.subtitle}
                  </span>
                </LauncherRow>
              );
            })}
          </div>
        )}
      </LauncherScrollArea>
      <LauncherFooter
        actionLabel={items.length > 0 ? "Edit" : null}
        hints={items.length > 0 ? HINTS : []}
        status={
          <span>
            {items.length === 1 ? "1 action" : `${items.length} actions`}
          </span>
        }
      />
    </div>
  );
}
