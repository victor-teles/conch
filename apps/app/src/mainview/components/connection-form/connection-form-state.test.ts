import { describe, expect, it } from "vitest";

import { INITIAL_STATE, isDirtyForm } from "./connection-form-state";

describe("isDirtyForm", () => {
  it("treats the untouched form as clean", () => {
    expect(isDirtyForm({ ...INITIAL_STATE })).toBeFalsy();
  });

  it("treats any changed field as dirty", () => {
    expect(isDirtyForm({ ...INITIAL_STATE, host: "db.internal" })).toBeTruthy();
    expect(isDirtyForm({ ...INITIAL_STATE, type: "mysql" })).toBeTruthy();
    expect(isDirtyForm({ ...INITIAL_STATE, piiRedaction: true })).toBeTruthy();
  });
});
