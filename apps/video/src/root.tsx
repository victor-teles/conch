import { Composition } from "remotion";

import { LAUNCH_EDIT, REUSE_EDIT, TOUR_EDIT } from "./data/footage";
import { Showcase, SHOWCASE_DURATION } from "./showcase";
import { ShowcaseReal, showcaseRealDuration } from "./showcase-real";

const VIDEO = { fps: 30, height: 1080, width: 1920 } as const;

export function RemotionRoot() {
  return (
    <>
      <Composition
        {...VIDEO}
        component={ShowcaseReal}
        defaultProps={{ edit: LAUNCH_EDIT }}
        durationInFrames={showcaseRealDuration(LAUNCH_EDIT)}
        id="ShowcaseReal"
      />
      <Composition
        {...VIDEO}
        component={ShowcaseReal}
        defaultProps={{ edit: REUSE_EDIT }}
        durationInFrames={showcaseRealDuration(REUSE_EDIT)}
        id="ShowcaseReuse"
      />
      <Composition
        {...VIDEO}
        component={ShowcaseReal}
        defaultProps={{ edit: TOUR_EDIT }}
        durationInFrames={showcaseRealDuration(TOUR_EDIT)}
        id="ShowcaseTour"
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
