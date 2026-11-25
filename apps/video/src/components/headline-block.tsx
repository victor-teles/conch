import { useCurrentFrame } from "remotion";

import type { Headline } from "@/data/footage";

import { fadeOut, useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SOFT } from "@/theme";

const STAGGER = 4;
const RISE = 26;

interface HeadlineBlockProps {
  headline: Headline;
  enterAt: number;
  exitAt: number;
}

export function HeadlineBlock({
  headline,
  enterAt,
  exitAt,
}: HeadlineBlockProps) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const leave = fadeOut(frame, exitAt, 7);
  const line = (index: number) => {
    const enter = springAt(frame, enterAt + index * STAGGER);
    return {
      opacity: Math.min(enter, leave),
      transform: `translateY(${(1 - enter) * RISE}px)`,
    };
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <span
        style={{
          ...line(0),
          alignItems: "center",
          color: COLOR.brand,
          display: "flex",
          fontFamily: FONT.sans,
          fontSize: 22,
          fontWeight: 600,
          gap: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            background: COLOR.brand,
            borderRadius: 999,
            height: 8,
            width: 8,
          }}
        />
        {headline.eyebrow}
      </span>
      <h2
        style={{
          ...line(1),
          color: COLOR.foreground,
          fontFamily: FONT.sans,
          fontSize: 58,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.02,
          margin: 0,
        }}
      >
        {headline.title}
      </h2>
      <p
        style={{
          ...line(2),
          color: COLOR.muted,
          fontFamily: FONT.sans,
          fontSize: 27,
          fontWeight: 450,
          letterSpacing: "-0.01em",
          lineHeight: 1.35,
          margin: 0,
          maxWidth: 430,
        }}
      >
        {headline.body}
      </p>
    </div>
  );
}
