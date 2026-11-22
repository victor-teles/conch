export const toggleIn = (
  set: ReadonlySet<string>,
  id: string
): ReadonlySet<string> => {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
};
