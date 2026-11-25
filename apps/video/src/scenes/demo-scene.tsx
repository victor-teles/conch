import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import type { Edit } from "@/data/footage";

import { HeadlineBlock } from "@/components/headline-block";
import { PanelFootage } from "@/components/panel-footage";
import { Stage } from "@/components/stage";
import { PANEL_CROP } from "@/data/footage";
import { fadeIn, fadeOut } from "@/lib/anim";

import type { TimedClip, TimedShot } from "./footage-timeline";

import { DIP_FRAMES, timeFootage } from "./footage-timeline";

const PANEL_SCALE = 0.82;
const PANEL_RIGHT = 72;
const PANEL_TOP = 52;
const HEADLINE_LEFT = 88;
const HEADLINE_TOP = PANEL_TOP + 60;
const HEADLINE_WIDTH = 430;
const DRIFT = 0.012;

function ClipFootage({ clip, take }: { clip: TimedClip; take: string }) {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    clip.fadeIn === 0 ? 1 : fadeIn(frame, 0, clip.fadeIn),
    clip.fadeOut === 0
      ? 1
      : fadeOut(frame, clip.duration - clip.fadeOut, clip.fadeOut)
  );
  return (
    <div style={{ opacity }}>
      <PanelFootage
        scale={PANEL_SCALE}
        take={take}
        trimBefore={clip.trimBefore}
      />
    </div>
  );
}

interface PanelProps {
  clips: readonly TimedClip[];
  duration: number;
  take: string;
}

function Panel({ clips, duration, take }: PanelProps) {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, duration], [1, 1 + DRIFT]);
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
        {clips.map((clip) => (
          <Sequence
            durationInFrames={clip.duration}
            from={clip.start}
            key={clip.id}
          >
            <ClipFootage clip={clip} take={take} />
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

export function DemoScene({ edit }: { edit: Edit }) {
  const footage = timeFootage(edit.shots);
  return (
    <Stage>
      <Panel
        clips={footage.clips}
        duration={footage.duration}
        take={edit.take}
      />
      {footage.shots.map((timed) => (
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
