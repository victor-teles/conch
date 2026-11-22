import type { KeyboardEvent, MouseEvent } from "react";

import { useRef } from "react";

import { useRowSelectionTarget } from "./row-selection";

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const focusRow = (body: Element | null, index: number) => {
  const row = body?.children[index];
  if (row instanceof HTMLElement) {
    row.focus();
  }
};

// Roving focus over result rows: one row is tabbable, arrows move the
// selection and focus together, right-click or ⌃-click opens its actions.
export const useSelectableRows = (rowCount: number) => {
  const target = useRowSelectionTarget();
  const containerRef = useRef<HTMLDivElement>(null);
  if (!target) {
    return null;
  }
  const { selected, select, openMenu } = target;
  const focusIndex = selected ?? 0;

  return {
    containerRef,
    rowProps: (rowIndex: number) => ({
      "aria-selected": selected === rowIndex,
      onClick: () => select(rowIndex),
      onContextMenu: (event: MouseEvent<HTMLTableRowElement>) => {
        event.preventDefault();
        openMenu(rowIndex);
      },
      onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
        const step = STEPS[event.key];
        if (step === undefined || event.metaKey) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const next = Math.min(rowCount - 1, Math.max(0, rowIndex + step));
        select(next);
        focusRow(event.currentTarget.parentElement, next);
      },
      tabIndex: rowIndex === focusIndex ? 0 : -1,
    }),
    selected,
  };
};
