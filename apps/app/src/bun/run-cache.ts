import type { TabularResult } from "@conch/core";

export const RUN_CACHE_MAX_RUNS = 20;
export const RUN_CACHE_TTL_MS = 10 * 60_000;

interface CachedRun {
  ownerId: string;
  columns: string[];
  rows: unknown[][];
  at: number;
}

export interface CachedRow {
  ownerId: string;
  columns: string[];
  row: unknown[];
}

interface RunCacheOptions {
  now(): number;
  maxRuns?: number;
  ttlMs?: number;
}

// Row actions read their values from bun's own copy of what the launcher
// showed, so a renderer can only point at a row, never supply its values.
export const createRunCache = ({
  now,
  maxRuns = RUN_CACHE_MAX_RUNS,
  ttlMs = RUN_CACHE_TTL_MS,
}: RunCacheOptions) => {
  const runs = new Map<string, CachedRun>();

  const prune = (): void => {
    const cutoff = now() - ttlMs;
    for (const [runId, run] of runs) {
      if (run.at <= cutoff) {
        runs.delete(runId);
      }
    }
    while (runs.size > maxRuns) {
      const [oldest] = runs.keys();
      if (oldest === undefined) {
        return;
      }
      runs.delete(oldest);
    }
  };

  const live = (runId: string): CachedRun | null => {
    prune();
    return runs.get(runId) ?? null;
  };

  return {
    columnsFor(ownerId: string): string[] {
      prune();
      const latest = [...runs.values()].findLast(
        (run) => run.ownerId === ownerId
      );
      return latest?.columns ?? [];
    },

    record(runId: string, ownerId: string, result: TabularResult): void {
      runs.delete(runId);
      runs.set(runId, {
        at: now(),
        columns: result.columns.map((column) => column.name),
        ownerId,
        rows: result.rows,
      });
      prune();
    },

    rowAt(runId: string, rowIndex: number): CachedRow | null {
      const run = live(runId);
      const row = run?.rows[rowIndex];
      if (!(run && row)) {
        return null;
      }
      return { columns: run.columns, ownerId: run.ownerId, row };
    },
  };
};

export type RunCache = ReturnType<typeof createRunCache>;
