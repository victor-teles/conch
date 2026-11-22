import { describe, expect, it } from "vitest";

import type { PanelElement as PanelElementValue } from "./panel-spec.ts";

import {
  ElementKey,
  ElementTypeDocs,
  moveChild,
  PANEL_ELEMENT_TYPES,
  PanelElement,
  panelProblems,
  PanelSpec,
  removeElement,
  resizeCard,
  setCardView,
} from "./panel-spec.ts";
import { cardProps, ordersCard, refundDesk } from "./test-mini-app.ts";

const layout = () => refundDesk().layout;

const note = (text: string): PanelElementValue => ({
  children: [],
  props: { text },
  type: "Note",
});

const stack = (children: string[]): PanelElementValue => ({
  children,
  props: { direction: "vertical", gap: "s" },
  type: "Stack",
});

describe("panelSpec", () => {
  it("accepts the refund desk layout unchanged", () => {
    expect(PanelSpec.parse(layout())).toStrictEqual(layout());
  });

  it("documents every element type", () => {
    expect(Object.keys(ElementTypeDocs).toSorted()).toStrictEqual(
      [...PANEL_ELEMENT_TYPES].toSorted()
    );
  });

  it("rejects an unknown element type", () => {
    const spec = layout();
    const elements = {
      ...spec.elements,
      title: { children: [], props: { text: "x" }, type: "Button" },
    };
    expect(PanelSpec.safeParse({ ...spec, elements }).success).toBeFalsy();
  });

  it("rejects literal rows where a pointer belongs", () => {
    const card = {
      ...ordersCard,
      props: { ...ordersCard.props, data: { rows: [[1, 2]] } },
    };
    expect(PanelElement.safeParse(card).success).toBeFalsy();
  });

  it("rejects content instead of text", () => {
    const heading = { children: [], props: { content: "Hi" }, type: "Heading" };
    expect(PanelElement.safeParse(heading).success).toBeFalsy();
  });

  it("rejects an extra prop or an extra element field", () => {
    const heading = {
      children: [],
      props: { onClick: "x", text: "Hi" },
      type: "Heading",
    };
    expect(PanelElement.safeParse(heading).success).toBeFalsy();
    expect(
      PanelElement.safeParse({ ...note("Hi"), state: { rows: [] } }).success
    ).toBeFalsy();
  });

  it("gives a leaf no children", () => {
    expect(
      PanelElement.safeParse({ ...note("Hi"), children: ["a"] }).success
    ).toBeFalsy();
  });

  it("strips an insight from a card spec", () => {
    const card = {
      ...ordersCard,
      props: {
        ...ordersCard.props,
        spec: {
          ...cardProps(ordersCard).spec,
          insight: "Refunds doubled.",
        },
      },
    };
    const parsed = PanelElement.parse(card);
    expect(cardProps(parsed).spec).not.toHaveProperty("insight");
  });

  it("refuses reserved keys", () => {
    expect(ElementKey.safeParse("constructor").success).toBeFalsy();
    expect(ElementKey.safeParse("__proto__").success).toBeFalsy();
    expect(ElementKey.safeParse("main-grid").success).toBeTruthy();
  });
});

describe("panelProblems", () => {
  it("finds nothing wrong with a valid layout", () => {
    expect(panelProblems(layout())).toStrictEqual([]);
  });

  it("needs the root to exist", () => {
    expect(panelProblems({ ...layout(), root: "nope" })).toStrictEqual([
      'The root "nope" is not an element.',
    ]);
  });

  it("needs every child to exist", () => {
    const elements = { root: stack(["ghost"]) };
    expect(panelProblems({ elements, root: "root" })).toStrictEqual([
      '"root" lists a missing "ghost".',
    ]);
  });

  it("rejects a cycle", () => {
    const elements = { a: stack(["b"]), b: stack(["a"]) };
    expect(panelProblems({ elements, root: "a" })).toStrictEqual([
      '"a" has two parents or forms a cycle.',
    ]);
  });

  it("rejects an element with two parents", () => {
    const elements = {
      a: stack(["b", "c"]),
      b: stack(["n"]),
      c: stack(["n"]),
      n: note("Shared"),
    };
    expect(panelProblems({ elements, root: "a" })).toStrictEqual([
      '"n" has two parents or forms a cycle.',
    ]);
  });

  it("rejects an unreachable element", () => {
    const elements = { a: stack([]), lost: note("Lost") };
    expect(panelProblems({ elements, root: "a" })).toStrictEqual([
      'Nothing contains "lost".',
    ]);
  });

  it("allows depth 4 and rejects depth 5", () => {
    const deep = {
      a: stack(["b"]),
      b: stack(["c"]),
      c: stack(["d"]),
      d: note("Four"),
    };
    expect(panelProblems({ elements: deep, root: "a" })).toStrictEqual([]);
    const deeper = { ...deep, d: stack(["e"]), e: note("Five") };
    expect(panelProblems({ elements: deeper, root: "a" })).toStrictEqual([
      "Nest elements at most 4 levels deep.",
    ]);
  });

  it("rejects 25 elements", () => {
    const notes = Object.fromEntries(
      Array.from({ length: 24 }, (_, index) => [`n${index}`, note("x")])
    );
    const elements = { root: stack(Object.keys(notes)), ...notes };
    expect(panelProblems({ elements, root: "root" })).toStrictEqual([
      "Use at most 24 elements.",
    ]);
  });

  it("rejects a card at the root", () => {
    expect(
      panelProblems({ elements: { card: ordersCard }, root: "card" })
    ).toStrictEqual(["A Card must sit inside a Grid or a Stack."]);
  });
});

describe("layout ops", () => {
  it("moves a child within its parent and clamps the target", () => {
    const moved = moveChild(layout(), "orders", 0);
    expect(moved.elements.grid?.children).toStrictEqual(["orders", "charges"]);
    expect(
      moveChild(layout(), "charges", 99).elements.grid?.children
    ).toStrictEqual(["orders", "charges"]);
    expect(moveChild(layout(), "main", 1)).toStrictEqual(layout());
    expect(moveChild(layout(), "charges", 0)).toStrictEqual(layout());
  });

  it("resizes and re-views a card, and ignores other elements", () => {
    const resized = resizeCard(layout(), "orders", "wide");
    expect(cardProps(resized.elements.orders).size).toBe("wide");
    expect(resizeCard(layout(), "title", "wide")).toStrictEqual(layout());
    const viewed = setCardView(layout(), "orders", "bar");
    expect(cardProps(viewed.elements.orders).view).toBe("bar");
  });

  it("removes an element with its subtree but never the root", () => {
    const removed = removeElement(layout(), "grid");
    expect(Object.keys(removed.elements).toSorted()).toStrictEqual([
      "copy",
      "main",
      "title",
    ]);
    expect(removed.elements.main?.children).toStrictEqual(["title", "copy"]);
    expect(removeElement(layout(), "main")).toStrictEqual(layout());
    expect(removeElement(layout(), "ghost")).toStrictEqual(layout());
  });
});
