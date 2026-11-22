import type { ReactNode } from "react";

import { useCurrentFrame } from "remotion";

import { useSpringAt } from "@/lib/anim";
import { COLOR, SPRING_SOFT, TYPE } from "@/theme";

interface BoardTileProps {
  title: string;
  enterAt: number;
  area: string;
  children: ReactNode;
}

export function BoardTile({ title, enterAt, area, children }: BoardTileProps) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const enter = springAt(frame, enterAt);
  return (
    <section
      style={{
        background: COLOR.panelRaised,
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: 12,
        boxShadow: `inset 0 1px 0 ${COLOR.panelHighlight}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        gridArea: area,
        minHeight: 0,
        opacity: enter,
        overflow: "hidden",
        padding: "12px 14px",
        transform: `translateY(${(1 - enter) * 12}px) scale(${0.98 + enter * 0.02})`,
      }}
    >
      <h3 style={{ ...TYPE.meta, color: COLOR.muted, margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}
