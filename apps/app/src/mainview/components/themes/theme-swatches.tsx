import type { Theme, ThemeTokenName } from "@conch/rpc";

const SWATCH_TOKENS: readonly ThemeTokenName[] = [
  "background",
  "panel-solid",
  "foreground",
  "primary",
  "brand",
  "chart-1",
  "chart-2",
  "chart-3",
];

export function ThemeSwatches({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      className="flex h-5 shrink-0 overflow-hidden rounded-[6px] ring-1 ring-panel-border"
      data-slot="theme-swatches"
    >
      {SWATCH_TOKENS.map((name) => (
        <span
          className="h-full w-2.5"
          key={name}
          style={{ backgroundColor: theme.tokens[name] }}
        />
      ))}
    </span>
  );
}
