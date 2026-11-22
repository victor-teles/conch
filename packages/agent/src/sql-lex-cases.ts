import type { DialectType } from "@conch/core";

import { assertReadOnly } from "./read-only-guard.ts";
import { lexersFor, stripLiterals } from "./sql-lex.ts";

const FRAGMENTS = [
  "/*",
  "*/",
  "/*/",
  "*/*",
  "/**/",
  "'",
  "''",
  '"',
  "$$",
  "$t$",
  "--",
  "\n",
  " ",
  "x",
  "E'",
  "\\",
  ";",
  "'*/",
  "*/'",
  "/* /*",
];
const OPENERS = [
  "/*",
  "/*/",
  "/**/",
  "/* /*",
  "$$",
  "$t$",
  "'",
  "E'",
  '"',
  " ",
];
const CLOSERS = ["*/", "'*/", "*/'", "$$", "$t$", "'", '"', "\n", " "];
const TAILS = ["", "--", "--'", "'", "*/", "$$", "*/ */"];
const PROBES = [", 42 AS conch_probe ", "; SELECT 42 AS conch_probe "];
const RANDOM_CASES = 6000;

const MODULUS = 2_147_483_647;

// A Park–Miller generator: the same cases on every run.
const random = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 48_271) % MODULUS;
    return state / MODULUS;
  };
};

const pick = (next: () => number, count: number): string =>
  Array.from(
    { length: count },
    () => FRAGMENTS[Math.floor(next() * FRAGMENTS.length)] ?? ""
  ).join("");

// Test support for the guard-vs-engine differential tests in the drivers:
// every case hides a probe column (or a second statement) behind a mix of
// fragments that change how quotes, comments and statements are read.
export const differentialSqlCases = (): string[] => {
  const cases: string[] = [];
  for (const probe of PROBES) {
    for (const before of ["", ...FRAGMENTS]) {
      for (const after of ["", ...FRAGMENTS]) {
        cases.push(`SELECT 1 AS a ${before}${probe}${after}`);
      }
    }
  }
  for (const probe of PROBES) {
    for (const first of OPENERS) {
      for (const second of OPENERS) {
        for (const close of CLOSERS) {
          for (const after of TAILS) {
            cases.push(
              `SELECT 1 AS a ${first}${second}${close}${probe}${after}`
            );
          }
        }
      }
    }
  }
  const next = random(19);
  for (let index = 0; index < RANDOM_CASES; index += 1) {
    const probe = PROBES[index % PROBES.length] ?? "";
    const before = pick(next, 1 + Math.floor(next() * 6));
    const after = pick(next, Math.floor(next() * 3));
    cases.push(`SELECT 1 AS a ${before}${probe}${after}`);
  }
  return cases;
};

export interface EngineReading {
  ran: boolean;
  sawProbe: boolean;
  statements: number;
}

export interface DifferentialResult {
  cases: number;
  ran: number;
  accepted: number;
  disagreements: string[];
}

const guardSeesProbe = (sql: string, dialect: DialectType): boolean =>
  lexersFor(dialect).some((lexer) => {
    const lexed = stripLiterals(sql, lexer);
    return lexed.ok && lexed.code.includes("conch_probe");
  });

// A disagreement is SQL the guard accepts while the engine runs more than
// one statement, or runs the probe the guard read as a string or comment.
export const compareGuardWithEngine = async (
  dialect: DialectType,
  read: (sql: string) => Promise<EngineReading>
): Promise<DifferentialResult> => {
  const cases = differentialSqlCases();
  const result: DifferentialResult = {
    accepted: 0,
    cases: cases.length,
    disagreements: [],
    ran: 0,
  };
  for (const sql of cases) {
    const reading = await read(sql);
    if (reading.ran) {
      result.ran += 1;
    }
    if (!assertReadOnly(sql, dialect).ok) {
      continue;
    }
    result.accepted += 1;
    const hidden = reading.sawProbe && !guardSeesProbe(sql, dialect);
    if (reading.statements > 1 || hidden) {
      result.disagreements.push(sql);
    }
  }
  return result;
};
