import type { RefObject } from "react";

import { useEffect } from "react";

const sectionHeadingOf = (row: HTMLElement): HTMLElement | null => {
  const section = row.closest<HTMLElement>('[role="group"]');
  const first = section?.querySelector('[role="option"]');
  const headingId = section?.getAttribute("aria-labelledby");
  return first === row && headingId
    ? document.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`)
    : null;
};

// Arrow keys can select a row outside the scrolled list. A row under the
// pointer was selected by hovering it, and scrolling would slide it away.
export const useRowInView = (
  ref: RefObject<HTMLElement | null>,
  selected: boolean
) => {
  useEffect(() => {
    const row = ref.current;
    if (!(selected && row) || row.matches(":hover")) {
      return;
    }
    row.scrollIntoView({ block: "nearest" });
    sectionHeadingOf(row)?.scrollIntoView({ block: "nearest" });
  }, [ref, selected]);
};
