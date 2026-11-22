import { Sequence, useCurrentFrame } from "remotion";

import type { ShowcaseAsk } from "@/data/asks";

import { Backdrop } from "@/components/backdrop";
import { Captions } from "@/components/caption";
import { EditorGhost } from "@/components/editor-ghost";
import { Panel } from "@/components/panel";
import { QUARTERLY_ASK } from "@/data/asks";
import { useSpringAt } from "@/lib/anim";
import { morphValue } from "@/lib/morph";
import { SPRING_SOFT } from "@/theme";

import { PANEL_TOP } from "./ask-timeline";
import { MontageItemView } from "./montage-item";
import {
  MONTAGE,
  MONTAGE_CAPTIONS,
  MONTAGE_PANEL_HEIGHTS,
} from "./montage-timeline";

const previousOf = (index: number): ShowcaseAsk => {
  const earlier = MONTAGE[index - 1]?.entry;
  return earlier?.kind === "answer" ? earlier.ask : QUARTERLY_ASK;
};

export function MontageScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const height = morphValue(MONTAGE_PANEL_HEIGHTS, (at) => springAt(frame, at));
  return (
    <Backdrop>
      <EditorGhost dim={1} />
      <Panel height={height} presence={1} top={PANEL_TOP}>
        {MONTAGE.map(({ beats, entry, from }, index) => (
          <Sequence
            durationInFrames={beats.end}
            from={from}
            key={entry.ask.prompt}
            layout="none"
          >
            <MontageItemView
              beats={beats}
              entry={entry}
              previous={previousOf(index)}
            />
          </Sequence>
        ))}
      </Panel>
      <Captions cues={MONTAGE_CAPTIONS} />
    </Backdrop>
  );
}
