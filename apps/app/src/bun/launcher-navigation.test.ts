import { describe, expect, it } from "vitest";

import { createNavigationGate } from "./launcher-navigation";

describe("createNavigationGate", () => {
  it("holds a navigate until the renderer is ready, then delivers it once", () => {
    const sent: string[] = [];
    const gate = createNavigationGate<string>((view) => sent.push(view));

    gate.navigate("settings");
    expect(sent).toStrictEqual([]);
    expect(gate.isReady()).toBeFalsy();

    gate.markReady();
    gate.markReady();
    expect(sent).toStrictEqual(["settings"]);
    expect(gate.isReady()).toBeTruthy();
  });

  it("keeps only the latest view while waiting", () => {
    const sent: string[] = [];
    const gate = createNavigationGate<string>((view) => sent.push(view));
    gate.navigate("settings");
    gate.navigate("watches");
    gate.markReady();
    expect(sent).toStrictEqual(["watches"]);
  });

  it("sends straight away once ready", () => {
    const sent: string[] = [];
    const gate = createNavigationGate<string>((view) => sent.push(view));
    gate.markReady();
    gate.navigate("root");
    expect(sent).toStrictEqual(["root"]);
  });
});
