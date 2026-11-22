import type { TabularResult } from "./types.ts";

import { DbError } from "./error.ts";
import { flattenRecords } from "./flatten.ts";
import { parseSelectPath, select } from "./json-select.ts";

export interface ToTabularOptions {
  maxRows?: number;
  maxColumns?: number;
}

const MAX_CELL_CHARS = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : { value };

const recordsOf = (selected: unknown): Record<string, unknown>[] =>
  Array.isArray(selected) ? selected.map(recordOf) : [recordOf(selected)];

export const toTabular = (
  json: unknown,
  selectPath: string,
  { maxRows = 2000, maxColumns = 50 }: ToTabularOptions = {}
): TabularResult => {
  const parsed = parseSelectPath(selectPath);
  if (!parsed.ok) {
    throw new DbError("SOURCE_BAD_SELECT", parsed.error);
  }
  const selected = select(json, parsed.segments);
  if (selected === undefined) {
    throw new DbError(
      "SOURCE_EMPTY",
      `Nothing in the response matches ${selectPath}.`
    );
  }
  const records = recordsOf(selected);
  return flattenRecords(records.slice(0, maxRows), {
    isTruncated: records.length > maxRows,
    maxCellChars: MAX_CELL_CHARS,
    maxColumns,
  });
};
