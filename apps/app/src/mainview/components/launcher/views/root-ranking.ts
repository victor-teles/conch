import type { Ranked } from "@/lib/fuzzy-match";

import type { RootItem } from "./root-items";

// Ties go to the kind the user is most likely looking for.
const KIND_ORDER: readonly RootItem["kind"][] = [
  "widget",
  "board",
  "connection",
  "command",
  "draft",
];

const kindRank = (kind: RootItem["kind"]): number => {
  const index = KIND_ORDER.indexOf(kind);
  return index === -1 ? KIND_ORDER.length : index;
};

export const rankRootItems = (
  scored: readonly Ranked<RootItem>[]
): RootItem[] =>
  scored
    .map((entry, index) => ({ ...entry, index }))
    .toSorted(
      (a, b) =>
        b.score - a.score ||
        kindRank(a.item.kind) - kindRank(b.item.kind) ||
        a.index - b.index
    )
    .map((entry) => entry.item);
