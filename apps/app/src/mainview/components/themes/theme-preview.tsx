import type { Theme, ThemeTokenName } from "@conch/rpc";

import { CheckIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { applyTheme } from "@/lib/theme/apply-theme";

const CHARTS: readonly ThemeTokenName[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
];
const CHART_HEIGHTS = [70, 45, 90, 60, 35, 80];
const CONNECTIONS: readonly ThemeTokenName[] = [
  "conn-honey",
  "conn-denim",
  "conn-moss",
  "conn-plum",
  "conn-clay",
  "conn-stone",
];

const tokenColor = (name: ThemeTokenName) => `var(--${name})`;

function PreviewRows() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex h-7 items-center gap-2 rounded-[8px] px-2 type-meta text-foreground">
        Revenue by region
        <span className="ml-auto text-panel-muted">Widget</span>
      </div>
      <div className="flex h-7 items-center gap-2 rounded-[8px] bg-row-active px-2 type-meta text-foreground">
        Signups this week
        <kbd className="ml-auto rounded-[5px] bg-kbd px-1 type-micro text-panel-muted">
          ⌘K
        </kbd>
      </div>
      <div className="flex h-6 items-center gap-1.5 px-2 type-micro">
        {CONNECTIONS.map((name) => (
          <span
            className="size-2 rounded-full"
            key={name}
            style={{ backgroundColor: tokenColor(name) }}
          />
        ))}
        <span className="ml-auto text-danger-ink">Failed</span>
        <span className="text-success-ink">Saved</span>
      </div>
    </div>
  );
}

function PreviewControls() {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <span className="flex h-6 items-center rounded-[7px] bg-primary px-2 type-micro text-primary-foreground">
        Use Theme
      </span>
      <span className="flex items-center gap-1.5">
        <span className="grid size-4 place-items-center rounded-[4px] bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </span>
        <span className="h-5 w-10 rounded-[6px] bg-row-hover outline-2 outline-offset-2 outline-ring" />
      </span>
      <span className="flex h-5 items-center gap-1 type-meta text-foreground">
        ask
        <span className="h-3.5 w-0.5 bg-brand" />
      </span>
    </div>
  );
}

function PreviewChart() {
  return (
    <div className="flex min-h-0 w-full flex-1 items-end gap-1 rounded-[8px] bg-card p-1.5">
      {CHARTS.map((name, index) => (
        <span
          className="flex-1 rounded-[2px]"
          key={name}
          style={{
            backgroundColor: tokenColor(name),
            height: `${CHART_HEIGHTS[index] ?? 50}%`,
          }}
        />
      ))}
    </div>
  );
}

// Applies the draft to this strip only, so a theme too faint to use in the
// launcher still shows here while it is being fixed.
export function ThemePreview({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      applyTheme(theme, ref.current);
    }
  }, [theme]);
  return (
    <div className="shrink-0 px-3 pb-2">
      <div
        aria-hidden
        className="relative flex h-[104px] gap-3 overflow-hidden rounded-[12px] bg-background p-2"
        data-slot="theme-preview"
        ref={ref}
      >
        <div
          className="flex min-w-0 flex-1 gap-3 rounded-[10px] p-1.5 ring-1 ring-panel-border"
          style={{ backgroundColor: tokenColor("panel-solid") }}
        >
          <PreviewRows />
          <PreviewControls />
        </div>
        <div className="flex w-24 shrink-0 flex-col items-end gap-1.5">
          <PreviewChart />
          <span className="flex h-5 items-center rounded-full capsule-material px-2 type-micro text-panel-muted">
            Status
          </span>
        </div>
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
      </div>
    </div>
  );
}
