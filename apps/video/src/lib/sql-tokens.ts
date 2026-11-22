export type SqlTokenKind =
  | "comment"
  | "function"
  | "keyword"
  | "number"
  | "plain"
  | "punctuation"
  | "string";

export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
  start: number;
}

const KEYWORDS = new Set([
  "and",
  "as",
  "by",
  "date",
  "delete",
  "desc",
  "from",
  "group",
  "interval",
  "join",
  "limit",
  "on",
  "or",
  "order",
  "select",
  "where",
  "withscores",
  "zrevrange",
]);

const TOKEN =
  /(--[^\n]*)|('(?:[^']|'')*'?|"[^"]*"?)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)(?=\()|([A-Za-z_$]\w*)|([(),.;:*=<>/+\-[\]{}]+)|(\s+)|(.)/g;

const kindOf = (match: RegExpExecArray): SqlTokenKind => {
  const [, comment, string, number, fn, word, punctuation] = match;
  if (comment !== undefined) {
    return "comment";
  }
  if (string !== undefined) {
    return "string";
  }
  if (number !== undefined) {
    return "number";
  }
  if (fn !== undefined) {
    return "function";
  }
  if (word !== undefined) {
    return KEYWORDS.has(word.toLowerCase()) ? "keyword" : "plain";
  }
  return punctuation === undefined ? "plain" : "punctuation";
};

export const tokenizeSqlLine = (line: string): SqlToken[] =>
  Array.from(line.matchAll(TOKEN), (match) => ({
    kind: kindOf(match),
    start: match.index,
    text: match[0],
  }));
