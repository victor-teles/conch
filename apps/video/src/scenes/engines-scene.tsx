import { useCurrentFrame } from "remotion";

import { Backdrop } from "@/components/backdrop";
import { ENGINES } from "@/data/board";
import { useSpringAt } from "@/lib/anim";
import { COLOR, CONNECTION_COLOR, FONT, SPRING_SOFT } from "@/theme";

export const ENGINES_DURATION = 74;

const TONES = Object.values(CONNECTION_COLOR);
const STAGGER = 3;
const FIRST_PILL = 10;

function EnginePill({ name, index }: { name: string; index: number }) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const enter = springAt(frame, FIRST_PILL + index * STAGGER);
  return (
    <div
      style={{
        alignItems: "center",
        background: COLOR.panelRaised,
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: 18,
        boxShadow: `inset 0 1px 0 ${COLOR.panelHighlight}`,
        color: COLOR.foreground,
        display: "flex",
        fontFamily: FONT.sans,
        fontSize: 34,
        fontWeight: 520,
        gap: 18,
        height: 92,
        letterSpacing: "-0.012em",
        opacity: enter,
        padding: "0 30px",
        transform: `translateY(${(1 - enter) * 18}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <span
        style={{
          background: TONES[index % TONES.length],
          borderRadius: 999,
          height: 14,
          width: 14,
        }}
      />
      {name}
    </div>
  );
}

export function EnginesScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const heading = springAt(frame, 0);
  return (
    <Backdrop>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 56,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <h2
          style={{
            color: COLOR.foreground,
            fontFamily: FONT.sans,
            fontSize: 76,
            fontWeight: 580,
            letterSpacing: "-0.03em",
            margin: 0,
            opacity: heading,
            transform: `translateY(${(1 - heading) * 16}px)`,
          }}
        >
          Eight engines. One panel.
        </h2>
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(4, 340px)",
          }}
        >
          {ENGINES.map((name, index) => (
            <EnginePill index={index} key={name} name={name} />
          ))}
        </div>
      </div>
    </Backdrop>
  );
}
