import type { ShowcaseAsk } from "@/data/asks";

import type { CardReveal } from "./answer-card";
import type { AskState } from "./status-mark";

import { AnswerCard } from "./answer-card";
import { AskHeader } from "./ask-header";
import { AskChart } from "./charts/ask-chart";

export const answerSegments = (ask: ShowcaseAsk): string[] => [
  `${ask.runtimeMs} ms`,
  `${ask.rows} ${ask.rows === 1 ? "row" : "rows"}`,
];

export interface AnswerProgress extends CardReveal {
  chart: number;
}

export const SETTLED: AnswerProgress = { chart: 1, heading: 1, insight: 1 };

interface AskAnswerProps {
  ask: ShowcaseAsk;
  progress: AnswerProgress;
  status?: { state: AskState; segments: readonly string[] };
}

export function AskAnswer({ ask, progress, status }: AskAnswerProps) {
  return (
    <>
      <AskHeader
        connection={ask.connection.name}
        segments={status?.segments ?? answerSegments(ask)}
        state={status?.state ?? "done"}
      />
      <AnswerCard copy={ask.copy} reveal={progress}>
        <AskChart chart={ask.chart} progress={progress.chart} />
      </AnswerCard>
    </>
  );
}
