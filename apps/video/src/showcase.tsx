import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { seriesDuration } from "./lib/series";
import { AskScene } from "./scenes/ask-scene";
import { ASK_TIMELINE } from "./scenes/ask-timeline";
import { BOARD_DURATION, BoardScene } from "./scenes/board-scene";
import { END_DURATION, EndScene } from "./scenes/end-scene";
import { ENGINES_DURATION, EnginesScene } from "./scenes/engines-scene";
import { MontageScene } from "./scenes/montage-scene";
import { MONTAGE_DURATION } from "./scenes/montage-timeline";

const TRANSITION = 14;

const SCENES = [
  { Scene: AskScene, duration: ASK_TIMELINE.end, id: "ask" },
  { Scene: MontageScene, duration: MONTAGE_DURATION, id: "montage" },
  { Scene: EnginesScene, duration: ENGINES_DURATION, id: "engines" },
  { Scene: BoardScene, duration: BOARD_DURATION, id: "board" },
  { Scene: EndScene, duration: END_DURATION, id: "end" },
] as const;

export const SHOWCASE_DURATION = seriesDuration({
  scenes: SCENES.map((scene) => scene.duration),
  transition: TRANSITION,
});

export function Showcase() {
  return (
    <TransitionSeries>
      {SCENES.flatMap(({ Scene, duration, id }, index) => [
        index === 0 ? null : (
          <TransitionSeries.Transition
            key={`${id}-in`}
            presentation={fade()}
            timing={linearTiming({ durationInFrames: TRANSITION })}
          />
        ),
        <TransitionSeries.Sequence durationInFrames={duration} key={id}>
          <Scene />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  );
}
