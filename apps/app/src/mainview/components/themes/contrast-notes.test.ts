import { defaultThemeFor, themeContrastReport } from "@conch/rpc";
import { describe, expect, it } from "vitest";

import {
  contrastSummary,
  noteFor,
  noteText,
  summaryText,
  tokenLabel,
} from "./contrast-notes";

const dark = defaultThemeFor("dark");
const reportWith = (tokens: Partial<typeof dark.tokens>) =>
  themeContrastReport({ ...dark, tokens: { ...dark.tokens, ...tokens } });

const noteOn = (
  report: ReturnType<typeof reportWith>,
  name: Parameters<typeof noteText>[1]
): string => {
  const entry = noteFor(report, name);
  if (!entry) {
    throw new Error(`no note on ${name}`);
  }
  return noteText(entry, name);
};

describe("contrast notes", () => {
  it("calls a built-in readable", () => {
    const report = themeContrastReport(dark);
    expect(summaryText(contrastSummary(report))).toBe("Readable");
    expect(noteFor(report, "panel-muted")).toBeNull();
  });

  it("notes a weak pair on both of its tokens", () => {
    const report = reportWith({ "panel-muted": "#4a4a4a" });
    expect(noteOn(report, "panel-muted")).toMatch(
      /^\d\.\d:1 on (Panel|Raised panel|Selected row), aim for 4\.5$/
    );
    expect(noteOn(report, "panel")).toMatch(
      /^Panel muted text is \d\.\d:1 here, aim for 4\.5$/
    );
    expect(contrastSummary(report)).toMatchObject({ kind: "notes" });
    expect(summaryText({ count: 1, kind: "notes" })).toBe("1 contrast note");
  });

  it("explains a blocked theme", () => {
    const report = reportWith({ foreground: dark.tokens.background });
    const summary = contrastSummary(report);
    expect(summary.kind).toBe("blocked");
    expect(summaryText(summary)).toMatch(
      /^Text is 1\.\d:1 on .+\. Raise it to save\.$/
    );
    expect(noteFor(report, "foreground")?.level).toBe("block");
  });

  it("labels tokens in plain words", () => {
    expect(tokenLabel("row-active")).toBe("Selected row");
  });
});
