import type { KeyboardEvent } from "react";

import { useMemo, useState } from "react";

import { useListSelection } from "@/components/launcher/use-list-selection";

import { filterByLabel } from "./actions-filter";

interface Pickable {
  id: string;
  disabled?: boolean;
}

interface UseFilteredListOptions<T extends Pickable> {
  items: readonly T[];
  labelOf: (item: T) => string;
  onPick: (item: T) => void;
  onClose: () => void;
}

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

// The keyboard contract shared by the action panel and the scope filter:
// arrows move, ↵ picks, Esc clears the filter first and closes second.
export const useFilteredList = <T extends Pickable>({
  items,
  labelOf,
  onPick,
  onClose,
}: UseFilteredListOptions<T>) => {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterByLabel(items, query, labelOf),
    [items, labelOf, query]
  );
  const { move, select, selected } = useListSelection(visible);

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      move(step);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selected && !selected.disabled) {
        onPick(selected);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
      } else {
        onClose();
      }
    }
  };

  return { handleKeyDown, query, select, selected, setQuery, visible };
};
