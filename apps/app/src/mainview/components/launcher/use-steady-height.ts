import { useCallback, useRef, useState } from "react";

// While a query is typed the body keeps the height it had before the first
// character, so the footer stays put as results narrow. The floor is derived
// from the query, so clearing it from anywhere releases the floor.
export const useSteadyHeight = (query: string) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);

  const onInput = useCallback(
    (next: string) => {
      if (query === "" && next !== "") {
        setFloor(bodyRef.current?.offsetHeight ?? 0);
      }
    },
    [query]
  );

  return { bodyRef, minHeight: query === "" ? 0 : floor, onInput };
};
