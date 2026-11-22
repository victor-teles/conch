export const CONCH_SCHEME = "conch";

export const MAX_LINK_LENGTH = 8192;
export const MAX_LINK_PROMPT = 4000;
export const MAX_LINK_CONNECTION = 200;
export const MAX_LINK_VALUES = 12;
export const MAX_LINK_VALUE = 200;

// Every route only stages work: an ask waits for ↵, link values open the
// argument pills, and only a bare widget id runs (as a click on a board does).
export type ConchLink =
  | { kind: "open" }
  | { kind: "ask"; prompt: string; connection: string | null }
  | { kind: "widget"; widgetId: string; values: Record<string, string> }
  | { kind: "board"; boardId: string };

export type ConchLinkParse =
  | { ok: true; link: ConchLink }
  | { ok: false; reason: string };

const RECORD_ID = /^[A-Za-z0-9-]{1,100}$/;
const VALUE_KEY = /^[a-z][a-z0-9_]{0,31}(\.(from|to))?$/;
const SPACING = /[\t\n\r]/g;
// A leading > # or @ would switch the launcher into SQL, table or connection mode.
const MODE_PREFIX = /^[\s>#@]+/;
const DOT_SEGMENT = /\/(\.|%2e){1,2}(\/|$)/i;

const fail = (reason: string): ConchLinkParse => ({ ok: false, reason });
const ok = (link: ConchLink): ConchLinkParse => ({ link, ok: true });

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

// Engines differ on non-special schemes: some parse `conch://ask` with host
// "ask", others keep it as an opaque path "//ask".
const routeAndPath = (url: URL): { route: string; path: string } => {
  const rest = url.host
    ? `${url.host}${url.pathname}`
    : url.pathname.replace(/^\/\//, "");
  const slash = rest.indexOf("/");
  const route = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? "" : rest.slice(slash);
  return { path, route: route.toLowerCase() };
};

const duplicateKey = (params: URLSearchParams): string | null => {
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) {
      return key;
    }
    seen.add(key);
  }
  return null;
};

const codePoint = (hex: string): number => Number.parseInt(hex, 16);

// C0/C1 controls and bidi marks, embeddings, overrides and isolates, so the
// input shows exactly what will be sent.
const INVISIBLE_RANGES = [
  ["0000", "001F"],
  ["007F", "009F"],
  ["061C", "061C"],
  ["200E", "200F"],
  ["202A", "202E"],
  ["2066", "2069"],
].map(([from = "", to = ""]) => [codePoint(from), codePoint(to)] as const);

const isInvisible = (code: number): boolean =>
  INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to);

const visibleText = (text: string): string =>
  [...text].filter((char) => !isInvisible(char.codePointAt(0) ?? 0)).join("");

const cleanPrompt = (text: string): string =>
  visibleText(text.replace(SPACING, " ")).replace(MODE_PREFIX, "").trim();

const parseAsk = (path: string, params: URLSearchParams): ConchLinkParse => {
  if (path !== "" && path !== "/") {
    return fail("An ask link has no path.");
  }
  const raw = params.get("q");
  if (raw === null) {
    return fail("An ask link needs a question in q.");
  }
  const prompt = cleanPrompt(raw);
  if (prompt.length === 0 || prompt.length > MAX_LINK_PROMPT) {
    return fail(`The question must be 1 to ${MAX_LINK_PROMPT} characters.`);
  }
  const conn = params.get("conn")?.trim() ?? "";
  if (conn.length > MAX_LINK_CONNECTION) {
    return fail("The connection name is too long.");
  }
  return ok({ connection: conn || null, kind: "ask", prompt });
};

const recordIdOf = (path: string): string | null => {
  const id = path.slice(1);
  return path.startsWith("/") && RECORD_ID.test(id) ? id : null;
};

const parseValues = (
  params: URLSearchParams
): Record<string, string> | string => {
  const values: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of params) {
    count += 1;
    if (count > MAX_LINK_VALUES) {
      return `A link sets at most ${MAX_LINK_VALUES} inputs.`;
    }
    if (!VALUE_KEY.test(key)) {
      return `“${key.slice(0, 40)}” is not an input name.`;
    }
    if (value.length > MAX_LINK_VALUE) {
      return `The value for ${key} is too long.`;
    }
    values[key] = value;
  }
  return values;
};

const parseWidget = (path: string, params: URLSearchParams): ConchLinkParse => {
  const widgetId = recordIdOf(path);
  if (!widgetId) {
    return fail("A widget link needs one widget id.");
  }
  const values = parseValues(params);
  return typeof values === "string"
    ? fail(values)
    : ok({ kind: "widget", values, widgetId });
};

const parseBoard = (path: string): ConchLinkParse => {
  const boardId = recordIdOf(path);
  return boardId
    ? ok({ boardId, kind: "board" })
    : fail("A board link needs one board id.");
};

const routeLink = (url: URL): ConchLinkParse => {
  const { route, path } = routeAndPath(url);
  const params = url.searchParams;
  const duplicate = duplicateKey(params);
  if (duplicate) {
    return fail(`${duplicate.slice(0, 40)} appears twice.`);
  }
  switch (route) {
    case "":
    case "open": {
      return path === "" || path === "/"
        ? ok({ kind: "open" })
        : fail("Unknown link.");
    }
    case "ask": {
      return parseAsk(path, params);
    }
    case "widget": {
      return parseWidget(path, params);
    }
    case "board": {
      return parseBoard(path);
    }
    default: {
      return fail("Unknown link.");
    }
  }
};

export const parseConchLink = (raw: string): ConchLinkParse => {
  if (raw.length > MAX_LINK_LENGTH) {
    return fail("The link is too long.");
  }
  if (raw.includes("#")) {
    return fail("Links do not carry fragments.");
  }
  if (DOT_SEGMENT.test(raw.split("?")[0] ?? "")) {
    return fail("Links do not carry relative paths.");
  }
  const url = parseUrl(raw);
  if (!url || url.protocol !== `${CONCH_SCHEME}:`) {
    return fail("Not a Conch link.");
  }
  if (url.username || url.password || url.port) {
    return fail("Links do not carry credentials or ports.");
  }
  return routeLink(url);
};

const withQuery = (base: string, params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `${base}?${query}` : base;
};

export const askLink = (
  prompt: string,
  connectionName: string | null
): string => {
  const params = new URLSearchParams({ q: prompt });
  if (connectionName) {
    params.set("conn", connectionName);
  }
  return withQuery(`${CONCH_SCHEME}://ask`, params);
};

export const widgetLink = (
  widgetId: string,
  values: Record<string, string> = {}
): string =>
  withQuery(
    `${CONCH_SCHEME}://widget/${encodeURIComponent(widgetId)}`,
    new URLSearchParams(values)
  );

export const boardLink = (boardId: string): string =>
  `${CONCH_SCHEME}://board/${encodeURIComponent(boardId)}`;
