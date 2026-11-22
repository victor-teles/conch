import type { DialectType } from "@conch/core";

export interface LexFlavor {
  backslashEscapes: boolean;
  hashComments: boolean;
  dashCommentNeedsSpace: boolean;
  dollarQuotes: boolean;
}

// Each engine lexes quotes and comments differently. A statement passes only
// when every flavor agrees, so a literal one engine reads as data can never
// hide code that another engine would execute.
export const FLAVORS: readonly LexFlavor[] = [
  {
    backslashEscapes: false,
    dashCommentNeedsSpace: false,
    dollarQuotes: true,
    hashComments: false,
  },
  {
    backslashEscapes: true,
    dashCommentNeedsSpace: true,
    dollarQuotes: false,
    hashComments: true,
  },
];

const DOLLAR_TAG = /^\$([A-Za-z_]\w*)?\$/;
const IDENTIFIER_CHAR = /\w/;
export const EXECUTABLE_COMMENT = /\/\*!/;
const WHITESPACE = /\s/;

const closingQuote = (
  sql: string,
  start: number,
  quote: string,
  backslashEscapes: boolean
): number => {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (backslashEscapes && char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      if (sql[index + 1] !== quote) {
        return index;
      }
      index += 2;
      continue;
    }
    index += 1;
  }
  return -1;
};

const lineEnd = (sql: string, start: number): number => {
  const end = sql.indexOf("\n", start);
  return end === -1 ? sql.length : end;
};

const isDashComment = (
  sql: string,
  index: number,
  flavor: LexFlavor
): boolean => {
  if (sql[index] !== "-" || sql[index + 1] !== "-") {
    return false;
  }
  if (!flavor.dashCommentNeedsSpace) {
    return true;
  }
  const after = sql[index + 2];
  return after === undefined || WHITESPACE.test(after);
};

const dollarQuoteEnd = (sql: string, start: number): number | null => {
  if (start > 0 && IDENTIFIER_CHAR.test(sql[start - 1] ?? "")) {
    return null;
  }
  const tag = DOLLAR_TAG.exec(sql.slice(start))?.[0];
  if (!tag) {
    return null;
  }
  const close = sql.indexOf(tag, start + tag.length);
  return close === -1 ? -1 : close + tag.length;
};

const QUOTED_IDENTIFIERS = new Set(['"', "`"]);
const COMMENT = " ";
const STRING = " '' ";
const IDENTIFIER = ' "" ';

// How an engine treats `/*` inside a block comment: Postgres and DuckDB
// count depth, MySQL and SQLite ignore it, and an engine we can't check
// against (SQL Server, the rest) refuses it.
export type CommentNesting = "nest" | "flat" | "refuse";

export interface Lexer extends LexFlavor {
  bracketIdentifiers: boolean;
  nesting: CommentNesting;
}

interface Literal {
  end: number;
  code: string;
  name: string;
}

const UNTERMINATED = -1;
const NESTED = -2;
const UNICODE_ESCAPED = -3;

// Postgres decodes U&"\0070g_read_file" to a name no word check can see.
const isUnicodeEscape = (sql: string, index: number): boolean =>
  (sql[index] === "u" || sql[index] === "U") &&
  sql[index + 1] === "&" &&
  (sql[index + 2] === '"' || sql[index + 2] === "'") &&
  !IDENTIFIER_CHAR.test(sql[index - 1] ?? "");

const past = (end: number, width: number): number =>
  end === UNTERMINATED ? UNTERMINATED : end + width;

// Left to right, `/*` and `*/` taken as two-character tokens, so the `*` of
// an opener can never also close it (`/*/` stays open).
const blockCommentEnd = (
  sql: string,
  index: number,
  nesting: CommentNesting
): number => {
  let depth = 1;
  let at = index + 2;
  while (at < sql.length) {
    if (sql.startsWith("*/", at)) {
      depth -= 1;
      at += 2;
      if (depth === 0) {
        return at;
      }
      continue;
    }
    if (nesting !== "flat" && sql.startsWith("/*", at)) {
      if (nesting === "refuse") {
        return NESTED;
      }
      depth += 1;
      at += 2;
      continue;
    }
    at += 1;
  }
  return UNTERMINATED;
};

const identifierName = (text: string): string =>
  ` ${text.toLowerCase().replaceAll(/[^a-z0-9_$]/g, "_")} `;

const quotedName = (sql: string, index: number, end: number): string => {
  if (end === UNTERMINATED) {
    return "";
  }
  const quote = sql[index] ?? "";
  const close = quote === "[" ? "]" : quote;
  return identifierName(
    sql.slice(index + 1, end - 1).replaceAll(close + close, close)
  );
};

const literalAt = (
  sql: string,
  index: number,
  lexer: Lexer
): Literal | null => {
  const char = sql[index] ?? "";
  if (isUnicodeEscape(sql, index)) {
    return { code: "", end: UNICODE_ESCAPED, name: "" };
  }
  if (char === "/" && sql[index + 1] === "*") {
    return {
      code: COMMENT,
      end: blockCommentEnd(sql, index, lexer.nesting),
      name: COMMENT,
    };
  }
  if (
    isDashComment(sql, index, lexer) ||
    (lexer.hashComments && char === "#")
  ) {
    return { code: COMMENT, end: lineEnd(sql, index), name: COMMENT };
  }
  if (char === "'") {
    const end = past(closingQuote(sql, index, char, lexer.backslashEscapes), 1);
    return { code: STRING, end, name: STRING };
  }
  if (QUOTED_IDENTIFIERS.has(char)) {
    const escapes = lexer.backslashEscapes && char !== "`";
    const end = past(closingQuote(sql, index, char, escapes), 1);
    return { code: IDENTIFIER, end, name: quotedName(sql, index, end) };
  }
  if (char === "[" && lexer.bracketIdentifiers) {
    const end = past(closingQuote(sql, index, "]", false), 1);
    return { code: IDENTIFIER, end, name: quotedName(sql, index, end) };
  }
  if (char === "$" && lexer.dollarQuotes) {
    const end = dollarQuoteEnd(sql, index);
    return end === null ? null : { code: STRING, end, name: STRING };
  }
  return null;
};

// `code` blanks literals and quoted identifiers; `names` keeps quoted
// identifiers as plain words, so "pg_catalog"."pg_read_file" still reads
// as a call to pg_read_file.
export type LexResult =
  | { ok: true; code: string; names: string }
  | { ok: false; reason: string };

const UNTERMINATED_REASON =
  "The statement has an unterminated string or comment.";
const NESTED_REASON = "Comments inside comments are not allowed.";
const UNICODE_REASON = "Unicode-escaped names and strings are not allowed.";

export const stripLiterals = (sql: string, lexer: Lexer): LexResult => {
  let code = "";
  let names = "";
  let index = 0;
  while (index < sql.length) {
    const literal = literalAt(sql, index, lexer);
    if (!literal) {
      code += sql[index];
      names += sql[index];
      index += 1;
      continue;
    }
    if (literal.end === NESTED) {
      return { ok: false, reason: NESTED_REASON };
    }
    if (literal.end === UNICODE_ESCAPED) {
      return { ok: false, reason: UNICODE_REASON };
    }
    if (literal.end === UNTERMINATED) {
      return { ok: false, reason: UNTERMINATED_REASON };
    }
    code += literal.code;
    names += literal.name;
    index = literal.end;
  }
  return { code, names, ok: true };
};

export const stripTrailingSemicolons = (sql: string): string =>
  sql.trim().replace(/;[\s;]*$/, "");

const NESTING: Partial<Record<DialectType, CommentNesting>> = {
  duckdb: "nest",
  mysql: "flat",
  postgresql: "nest",
  sqlite: "flat",
};

// T-SQL is the only engine that quotes identifiers in brackets.
export const lexersFor = (dialect: DialectType): Lexer[] =>
  FLAVORS.map((flavor) => ({
    ...flavor,
    bracketIdentifiers: dialect === "tsql",
    nesting: NESTING[dialect] ?? "refuse",
  }));
