import "@/index.css";
import "./setup";
import { defaultThemeFor } from "@conch/rpc";
import { afterEach, beforeEach, expect } from "vitest";
import { commands } from "vitest/browser";

import { applyTheme } from "@/lib/theme/apply-theme";

const VOLATILE_STYLE_PROPS = new Set([
  "transform",
  "transform-origin",
  "opacity",
  "filter",
  "will-change",
  "--front-toast-height",
  "--initial-height",
  "--offset",
  "--cmdk-list-height",
]);

const VOLATILE_SVG_TEXT_ATTRS = ["x", "y", "dx", "dy"];

const VOLATILE_DATA_ATTRS = ["data-mounted", "data-motion-pop-id"];

// React useId values depend on how many components rendered before, so they
// change with test order; snapshots keep the reference shape, not the value.
const REACT_ID = /_r_[0-9a-z]+_/g;
// Recharts numbers clip paths with a global counter, which also depends on order.
const RECHARTS_CLIP = /recharts\d+-clip/g;
const CLIP_ATTRS = ["id", "clip-path"];
const ID_REFERENCE_ATTRS = [
  "id",
  "for",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-activedescendant",
  "data-chart",
];

function stripVolatileStyle(value: string): string | null {
  const cleaned = value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const [prop] = part.split(":");
      return part && !VOLATILE_STYLE_PROPS.has((prop ?? "").trim());
    })
    .join("; ");
  return cleaned.length > 0 ? cleaned : null;
}

function normalize(node: Node): Node {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const style = el.getAttribute("style");
    if (style !== null) {
      const cleaned = stripVolatileStyle(style);
      if (cleaned === null) {
        el.removeAttribute("style");
      } else {
        el.setAttribute("style", cleaned);
      }
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "text" || tag === "tspan") {
      for (const attr of VOLATILE_SVG_TEXT_ATTRS) {
        el.removeAttribute(attr);
      }
    }
    for (const attr of VOLATILE_DATA_ATTRS) {
      el.removeAttribute(attr);
    }
    if (tag === "style" && el.textContent?.match(REACT_ID)) {
      el.textContent = el.textContent.replaceAll(REACT_ID, "_r_id_");
    }
    for (const attr of CLIP_ATTRS) {
      const value = el.getAttribute(attr);
      if (value?.match(RECHARTS_CLIP)) {
        el.setAttribute(
          attr,
          value.replaceAll(RECHARTS_CLIP, "rechartsN-clip")
        );
      }
    }
    for (const attr of ID_REFERENCE_ATTRS) {
      const reference = el.getAttribute(attr);
      if (reference?.match(REACT_ID)) {
        el.setAttribute(attr, reference.replaceAll(REACT_ID, "_r_id_"));
      }
    }
  }
  for (const child of node.childNodes) {
    normalize(child);
  }
  return node;
}

const normalized = new WeakSet<Element>();

function markSubtree(el: Element): void {
  normalized.add(el);
  for (const child of el.children) {
    markSubtree(child);
  }
}

// oxlint-disable-next-line jest/require-hook -- vitest setup file
expect.addSnapshotSerializer({
  serialize(value, config, indentation, depth, refs, printer) {
    const clone = (value as Element).cloneNode(true) as Element;
    normalize(clone);
    markSubtree(clone);
    return printer(clone, config, indentation, depth, refs);
  },
  test(value) {
    return value instanceof Element && !normalized.has(value);
  },
});

const pointer = { moved: false };

if (typeof document !== "undefined") {
  applyTheme(defaultThemeFor("dark"));

  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
    }
  `;
  document.head.append(style);

  window.addEventListener(
    "mousemove",
    (event) => {
      pointer.moved ||= event.isTrusted;
    },
    { capture: true }
  );
}

// oxlint-disable-next-line jest/require-top-level-describe -- vitest setup file
beforeEach(async () => {
  // A face only starts loading once text uses it, and its swap shifts layout mid-test.
  await Promise.all(Array.from(document.fonts, (face) => face.load()));
});

// Playwright's pointer outlives a test and hovers whatever renders under it next.
// oxlint-disable-next-line jest/require-top-level-describe -- vitest setup file
afterEach(async () => {
  applyTheme(defaultThemeFor("dark"));
  if (!pointer.moved) {
    return;
  }
  await commands.resetPointer();
  pointer.moved = false;
});
