import type { ContrastEntry, ThemeTokenName } from "@conch/rpc";

import { THEME_TOKENS } from "@conch/rpc";

const LABELS = new Map(THEME_TOKENS.map((info) => [info.name, info.label]));

export const tokenLabel = (name: ThemeTokenName): string =>
  LABELS.get(name) ?? name;

const ratioText = (entry: ContrastEntry) => `${entry.ratio.toFixed(1)}:1`;

const surfaceOf = (entry: ContrastEntry): ThemeTokenName =>
  entry.pair.over.at(-1) ?? entry.pair.fg;

const touches = (entry: ContrastEntry, name: ThemeTokenName) =>
  entry.pair.fg === name || entry.pair.over.includes(name);

const severity = (entry: ContrastEntry) => (entry.level === "block" ? 0 : 1);

export const noteFor = (
  report: readonly ContrastEntry[],
  name: ThemeTokenName
): ContrastEntry | null =>
  report
    .filter((entry) => entry.level !== "ok" && touches(entry, name))
    .toSorted((a, b) => severity(a) - severity(b) || a.ratio - b.ratio)[0] ??
  null;

export const noteText = (entry: ContrastEntry, name: ThemeTokenName): string =>
  name === entry.pair.fg
    ? `${ratioText(entry)} on ${tokenLabel(surfaceOf(entry))}, aim for ${entry.pair.min}`
    : `${tokenLabel(entry.pair.fg)} is ${ratioText(entry)} here, aim for ${entry.pair.min}`;

export type ContrastSummary =
  | { kind: "readable" }
  | { kind: "notes"; count: number }
  | { kind: "blocked"; entry: ContrastEntry };

export const contrastSummary = (
  report: readonly ContrastEntry[]
): ContrastSummary => {
  const blocked = report.find((entry) => entry.level === "block");
  if (blocked) {
    return { entry: blocked, kind: "blocked" };
  }
  const count = report.filter((entry) => entry.level === "warn").length;
  return count === 0 ? { kind: "readable" } : { count, kind: "notes" };
};

export const summaryText = (summary: ContrastSummary): string => {
  switch (summary.kind) {
    case "readable": {
      return "Readable";
    }
    case "notes": {
      return summary.count === 1
        ? "1 contrast note"
        : `${summary.count} contrast notes`;
    }
    default: {
      const { entry } = summary;
      return `${tokenLabel(entry.pair.fg)} is ${ratioText(entry)} on ${tokenLabel(surfaceOf(entry))}. Raise it to save.`;
    }
  }
};
