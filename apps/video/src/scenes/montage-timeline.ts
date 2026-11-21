import type { CaptionCue } from "@/components/caption";
import type { RefusedAsk, ShowcaseAsk } from "@/data/asks";
import type { MorphStep } from "@/lib/morph";

import { ASK_HEADER_HEIGHT } from "@/components/ask-header";
import { REFUSAL_NOTICE_HEIGHT } from "@/components/refusal-notice";
import { sqlBlockHeight } from "@/components/sql-block";
import {
  ACCOUNTS_ASK,
  LATENCY_ASK,
  LEADERBOARD_ASK,
  ORDERS_ASK,
  REFUSED_ASK,
} from "@/data/asks";
import { typingEnd } from "@/lib/text";

import { ANSWER_BODY_HEIGHT, PANEL_CHROME } from "./ask-timeline";

export type MontageEntry =
  | { kind: "answer"; ask: ShowcaseAsk }
  | { kind: "refused"; ask: RefusedAsk };

export interface ItemBeats {
  typeStart: number;
  framesPerChar: number;
  submit: number;
  queryStart: number;
  queryCharsPerFrame: number;
  runStart: number;
  answer: number;
  end: number;
}

export interface MontageItem {
  entry: MontageEntry;
  caption: string;
  from: number;
  beats: ItemBeats;
}

const TYPE_START = 3;
const FRAMES_PER_CHAR = 0.75;
const QUERY_CHARS_PER_FRAME = 12;
const RUN_FRAMES = 7;
const CHECK_FRAMES = 4;
const ANSWER_HOLD = 42;
const REFUSED_HOLD = 56;

export const beatsFor = (entry: MontageEntry): ItemBeats => {
  const { prompt, query } = entry.ask;
  const submit = Math.ceil(typingEnd(prompt, TYPE_START, FRAMES_PER_CHAR)) + 5;
  const queryStart = submit + 3;
  const runStart =
    queryStart + Math.ceil(query.length / QUERY_CHARS_PER_FRAME) + 2;
  const answers = entry.kind === "answer";
  const answer = runStart + (answers ? RUN_FRAMES : CHECK_FRAMES);
  return {
    answer,
    end: answer + (answers ? ANSWER_HOLD : REFUSED_HOLD),
    framesPerChar: FRAMES_PER_CHAR,
    queryCharsPerFrame: QUERY_CHARS_PER_FRAME,
    queryStart,
    runStart,
    submit,
    typeStart: TYPE_START,
  };
};

const ENTRIES: readonly { entry: MontageEntry; caption: string }[] = [
  {
    caption: "It picks the chart. Shares get a donut.",
    entry: { ask: ORDERS_ASK, kind: "answer" },
  },
  {
    caption: "Comparisons get bars.",
    entry: { ask: LATENCY_ASK, kind: "answer" },
  },
  {
    caption: "A single number gets a number.",
    entry: { ask: ACCOUNTS_ASK, kind: "answer" },
  },
  {
    caption: "Rankings get a table.",
    entry: { ask: LEADERBOARD_ASK, kind: "answer" },
  },
  {
    caption: "Writes are refused before they run.",
    entry: { ask: REFUSED_ASK, kind: "refused" },
  },
];

const schedule = (): MontageItem[] => {
  const items: MontageItem[] = [];
  let from = 0;
  for (const { entry, caption } of ENTRIES) {
    const beats = beatsFor(entry);
    items.push({ beats, caption, entry, from });
    from += beats.end;
  }
  return items;
};

export const MONTAGE: readonly MontageItem[] = schedule();

const lastItem = MONTAGE.at(-1);

export const MONTAGE_DURATION = lastItem
  ? lastItem.from + lastItem.beats.end
  : 0;

export const MONTAGE_CAPTIONS: readonly CaptionCue[] = MONTAGE.map(
  ({ beats, caption, from }) => ({
    from: from + 2,
    text: caption,
    to: from + beats.end - 6,
  })
);

const REFUSED_BODY_PADDING = 14;

const refusedPanelHeight = (ask: RefusedAsk): number =>
  PANEL_CHROME +
  ASK_HEADER_HEIGHT +
  REFUSAL_NOTICE_HEIGHT +
  sqlBlockHeight(ask.query.split("\n").length) +
  REFUSED_BODY_PADDING;

export const MONTAGE_PANEL_HEIGHTS: readonly MorphStep[] = [
  { at: 0, value: PANEL_CHROME + ANSWER_BODY_HEIGHT },
  ...MONTAGE.flatMap(({ beats, entry, from }) =>
    entry.kind === "refused"
      ? [{ at: from + beats.answer, value: refusedPanelHeight(entry.ask) }]
      : []
  ),
];
