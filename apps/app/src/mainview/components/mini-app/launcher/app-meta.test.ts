import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";
import { deskApp } from "@/test/mini-app-fixtures";

import { appMeta } from "./app-meta";

describe("appMeta", () => {
  it("names the connection, external kinds and the action count", () => {
    const app = deskApp();
    const analytics = makeConnection({ id: "analytics", name: "Postgres" });
    const mcp = {
      args: {},
      kind: "mcp" as const,
      select: "$",
      serverId: "stripe",
      tool: "list",
    };
    expect(
      appMeta({ ...app, sources: { ...app.sources, mcp } }, () => analytics)
    ).toBe("Postgres · MCP · 2 actions");
    expect(
      appMeta({ ...app, actions: app.actions.slice(0, 1) }, () => null)
    ).toBe("SQL · 1 action");
    expect(appMeta({ actions: [], sources: {} }, () => null)).toBe("");
  });
});
