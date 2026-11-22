import { interpolate, useCurrentFrame } from "remotion";

import type { AskState } from "@/components/status-mark";

import { answerSegments, AskAnswer } from "@/components/ask-answer";
import { AskHeader } from "@/components/ask-header";
import { ProgressHairline } from "@/components/progress-hairline";
import { SqlBlock } from "@/components/sql-block";
import { QUARTERLY_ASK, REVENUE_ASK } from "@/data/asks";
import { CONNECTION, SQL } from "@/data/revenue";
import { fadeIn, fadeOut, progress, useSpringAt } from "@/lib/anim";
import { isBetween } from "@/lib/morph";
import { streamedText } from "@/lib/text";
import { SPRING_SOFT } from "@/theme";

import { ASK_TIMELINE, SQL_LINES } from "./ask-timeline";

const {
  answer,
  askView,
  refineSubmit,
  refined,
  runStart,
  sqlCharsPerFrame,
  sqlStart,
} = ASK_TIMELINE;

const DIMMED = 0.42;

const workingSegments = (frame: number): string[] => {
  if (frame >= runStart) {
    return [CONNECTION.engine, "Running read only"];
  }
  if (frame >= sqlStart) {
    return [CONNECTION.engine, REVENUE_ASK.writing];
  }
  return [CONNECTION.engine, "Reading the schema"];
};

const statusAt = (
  frame: number
): { state: AskState; segments: readonly string[] } => {
  if (isBetween(frame, refineSubmit, refined)) {
    return { segments: [CONNECTION.engine, "Refining"], state: "busy" };
  }
  const ask = frame >= refined ? QUARTERLY_ASK : REVENUE_ASK;
  return { segments: answerSegments(ask), state: "done" };
};

function WorkingBody() {
  const frame = useCurrentFrame();
  return (
    <div style={{ opacity: fadeOut(frame, answer - 2, 5) }}>
      <AskHeader
        connection={CONNECTION.name}
        segments={workingSegments(frame)}
        state="busy"
      />
      <div style={{ paddingTop: 4, position: "relative" }}>
        {frame >= runStart ? <ProgressHairline start={runStart} /> : null}
        <SqlBlock
          lines={SQL_LINES}
          sql={streamedText(SQL, frame, sqlStart, sqlCharsPerFrame)}
        />
      </div>
    </div>
  );
}

function AnswerBody() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const isRefined = frame >= refined;
  const shownAt = isRefined ? refined : answer;
  const dim = interpolate(
    frame,
    [refineSubmit, refineSubmit + 4, refined - 2, refined + 4],
    [1, DIMMED, DIMMED, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div style={{ position: "relative" }}>
      {isBetween(frame, refineSubmit, refined) ? (
        <ProgressHairline start={refineSubmit} />
      ) : null}
      <div style={{ opacity: dim }}>
        <AskAnswer
          ask={isRefined ? QUARTERLY_ASK : REVENUE_ASK}
          progress={{
            chart: progress(frame, shownAt + 4, 36),
            heading: springAt(frame, shownAt),
            insight: springAt(frame, shownAt + 36),
          }}
          status={statusAt(frame)}
        />
      </div>
    </div>
  );
}

export function AskBody() {
  const frame = useCurrentFrame();
  return (
    <div style={{ opacity: fadeIn(frame, askView, 4) }}>
      {frame < answer + 3 ? <WorkingBody /> : <AnswerBody />}
    </div>
  );
}
