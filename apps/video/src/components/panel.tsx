import type { ReactNode } from "react";

import { COLOR, FONT, PANEL_WIDTH, UI_SCALE } from "@/theme";

interface PanelProps {
  height: number;
  presence: number;
  top: number;
  children: ReactNode;
}

export function Panel({ height, presence, top, children }: PanelProps) {
  const scale = UI_SCALE * (0.98 + presence * 0.02);
  return (
    <div
      style={{
        backdropFilter: "blur(24px) saturate(200%)",
        background: COLOR.panel,
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: 16,
        boxShadow: `inset 0 1px 0 ${COLOR.panelHighlight}, 0 28px 64px -16px oklch(0 0 0 / 0.6), 0 2px 8px oklch(0 0 0 / 0.32)`,
        color: COLOR.foreground,
        fontFamily: FONT.sans,
        height,
        left: "50%",
        marginLeft: -PANEL_WIDTH / 2,
        opacity: presence,
        overflow: "hidden",
        position: "absolute",
        top,
        transform: `translateY(${(1 - presence) * -8 * UI_SCALE}px) scale(${scale})`,
        transformOrigin: "50% 0",
        width: PANEL_WIDTH,
      }}
    >
      {children}
    </div>
  );
}
