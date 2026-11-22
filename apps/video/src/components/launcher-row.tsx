import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { COLOR, TYPE } from "@/theme";

interface LauncherRowProps {
  icon: LucideIcon;
  selected?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}

export function LauncherRow({
  icon: Icon,
  selected = false,
  trailing,
  children,
}: LauncherRowProps) {
  return (
    <div
      style={{
        alignItems: "center",
        background: selected ? COLOR.rowActive : undefined,
        borderRadius: 10,
        display: "flex",
        gap: 12,
        height: 40,
        padding: "0 10px",
      }}
    >
      <span
        style={{
          alignItems: "center",
          background: COLOR.rowHover,
          borderRadius: 7,
          color: COLOR.muted,
          display: "grid",
          height: 24,
          placeItems: "center",
          width: 24,
        }}
      >
        <Icon size={14} />
      </span>
      <span
        style={{
          ...TYPE.body,
          alignItems: "baseline",
          display: "flex",
          flex: 1,
          gap: 6,
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
      {trailing}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...TYPE.micro, color: COLOR.muted, padding: "4px 10px 6px" }}>
      {children}
    </div>
  );
}
