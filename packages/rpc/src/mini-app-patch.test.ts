import { describe, expect, it } from "vitest";

import type { DraftState } from "./mini-app-patch.ts";
import type { DraftPatch } from "./mini-app.ts";

import {
  applyDraftPatch,
  applyDraftPatches,
  draftStateOf,
  emptyDraftState,
  parseDraftState,
  parsePatchLine,
} from "./mini-app-patch.ts";
import { ordersCard, present, refundDesk } from "./test-mini-app.ts";

const desk = refundDesk();
const [period, input] = desk.inputs;
const { orders: source } = desk.sources;
const [, action] = desk.actions;
const empty = emptyDraftState("a refund desk");

const apply = (draft: DraftState, ...ops: DraftPatch[]): DraftState => {
  let current = draft;
  for (const op of ops) {
    const result = applyDraftPatch(current, op);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    current = result.draft;
  }
  return current;
};

const reasonOf = (draft: DraftState, op: DraftPatch): string | null => {
  const result = applyDraftPatch(draft, op);
  return result.ok ? null : result.reason;
};

const parsedOrNull = (state: DraftState) => {
  const parsed = parseDraftState(state);
  return parsed.success ? parsed.data : null;
};

const childrenOf = (draft: DraftState) => draft.layout.elements.main?.children;

const withInputs = apply(
  empty,
  { op: "add", path: "/inputs/-", value: input },
  { op: "add", path: "/inputs/0", value: period }
);

describe("parsePatchLine", () => {
  it("reads one op per line", () => {
    expect(
      parsePatchLine('{"op":"add","path":"/name","value":"Refunds"}')
    ).toStrictEqual({ op: "add", path: "/name", value: "Refunds" });
    expect(parsePatchLine('  {"op":"remove","path":"/emoji"}  ')).toStrictEqual(
      { op: "remove", path: "/emoji" }
    );
  });

  it.each([
    ['{"op":"add","path":"/name"'],
    ["Here is your app:"],
    ['{"op":"move","from":"/a","path":"/b"}'],
    ['{"op":"add","path":"/name","value":"x","extra":1}'],
  ])("drops %s", (line) => {
    expect(parsePatchLine(line)).toBeNull();
  });
});

describe("applyDraftPatch fields", () => {
  it("writes the top-level fields", () => {
    const draft = apply(
      empty,
      { op: "add", path: "/name", value: "Refunds" },
      { op: "add", path: "/emoji", value: "💳" },
      { op: "add", path: "/description", value: "Desk" },
      { op: "replace", path: "/refresh", value: "5m" }
    );
    expect(draft).toMatchObject({
      description: "Desk",
      emoji: "💳",
      name: "Refunds",
      refresh: "5m",
    });
    expect(
      apply(draft, { op: "remove", path: "/emoji" }).emoji
    ).toBeUndefined();
  });

  it("refuses to remove a required field or write a bad value", () => {
    expect(reasonOf(empty, { op: "remove", path: "/name" })).toBe(
      "/name can't be removed."
    );
    expect(
      reasonOf(empty, { op: "add", path: "/refresh", value: "2m" })
    ).toMatch(/^\/refresh: /u);
  });
});

describe("applyDraftPatch lists", () => {
  it("appends and inserts inputs", () => {
    expect(withInputs.inputs.map((item) => item.name)).toStrictEqual([
      "period",
      "region",
    ]);
  });

  it("replaces and removes inputs by index", () => {
    const replaced = apply(withInputs, {
      op: "replace",
      path: "/inputs/1",
      value: { ...input, label: "Zone" },
    });
    expect(replaced.inputs[1]?.label).toBe("Zone");
    expect(
      apply(replaced, { op: "remove", path: "/inputs/0" }).inputs
    ).toHaveLength(1);
  });

  it.each<[string, DraftPatch, string | RegExp]>([
    [
      "removing past the end",
      { op: "remove", path: "/inputs/4" },
      "/inputs/4: nothing to remove.",
    ],
    [
      "replacing at -",
      { op: "replace", path: "/inputs/-", value: input },
      "/inputs/-: nothing to replace.",
    ],
    [
      "a word for an index",
      { op: "add", path: "/inputs/x", value: input },
      "/inputs/x: use an index or -.",
    ],
    [
      "an invalid input",
      { op: "add", path: "/inputs/-", value: { name: 1 } },
      /^\/inputs\/-: /u,
    ],
  ])("refuses %s", (_name, op, reason) => {
    expect(reasonOf(withInputs, op)).toMatch(reason);
  });

  it("caps lists", () => {
    const full = {
      ...empty,
      inputs: Array.from({ length: 6 }, () => present(input)),
    };
    expect(reasonOf(full, { op: "add", path: "/inputs/-", value: input })).toBe(
      "/inputs/-: at most 6 entries."
    );
  });
});

describe("applyDraftPatch records", () => {
  const written = apply(
    empty,
    { op: "add", path: "/sources/orders", value: source },
    { op: "add", path: "/actions/-", value: action },
    { op: "add", path: "/inputOptions/region", value: "orders" },
    { op: "add", path: "/refreshAfter/copy-region", value: ["orders"] }
  );

  it("writes sources, actions, input options and refreshes by name", () => {
    expect(Object.keys(written.sources)).toStrictEqual(["orders"]);
    expect(written.actions[0]?.id).toBe("copy-region");
    expect(written.inputOptions).toStrictEqual({ region: "orders" });
    expect(written.refreshAfter).toStrictEqual({ "copy-region": ["orders"] });
  });

  it("removes a source", () => {
    expect(
      apply(written, { op: "remove", path: "/sources/orders" }).sources
    ).toStrictEqual({});
  });

  it.each<[string, DraftPatch, string]>([
    [
      "removing a missing source",
      { op: "remove", path: "/sources/ghost" },
      "/sources/ghost: nothing to remove.",
    ],
    [
      "replacing a missing source",
      { op: "replace", path: "/sources/ghost", value: source },
      "/sources/ghost: nothing to replace.",
    ],
    [
      "a name that isn't an identifier",
      { op: "add", path: "/sources/Bad", value: source },
      '/sources/Bad: "Bad" isn\'t a valid name.',
    ],
  ])("refuses %s", (_name, op, reason) => {
    expect(reasonOf(written, op)).toBe(reason);
  });
});

describe("applyDraftPatch layout", () => {
  const laid = apply(
    empty,
    { op: "add", path: "/layout/root", value: "main" },
    { op: "add", path: "/layout/elements/orders", value: ordersCard }
  );

  it("writes the layout root and whole elements", () => {
    expect(laid.layout.root).toBe("main");
    expect(Object.keys(laid.layout.elements)).toStrictEqual(["orders"]);
  });

  it.each<[string, DraftPatch, string | RegExp]>([
    [
      "a deep write that breaks the element",
      { op: "add", path: "/layout/elements/orders/props/data", value: {} },
      /^\/layout\/elements\/orders\/props\/data: /u,
    ],
    [
      "an element field that breaks the element",
      { op: "add", path: "/layout/elements/orders/props", value: {} },
      /^\/layout\/elements\/orders\/props: /u,
    ],
    [
      "removing the root",
      { op: "remove", path: "/layout/root" },
      "/layout/root can't be removed.",
    ],
    [
      "rows where a pointer belongs",
      {
        op: "add",
        path: "/layout/elements/x",
        value: { props: { rows: [[1]] }, type: "Card" },
      },
      /^\/layout\/elements\/x: /u,
    ],
  ])("refuses %s", (_name, op, reason) => {
    expect(reasonOf(laid, op)).toMatch(reason);
  });
});

describe("applyDraftPatch allow-list", () => {
  it.each([
    "/version",
    "/id",
    "/createdAt",
    "/prompt",
    "/values",
    "/inputs/0/label",
    "/sources/orders/sqlTemplate",
    "name",
    "/layout",
    "/layout/other",
  ])("refuses %s", (path) => {
    expect(reasonOf(empty, { op: "add", path, value: "x" })).toBe(
      `${path} isn't a path you can write.`
    );
  });

  it.each([
    "/__proto__/polluted",
    "/sources/__proto__",
    "/layout/elements/constructor",
    "/inputOptions/prototype",
    "/sources/~0~1__proto__/x",
  ])("refuses the prototype path %s", (path) => {
    expect(
      applyDraftPatch(empty, { op: "add", path, value: source }).ok
    ).toBeFalsy();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("skips invalid ops when applying a batch", () => {
    const draft = applyDraftPatches(empty, [
      { op: "add", path: "/name", value: "Refunds" },
      { op: "add", path: "/id", value: "stolen" },
      { op: "add", path: "/emoji", value: "x".repeat(20) },
    ]);
    expect(draft.name).toBe("Refunds");
    expect(draft).not.toHaveProperty("id");
    expect(draft.emoji).toBeUndefined();
  });
});

describe("applyDraftPatch one-field writes", () => {
  const withSource = apply(empty, {
    op: "add",
    path: "/sources/orders",
    value: source,
  });

  it("replaces one field of an existing source, as a model fixing SQL does", () => {
    const next = apply(withSource, {
      op: "replace",
      path: "/sources/orders/sqlTemplate",
      value: "SELECT 2",
    });
    expect(next.sources.orders).toStrictEqual({
      ...source,
      sqlTemplate: "SELECT 2",
    });
  });

  it("checks the merged value with the full schema", () => {
    expect(
      reasonOf(withSource, {
        op: "replace",
        path: "/sources/orders/sqlTemplate",
        value: "",
      })
    ).toContain("/sources/orders/sqlTemplate");
    expect(
      reasonOf(withSource, {
        op: "replace",
        path: "/sources/orders/kind",
        value: "shell",
      })
    ).not.toBeNull();
    expect(
      reasonOf(withSource, {
        op: "remove",
        path: "/sources/orders/sqlTemplate",
      })
    ).not.toBeNull();
  });

  it("writes one field of an input and of an element", () => {
    const labelled = apply(withInputs, {
      op: "replace",
      path: "/inputs/1/label",
      value: "Market",
    });
    expect(labelled.inputs[1]).toStrictEqual({ ...input, label: "Market" });
  });

  it.each([
    "/sources/missing/sqlTemplate",
    "/inputs/9/label",
    "/inputs/-/label",
    "/inputOptions/region/x",
    "/sources/orders/sqlTemplate/deeper",
    "/layout/elements/missing/props",
    "/sources/orders/__proto__",
  ])("refuses %s", (path) => {
    expect(
      applyDraftPatch(withSource, { op: "replace", path, value: "x" }).ok
    ).toBeFalsy();
    expect(Object.prototype).not.toHaveProperty("x");
  });

  const stacked = apply(
    empty,
    { op: "add", path: "/layout/root", value: "main" },
    {
      op: "add",
      path: "/layout/elements/main",
      value: {
        children: ["a"],
        props: { direction: "vertical", gap: "m" },
        type: "Stack",
      },
    }
  );

  it("inserts, appends and removes children by index, as a model laying out does", () => {
    const first = apply(stacked, {
      op: "add",
      path: "/layout/elements/main/children/0",
      value: "header",
    });
    expect(childrenOf(first)).toStrictEqual(["header", "a"]);
    const appended = apply(first, {
      op: "add",
      path: "/layout/elements/main/children/-",
      value: "z",
    });
    expect(childrenOf(appended)).toStrictEqual(["header", "a", "z"]);
    const removed = apply(appended, {
      op: "remove",
      path: "/layout/elements/main/children/1",
    });
    expect(childrenOf(removed)).toStrictEqual(["header", "z"]);
  });

  it("writes a nested prop of an element", () => {
    const tight = apply(stacked, {
      op: "replace",
      path: "/layout/elements/main/props/gap",
      value: "s",
    });
    expect(tight.layout.elements.main?.props).toStrictEqual({
      direction: "vertical",
      gap: "s",
    });
  });

  it.each<DraftPatch>([
    { op: "add", path: "/layout/elements/main/children/5", value: "x" },
    { op: "remove", path: "/layout/elements/main/children/3" },
    { op: "add", path: "/layout/elements/main/children/x", value: "x" },
    { op: "add", path: "/layout/elements/main/props/a/b/c/d", value: "x" },
  ])("refuses $op at $path", (op) => {
    expect(reasonOf(stacked, op)).toBe(
      `${op.path} isn't a path you can write.`
    );
  });

  it("keeps layout structure checks on an element field write", () => {
    const laidOut = apply(
      empty,
      { op: "add", path: "/layout/root", value: "main" },
      {
        op: "add",
        path: "/layout/elements/main",
        value: {
          children: [],
          props: { direction: "vertical", gap: "m" },
          type: "Stack",
        },
      }
    );
    expect(
      applyDraftPatch(laidOut, {
        op: "replace",
        path: "/layout/elements/main/children",
        value: ["main"],
      }).ok
    ).toBeFalsy();
  });
});

describe("draft state", () => {
  it("round-trips a full draft", () => {
    expect(parsedOrNull(draftStateOf(desk))).toStrictEqual(desk);
  });

  it("rebuilds the refund desk op by op", () => {
    const ops: DraftPatch[] = [
      { op: "add", path: "/name", value: desk.name },
      { op: "add", path: "/emoji", value: desk.emoji },
      { op: "add", path: "/description", value: desk.description },
      ...desk.inputs.map(
        (value): DraftPatch => ({ op: "add", path: "/inputs/-", value })
      ),
      ...Object.entries(desk.sources).map(
        ([name, value]): DraftPatch => ({
          op: "add",
          path: `/sources/${name}`,
          value,
        })
      ),
      ...desk.actions.map(
        (value): DraftPatch => ({ op: "add", path: "/actions/-", value })
      ),
      { op: "add", path: "/refreshAfter/refund", value: ["orders"] },
      { op: "add", path: "/layout/root", value: "main" },
      ...Object.entries(desk.layout.elements).map(
        ([key, value]): DraftPatch => ({
          op: "add",
          path: `/layout/elements/${key}`,
          value,
        })
      ),
    ];
    const state = applyDraftPatches(emptyDraftState(desk.prompt), ops);
    expect(parsedOrNull(state)).toStrictEqual(desk);
  });

  it("refuses an incomplete draft at the end", () => {
    expect(parsedOrNull(emptyDraftState("x"))).toBeNull();
  });
});

const stackOf = (children: string[]) => ({
  children,
  props: { direction: "vertical", gap: "s" },
  type: "Stack",
});

const element = (key: string, children: string[]): DraftPatch => ({
  op: "add",
  path: `/layout/elements/${key}`,
  value: stackOf(children),
});

describe("applyDraftPatch layout structure", () => {
  const rooted = apply(empty, { op: "add", path: "/layout/root", value: "a" });

  it.each<[string, DraftPatch[], string]>([
    [
      "an element listing itself",
      [element("a", ["a"])],
      '"a" ends up inside itself.',
    ],
    [
      "a two-element cycle",
      [element("a", ["b"]), element("b", ["a"])],
      '"a" ends up inside itself.',
    ],
    [
      "a child listed twice",
      [element("a", ["b", "b"])],
      '"a" lists "b" twice.',
    ],
    [
      "a child with two parents",
      [element("a", ["b", "c"]), element("b", ["d"]), element("c", ["d"])],
      '"d" has two parents.',
    ],
    [
      "a fifth level",
      [
        element("a", ["b"]),
        element("b", ["c"]),
        element("c", ["d"]),
        element("d", ["e"]),
        element("e", []),
      ],
      "Nest elements at most 4 levels deep.",
    ],
  ])("refuses %s", (_name, ops, reason) => {
    const ready = apply(rooted, ...ops.slice(0, -1));
    expect(reasonOf(ready, present(ops.at(-1)))).toBe(reason);
  });

  it("refuses a cycle away from the root and a root inside another element", () => {
    const loose = apply(empty, element("x", ["y"]));
    expect(reasonOf(loose, element("y", ["x"]))).toBe(
      '"x" ends up inside itself.'
    );
    const parented = apply(empty, element("p", ["a"]));
    expect(
      reasonOf(parented, {
        op: "add",
        path: "/layout/elements/a",
        value: stackOf(["p"]),
      })
    ).toBe('"p" ends up inside itself.');
  });

  it("still accepts children that arrive later", () => {
    const draft = apply(rooted, element("a", ["b", "c"]), element("b", []));
    expect(Object.keys(draft.layout.elements)).toStrictEqual(["a", "b"]);
  });
});
