import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
import { useCurrentFrame } from "remotion";

import { COLOR, TYPE } from "@/theme";

export const INPUT_HEIGHT = 56;

const PLACEHOLDER = "Search or ask… > SQL · # table · @ connection";
const CARET_PERIOD = 16;

interface InputRowProps {
  text: string;
  busy: boolean;
  caret: boolean;
  pressed: number;
}

export function InputRow({ text, busy, caret, pressed }: InputRowProps) {
  const frame = useCurrentFrame();
  const caretOn = caret && frame % CARET_PERIOD < CARET_PERIOD / 2;
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 10,
        height: INPUT_HEIGHT,
        padding: "0 16px",
      }}
    >
      <div
        style={{
          ...TYPE.input,
          alignItems: "center",
          display: "flex",
          flex: 1,
          minWidth: 0,
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: COLOR.foreground }}>{text}</span>
        {caret ? (
          <span
            style={{
              background: COLOR.amber,
              borderRadius: 1,
              height: 20,
              marginLeft: 1,
              marginRight: 1,
              opacity: caretOn ? 1 : 0,
              width: 2,
            }}
          />
        ) : null}
        {text ? null : (
          <span style={{ color: COLOR.muted, opacity: 0.8 }}>
            {PLACEHOLDER}
          </span>
        )}
      </div>
      <span
        style={{
          alignItems: "center",
          background: COLOR.rowHover,
          borderRadius: busy ? 6 : 8,
          color: COLOR.muted,
          display: "grid",
          height: 28,
          placeItems: "center",
          transform: `scale(${1 - pressed * 0.08})`,
          width: 28,
        }}
      >
        {busy ? (
          <SquareIcon fill="currentColor" size={12} />
        ) : (
          <CornerDownLeftIcon size={14} />
        )}
      </span>
    </div>
  );
}
