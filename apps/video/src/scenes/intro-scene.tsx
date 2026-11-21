import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Keycaps } from "@/components/keycaps";
import { Stage } from "@/components/stage";
import { fadeOut, useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SOFT } from "@/theme";

export const INTRO_DURATION = 56;

const KEYS = [
  { down: 22, label: "⌥", width: 104 },
  { down: 26, label: "⇧", width: 104 },
  { down: 31, label: "Space", width: 300 },
];
const RELEASE = 42;
const EXIT_FRAMES = 6;

export function IntroScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const subtitle = springAt(frame, 2);
  const keys = springAt(frame, 8);
  const exit = fadeOut(frame, INTRO_DURATION - EXIT_FRAMES, EXIT_FRAMES);
  return (
    <Stage>
      <AbsoluteFill
        style={{
          alignItems: "center",
          flexDirection: "column",
          gap: 28,
          justifyContent: "center",
          opacity: exit,
        }}
      >
        <h1
          style={{
            color: COLOR.foreground,
            fontFamily: FONT.sans,
            fontSize: 112,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            margin: 0,
          }}
        >
          Your data has answers.
        </h1>
        <p
          style={{
            color: COLOR.muted,
            fontFamily: FONT.sans,
            fontSize: 38,
            fontWeight: 450,
            letterSpacing: "-0.012em",
            margin: 0,
            opacity: subtitle,
            transform: `translateY(${(1 - subtitle) * 20}px)`,
          }}
        >
          Ask for them from anywhere on your Mac.
        </p>
        <div
          style={{
            marginTop: 40,
            opacity: keys,
            transform: `translateY(${(1 - keys) * 20}px)`,
          }}
        >
          <Keycaps keys={KEYS} release={RELEASE} size={96} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
}
