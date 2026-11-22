import { fuzzyMatch } from "@/lib/fuzzy-match";

// Filters without re-ranking: a menu's order carries meaning (primary first,
// destructive last), so matches keep it.
export const filterByLabel = <T>(
  items: readonly T[],
  query: string,
  labelOf: (item: T) => string
): T[] => {
  const needle = query.trim();
  if (!needle) {
    return [...items];
  }
  return items.filter((item) => fuzzyMatch(labelOf(item), needle) !== null);
};
