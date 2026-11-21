import type { CaptionCue } from "@/components/caption";
import type { MorphStep } from "@/lib/morph";

import { ANSWER_CARD_HEIGHT } from "@/components/answer-card";
import { ASK_HEADER_HEIGHT } from "@/components/ask-header";
import { FOOTER_HEIGHT } from "@/components/footer";
import { INPUT_HEIGHT } from "@/components/input-row";
import { ASK_LIST_HEIGHT, ROOT_LIST_HEIGHT } from "@/components/root-list";
import { SQL_LINE_HEIGHT } from "@/components/sql-block";
import { REFINE_PROMPT } from "@/data/asks";
import { PROMPT, SQL } from "@/data/revenue";
import { typingEnd } from "@/lib/text";

export const PANEL_TOP = 120;

const FRAMES_PER_CHAR = 2;
const REFINE_FRAMES_PER_CHAR = 1;
const SQL_CHARS_PER_FRAME = 7;
const RUN_FRAMES = 30;
const ANSWER_HOLD = 64;
const REFINE_RUN = 18;
const REFINED_HOLD = 78;

const typeStart = 58;
const submit = typingEnd(PROMPT, typeStart, FRAMES_PER_CHAR) + 10;
const askView = submit + 4;
const sqlStart = askView + 8;
const runStart = sqlStart + Math.ceil(SQL.length / SQL_CHARS_PER_FRAME) + 6;
const answer = runStart + RUN_FRAMES;
const refineStart = answer + ANSWER_HOLD;
const refineSubmit =
  typingEnd(REFINE_PROMPT, refineStart, REFINE_FRAMES_PER_CHAR) + 6;
const refined = refineSubmit + REFINE_RUN;

export const SQL_LINES = SQL.split("\n").length;

export const ASK_TIMELINE = {
  answer,
  askView,
  end: refined + REFINED_HOLD,
  framesPerChar: FRAMES_PER_CHAR,
  keys: [
    { down: 10, label: "⌥", width: 112 },
    { down: 14, label: "⇧", width: 112 },
    { down: 19, label: "Space", width: 320 },
  ],
  keysRelease: 30,
  panelIn: 24,
  refineFramesPerChar: REFINE_FRAMES_PER_CHAR,
  refineStart,
  refineSubmit,
  refined,
  runStart,
  sqlCharsPerFrame: SQL_CHARS_PER_FRAME,
  sqlStart,
  submit,
  typeStart,
} as const;

const SQL_BODY = ASK_HEADER_HEIGHT + SQL_LINES * SQL_LINE_HEIGHT + 20 + 12;
export const ANSWER_BODY_HEIGHT = ASK_HEADER_HEIGHT + ANSWER_CARD_HEIGHT;
export const PANEL_CHROME = INPUT_HEIGHT + FOOTER_HEIGHT;

export const PANEL_HEIGHTS: readonly MorphStep[] = [
  { at: 0, value: PANEL_CHROME + ROOT_LIST_HEIGHT },
  { at: typeStart + 1, value: PANEL_CHROME + ASK_LIST_HEIGHT },
  { at: askView, value: PANEL_CHROME + SQL_BODY },
  { at: answer, value: PANEL_CHROME + ANSWER_BODY_HEIGHT },
];

export const ASK_CAPTIONS: readonly CaptionCue[] = [
  { from: 2, text: "One hotkey, from any app.", to: typeStart - 6 },
  { from: typeStart, text: "Ask in plain words.", to: askView - 2 },
  {
    from: askView + 2,
    text: "It writes read-only SQL for your schema.",
    to: answer - 4,
  },
  {
    from: answer + 6,
    text: "The answer comes back as a chart.",
    to: refineStart - 4,
  },
  {
    from: refineStart,
    text: "Refine it. The card follows.",
    to: refined + REFINED_HOLD - 8,
  },
];
