import type { BarRow } from "@/data/asks";

import { countUp, formatInteger, staggered } from "@/lib/chart";
import { COLOR, FONT, MONO_FEATURES } from "@/theme";

interface BarListProps {
  rows: readonly BarRow[];
  unit: string;
  grown: number;
}

const MONO = {
  fontFamily: FONT.mono,
  fontFeatureSettings: MONO_FEATURES,
  fontSize: 12,
};

export function BarList({ rows, unit, grown }: BarListProps) {
  const max = Math.max(...rows.map((row) => row.value));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
        justifyContent: "center",
      }}
    >
      {rows.map((row, index) => {
        const grow = staggered(grown, index, rows.length);
        return (
          <div
            key={row.label}
            style={{
              alignItems: "center",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "136px 1fr 72px",
            }}
          >
            <span style={{ ...MONO, color: COLOR.foreground }}>
              {row.label}
            </span>
            <span
              style={{
                background: COLOR.rowHover,
                borderRadius: 4,
                height: 16,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  background: COLOR.chart1,
                  borderRadius: 4,
                  display: "block",
                  height: "100%",
                  opacity: index === 0 ? 1 : 0.72,
                  width: `${(row.value / max) * 100 * grow}%`,
                }}
              />
            </span>
            <span
              style={{
                ...MONO,
                color: COLOR.muted,
                opacity: grow,
                textAlign: "right",
              }}
            >
              {formatInteger(countUp(row.value, grow))} {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
