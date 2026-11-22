export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const LAUNCHER_WINDOW_WIDTH = 800;
export const LAUNCHER_MIN_HEIGHT = 64;
export const LAUNCHER_MAX_HEIGHT = 720;
const TOP_OFFSET_RATIO = 0.22;

export const clampLauncherHeight = (height: number): number =>
  Math.min(
    LAUNCHER_MAX_HEIGHT,
    Math.max(LAUNCHER_MIN_HEIGHT, Math.ceil(height))
  );

const contains = (area: Rect, point: Point): boolean =>
  point.x >= area.x &&
  point.x < area.x + area.width &&
  point.y >= area.y &&
  point.y < area.y + area.height;

export const workAreaForPoint = (
  workAreas: readonly Rect[],
  point: Point,
  fallback: Rect
): Rect => workAreas.find((area) => contains(area, point)) ?? fallback;

const launcherTop = (workArea: Rect): number =>
  Math.round(workArea.y + workArea.height * TOP_OFFSET_RATIO);

// The tallest window that still ends above the Dock on this display.
export const heightRoom = (workArea: Rect): number =>
  Math.max(
    LAUNCHER_MIN_HEIGHT,
    Math.min(
      LAUNCHER_MAX_HEIGHT,
      Math.floor(workArea.y + workArea.height - launcherTop(workArea))
    )
  );

export const launcherFrame = (workArea: Rect, height: number): Rect => ({
  height: Math.min(clampLauncherHeight(height), heightRoom(workArea)),
  width: LAUNCHER_WINDOW_WIDTH,
  x: Math.round(workArea.x + (workArea.width - LAUNCHER_WINDOW_WIDTH) / 2),
  y: launcherTop(workArea),
});

export const resizedFrame = (
  current: Rect,
  height: number,
  room: number = LAUNCHER_MAX_HEIGHT
): Rect => ({
  ...current,
  height: Math.min(clampLauncherHeight(height), room),
});
