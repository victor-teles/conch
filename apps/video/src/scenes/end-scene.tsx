import { Img, staticFile, useCurrentFrame } from "remotion";

import { Keycaps } from "@/components/keycaps";
import { Stage } from "@/components/stage";
import { useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SOFT } from "@/theme";

export const END_DURATION = 108;

const LOGO = { height: 216, width: 720 };

const HOTKEY = [
  { label: "⌥", width: 64 },
  { label: "⇧", width: 64 },
  { label: "Space", width: 168 },
];

export function EndScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const logo = springAt(frame, 4);
  const line = springAt(frame, 16);
  const keys = springAt(frame, 26);
  return (
    <Stage>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <Img
          alt="Conch"
          src={staticFile("conch-logo-dark.png")}
          style={{
            height: LOGO.height,
            opacity: logo,
            transform: `scale(${0.96 + logo * 0.04})`,
            width: LOGO.width,
          }}
        />
        <p
          style={{
            color: COLOR.muted,
            fontFamily: FONT.sans,
            fontSize: 38,
            fontWeight: 450,
            letterSpacing: "-0.01em",
            margin: 0,
            opacity: line,
            transform: `translateY(${(1 - line) * 10}px)`,
          }}
        >
          Ask your database a question without leaving what you’re doing.
        </p>
        <div
          style={{
            marginTop: 24,
            opacity: keys,
            transform: `translateY(${(1 - keys) * 10}px)`,
          }}
        >
          <Keycaps keys={HOTKEY} size={64} />
        </div>
      </div>
    </Stage>
  );
}
