import type { DialectType } from "@conch/core";

import { statementCount } from "@conch/core";
import { classifyStandardSql } from "@conch/core/client";

import { serverCallIn } from "./server-calls.ts";
import {
  EXECUTABLE_COMMENT,
  lexersFor,
  stripLiterals,
  stripTrailingSemicolons,
} from "./sql-lex.ts";

export type ReadOnlyVerdict = { ok: true } | { ok: false; reason: string };

const ALLOWED_LEADING_KEYWORDS = new Set([
  "select",
  "with",
  "show",
  "describe",
  "desc",
  "explain",
  "values",
  "table",
]);

const FORBIDDEN_WORDS = [
  "insert",
  "update",
  "delete",
  "merge",
  "upsert",
  String.raw`replace\s+into`,
  "create",
  "drop",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "copy",
  "call",
  "exec",
  "execute",
  "attach",
  "detach",
  "vacuum",
  "set",
  "lock",
  "into",
  "load",
  "install",
  "commit",
  "rollback",
  "pragma",
  "pg_sleep",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "dblink",
];

// T-SQL runs a batch without semicolons, so a second statement can follow a
// SELECT. These reserved words start statements that cannot be rolled back or
// that read outside the database.
const TSQL_FORBIDDEN_WORDS = [
  "backup",
  "restore",
  "shutdown",
  "kill",
  "dbcc",
  "reconfigure",
  "checkpoint",
  "waitfor",
  "deny",
  "writetext",
  "updatetext",
  "bulk",
  "declare",
  "begin",
  String.raw`(?:dis|en)able\s+trigger`,
  "openrowset",
  "opendatasource",
  "openquery",
];

const wordPattern = (words: readonly string[]): RegExp =>
  new RegExp(String.raw`\b(${words.join("|")})\b`, "i");

const FORBIDDEN = wordPattern(FORBIDDEN_WORDS);
const FORBIDDEN_IN_TSQL = wordPattern([
  ...FORBIDDEN_WORDS,
  ...TSQL_FORBIDDEN_WORDS,
]);
const LEADING_WORD = /^[\s(]*([a-z_]+)/i;
const reject = (reason: string): ReadOnlyVerdict => ({ ok: false, reason });

const checkLexed = (code: string, forbiddenWords: RegExp): ReadOnlyVerdict => {
  const statement = stripTrailingSemicolons(code);
  if (!statement) {
    return reject("The statement is empty.");
  }
  if (statement.includes(";")) {
    return reject("Only one statement can run at a time.");
  }
  const leading = LEADING_WORD.exec(statement)?.[1]?.toLowerCase();
  if (!(leading && ALLOWED_LEADING_KEYWORDS.has(leading))) {
    const shown = leading ? leading.toUpperCase() : "an unknown keyword";
    return reject(`Only read-only queries can run here, not ${shown}.`);
  }
  const forbidden = forbiddenWords.exec(statement)?.[1];
  if (forbidden) {
    const word = forbidden.replaceAll(/\s+/g, " ").toUpperCase();
    return reject(`${word} is not allowed in a read-only query.`);
  }
  const destructive = classifyStandardSql(statement);
  if (destructive) {
    return reject(destructive.reason);
  }
  return { ok: true };
};

export const assertReadOnly = (
  sql: string,
  dialect: DialectType
): ReadOnlyVerdict => {
  if (EXECUTABLE_COMMENT.test(sql)) {
    return reject("Executable comments are not allowed.");
  }
  const forbiddenWords = dialect === "tsql" ? FORBIDDEN_IN_TSQL : FORBIDDEN;
  for (const lexer of lexersFor(dialect)) {
    const lexed = stripLiterals(sql, lexer);
    if (!lexed.ok) {
      return reject(lexed.reason);
    }
    const verdict = checkLexed(lexed.code, forbiddenWords);
    if (!verdict.ok) {
      return verdict;
    }
    const call = serverCallIn(lexed.names);
    if (call) {
      return reject(`${call}() is not allowed in a read-only query.`);
    }
  }
  if (dialect === "tsql" && statementCount(sql, dialect) !== 1) {
    return reject(
      "SQL Server runs a whole batch, so the query must parse as exactly one statement."
    );
  }
  return { ok: true };
};
