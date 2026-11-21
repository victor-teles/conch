import { useCurrentFrame } from "remotion";

import { COLOR } from "@/theme";

const SHIMMER_FRAMES = 30;
const BARS = [0.62, 0.84, 0.48, 0.72, 0.9, 0.56, 0.78];

export function CardSkeleton() {
  const frame = useCurrentFrame();
  const phase = (frame % SHIMMER_FRAMES) / SHIMMER_FRAMES;
  return (
    <div
      style={{
        alignItems: "flex-end",
        backgroundImage: `linear-gradient(90deg, transparent ${phase * 100 - 30}%, oklch(1 0 0 / 0.05) ${phase * 100}%, transparent ${phase * 100 + 30}%)`,
        display: "flex",
        gap: 18,
        height: 120,
        margin: "16px 16px 0",
        padding: "0 12px",
      }}
    >
      {BARS.map((height) => (
        <span
          key={height}
          style={{
            background: COLOR.rowHover,
            borderRadius: 4,
            flex: 1,
            height: `${height * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
