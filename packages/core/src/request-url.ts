import type { BoundValues, ParamRefShape } from "./arg-template.ts";
import type { RangePart } from "./sql-template.ts";

import { isParamRef, paramText } from "./arg-template.ts";
import { DbError } from "./error.ts";

export type QueryLeafValue = string | number | boolean | ParamRefShape;

export type PathPart =
  | { kind: "literal"; text: string }
  | { kind: "param"; name: string; part: RangePart | null };

export type PathTemplateParse =
  | { ok: true; parts: PathPart[] }
  | { ok: false; error: string };

const WHOLE_PLACEHOLDER =
  /^\{\{\s*([a-z][a-z0-9_]{0,31})(?:\.(from|to))?\s*\}\}$/;
const DOT_SEGMENTS = new Set([".", ".."]);

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const partOf = (segment: string): PathPart | { error: string } => {
  const placeholder = WHOLE_PLACEHOLDER.exec(segment);
  const [, name, part] = placeholder ?? [];
  if (name !== undefined) {
    return {
      kind: "param",
      name,
      part: part === "from" || part === "to" ? part : null,
    };
  }
  if (segment.includes("{{") || segment.includes("}}")) {
    return { error: "An input fills a whole path segment, like /{{id}}/." };
  }
  if (DOT_SEGMENTS.has(decoded(segment))) {
    return { error: "The path can't use . or .. segments." };
  }
  return { kind: "literal", text: segment };
};

export const parsePathTemplate = (path: string): PathTemplateParse => {
  if (!path.startsWith("/")) {
    return { error: "Start the path with /.", ok: false };
  }
  const parts: PathPart[] = [];
  for (const segment of path.slice(1).split("/")) {
    const part = partOf(segment);
    if ("error" in part) {
      return { error: part.error, ok: false };
    }
    parts.push(part);
  }
  return { ok: true, parts };
};

export const pathParamRefs = (path: string): ParamRefShape[] => {
  const parsed = parsePathTemplate(path);
  if (!parsed.ok) {
    return [];
  }
  return parsed.parts.flatMap((part) =>
    part.kind === "param"
      ? [
          part.part
            ? { $param: part.name, part: part.part }
            : { $param: part.name },
        ]
      : []
  );
};

const unsafe = (message: string): DbError =>
  new DbError("SOURCE_BAD_URL", message);

const encodeSegment = (value: string): string => {
  if (value === "" || DOT_SEGMENTS.has(value)) {
    throw unsafe("A path input can't be empty, . or ..");
  }
  return encodeURIComponent(value);
};

const renderPart = (part: PathPart, values: BoundValues): string => {
  if (part.kind === "literal") {
    return part.text;
  }
  const ref = part.part
    ? { $param: part.name, part: part.part }
    : { $param: part.name };
  return encodeSegment(paramText(ref, values));
};

const queryText = (leaf: QueryLeafValue, values: BoundValues): string =>
  isParamRef(leaf) ? paramText(leaf, values) : String(leaf);

const withTrailingSlash = (pathname: string): string =>
  pathname.endsWith("/") ? pathname : `${pathname}/`;

export const buildRequestUrl = (
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, QueryLeafValue>>,
  values: BoundValues
): URL => {
  const base = new URL(baseUrl);
  const parsed = parsePathTemplate(path);
  if (!parsed.ok) {
    throw unsafe(parsed.error);
  }
  const basePath = withTrailingSlash(base.pathname);
  const url = new URL(base.href);
  url.hash = "";
  url.pathname = `${basePath}${parsed.parts.map((part) => renderPart(part, values)).join("/")}`;
  for (const [key, leaf] of Object.entries(query)) {
    url.searchParams.set(key, queryText(leaf, values));
  }
  if (url.origin !== base.origin || !url.pathname.startsWith(basePath)) {
    throw unsafe("The request would leave the endpoint's base URL.");
  }
  return url;
};
