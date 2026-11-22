export interface Headline {
  eyebrow: string;
  title: string;
  body: string;
}

export interface Clip {
  from: number;
  to: number;
}

export type Join = "cut" | "dip";

export interface Shot {
  id: string;
  join: Join;
  clips: readonly Clip[];
  headline: Headline;
}

export const TAKE = "footage/take8.mp4";

// `join` says how a shot meets the one before it: a hard cut when the panel
// carries on, a dip through the stage when it changes.
// Recorded with capture/take.py against the seeded demo data, over a flat
// backdrop. Clip times are seconds into the take; gaps between clips skip
// the loading wait.
export const SHOTS: readonly Shot[] = [
  {
    clips: [
      { from: 3.25, to: 6.6 },
      { from: 8.35, to: 12 },
    ],
    headline: {
      body: "Type a question. Get a chart from your own data.",
      eyebrow: "Ask",
      title: "Ask in plain words.",
    },
    id: "revenue",
    join: "dip",
  },
  {
    clips: [
      { from: 14.1, to: 15.9 },
      { from: 17.1, to: 21.5 },
    ],
    headline: {
      body: "Ask for it another way. The chart follows.",
      eyebrow: "Refine",
      title: "Change your mind.",
    },
    id: "refine",
    join: "cut",
  },
  {
    clips: [
      { from: 23.8, to: 25.95 },
      { from: 27.65, to: 30.9 },
    ],
    headline: {
      body: "Some answers are a chart, some are a table.",
      eyebrow: "Follow up",
      title: "Keep asking.",
    },
    id: "customers",
    join: "cut",
  },
  {
    clips: [
      { from: 36.45, to: 39 },
      { from: 41.35, to: 44.5 },
    ],
    headline: {
      body: "Postgres, MongoDB, Redis and more.",
      eyebrow: "Any source",
      title: "Works where your data lives.",
    },
    id: "orders",
    join: "dip",
  },
  {
    clips: [
      { from: 49.95, to: 53.4 },
      { from: 54.4, to: 58.6 },
    ],
    headline: {
      body: "Ask it to delete, and it shows you who would be affected instead.",
      eyebrow: "Safe by design",
      title: "Asking never changes your data.",
    },
    id: "delete",
    join: "dip",
  },
];

// The colour the recorded backdrop decodes to, so the cut-out panel has no edge.
export const BACKDROP_RGB = "rgb(16, 13, 12)";

// The part of the 3024×1964 recording that can hold the launcher panel.
export const PANEL_CROP = {
  height: 1236,
  width: 1584,
  x: 720,
  y: 462,
} as const;
export const SCREEN = { height: 1964, width: 3024 } as const;
