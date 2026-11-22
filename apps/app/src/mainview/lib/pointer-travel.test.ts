import { describe, expect, it } from "vitest";

import { isPointerTravel } from "./pointer-travel";

describe("isPointerTravel", () => {
  it("counts the first move and every move to a new point", () => {
    expect(isPointerTravel({ screenX: 10, screenY: 20 })).toBeTruthy();
    expect(isPointerTravel({ screenX: 11, screenY: 20 })).toBeTruthy();
    expect(isPointerTravel({ screenX: 11, screenY: 24 })).toBeTruthy();
  });

  it("ignores a move replayed at the same point, as after a scroll", () => {
    expect(isPointerTravel({ screenX: 300, screenY: 400 })).toBeTruthy();
    expect(isPointerTravel({ screenX: 300, screenY: 400 })).toBeFalsy();
    expect(isPointerTravel({ screenX: 300, screenY: 400 })).toBeFalsy();
  });
});
