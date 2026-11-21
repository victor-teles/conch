import { useCurrentFrame } from "remotion";

import { fadeOut, useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SOFT } from "@/theme";

export interface CaptionCue {
  from: number;
  to: number;
  text: string;
}

interface CaptionProps {
  cue: CaptionCue;
  bottom?: number;
}

export function Caption({ cue, bottom = 96 }: CaptionProps) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  if (frame < cue.from || frame >= cue.to + 6) {
    return null;
  }
  const enter = springAt(frame, cue.from);
  const opacity = Math.min(enter, fadeOut(frame, cue.to, 6));
  return (
    <div
      style={{
        bottom,
        color: COLOR.foreground,
        fontFamily: FONT.sans,
        fontSize: 46,
        fontWeight: 560,
        left: 0,
        letterSpacing: "-0.022em",
        opacity,
        position: "absolute",
        right: 0,
        textAlign: "center",
        transform: `translateY(${(1 - enter) * 14}px)`,
      }}
    >
      {cue.text}
    </div>
  );
}

export function Captions({ cues }: { cues: readonly CaptionCue[] }) {
  return (
    <>
      {cues.map((cue) => (
        <Caption cue={cue} key={cue.text} />
      ))}
    </>
  );
}
