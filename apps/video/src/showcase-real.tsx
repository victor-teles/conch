import { Series } from "remotion";

import type { Edit } from "./data/footage";

import { DemoScene } from "./scenes/demo-scene";
import { END_DURATION, EndScene } from "./scenes/end-scene";
import { timeFootage } from "./scenes/footage-timeline";
import { INTRO_DURATION, IntroScene } from "./scenes/intro-scene";

export interface ShowcaseRealProps extends Record<string, unknown> {
  edit: Edit;
}

export const showcaseRealDuration = (edit: Edit): number =>
  INTRO_DURATION + timeFootage(edit.shots).duration + END_DURATION;

// Scenes share one stage colour, so they play back to back and each one
// fades its own content: two panels or cards never overlap.
export function ShowcaseReal({ edit }: ShowcaseRealProps) {
  const footage = timeFootage(edit.shots).duration;
  return (
    <Series>
      <Series.Sequence durationInFrames={INTRO_DURATION}>
        <IntroScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={footage}>
        <DemoScene edit={edit} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={END_DURATION}>
        <EndScene />
      </Series.Sequence>
    </Series>
  );
}
