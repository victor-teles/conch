import type { PlotBox } from "@/lib/chart";

import { COLOR, FONT, TYPE } from "@/theme";

export const AXIS_WIDTH = 48;
export const AXIS_HEIGHT = 22;

const TICKS = 4;

interface YGridProps {
  box: PlotBox;
  max: number;
  format: (value: number) => string;
}

export function YGrid({ box, max, format }: YGridProps) {
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * i);
  return (
    <g>
      {ticks.map((tick) => {
        const y = box.height - (tick / max) * box.height;
        return (
          <g key={tick}>
            <line
              stroke={COLOR.panelBorder}
              strokeDasharray={tick === 0 ? undefined : "2 4"}
              x1={0}
              x2={box.width}
              y1={y}
              y2={y}
            />
            <text
              fill={COLOR.muted}
              fontFamily={FONT.sans}
              fontSize={TYPE.micro.fontSize}
              textAnchor="end"
              x={-10}
              y={y + 4}
            >
              {format(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function XLabel({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <text
      fill={COLOR.muted}
      fontFamily={FONT.sans}
      fontSize={TYPE.micro.fontSize}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {label}
    </text>
  );
}

export const plotBox = (width: number, height: number): PlotBox => ({
  height: height - AXIS_HEIGHT,
  width: width - AXIS_WIDTH - 8,
});
