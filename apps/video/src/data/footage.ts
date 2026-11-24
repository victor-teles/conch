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

// One take of the real app and the shots cut from it. Clip times are seconds
// into the take; gaps between clips skip the loading wait.
export interface Edit {
  take: string;
  shots: readonly Shot[];
}

// `join` says how a shot meets the one before it: a hard cut when the panel
// carries on, a dip through the stage when it changes.
// Recorded with capture/take.py against the seeded demo data, over a flat
// backdrop.
const LAUNCH_SHOTS: readonly Shot[] = [
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

export const LAUNCH_EDIT: Edit = {
  shots: LAUNCH_SHOTS,
  take: "footage/take8.mp4",
};

// Recorded with capture/take_reuse.py: one answer saved as a widget with a
// Plan input, then run again on another plan without the AI.
const REUSE_SHOTS: readonly Shot[] = [
  {
    clips: [
      { from: 2.35, to: 6.2 },
      { from: 10.3, to: 13 },
    ],
    headline: {
      body: "Type a question. Get a chart from your own data.",
      eyebrow: "Ask",
      title: "Ask in plain words.",
    },
    id: "ask",
    join: "dip",
  },
  {
    clips: [
      { from: 13.3, to: 14.5 },
      { from: 21.1, to: 25.9 },
    ],
    headline: {
      body: "Save the answer. The plan you asked about becomes an input.",
      eyebrow: "Save",
      title: "Keep the good ones.",
    },
    id: "save",
    join: "cut",
  },
  {
    clips: [{ from: 26.4, to: 32 }],
    headline: {
      body: "Pick another plan. It runs the saved query, with no AI in the loop.",
      eyebrow: "Reuse",
      title: "Run it again, your way.",
    },
    id: "reuse",
    join: "cut",
  },
  {
    clips: [{ from: 32.9, to: 37.6 }],
    headline: {
      body: "Search what you asked last week and ask it again.",
      eyebrow: "History",
      title: "Every question, kept.",
    },
    id: "history",
    join: "dip",
  },
  {
    clips: [
      { from: 38.2, to: 42 },
      { from: 45.8, to: 49.8 },
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

export const REUSE_EDIT: Edit = {
  shots: REUSE_SHOTS,
  take: "footage/take9.mp4",
};

// Recorded with capture/take_tour.py: every chart kind, three engines, and the
// save-and-reuse flow in one take.
const TOUR_SHOTS: readonly Shot[] = [
  {
    clips: [
      { from: 2.4, to: 5.8 },
      { from: 9.9, to: 12 },
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
    clips: [{ from: 12, to: 16.4 }],
    headline: {
      body: "Switch with ⌘1, ⌘2 and ⌘3. No new question.",
      eyebrow: "Views",
      title: "Bar, line or table.",
    },
    id: "views",
    join: "cut",
  },
  {
    clips: [
      { from: 17, to: 19.8 },
      { from: 24.6, to: 27.2 },
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
      { from: 27.3, to: 30.7 },
      { from: 32.9, to: 35.4 },
    ],
    headline: {
      body: "A count comes back as one clear number.",
      eyebrow: "Numbers",
      title: "The right shape for the answer.",
    },
    id: "kpi",
    join: "cut",
  },
  {
    clips: [
      { from: 37.6, to: 40.6 },
      { from: 48.5, to: 51.6 },
    ],
    headline: {
      body: "The same question, answered with a MongoDB pipeline.",
      eyebrow: "MongoDB",
      title: "Not just SQL.",
    },
    id: "orders",
    join: "dip",
  },
  {
    clips: [
      { from: 54, to: 57.7 },
      { from: 60.4, to: 62.6 },
    ],
    headline: {
      body: "Ask Redis in plain words. Read-only commands, every time.",
      eyebrow: "Redis",
      title: "Even your cache.",
    },
    id: "leaderboard",
    join: "dip",
  },
  {
    clips: [
      { from: 65.4, to: 69.4 },
      { from: 73.9, to: 76.4 },
      { from: 81.9, to: 87.1 },
    ],
    headline: {
      body: "Save the answer. The plan you asked about becomes an input.",
      eyebrow: "Save",
      title: "Keep the good ones.",
    },
    id: "save",
    join: "dip",
  },
  {
    clips: [{ from: 87.3, to: 92.8 }],
    headline: {
      body: "Pick another plan. It runs the saved query, with no AI in the loop.",
      eyebrow: "Reuse",
      title: "Run it again, your way.",
    },
    id: "reuse",
    join: "cut",
  },
  {
    clips: [
      { from: 94.1, to: 98.2 },
      { from: 98.9, to: 102 },
    ],
    headline: {
      body: "Ask it to delete, and Conch refuses to run it.",
      eyebrow: "Safe by design",
      title: "Asking never changes your data.",
    },
    id: "delete",
    join: "dip",
  },
];

export const TOUR_EDIT: Edit = {
  shots: TOUR_SHOTS,
  take: "footage/take10.mp4",
};

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
