import type { ReactNode } from "react";

import { AbsoluteFill } from "remotion";

import { COLOR } from "@/theme";

export function Backdrop({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 70% 55% at 50% 0%, ${COLOR.brandGlow} 0%, transparent 70%), radial-gradient(ellipse 120% 90% at 50% 110%, oklch(0.2 0 0) 0%, ${COLOR.inkDeep} 60%)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
