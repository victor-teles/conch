import { interpolate, useCurrentFrame } from "remotion";

import type { FooterHint } from "@/components/footer";
import type { ShowcaseAsk } from "@/data/asks";

import { AskAnswer, SETTLED } from "@/components/ask-answer";
import { AskHeader } from "@/components/ask-header";
import { CardSkeleton } from "@/components/card-skeleton";
import { Footer } from "@/components/footer";
import { INPUT_HEIGHT, InputRow } from "@/components/input-row";
import { ProgressHairline } from "@/components/progress-hairline";
import { RefusalNotice } from "@/components/refusal-notice";
import { SqlBlock } from "@/components/sql-block";
import { fadeIn, progress, useSpringAt } from "@/lib/anim";
import { isBetween } from "@/lib/morph";
import { streamedText, typedText } from "@/lib/text";
import { SPRING_SOFT } from "@/theme";

import type { ItemBeats, MontageEntry } from "./montage-timeline";

const PREVIOUS_DIM = 0.32;

interface MontageItemViewProps {
  entry: MontageEntry;
  beats: ItemBeats;
  previous: ShowcaseAsk;
}

const footerAt = (
  frame: number,
  beats: ItemBeats
): [FooterHint, FooterHint | undefined] => {
  if (frame < beats.submit) {
    return [
      { keys: ["↩"], label: "Ask" },
      { keys: ["⌘", "K"], label: "Actions" },
    ];
  }
  if (frame < beats.answer) {
    return [{ keys: ["esc"], label: "Stop" }, undefined];
  }
  return [
    { keys: ["↩"], label: "Refine" },
    { keys: ["⌘", "↩"], label: "New question" },
  ];
};

function Working({ entry, beats }: Omit<MontageItemViewProps, "previous">) {
  const frame = useCurrentFrame();
  const { ask } = entry;
  const lines = ask.query.split("\n").length;
  const running = frame >= beats.runStart;
  const writing = entry.kind === "answer" ? entry.ask.writing : "Writing SQL";
  return (
    <div style={{ opacity: fadeIn(frame, beats.submit, 3) }}>
      <AskHeader
        connection={ask.connection.name}
        segments={[
          ask.connection.engine,
          running ? "Running read only" : writing,
        ]}
        state="busy"
      />
      <div style={{ paddingTop: 4, position: "relative" }}>
        {running ? <ProgressHairline start={beats.runStart} /> : null}
        <SqlBlock
          lines={lines}
          sql={streamedText(
            ask.query,
            frame,
            beats.queryStart,
            beats.queryCharsPerFrame
          )}
        />
        <CardSkeleton />
      </div>
    </div>
  );
}

function Outcome({ entry, beats }: Omit<MontageItemViewProps, "previous">) {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  if (entry.kind === "refused") {
    const { ask } = entry;
    return (
      <>
        <AskHeader
          connection={ask.connection.name}
          segments={[ask.connection.engine, "Refused"]}
          state="refused"
        />
        <RefusalNotice
          detail={ask.detail}
          message={ask.message}
          shown={springAt(frame, beats.answer)}
        />
        <SqlBlock lines={ask.query.split("\n").length} sql={ask.query} />
      </>
    );
  }
  return (
    <AskAnswer
      ask={entry.ask}
      progress={{
        chart: progress(frame, beats.answer + 2, 30),
        heading: springAt(frame, beats.answer),
        insight: springAt(frame, beats.answer + 22),
      }}
    />
  );
}

export function MontageItemView({
  entry,
  beats,
  previous,
}: MontageItemViewProps) {
  const frame = useCurrentFrame();
  const [action, hint] = footerAt(frame, beats);
  const pressed = interpolate(
    frame,
    [beats.submit - 2, beats.submit, beats.submit + 4],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const previousOpacity = interpolate(frame, [0, 4], [1, PREVIOUS_DIM], {
    extrapolateRight: "clamp",
  });
  return (
    <>
      <InputRow
        busy={isBetween(frame, beats.submit, beats.answer)}
        caret={frame < beats.submit}
        pressed={pressed}
        text={typedText(
          entry.ask.prompt,
          frame,
          beats.typeStart,
          beats.framesPerChar
        )}
      />
      <div
        style={{ left: 0, position: "absolute", right: 0, top: INPUT_HEIGHT }}
      >
        {frame < beats.submit ? (
          <div style={{ opacity: previousOpacity }}>
            <AskAnswer ask={previous} progress={SETTLED} />
          </div>
        ) : null}
        {isBetween(frame, beats.submit, beats.answer) ? (
          <Working beats={beats} entry={entry} />
        ) : null}
        {frame >= beats.answer ? <Outcome beats={beats} entry={entry} /> : null}
      </div>
      <Footer
        action={action}
        connection={entry.ask.connection.name}
        hint={hint}
      />
    </>
  );
}
