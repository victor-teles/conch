import { useCurrentFrame } from "remotion";

import { COLOR } from "@/theme";

const SWEEP_FRAMES = 24;

export function ProgressHairline({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const phase = ((frame - start) % SWEEP_FRAMES) / SWEEP_FRAMES;
  return (
    <div
      style={{
        height: 2,
        left: 0,
        overflow: "hidden",
        position: "absolute",
        right: 0,
        top: 0,
      }}
    >
      <div
        style={{
          background: `linear-gradient(90deg, transparent, ${COLOR.brand}, transparent)`,
          height: "100%",
          transform: `translateX(${phase * 140 - 40}%)`,
          width: "40%",
        }}
      />
    </div>
  );
}
