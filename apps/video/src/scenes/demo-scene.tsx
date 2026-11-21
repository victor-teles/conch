import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { HeadlineBlock } from "@/components/headline-block";
import { PanelFootage } from "@/components/panel-footage";
import { Stage } from "@/components/stage";
import { PANEL_CROP } from "@/data/footage";
import { fadeIn, fadeOut } from "@/lib/anim";

import type { TimedClip, TimedShot } from "./footage-timeline";

import { DIP_FRAMES, FOOTAGE } from "./footage-timeline";

const PANEL_SCALE = 0.82;
const PANEL_RIGHT = 72;
const PANEL_TOP = 52;
const HEADLINE_LEFT = 88;
const HEADLINE_TOP = PANEL_TOP + 60;
const HEADLINE_WIDTH = 430;
const DRIFT = 0.012;

function ClipFootage({ clip }: { clip: TimedClip }) {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    clip.fadeIn === 0 ? 1 : fadeIn(frame, 0, clip.fadeIn),
    clip.fadeOut === 0
      ? 1
      : fadeOut(frame, clip.duration - clip.fadeOut, clip.fadeOut)
  );
  return (
    <div style={{ opacity }}>
      <PanelFootage scale={PANEL_SCALE} trimBefore={clip.trimBefore} />
    </div>
  );
}

function Panel() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, FOOTAGE.duration], [1, 1 + DRIFT]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "flex-end",
        paddingRight: PANEL_RIGHT,
        paddingTop: PANEL_TOP,
      }}
    >
      <div
        style={{
          height: PANEL_CROP.height * PANEL_SCALE,
          position: "relative",
          transform: `scale(${drift})`,
          transformOrigin: "50% 0",
          width: PANEL_CROP.width * PANEL_SCALE,
        }}
      >
        {FOOTAGE.clips.map((clip) => (
          <Sequence
            durationInFrames={clip.duration}
            from={clip.start}
            key={clip.id}
          >
            <ClipFootage clip={clip} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function ShotHeadline({ timed }: { timed: TimedShot }) {
  return (
    <AbsoluteFill
      style={{
        paddingLeft: HEADLINE_LEFT,
        paddingTop: HEADLINE_TOP,
        width: HEADLINE_LEFT + HEADLINE_WIDTH,
      }}
    >
      <HeadlineBlock
        enterAt={DIP_FRAMES}
        exitAt={timed.duration - DIP_FRAMES - 4}
        headline={timed.shot.headline}
      />
    </AbsoluteFill>
  );
}

export function DemoScene() {
  return (
    <Stage>
      <Panel />
      {FOOTAGE.shots.map((timed) => (
        <Sequence
          durationInFrames={timed.duration}
          from={timed.start}
          key={`${timed.shot.id}-headline`}
        >
          <ShotHeadline timed={timed} />
        </Sequence>
      ))}
    </Stage>
  );
}
