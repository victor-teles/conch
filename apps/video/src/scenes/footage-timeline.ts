import type { Shot } from "@/data/footage";

import { SHOTS } from "@/data/footage";

export const FPS = 30;
export const DIP_FRAMES = 4;

export interface TimedClip {
  id: string;
  start: number;
  duration: number;
  trimBefore: number;
  fadeIn: number;
  fadeOut: number;
}

export interface TimedShot {
  shot: Shot;
  start: number;
  duration: number;
}

export interface FootageTimeline {
  clips: TimedClip[];
  shots: TimedShot[];
  duration: number;
}

const toFrames = (seconds: number): number => Math.round(seconds * FPS);

export const timeFootage = (shots: readonly Shot[]): FootageTimeline => {
  const clips: TimedClip[] = [];
  const timedShots: TimedShot[] = [];
  let cursor = 0;
  for (const [shotIndex, shot] of shots.entries()) {
    const shotStart = cursor;
    const last = shot.clips.length - 1;
    const next = shots[shotIndex + 1];
    const dipsOut = next === undefined || next.join === "dip";
    for (const [index, clip] of shot.clips.entries()) {
      const duration = toFrames(clip.to - clip.from);
      clips.push({
        duration,
        fadeIn: index === 0 && shot.join === "dip" ? DIP_FRAMES : 0,
        fadeOut: index === last && dipsOut ? DIP_FRAMES : 0,
        id: `${shot.id}-${index}`,
        start: cursor,
        trimBefore: toFrames(clip.from),
      });
      cursor += duration;
    }
    timedShots.push({ duration: cursor - shotStart, shot, start: shotStart });
  }
  return { clips, duration: cursor, shots: timedShots };
};

export const FOOTAGE = timeFootage(SHOTS);
export const FOOTAGE_DURATION = FOOTAGE.duration;
