import { Series } from "remotion";

import { DemoScene } from "./scenes/demo-scene";
import { END_DURATION, EndScene } from "./scenes/end-scene";
import { FOOTAGE_DURATION } from "./scenes/footage-timeline";
import { INTRO_DURATION, IntroScene } from "./scenes/intro-scene";

// Scenes share one stage colour, so they play back to back and each one
// fades its own content: two panels or cards never overlap.
const SCENES = [
  { Scene: IntroScene, duration: INTRO_DURATION, id: "intro" },
  { Scene: DemoScene, duration: FOOTAGE_DURATION, id: "demo" },
  { Scene: EndScene, duration: END_DURATION, id: "end" },
] as const;

export const SHOWCASE_REAL_DURATION = SCENES.reduce(
  (total, scene) => total + scene.duration,
  0
);

export function ShowcaseReal() {
  return (
    <Series>
      {SCENES.map(({ Scene, duration, id }) => (
        <Series.Sequence durationInFrames={duration} key={id}>
          <Scene />
        </Series.Sequence>
      ))}
    </Series>
  );
}
