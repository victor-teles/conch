import { COLOR, TYPE } from "@/theme";

import { KeyCombo } from "./kbd";

export const FOOTER_HEIGHT = 36;

export interface FooterHint {
  label: string;
  keys: readonly string[];
}

interface FooterProps {
  connection: string;
  action: FooterHint;
  hint?: FooterHint;
}

export function Footer({ connection, action, hint }: FooterProps) {
  return (
    <footer
      style={{
        ...TYPE.meta,
        alignItems: "center",
        borderTop: `1px solid ${COLOR.panelBorder}`,
        bottom: 0,
        color: COLOR.muted,
        display: "flex",
        height: FOOTER_HEIGHT,
        justifyContent: "space-between",
        left: 0,
        padding: "0 16px",
        position: "absolute",
        right: 0,
      }}
    >
      <span style={{ alignItems: "center", display: "flex", gap: 8 }}>
        <span
          style={{
            background: COLOR.success,
            borderRadius: 999,
            height: 6,
            width: 6,
          }}
        />
        {connection}
      </span>
      <span style={{ alignItems: "center", display: "flex", gap: 12 }}>
        <span style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <span style={{ color: COLOR.foreground }}>{action.label}</span>
          <KeyCombo keys={action.keys} />
        </span>
        {hint ? (
          <span
            style={{
              alignItems: "center",
              borderLeft: `1px solid ${COLOR.panelBorder}`,
              display: "flex",
              gap: 8,
              paddingLeft: 12,
            }}
          >
            {hint.label}
            <KeyCombo keys={hint.keys} />
          </span>
        ) : null}
      </span>
    </footer>
  );
}
