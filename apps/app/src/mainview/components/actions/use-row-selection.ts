import { useCallback, useState } from "react";

interface Selection {
  runKey: string | null;
  index: number | null;
}

// A selection belongs to one run: when the run changes it reads as none,
// without an effect resetting it.
export const useRowSelection = (runKey: string | null, rowCount: number) => {
  const [selection, setSelection] = useState<Selection>({
    index: null,
    runKey: null,
  });
  const current =
    selection.runKey === runKey && runKey !== null ? selection.index : null;
  const selected = current !== null && current < rowCount ? current : null;

  const select = useCallback(
    (index: number) => setSelection({ index, runKey }),
    [runKey]
  );
  const clear = useCallback(
    () => setSelection({ index: null, runKey }),
    [runKey]
  );
  const move = useCallback(
    (delta: number) => {
      if (rowCount === 0) {
        return;
      }
      const start = selected ?? (delta > 0 ? -1 : rowCount);
      const next = Math.min(rowCount - 1, Math.max(0, start + delta));
      setSelection({ index: next, runKey });
    },
    [rowCount, runKey, selected]
  );

  return { clear, move, select, selected };
};

export type RowSelection = ReturnType<typeof useRowSelection>;
