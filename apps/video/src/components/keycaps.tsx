import { useCurrentFrame } from "remotion";

import { useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SNAPPY } from "@/theme";

export interface KeyPress {
  label: string;
  width: number;
  down?: number;
}

interface KeycapsProps {
  keys: readonly KeyPress[];
  release?: number;
  size?: number;
}

const TRAVEL = 6;

function Keycap({
  press,
  release,
  size,
}: {
  press: KeyPress;
  release: number | undefined;
  size: number;
}) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SNAPPY);
  const depth =
    press.down === undefined
      ? 0
      : springAt(frame, press.down) -
        (release === undefined ? 0 : springAt(frame, release));
  return (
    <div
      style={{
        alignItems: "center",
        background: `linear-gradient(180deg, oklch(0.31 0.008 48) 0%, oklch(0.26 0.007 45) 100%)`,
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: size * 0.2,
        boxShadow: `inset 0 1px 0 ${COLOR.panelHighlight}, 0 ${TRAVEL * (1 - depth) + 2}px 0 oklch(0.14 0.006 34), 0 ${18 * (1 - depth) + 6}px ${36 - depth * 16}px -10px oklch(0 0 0 / 0.6)`,
        color: depth > 0.5 ? COLOR.amber : COLOR.foreground,
        display: "flex",
        fontFamily: FONT.sans,
        fontSize: size * 0.4,
        fontWeight: 520,
        height: size,
        justifyContent: "center",
        letterSpacing: "-0.01em",
        transform: `translateY(${depth * TRAVEL}px)`,
        width: press.width,
      }}
    >
      {press.label}
    </div>
  );
}

export function Keycaps({ keys, release, size = 112 }: KeycapsProps) {
  return (
    <div style={{ display: "flex", gap: size * 0.16 }}>
      {keys.map((press) => (
        <Keycap key={press.label} press={press} release={release} size={size} />
      ))}
    </div>
  );
}
