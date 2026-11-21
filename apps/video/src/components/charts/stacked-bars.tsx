import type { Series } from "@/data/revenue";

import {
  formatThousands,
  niceCeiling,
  stackSpans,
  staggered,
} from "@/lib/chart";
import { COLOR, FONT, TYPE } from "@/theme";

import { AXIS_WIDTH, plotBox, XLabel, YGrid } from "./y-grid";

interface StackedBarsProps {
  series: readonly Series[];
  labels: readonly string[];
  width: number;
  height: number;
  grown: number;
}

const SEGMENT_GAP = 2;
const MAX_BAR_WIDTH = 104;

const formatTick = (tick: number) => formatThousands(tick * 1000);

export function StackedBars({
  series,
  labels,
  width,
  height,
  grown,
}: StackedBarsProps) {
  const values = series.map((item) => item.values);
  const totals = labels.map((_, index) =>
    values.reduce((sum, row) => sum + (row[index] ?? 0), 0)
  );
  const max = niceCeiling(Math.max(...totals));
  const box = plotBox(width, height);
  const slot = box.width / labels.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * 0.46);
  const scale = (value: number) => (value / max) * box.height;
  return (
    <svg
      aria-hidden
      height={height}
      style={{ display: "block", overflow: "visible" }}
      width={width}
    >
      <g transform={`translate(${AXIS_WIDTH} 0)`}>
        <YGrid box={box} format={formatTick} max={max} />
        {labels.map((label, index) => {
          const grow = staggered(grown, index, labels.length);
          const x = slot * index + (slot - barWidth) / 2;
          const total = totals[index] ?? 0;
          return (
            <g key={label}>
              {stackSpans(values, index).map(([from, to], layer) => {
                const tone = series[layer];
                return tone ? (
                  <rect
                    fill={tone.color}
                    height={Math.max(scale(to - from) * grow - SEGMENT_GAP, 0)}
                    key={tone.label}
                    rx={3}
                    width={barWidth}
                    x={x}
                    y={box.height - scale(to) * grow}
                  />
                ) : null;
              })}
              <text
                fill={COLOR.foreground}
                fontFamily={FONT.sans}
                fontSize={TYPE.meta.fontSize}
                fontWeight={600}
                opacity={Math.max((grow - 0.8) * 5, 0)}
                textAnchor="middle"
                x={x + barWidth / 2}
                y={box.height - scale(total) * grow - 8}
              >
                {formatThousands(total * 1000)}
              </text>
              <XLabel label={label} x={x + barWidth / 2} y={box.height + 18} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
