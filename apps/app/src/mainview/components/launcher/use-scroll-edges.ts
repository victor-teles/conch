import type { RefObject } from "react";

import { useEffect, useState } from "react";

export interface ScrollEdges {
  atStart: boolean;
  atEnd: boolean;
}

const AT_REST: ScrollEdges = { atEnd: true, atStart: true };

// Sub-pixel scroll positions on Retina never quite reach the end.
const TOLERANCE_PX = 1;

export const scrollEdgesOf = (element: HTMLElement): ScrollEdges => ({
  atEnd:
    element.scrollTop + element.clientHeight >=
    element.scrollHeight - TOLERANCE_PX,
  atStart: element.scrollTop <= TOLERANCE_PX,
});

const sameEdges = (a: ScrollEdges, b: ScrollEdges) =>
  a.atStart === b.atStart && a.atEnd === b.atEnd;

export const useScrollEdges = (
  ref: RefObject<HTMLElement | null>
): ScrollEdges => {
  const [edges, setEdges] = useState<ScrollEdges>(AT_REST);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const next = scrollEdgesOf(element);
      setEdges((current) => (sameEdges(current, next) ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [ref]);

  return edges;
};
