export type SelectSegment =
  | { kind: "key"; key: string }
  | { kind: "index"; index: number }
  | { kind: "wildcard" };

export type SelectPathParse =
  | { ok: true; segments: SelectSegment[] }
  | { ok: false; error: string };

export const MAX_SELECT_PATH = 200;
export const MAX_SELECT_WILDCARDS = 2;

const DOT_KEY = /^\.([A-Za-z_$][\w$-]*)/;
const QUOTED_KEY = /^\[(?:'([^'\\]*)'|"([^"\\]*)")\]/;
const INDEX = /^\[(\d{1,6})\]/;
const WILDCARD = /^\[\*\]/;

const failure = (error: string): SelectPathParse => ({ error, ok: false });

const readSegment = (
  rest: string
): { segment: SelectSegment; length: number } | null => {
  const dotKey = DOT_KEY.exec(rest);
  if (dotKey?.[1] !== undefined) {
    return {
      length: dotKey[0].length,
      segment: { key: dotKey[1], kind: "key" },
    };
  }
  const quoted = QUOTED_KEY.exec(rest);
  if (quoted) {
    const key = quoted[1] ?? quoted[2] ?? "";
    return { length: quoted[0].length, segment: { key, kind: "key" } };
  }
  const index = INDEX.exec(rest);
  if (index?.[1] !== undefined) {
    return {
      length: index[0].length,
      segment: { index: Number(index[1]), kind: "index" },
    };
  }
  const wildcard = WILDCARD.exec(rest);
  if (wildcard) {
    return { length: wildcard[0].length, segment: { kind: "wildcard" } };
  }
  return null;
};

// A deliberately tiny JSONPath subset: no filters, no recursive descent and
// no script expressions, so nothing in a saved path is ever evaluated.
export const parseSelectPath = (path: string): SelectPathParse => {
  if (path.length > MAX_SELECT_PATH) {
    return failure(`Keep the path under ${MAX_SELECT_PATH} characters.`);
  }
  if (!path.startsWith("$")) {
    return failure("Start the path with $.");
  }
  const segments: SelectSegment[] = [];
  let rest = path.slice(1);
  while (rest.length > 0) {
    const read = readSegment(rest);
    if (!read) {
      return failure(`The path can't read "${rest.slice(0, 20)}".`);
    }
    segments.push(read.segment);
    rest = rest.slice(read.length);
  }
  const wildcards = segments.filter((item) => item.kind === "wildcard");
  if (wildcards.length > MAX_SELECT_WILDCARDS) {
    return failure(`Use at most ${MAX_SELECT_WILDCARDS} [*] in a path.`);
  }
  return { ok: true, segments };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const step = (value: unknown, segment: SelectSegment): unknown => {
  if (segment.kind === "key") {
    return isRecord(value) && Object.hasOwn(value, segment.key)
      ? value[segment.key]
      : undefined;
  }
  if (segment.kind === "index") {
    return Array.isArray(value) ? value[segment.index] : undefined;
  }
  return undefined;
};

const childrenOf = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return isRecord(value) ? Object.values(value) : [];
};

export const select = (
  json: unknown,
  segments: readonly SelectSegment[]
): unknown => {
  let current: unknown = json;
  let matches: unknown[] | null = null;
  for (const segment of segments) {
    if (matches) {
      matches =
        segment.kind === "wildcard"
          ? matches.flatMap(childrenOf)
          : matches
              .map((item) => step(item, segment))
              .filter((item) => item !== undefined);
    } else if (segment.kind === "wildcard") {
      matches = childrenOf(current);
    } else {
      current = step(current, segment);
    }
  }
  return matches ?? current;
};
