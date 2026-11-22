import fs from "node:fs/promises";

import type { RecordParser } from "./records.ts";

import { decryptLine, encryptLine } from "./crypto.ts";
import {
  atomicWrite,
  ensureParentDir,
  pathExists,
  unlinkIfExists,
  withFileLock,
} from "./fs-utils.ts";
import { mcpAuditPath, mcpSettingsPath } from "./paths.ts";

export interface StoredMcpSettings {
  version: 1;
  enabled: boolean;
  token: string;
  exposedConnectionIds: string[];
  rowLimit: number;
}

export const MCP_AUDIT_KEEP = 1000;
export const MCP_AUDIT_TRIM_AT = 2000;
const TOKEN_BYTES = 32;

export const newMcpToken = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))).toString(
    "base64url"
  );

export const defaultMcpSettings = (): StoredMcpSettings => ({
  enabled: false,
  exposedConnectionIds: [],
  rowLimit: 100,
  token: newMcpToken(),
  version: 1,
});

const writeSettings = async (settings: StoredMcpSettings): Promise<void> => {
  const filePath = mcpSettingsPath();
  await ensureParentDir(filePath);
  await atomicWrite(filePath, await encryptLine(JSON.stringify(settings)));
};

const readStored = async (filePath: string): Promise<unknown> => {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const raw = await fs.readFile(filePath, "utf8");
  const content = raw.trim();
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(await decryptLine(content));
  } catch (error) {
    console.warn(`[mcp] ${filePath} is unreadable (${String(error)})`);
    return null;
  }
};

// An unreadable or invalid file falls back to fresh settings, which are off.
export const readMcpSettings = <T extends StoredMcpSettings>(
  parse: RecordParser<T>
): Promise<StoredMcpSettings> =>
  withFileLock(mcpSettingsPath(), async () => {
    const parsed = parse(await readStored(mcpSettingsPath()));
    if (parsed) {
      return parsed;
    }
    const fresh = defaultMcpSettings();
    await writeSettings(fresh);
    return fresh;
  });

export const writeMcpSettings = (settings: StoredMcpSettings): Promise<void> =>
  withFileLock(mcpSettingsPath(), () => writeSettings(settings));

const dataLinesOf = (content: string): string[] =>
  content.split("\n").filter((line) => line.length > 0);

export const appendMcpAudit = async (entry: object): Promise<void> => {
  const filePath = mcpAuditPath();
  await ensureParentDir(filePath);
  const encrypted = await encryptLine(JSON.stringify(entry));
  await withFileLock(filePath, async () => {
    await fs.appendFile(filePath, `${encrypted}\n`);
    const lines = dataLinesOf(await fs.readFile(filePath, "utf8"));
    if (lines.length > MCP_AUDIT_TRIM_AT) {
      await atomicWrite(
        filePath,
        `${lines.slice(-MCP_AUDIT_KEEP).join("\n")}\n`
      );
    }
  });
};

const decodeEntry = async <T>(
  line: string,
  parse: RecordParser<T>
): Promise<T | null> => {
  try {
    return parse(JSON.parse(await decryptLine(line)));
  } catch {
    return null;
  }
};

export const listMcpAudit = async <T>(
  limit: number,
  parse: RecordParser<T>
): Promise<T[]> => {
  const filePath = mcpAuditPath();
  if (!(await pathExists(filePath))) {
    return [];
  }
  const lines = await withFileLock(filePath, async () =>
    dataLinesOf(await fs.readFile(filePath, "utf8"))
  );
  const newest = lines.toReversed().slice(0, limit);
  const decoded = await Promise.all(
    newest.map((line) => decodeEntry(line, parse))
  );
  return decoded.filter((entry): entry is Awaited<T> => entry !== null);
};

export const clearMcpAudit = (): Promise<void> =>
  withFileLock(mcpAuditPath(), () => unlinkIfExists(mcpAuditPath()));
