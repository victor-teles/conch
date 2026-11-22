import type { DialectType, WriteKind } from "@conch/core";

import { classifyWriteAst, WRITE_AST_DIALECTS } from "@conch/core";
import { maskTemplateInputs, tokenizeSqlTemplate } from "@conch/core/client";

import { serverCallIn } from "./server-calls.ts";
import {
  EXECUTABLE_COMMENT,
  lexersFor,
  stripLiterals,
  stripTrailingSemicolons,
} from "./sql-lex.ts";

export type GuardedWriteVerdict =
  | { ok: true; kind: WriteKind; table: string }
  | { ok: false; reason: string };

const LEADING_WORD = /^\s*([a-z_]+)/i;

const SHAPES: Record<WriteKind, RegExp> = {
  delete: /^\s*delete\s+from\b/i,
  insert: /^\s*insert\s+into\b/i,
  update: /^\s*update\b/i,
};

// Words that may appear at most this many times, by statement kind: the
// keywords the statement itself needs, and nothing more.
const COUNTED_WORDS: Record<WriteKind, Record<string, number>> = {
  delete: { from: 1, into: 0, set: 0, values: 0, where: 1 },
  insert: { from: 0, into: 1, set: 0, values: 1, where: 0 },
  update: { from: 0, into: 0, set: 1, values: 0, where: 1 },
};

const FORBIDDEN_WORDS = [
  "select",
  "join",
  "union",
  "intersect",
  "except",
  "with",
  "using",
  "merge",
  "replace\\s+into",
  "upsert",
  "conflict",
  "duplicate",
  "returning\\s+into",
  "create",
  "drop",
  "alter",
  "truncate",
  "rename",
  "grant",
  "revoke",
  "deny",
  "comment",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "lock",
  "call",
  "exec",
  "execute",
  "do",
  "copy",
  "load",
  "attach",
  "detach",
  "pragma",
  "vacuum",
  "outfile",
  "dumpfile",
  "load_file",
  "pg_sleep",
  "sleep",
  "benchmark",
  "dblink",
  "lo_import",
  "lo_export",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_terminate_backend",
  "xp_cmdshell",
  "openrowset",
  "opendatasource",
  "openquery",
  "declare",
  "waitfor",
  "backup",
  "restore",
  "shutdown",
  "kill",
  "dbcc",
  "bulk",
  "install",
];

// Whole families of server functions that act outside the row being written:
// admin, file, large-object, cross-database and stored-procedure calls.
const FORBIDDEN_PREFIXES = ["pg_", "lo_", "xp_", "sp_", "dblink", "sys_"];
const FORBIDDEN_FUNCTIONS = [
  "set_config",
  "load_extension",
  "readfile",
  "writefile",
  "getenv",
];

const FORBIDDEN_CALL = new RegExp(
  String.raw`\b((?:${FORBIDDEN_PREFIXES.join("|")})\w*|${FORBIDDEN_FUNCTIONS.join("|")})\b`,
  "i"
);

const FORBIDDEN = new RegExp(
  String.raw`\b(${FORBIDDEN_WORDS.join("|")})\b`,
  "i"
);

const reject = (reason: string): GuardedWriteVerdict => ({ ok: false, reason });

const kindOf = (statement: string): WriteKind | null => {
  const leading = LEADING_WORD.exec(statement)?.[1]?.toLowerCase();
  return leading === "insert" || leading === "update" || leading === "delete"
    ? leading
    : null;
};

const TOKEN = /[()]|[a-z_][a-z0-9_$]*/gi;

// Statement keywords only count outside parentheses, so a call such as
// extract(year FROM day) doesn't read as a second FROM.
const wordCounts = (statement: string): Map<string, number> => {
  const counts = new Map<string, number>();
  let depth = 0;
  for (const match of statement.matchAll(TOKEN)) {
    const token = match[0].toLowerCase();
    if (token === "(" || token === ")") {
      depth += token === "(" ? 1 : -1;
      continue;
    }
    if (depth === 0) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
};

const checkLexed = (
  code: string,
  names: string
): { ok: true; kind: WriteKind } | { ok: false; reason: string } => {
  const statement = stripTrailingSemicolons(code);
  if (!statement) {
    return reject("The statement is empty.");
  }
  if (statement.includes(";")) {
    return reject("Only one statement can run at a time.");
  }
  const kind = kindOf(statement);
  if (!kind) {
    return reject("A write action is one INSERT, UPDATE or DELETE.");
  }
  if (!SHAPES[kind].test(statement)) {
    return reject(
      kind === "insert"
        ? "Write INSERT INTO table (columns) VALUES (…)."
        : "Write DELETE FROM table WHERE …."
    );
  }
  const forbidden =
    FORBIDDEN.exec(names)?.[1] ??
    FORBIDDEN_CALL.exec(names)?.[1] ??
    serverCallIn(names);
  if (forbidden) {
    const word = forbidden.replaceAll(/\s+/g, " ").toUpperCase();
    return reject(`${word} isn't allowed in a write action.`);
  }
  const counts = wordCounts(statement);
  for (const [word, limit] of Object.entries(COUNTED_WORDS[kind])) {
    const seen = counts.get(word) ?? 0;
    if (seen > limit) {
      return reject(
        limit === 0
          ? `${word.toUpperCase()} isn't allowed in this ${kind.toUpperCase()}.`
          : `${word.toUpperCase()} can appear only once.`
      );
    }
    if (word === "where" && limit === 1 && seen === 0) {
      return reject(
        `${kind.toUpperCase()} needs a WHERE clause that uses an input.`
      );
    }
  }
  return { kind, ok: true };
};

const PAREN_DEPTH: Record<string, number> = { "(": 1, ")": -1 };

// The statement's own WHERE must use an input, so WHERE 1=1 or WHERE true
// can never match a whole table.
const whereUsesInput = (template: string, dialect: DialectType): boolean => {
  let depth = 0;
  let inWhere = false;
  for (const segment of tokenizeSqlTemplate(template, dialect)) {
    if (segment.kind === "placeholder") {
      if (inWhere) {
        return true;
      }
      continue;
    }
    if (segment.kind !== "code") {
      continue;
    }
    for (const token of segment.text.matchAll(/[()]|[a-z_]+/gi)) {
      const text = token[0].toLowerCase();
      depth += PAREN_DEPTH[text] ?? 0;
      if (depth === 0 && text === "where") {
        inWhere = true;
      } else if (depth === 0 && text === "returning") {
        inWhere = false;
      }
    }
  }
  return false;
};

const supportedDialect = (dialect: DialectType): boolean =>
  (WRITE_AST_DIALECTS as readonly DialectType[]).includes(dialect);

// The parse tree sees each input as this column, so its WHERE checks can
// tell an input from a literal.
const INPUT_MARKER = "conch_bound_input";

const masked = (
  template: string,
  dialect: DialectType,
  mask: string
): string | null => {
  try {
    return maskTemplateInputs(template, dialect, mask);
  } catch {
    return null;
  }
};

export const assertGuardedWrite = (
  template: string,
  dialect: DialectType
): GuardedWriteVerdict => {
  if (!supportedDialect(dialect)) {
    return reject("Write actions aren't available for this database.");
  }
  const sql = masked(template, dialect, "NULL");
  if (template.toLowerCase().includes(INPUT_MARKER)) {
    return reject(`${INPUT_MARKER} is a reserved name.`);
  }
  if (sql === null) {
    return reject(
      "The statement has an unterminated string, or an input inside a string or comment."
    );
  }
  if (EXECUTABLE_COMMENT.test(sql)) {
    return reject("Executable comments are not allowed.");
  }
  let kind: WriteKind | null = null;
  for (const lexer of lexersFor(dialect)) {
    const lexed = stripLiterals(sql, lexer);
    if (!lexed.ok) {
      return reject(lexed.reason);
    }
    const verdict = checkLexed(lexed.code, lexed.names);
    if (!verdict.ok) {
      return verdict;
    }
    if (kind && verdict.kind !== kind) {
      return reject("The statement reads differently across engines.");
    }
    ({ kind } = verdict);
  }
  if (!kind) {
    return reject("The statement is empty.");
  }
  if (kind !== "insert" && !whereUsesInput(template, dialect)) {
    return reject(
      `${kind.toUpperCase()}'s WHERE must compare against an input, like WHERE id = {{id}}.`
    );
  }
  const structure = classifyWriteAst(
    masked(template, dialect, INPUT_MARKER) ?? sql,
    dialect,
    INPUT_MARKER
  );
  if (!structure.ok) {
    return structure;
  }
  if (structure.kind !== kind) {
    return reject("The statement's structure doesn't match its keyword.");
  }
  return structure;
};
