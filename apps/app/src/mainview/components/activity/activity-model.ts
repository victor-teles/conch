import type { ActionActivity, AuditIntegrity } from "@/lib/ipc";

export interface ActivitySection {
  id: string;
  label: string;
  items: ActionActivity[];
}

const DAY_MS = 86_400_000;
const DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dayOf = (at: string, now: Date): { id: string; label: string } => {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return { id: "earlier", label: "Earlier" };
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) {
    return { id: "today", label: "Today" };
  }
  if (days === 1) {
    return { id: "yesterday", label: "Yesterday" };
  }
  return { id: `day-${startOfDay(date)}`, label: DATE.format(date) };
};

export const filterActivity = (
  activity: readonly ActionActivity[],
  query: string
): ActionActivity[] => {
  const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) {
    return [...activity];
  }
  return activity.filter((item) => {
    const text = `${item.actionLabel} ${item.targetName}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
};

export const activitySections = (
  activity: readonly ActionActivity[],
  now: Date
): ActivitySection[] => {
  const sections = new Map<string, ActivitySection>();
  for (const item of activity.toSorted((a, b) => b.at.localeCompare(a.at))) {
    const day = dayOf(item.at, now);
    const section = sections.get(day.id) ?? { ...day, items: [] };
    section.items.push(item);
    sections.set(day.id, section);
  }
  return [...sections.values()];
};

const archivedText = (archived: number): string => {
  if (archived === 0) {
    return "";
  }
  return archived === 1
    ? " · an earlier log was set aside at a reset"
    : ` · ${archived} earlier logs were set aside at resets`;
};

export const integrityText = (integrity: AuditIntegrity): string =>
  (integrity.ok
    ? "Log verified"
    : `Log broken at entry ${integrity.brokenAt + 1}`) +
  archivedText(integrity.archived);

export const outcomeLabel = (item: ActionActivity): string => {
  if (item.status === "interrupted") {
    return "No result recorded";
  }
  if (!item.outcome) {
    return "";
  }
  return item.outcome.ok ? item.outcome.summary : item.outcome.message;
};
