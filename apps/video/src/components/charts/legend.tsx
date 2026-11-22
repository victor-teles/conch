import type { Series } from "@/data/revenue";

import { COLOR, TYPE } from "@/theme";

export function Legend({ series }: { series: readonly Series[] }) {
  return (
    <div
      style={{
        ...TYPE.meta,
        color: COLOR.muted,
        display: "flex",
        gap: 16,
      }}
    >
      {series.map((item) => (
        <span
          key={item.label}
          style={{ alignItems: "center", display: "flex", gap: 6 }}
        >
          <span
            style={{
              background: item.color,
              borderRadius: 999,
              height: 8,
              width: 8,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
