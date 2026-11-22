import { Composition } from "remotion";

import { Showcase, SHOWCASE_DURATION } from "./showcase";
import { SHOWCASE_REAL_DURATION, ShowcaseReal } from "./showcase-real";

const VIDEO = { fps: 30, height: 1080, width: 1920 } as const;

export function RemotionRoot() {
  return (
    <>
      <Composition
        {...VIDEO}
        component={ShowcaseReal}
        durationInFrames={SHOWCASE_REAL_DURATION}
        id="ShowcaseReal"
      />
      <Composition
        {...VIDEO}
        component={Showcase}
        durationInFrames={SHOWCASE_DURATION}
        id="Showcase"
      />
    </>
  );
}
