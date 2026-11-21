import { useId } from "react";

import { countUp, formatInteger, linePath, pointsOf } from "@/lib/chart";
import { COLOR, TYPE } from "@/theme";

interface KpiChartProps {
  value: number;
  delta: string;
  label: string;
  spark: readonly number[];
  width: number;
  counted: number;
}

const SPARK_HEIGHT = 92;

export function KpiChart({
  value,
  delta,
  label,
  spark,
  width,
  counted,
}: KpiChartProps) {
  const id = useId();
  const low = Math.min(...spark);
  const range = Math.max(...spark) - low;
  const box = { height: SPARK_HEIGHT - 8, width };
  const points = pointsOf(
    spark.map((point) => point - low + range * 0.15),
    range * 1.15,
    box
  );
  const line = linePath(points);
  const last = points.at(-1);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ alignItems: "baseline", display: "flex", gap: 14 }}>
          <span
            style={{
              fontSize: 64,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {formatInteger(countUp(value, counted))}
          </span>
          <span
            style={{
              ...TYPE.meta,
              background: "oklch(0.8 0.13 145 / 0.14)",
              borderRadius: 999,
              color: COLOR.success,
              opacity: counted,
              padding: "3px 9px",
            }}
          >
            {delta}
          </span>
        </div>
        <span style={{ ...TYPE.body, color: COLOR.muted }}>{label}</span>
      </div>
      <svg aria-hidden height={SPARK_HEIGHT} width={width}>
        <defs>
          <linearGradient id={`${id}-fill`} x1={0} x2={0} y1={0} y2={1}>
            <stop offset="0%" stopColor={COLOR.chart1} stopOpacity={0.22} />
            <stop offset="100%" stopColor={COLOR.chart1} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect height={SPARK_HEIGHT} width={(width + 8) * counted} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-clip)`} transform="translate(0 4)">
          <path
            d={`${line} L${width} ${box.height} L0 ${box.height} Z`}
            fill={`url(#${id}-fill)`}
          />
          <path
            d={line}
            fill="none"
            stroke={COLOR.chart1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
          {last ? (
            <circle
              cx={last[0] - 4}
              cy={last[1]}
              fill={COLOR.chart1}
              r={3.5}
              stroke={COLOR.ink}
              strokeWidth={2}
            />
          ) : null}
        </g>
      </svg>
    </div>
  );
}
