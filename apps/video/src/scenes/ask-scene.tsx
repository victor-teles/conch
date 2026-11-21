import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { FooterHint } from "@/components/footer";

import { Backdrop } from "@/components/backdrop";
import { Captions } from "@/components/caption";
import { EditorGhost } from "@/components/editor-ghost";
import { Footer } from "@/components/footer";
import { InputRow, INPUT_HEIGHT } from "@/components/input-row";
import { Keycaps } from "@/components/keycaps";
import { Panel } from "@/components/panel";
import { AskList, RootList } from "@/components/root-list";
import { REFINE_PROMPT } from "@/data/asks";
import { CONNECTION, PROMPT } from "@/data/revenue";
import { fadeOut, useSpringAt } from "@/lib/anim";
import { isBetween, morphValue } from "@/lib/morph";
import { typedText } from "@/lib/text";
import { SPRING_SOFT } from "@/theme";

import { AskBody } from "./ask-body";
import {
  ASK_CAPTIONS,
  ASK_TIMELINE,
  PANEL_HEIGHTS,
  PANEL_TOP,
} from "./ask-timeline";

const {
  askView,
  answer,
  framesPerChar,
  panelIn,
  refineFramesPerChar,
  refineStart,
  refineSubmit,
  refined,
  submit,
  typeStart,
} = ASK_TIMELINE;

const isWorking = (frame: number): boolean =>
  isBetween(frame, askView, answer) || isBetween(frame, refineSubmit, refined);

const pressAt = (frame: number, at: number): number =>
  interpolate(frame, [at - 2, at, at + 4], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const inputTextAt = (frame: number): string =>
  frame < refineStart
    ? typedText(PROMPT, frame, typeStart, framesPerChar)
    : typedText(REFINE_PROMPT, frame, refineStart, refineFramesPerChar);

const footerAt = (frame: number): [FooterHint, FooterHint | undefined] => {
  if (isWorking(frame)) {
    return [{ keys: ["esc"], label: "Stop" }, undefined];
  }
  if (frame >= answer) {
    return [
      { keys: ["↩"], label: "Refine" },
      { keys: ["⌘", "⇧", "S"], label: "Save as widget" },
    ];
  }
  const actions = { keys: ["⌘", "K"], label: "Actions" };
  return frame > typeStart
    ? [{ keys: ["↩"], label: "Ask" }, actions]
    : [{ keys: ["↩"], label: "Open" }, actions];
};

function Hotkey() {
  const frame = useCurrentFrame();
  const opacity = fadeOut(frame, panelIn, 6);
  if (opacity === 0) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${1 - (1 - opacity) * 0.06})`,
      }}
    >
      <Keycaps keys={ASK_TIMELINE.keys} release={ASK_TIMELINE.keysRelease} />
    </AbsoluteFill>
  );
}

export function AskScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const presence = springAt(frame, panelIn);
  const height = morphValue(PANEL_HEIGHTS, (at) => springAt(frame, at));
  const [action, hint] = footerAt(frame);
  const pressed = Math.max(
    pressAt(frame, submit),
    pressAt(frame, refineSubmit)
  );
  return (
    <Backdrop>
      <EditorGhost dim={presence} />
      <Hotkey />
      <Panel height={height} presence={presence} top={PANEL_TOP}>
        <InputRow
          busy={isWorking(frame)}
          caret={frame < askView || isBetween(frame, refineStart, refineSubmit)}
          pressed={pressed}
          text={inputTextAt(frame)}
        />
        <div
          style={{ left: 0, position: "absolute", right: 0, top: INPUT_HEIGHT }}
        >
          <div
            style={{
              opacity: fadeOut(frame, typeStart + 1, 3),
            }}
          >
            <RootList />
          </div>
        </div>
        <div
          style={{ left: 0, position: "absolute", right: 0, top: INPUT_HEIGHT }}
        >
          {frame > typeStart && frame < askView ? (
            <AskList
              prompt={typedText(PROMPT, frame, typeStart, framesPerChar)}
            />
          ) : null}
          {frame >= askView ? <AskBody /> : null}
        </div>
        <Footer action={action} connection={CONNECTION.name} hint={hint} />
      </Panel>
      <Captions cues={ASK_CAPTIONS} />
    </Backdrop>
  );
}
