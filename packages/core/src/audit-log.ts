import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RecordParser } from "./records.ts";

import { decryptLine, encryptLine } from "./crypto.ts";
import { ensureParentDir, pathExists, withFileLock } from "./fs-utils.ts";
import { actionsAuditPath } from "./paths.ts";

export const ZERO_HASH = "0".repeat(64);
const TAIL_CHUNK = 64 * 1024;

export type AuditVerification =
  | { ok: true; entries: number; archived: number }
  | { ok: false; brokenAt: number; entries: number; archived: number };

const ARCHIVE_PREFIX = "actions-audit-";
const ARCHIVE_SUFFIX = ".enc";

export const lineHash = (line: string): string =>
  createHash("sha256").update(line).digest("hex");

const dataLinesOf = (content: string): string[] =>
  content.split("\n").filter((line) => line.length > 0);

// Reads backwards in chunks so an append never loads the whole log.
const lastLineOf = async (filePath: string): Promise<string | null> => {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const handle = await fs.open(filePath, "r");
  try {
    const { size } = await handle.stat();
    let tail = "";
    let position = size;
    while (position > 0) {
      const length = Math.min(TAIL_CHUNK, position);
      position -= length;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, position);
      tail = buffer.toString("utf8") + tail;
      const trimmed = tail.replace(/\n+$/, "");
      const newline = trimmed.lastIndexOf("\n");
      if (newline !== -1) {
        return trimmed.slice(newline + 1);
      }
      if (position === 0) {
        return trimmed.length > 0 ? trimmed : null;
      }
    }
    return null;
  } finally {
    await handle.close();
  }
};

// Each line carries the SHA-256 of the encrypted line before it, so a
// removed or edited entry breaks the chain at that point.
export const appendAudit = async (entry: object): Promise<void> => {
  const filePath = actionsAuditPath();
  await ensureParentDir(filePath);
  await withFileLock(filePath, async () => {
    const previous = await lastLineOf(filePath);
    const prevHash = previous === null ? ZERO_HASH : lineHash(previous);
    const encrypted = await encryptLine(JSON.stringify({ ...entry, prevHash }));
    await fs.appendFile(filePath, `${encrypted}\n`, { mode: 0o600 });
  });
};

const readLines = async (filePath: string): Promise<string[]> => {
  if (!(await pathExists(filePath))) {
    return [];
  }
  return withFileLock(filePath, async () =>
    dataLinesOf(await fs.readFile(filePath, "utf8"))
  );
};

const decode = async (line: string): Promise<unknown> => {
  try {
    return JSON.parse(await decryptLine(line));
  } catch {
    return null;
  }
};

export const readAudit = async <T>(
  { limit, offset = 0 }: { limit: number; offset?: number },
  parse: RecordParser<T>
): Promise<T[]> => {
  const lines = await readLines(actionsAuditPath());
  const newest = lines.toReversed().slice(offset, offset + limit);
  const decoded = await Promise.all(newest.map(decode));
  return decoded.flatMap((raw) => {
    const parsed = parse(raw);
    return parsed === null ? [] : [parsed];
  });
};

const prevHashOf = (raw: unknown): unknown =>
  typeof raw === "object" && raw !== null
    ? (raw as { prevHash?: unknown }).prevHash
    : undefined;

const archivedLogs = async (): Promise<number> => {
  const dir = path.dirname(actionsAuditPath());
  if (!(await pathExists(dir))) {
    return 0;
  }
  const names = await fs.readdir(dir);
  return names.filter(
    (name) => name.startsWith(ARCHIVE_PREFIX) && name.endsWith(ARCHIVE_SUFFIX)
  ).length;
};

export const verifyAudit = async (): Promise<AuditVerification> => {
  const lines = await readLines(actionsAuditPath());
  const archived = await archivedLogs();
  let expected = ZERO_HASH;
  for (const [index, line] of lines.entries()) {
    const raw = await decode(line);
    if (prevHashOf(raw) !== expected) {
      return { archived, brokenAt: index, entries: lines.length, ok: false };
    }
    expected = lineHash(line);
  }
  return { archived, entries: lines.length, ok: true };
};

// A reset replaces the key, so the old log can no longer be read; it is set
// aside rather than deleted, and Activity reports that it exists.
export const archiveAudit = (stamp: Date): Promise<void> => {
  const filePath = actionsAuditPath();
  return withFileLock(filePath, async () => {
    if (!(await pathExists(filePath))) {
      return;
    }
    const name = `${ARCHIVE_PREFIX}${stamp.toISOString().replaceAll(":", "-")}${ARCHIVE_SUFFIX}`;
    await fs.rename(filePath, path.join(path.dirname(filePath), name));
  });
};
