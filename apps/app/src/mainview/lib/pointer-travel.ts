interface ScreenPoint {
  screenX: number;
  screenY: number;
}

let last: ScreenPoint | null = null;

// WebKit replays a pointer move whenever content scrolls under a still
// cursor. Only a pointer that really moved may pick a row, so scrolling (by
// wheel or by arrow keys) never hands the selection to the row underneath.
export const isPointerTravel = (event: ScreenPoint): boolean => {
  const moved =
    last === null ||
    last.screenX !== event.screenX ||
    last.screenY !== event.screenY;
  last = { screenX: event.screenX, screenY: event.screenY };
  return moved;
};
