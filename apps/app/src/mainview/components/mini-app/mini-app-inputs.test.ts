import { describe, expect, it } from "vitest";

import { deskDraft } from "@/test/mini-app-fixtures";

import {
  affectedSources,
  appInputs,
  initialInputs,
  storedValuesOf,
} from "./mini-app-inputs";

const desk = deskDraft();

describe("mini-app inputs", () => {
  it("starts from stored values, else defaults", () => {
    expect(
      initialInputs({ ...desk, values: { "region:text": "US" } })
    ).toStrictEqual({
      period: "last7d",
      region: "US",
    });
    expect(
      initialInputs({ ...desk, values: { "region:text": { bad: 1 } } })
    ).toMatchObject({
      region: "EU",
    });
  });

  it("stores values by name and type", () => {
    expect(storedValuesOf(desk.inputs, { region: "US" })).toStrictEqual({
      "region:text": "US",
    });
  });

  it("re-runs only the sources a changed input feeds", () => {
    expect(
      affectedSources(
        desk,
        { period: "last7d", region: "EU" },
        { period: "last7d", region: "US" }
      )
    ).toStrictEqual(["orders"]);
    expect(
      affectedSources(desk, { region: "EU" }, { region: "EU" })
    ).toStrictEqual([]);
  });

  it("offers pills that load options only when a source feeds them", () => {
    const inputs = appInputs(
      { ...desk, inputOptions: { region: "orders" } },
      { appId: "a", kind: "saved" }
    );
    expect(inputs.map((input) => input.owner)).toStrictEqual([
      {
        kind: "mini-app",
        sourced: false,
        target: { appId: "a", kind: "saved" },
      },
      {
        kind: "mini-app",
        sourced: true,
        target: { appId: "a", kind: "saved" },
      },
    ]);
  });
});
