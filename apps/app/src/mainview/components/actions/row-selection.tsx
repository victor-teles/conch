import type { ReactNode } from "react";

import { createContext, use } from "react";

export interface RowSelectionTarget {
  selected: number | null;
  select: (rowIndex: number) => void;
  openMenu: (rowIndex: number) => void;
}

const RowSelectionContext = createContext<RowSelectionTarget | null>(null);

// Only a widget run provides one; cards in asks and on boards stay inert.
export function RowSelectionProvider({
  target,
  children,
}: {
  target: RowSelectionTarget | null;
  children: ReactNode;
}) {
  return <RowSelectionContext value={target}>{children}</RowSelectionContext>;
}

export const useRowSelectionTarget = (): RowSelectionTarget | null =>
  use(RowSelectionContext);
