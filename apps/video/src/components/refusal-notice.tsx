import { ShieldAlertIcon } from "lucide-react";

import { COLOR, TYPE } from "@/theme";

export const REFUSAL_NOTICE_HEIGHT = 84;

interface RefusalNoticeProps {
  message: string;
  detail: string;
  shown: number;
}

export function RefusalNotice({ message, detail, shown }: RefusalNoticeProps) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        background: COLOR.dangerTint,
        border: `1px solid ${COLOR.dangerBorder}`,
        borderRadius: 10,
        display: "flex",
        gap: 10,
        margin: "4px 16px 12px",
        opacity: shown,
        padding: "12px 14px",
        transform: `translateY(${(1 - shown) * 6}px)`,
      }}
    >
      <ShieldAlertIcon
        color={COLOR.danger}
        size={16}
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ ...TYPE.title, color: COLOR.foreground }}>
          {message}
        </span>
        <span style={{ ...TYPE.body, color: COLOR.muted }}>{detail}</span>
      </div>
    </div>
  );
}
