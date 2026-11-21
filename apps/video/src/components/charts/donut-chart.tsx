import type { Slice } from "@/data/asks";

import {
  arcPath,
  countUp,
  formatInteger,
  sliceSpans,
  staggered,
} from "@/lib/chart";
import { COLOR, FONT, TYPE } from "@/theme";

interface DonutChartProps {
  slices: readonly Slice[];
  unit: string;
  size: number;
  swept: number;
}

export function DonutChart({ slices, unit, size, swept }: DonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const ring = {
    cx: size / 2,
    cy: size / 2,
    inner: size * 0.31,
    outer: size * 0.47,
  };
  const spans = sliceSpans(
    slices.map((slice) => slice.value),
    swept
  );
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 44,
        height: "100%",
        paddingLeft: 24,
      }}
    >
      <div style={{ height: size, position: "relative", width: size }}>
        <svg aria-hidden height={size} width={size}>
          <circle
            cx={ring.cx}
            cy={ring.cy}
            fill="none"
            r={(ring.outer + ring.inner) / 2}
            stroke={COLOR.rowHover}
            strokeWidth={ring.outer - ring.inner}
          />
          {slices.map((slice, index) => {
            const span = spans[index];
            return span ? (
              <path
                d={arcPath(ring, span)}
                fill={slice.color}
                key={slice.label}
                stroke={COLOR.ink}
                strokeWidth={2}
              />
            ) : null;
          })}
        </svg>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            inset: 0,
            justifyContent: "center",
            position: "absolute",
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {formatInteger(countUp(total, swept))}
          </span>
          <span style={{ ...TYPE.micro, color: COLOR.muted }}>{unit}</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 10,
          maxWidth: 380,
        }}
      >
        {slices.map((slice, index) => {
          const shown = staggered(swept, index, slices.length);
          return (
            <div
              key={slice.label}
              style={{
                ...TYPE.body,
                alignItems: "center",
                display: "grid",
                gap: 12,
                gridTemplateColumns: "10px 1fr 64px 44px",
                opacity: shown,
                transform: `translateX(${(1 - shown) * 8}px)`,
              }}
            >
              <span
                style={{
                  background: slice.color,
                  borderRadius: 999,
                  height: 10,
                  width: 10,
                }}
              />
              <span>{slice.label}</span>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  textAlign: "right",
                }}
              >
                {formatInteger(slice.value)}
              </span>
              <span style={{ color: COLOR.muted, textAlign: "right" }}>
                {Math.round((slice.value / total) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
