import type { ChangeEvent, FocusEvent, KeyboardEvent, RefObject } from "react";

import { motion } from "motion/react";
import { Fragment, useCallback, useId, useLayoutEffect, useRef } from "react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { MenuAction } from "./menu-action";

import { ActionMenuItem, actionItemId } from "./action-menu-item";
import { useFilteredList } from "./use-filtered-list";

const HEADER_HEIGHT = 28;
const ITEM_HEIGHT = 32;
const SEPARATOR_HEIGHT = 9;
const FILTER_HEIGHT = 38;
const CHROME = 14;
const GUTTER = 12;

export const actionsMenuHeight = (count: number) =>
  HEADER_HEIGHT +
  count * ITEM_HEIGHT +
  SEPARATOR_HEIGHT +
  FILTER_HEIGHT +
  CHROME +
  GUTTER * 2;

const labelOf = (action: MenuAction) => action.label;

// Anchors the scale origin at the anchor's trailing edge so the menu grows
// out of the element it acts on.
const useOriginAt = (
  anchorId: string,
  field: RefObject<HTMLInputElement | null>
) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const anchor = document.querySelector(`#${CSS.escape(anchorId)}`);
    if (anchor) {
      const panelBox = panel.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const y = anchorBox.top + anchorBox.height / 2 - panelBox.top;
      panel.style.transformOrigin = `${anchorBox.right - panelBox.left}px ${y}px`;
    }
    field.current?.focus();
  }, [anchorId, field]);
  return panelRef;
};

interface ActionsMenuProps<A extends MenuAction> {
  title: string;
  anchorId: string;
  actions: readonly A[];
  armedId: string | null;
  onRun: (action: A) => void;
  onClose: () => void;
  className?: string;
}

export function ActionsMenu<A extends MenuAction>({
  title,
  anchorId,
  actions,
  armedId,
  onRun,
  onClose,
  className,
}: ActionsMenuProps<A>) {
  const { reduced, snappy, fadeIn, fadeOut } = useMotionPreset();
  const listId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const panelRef = useOriginAt(anchorId, fieldRef);
  const list = useFilteredList({
    items: actions,
    labelOf,
    onClose,
    onPick: onRun,
  });
  const {
    handleKeyDown: handleListKey,
    setQuery,
    select: handleHighlight,
  } = list;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const toggled = event.key === "k" && event.metaKey;
      if (event.key === "Tab" || toggled) {
        event.preventDefault();
        onClose();
        return;
      }
      handleListKey(event);
    },
    [handleListKey, onClose]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [setQuery]
  );

  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  const firstDestructive = list.visible.findIndex(
    (action) => action.tone === "destructive"
  );

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "absolute right-2 bottom-2 z-30 w-64 rounded-[12px] popover-material p-1.5 outline-none",
        className
      )}
      data-slot="actions-panel"
      exit={{ ...hidden, transition: fadeOut }}
      initial={hidden}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={panelRef}
      tabIndex={-1}
      transition={{ ...snappy, opacity: fadeIn }}
    >
      <div aria-label={`Actions for ${title}`} id={listId} role="menu">
        <div
          aria-hidden
          className="flex h-7 items-center truncate px-2.5 type-micro text-panel-muted"
        >
          {title}
        </div>
        {list.visible.length === 0 ? (
          <p className="flex h-8 items-center px-2.5 type-body text-panel-muted">
            No matching actions
          </p>
        ) : (
          list.visible.map((action, index) => (
            <Fragment key={action.id}>
              {index === firstDestructive && index > 0 ? (
                <div
                  className="mx-2.5 my-1 h-px bg-panel-border"
                  role="separator"
                />
              ) : null}
              <ActionMenuItem
                action={action}
                armed={action.id === armedId}
                highlighted={action.id === list.selected?.id}
                onHighlight={handleHighlight}
                onRun={onRun}
              />
            </Fragment>
          ))
        )}
      </div>
      <div className="mt-1 border-t border-panel-border pt-1">
        <input
          aria-activedescendant={
            list.selected ? actionItemId(list.selected.id) : undefined
          }
          aria-controls={listId}
          aria-label="Filter actions"
          autoComplete="off"
          className="h-8 w-full rounded-[8px] bg-transparent px-2.5 type-body text-foreground outline-none placeholder:text-panel-muted focus-visible:ring-1 focus-visible:ring-primary/50"
          onChange={handleChange}
          placeholder="Filter actions…"
          ref={fieldRef}
          spellCheck={false}
          type="text"
          value={list.query}
        />
      </div>
    </motion.div>
  );
}
