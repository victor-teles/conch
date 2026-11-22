import { useId } from "react";

import type { Series } from "@/data/revenue";

import { formatThousands, linePath, niceCeiling, pointsOf } from "@/lib/chart";
import { COLOR } from "@/theme";

import { AXIS_WIDTH, plotBox, XLabel, YGrid } from "./y-grid";

interface LineChartProps {
  series: readonly Series[];
  labels: readonly string[];
  width: number;
  height: number;
  drawn: number;
}

const formatTick = (tick: number) => formatThousands(tick * 1000);

export function LineChart({
  series,
  labels,
  width,
  height,
  drawn,
}: LineChartProps) {
  const clipId = useId();
  const max = niceCeiling(Math.max(...series.flatMap((item) => item.values)));
  const box = plotBox(width, height);
  const stepX = box.width / Math.max(labels.length - 1, 1);
  return (
    <svg
      aria-hidden
      height={height}
      style={{ display: "block", overflow: "visible" }}
      width={width}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            height={box.height + 12}
            width={(box.width + 12) * drawn}
            x={-6}
            y={-6}
          />
        </clipPath>
      </defs>
      <g transform={`translate(${AXIS_WIDTH} 0)`}>
        <YGrid box={box} format={formatTick} max={max} />
        {labels.map((label, index) => (
          <XLabel
            key={label}
            label={label}
            x={stepX * index}
            y={box.height + 18}
          />
        ))}
        <g clipPath={`url(#${clipId})`}>
          {series.map((item) => {
            const points = pointsOf(item.values, max, box);
            const last = points.at(-1);
            return (
              <g key={item.label}>
                <path
                  d={linePath(points)}
                  fill="none"
                  stroke={item.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
                {last ? (
                  <circle
                    cx={last[0]}
                    cy={last[1]}
                    fill={item.color}
                    opacity={drawn >= 0.99 ? 1 : 0}
                    r={3.5}
                    stroke={COLOR.ink}
                    strokeWidth={2}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
