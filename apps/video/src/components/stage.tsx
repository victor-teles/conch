import type { ReactNode } from "react";

import { AbsoluteFill } from "remotion";

import { BACKDROP_RGB } from "@/data/footage";

const GLOW =
  "radial-gradient(circle 380px at 150px 300px, oklch(0.82 0.08 66 / 0.10), transparent 100%)";
const VIGNETTE =
  "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 60%, oklch(0 0 0 / 0.35) 100%)";

export function Stage({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: BACKDROP_RGB }}>
      <AbsoluteFill style={{ background: GLOW }} />
      {children}
      <AbsoluteFill style={{ background: VIGNETTE, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}
