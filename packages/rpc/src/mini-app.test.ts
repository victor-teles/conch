import { describe, expect, it } from "vitest";

import type { MiniAppDraft as MiniAppDraftValue } from "./mini-app.ts";

import {
  draftOfApp,
  inputValuesOf,
  migrateMiniApp,
  MiniApp,
  MiniAppDraft,
  miniAppProblems,
  paramsForSource,
  parseStoredMiniApp,
  removeAction,
  removeSource,
  sourceKindsOf,
  sourcesUsing,
} from "./mini-app.ts";
import { cardProps, present, refundDesk } from "./test-mini-app.ts";

const problemsOf = (change: (app: MiniAppDraftValue) => MiniAppDraftValue) =>
  miniAppProblems(change(refundDesk()));

const stamp = "2026-11-21T10:00:00.000Z";

const savedApp = () => {
  const draft = refundDesk();
  return {
    ...draft,
    actions: draft.actions.map((action) => ({
      ...action,
      createdAt: stamp,
      effect:
        action.target.kind === "sql" ? ("write" as const) : ("read" as const),
      reviewHash: "a".repeat(64),
      reviewedAt: stamp,
      updatedAt: stamp,
    })),
    createdAt: stamp,
    id: "app-1",
    lastOpenedAt: null,
    updatedAt: stamp,
  };
};

const widgetScoped = (app: MiniAppDraftValue) => ({
  ...app,
  actions: app.actions.map((action) =>
    action.id === "refund"
      ? {
          ...action,
          bind: { id: { from: "literal" as const, value: 1 } },
          scope: "widget" as const,
        }
      : action
  ),
});

const pointAtRow = (app: MiniAppDraftValue) => {
  const elements = {
    ...app.layout.elements,
    copy: {
      children: [],
      props: { action: "refund" },
      type: "ActionButton" as const,
    },
  };
  return { ...app, layout: { ...app.layout, elements } };
};

describe("checkMiniAppReferences", () => {
  it("accepts the refund desk", () => {
    expect(miniAppProblems(refundDesk())).toStrictEqual([]);
    expect(MiniAppDraft.safeParse(refundDesk()).success).toBeTruthy();
  });

  it("requires unique input names", () => {
    expect(
      problemsOf((app) => ({
        ...app,
        inputs: [...app.inputs, present(app.inputs[1])],
      }))
    ).toContain("Input names must be unique.");
  });

  it("rejects optionsSql on an input", () => {
    const select = {
      default: "EU",
      label: "Region",
      name: "region",
      optionsSql: "SELECT region FROM orders",
      type: "select" as const,
    };
    expect(
      problemsOf((app) => ({
        ...app,
        inputs: [present(app.inputs[0]), select],
      }))
    ).toContain('"region" takes its options from a source, not optionsSql.');
  });

  it("maps input options from a select input to a source", () => {
    const select = {
      default: "EU",
      label: "Region",
      name: "region",
      type: "select" as const,
    };
    const ok = (app: MiniAppDraftValue) => ({
      ...app,
      inputOptions: { region: "orders" },
      inputs: [present(app.inputs[0]), select],
    });
    expect(problemsOf(ok)).toStrictEqual([]);
    expect(
      problemsOf((app) => ({ ...app, inputOptions: { period: "orders" } }))
    ).toContain('Options go to select inputs; "period" isn\'t one.');
    expect(
      problemsOf((app) => ({ ...ok(app), inputOptions: { region: "nope" } }))
    ).toContain('"region" takes options from a missing source.');
  });

  it("needs every card to name an existing source", () => {
    const { orders: _orders, ...sources } = refundDesk().sources;
    expect(problemsOf((app) => ({ ...app, sources }))).toContain(
      '"orders" shows the missing source "orders".'
    );
  });

  it("needs row actions to exist and act on rows", () => {
    expect(
      problemsOf((app) => ({ ...app, actions: app.actions.slice(1) }))
    ).toContain('"orders" lists the missing action "refund".');
    expect(problemsOf(widgetScoped)).toContain(
      '"refund" acts on the app, so it can\'t be a row action.'
    );
  });

  it("needs a button's action to exist and act on the app", () => {
    expect(
      problemsOf((app) => ({ ...app, actions: app.actions.slice(0, 1) }))
    ).toContain('"copy" runs the missing action "copy-region".');
    expect(problemsOf(pointAtRow)).toContain(
      '"refund" reads a row, so it belongs in a card\'s rowActions.'
    );
  });

  it("needs visibility to point at an existing input or source", () => {
    const visibleOn = (path: string) => (app: MiniAppDraftValue) => {
      const title = present(app.layout.elements.title);
      const elements = {
        ...app.layout.elements,
        title: { ...title, visible: { $state: path, eq: "EU" } },
      };
      return { ...app, layout: { ...app.layout, elements } };
    };
    expect(problemsOf(visibleOn("/inputs/region"))).toStrictEqual([]);
    expect(problemsOf(visibleOn("/sources/orders/rowCount"))).toStrictEqual([]);
    expect(problemsOf(visibleOn("/inputs/ghost"))).toContain(
      '"title" shows or hides on a missing /inputs/ghost.'
    );
  });

  it("needs action binds to read existing inputs", () => {
    expect(
      problemsOf((app) => ({ ...app, inputs: app.inputs.slice(0, 1) }))
    ).toContain('"copy-region" reads the missing input "region".');
  });

  it("checks refreshAfter keys and values", () => {
    expect(
      problemsOf((app) => ({ ...app, refreshAfter: { ghost: ["orders"] } }))
    ).toContain('refreshAfter names the missing action "ghost".');
    expect(
      problemsOf((app) => ({ ...app, refreshAfter: { refund: ["ghost"] } }))
    ).toContain('"refund" refreshes the missing source "ghost".');
  });

  it("rejects duplicate action ids", () => {
    expect(
      problemsOf((app) => ({
        ...app,
        actions: [...app.actions, present(app.actions[1])],
      }))
    ).toContain("Action ids must be unique.");
  });

  it("caps sources at 8", () => {
    const base = present(refundDesk().sources.orders);
    const sources = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [`s${index}`, base])
    );
    expect(
      problemsOf((app) => ({ ...app, sources: { ...app.sources, ...sources } }))
    ).toContain("Use at most 8 sources.");
  });

  it("checks external sources against the inputs they use", () => {
    const mcp = {
      args: { status: { $param: "ghost" } },
      kind: "mcp" as const,
      select: "$.items[*]",
      serverId: "stripe",
      tool: "list_charges",
    };
    expect(
      problemsOf((app) => ({ ...app, sources: { ...app.sources, mcp } }))
    ).toContain('mcp: The call uses "ghost", which isn\'t an input.');
    expect(
      problemsOf((app) => ({
        ...app,
        sources: { ...app.sources, mcp: { ...mcp, args: {} } },
      }))
    ).toStrictEqual([]);
  });

  it("refuses reserved source names", () => {
    const sources = {
      ...refundDesk().sources,
      constructor: present(refundDesk().sources.orders),
    };
    expect(
      MiniAppDraft.safeParse({ ...refundDesk(), sources }).success
    ).toBeFalsy();
  });

  it("caps actions at 12", () => {
    const actions = Array.from({ length: 13 }, (_, index) => ({
      ...present(refundDesk().actions[1]),
      id: `a${index}`,
    }));
    expect(
      MiniAppDraft.safeParse({ ...refundDesk(), actions }).success
    ).toBeFalsy();
  });
});

describe("stored mini-apps", () => {
  it("parses a saved v1 app and keeps v1 unchanged in migration", () => {
    const raw = savedApp();
    expect(migrateMiniApp(raw)).toBe(raw);
    expect(parseStoredMiniApp(raw)?.id).toBe("app-1");
    expect(MiniApp.safeParse(raw).success).toBeTruthy();
  });

  it("does not list an unknown version", () => {
    expect(parseStoredMiniApp({ ...savedApp(), version: 2 })).toBeNull();
  });

  it("turns a saved app back into a draft without review fields", () => {
    const draft = draftOfApp(MiniApp.parse(savedApp()));
    expect(draft.actions[0]).toStrictEqual(refundDesk().actions[0]);
    expect(MiniAppDraft.safeParse(draft).success).toBeTruthy();
  });
});

describe("source inputs", () => {
  it("lists only the inputs a source uses", () => {
    const app = refundDesk();
    expect(
      paramsForSource(present(app.sources.charges), app.inputs).map(
        (p) => p.name
      )
    ).toStrictEqual(["period"]);
    expect(sourcesUsing(app, "region")).toStrictEqual(["orders"]);
    expect(sourcesUsing(app, "period")).toStrictEqual(["charges"]);
  });

  it("maps name:type values to input names", () => {
    const app = refundDesk();
    expect(
      inputValuesOf(app.inputs, { "region:text": "US", "zone:text": "x" })
    ).toStrictEqual({ region: "US" });
  });

  it("names the source kinds", () => {
    expect(sourceKindsOf(refundDesk())).toStrictEqual(["sql"]);
  });
});

describe("removeSource", () => {
  it("removes the source with its cards and references", () => {
    const next = removeSource(refundDesk(), "orders");
    expect(Object.keys(next.sources)).toStrictEqual(["charges"]);
    expect(next.layout.elements.orders).toBeUndefined();
    expect(next.layout.elements.grid?.children).toStrictEqual(["charges"]);
    expect(next.refreshAfter).toStrictEqual({ refund: [] });
    expect(removeSource(refundDesk(), "ghost")).toStrictEqual(refundDesk());
  });
});

describe("removeAction", () => {
  it("removes the action with its buttons, row listings and refreshes", () => {
    const withoutRefund = removeAction(refundDesk(), "refund");
    expect(withoutRefund.actions.map((action) => action.id)).toStrictEqual([
      "copy-region",
    ]);
    expect(
      cardProps(withoutRefund.layout.elements.orders).rowActions
    ).toStrictEqual([]);
    expect(withoutRefund.refreshAfter).toStrictEqual({});
    expect(miniAppProblems(withoutRefund)).toStrictEqual([]);
  });

  it("removes an app action's button", () => {
    const withoutCopy = removeAction(refundDesk(), "copy-region");
    expect(withoutCopy.layout.elements.copy).toBeUndefined();
    expect(withoutCopy.layout.elements.main?.children).toStrictEqual([
      "title",
      "grid",
    ]);
    expect(miniAppProblems(withoutCopy)).toStrictEqual([]);
  });
});
