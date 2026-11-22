import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";

import {
  linkAnnouncement,
  resolveLinkConnection,
  stagedLinkOf,
} from "./staged-link";

const analytics = makeConnection({ id: "c-1", name: "Analytics" });
const warehouse = makeConnection({ id: "c-2", name: "warehouse" });
const twin = makeConnection({ id: "c-3", name: "WAREHOUSE" });

describe("stagedLinkOf", () => {
  it("stages the link views and leaves every other view alone", () => {
    expect(
      stagedLinkOf({ connection: "x", kind: "ask-draft", prompt: "p" }, 1)
    ).toStrictEqual({ connection: "x", kind: "ask", nonce: 1, prompt: "p" });
    expect(
      stagedLinkOf(
        { kind: "widget-args", values: { a: "1" }, widgetId: "w" },
        2
      )
    ).toStrictEqual({
      kind: "widget-args",
      nonce: 2,
      values: { a: "1" },
      widgetId: "w",
    });
    expect(stagedLinkOf({ kind: "notice", message: "m" }, 3)).toStrictEqual({
      kind: "notice",
      message: "m",
      nonce: 3,
    });
    expect(stagedLinkOf("settings", 4)).toBeNull();
    expect(stagedLinkOf({ kind: "widget-run", widgetId: "w" }, 5)).toBeNull();
  });
});

describe("resolveLinkConnection", () => {
  const connections = [analytics, warehouse];

  it("matches an id first, then one name case-insensitively", () => {
    expect(resolveLinkConnection("c-2", connections).connection).toBe(
      warehouse
    );
    expect(resolveLinkConnection("analytics", connections).connection).toBe(
      analytics
    );
  });

  it("asks nothing of a link without a connection", () => {
    expect(resolveLinkConnection(null, connections)).toStrictEqual({
      connection: null,
      problem: null,
    });
  });

  it("names a missing or ambiguous connection", () => {
    expect(resolveLinkConnection("prod", connections)).toStrictEqual({
      connection: null,
      problem: "No connection named “prod”",
    });
    expect(
      resolveLinkConnection("Warehouse", [...connections, twin])
    ).toStrictEqual({
      connection: null,
      problem: "More than one connection is named “Warehouse”",
    });
  });
});

describe("linkAnnouncement", () => {
  it("says what ↵ will ask, and where", () => {
    expect(linkAnnouncement("revenue by region", analytics)).toBe(
      "From a link: ask Analytics “revenue by region”. Press Return to ask."
    );
    expect(linkAnnouncement("revenue", null)).toBe("From a link: “revenue”.");
  });
});
