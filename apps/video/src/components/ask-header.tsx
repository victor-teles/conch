import { DatabaseIcon } from "lucide-react";

import { COLOR, TYPE } from "@/theme";

import type { AskState } from "./status-mark";

import { StatusMark } from "./status-mark";

export const ASK_HEADER_HEIGHT = 36;

interface AskHeaderProps {
  connection: string;
  segments: readonly string[];
  state: AskState;
}

export function AskHeader({ connection, segments, state }: AskHeaderProps) {
  return (
    <div
      style={{
        ...TYPE.meta,
        alignItems: "center",
        display: "flex",
        gap: 8,
        height: ASK_HEADER_HEIGHT,
        padding: "0 16px",
      }}
    >
      <DatabaseIcon color={COLOR.muted} size={14} />
      <span style={{ fontWeight: 600 }}>{connection}</span>
      <span
        style={{
          color: COLOR.muted,
          display: "flex",
          fontVariantNumeric: "tabular-nums",
          gap: 6,
        }}
      >
        {segments.map((segment) => (
          <span key={segment} style={{ display: "flex", gap: 6 }}>
            <span>·</span>
            {segment}
          </span>
        ))}
      </span>
      <span style={{ marginLeft: "auto" }}>
        <StatusMark state={state} />
      </span>
    </div>
  );
}
