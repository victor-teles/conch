export const MAX_CONCURRENT_CALLS = 2;
export const MAX_CALLS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export type Release = () => void;

export interface ClientLimits {
  acquire(): Release | null;
}

export const createClientLimits = (
  now: () => number,
  { concurrent = MAX_CONCURRENT_CALLS, perMinute = MAX_CALLS_PER_MINUTE } = {}
): ClientLimits => {
  let running = 0;
  let starts: number[] = [];
  return {
    acquire() {
      const at = now();
      starts = starts.filter((started) => at - started < WINDOW_MS);
      if (running >= concurrent || starts.length >= perMinute) {
        return null;
      }
      running += 1;
      starts.push(at);
      let released = false;
      return () => {
        if (!released) {
          released = true;
          running -= 1;
        }
      };
    },
  };
};

export interface AskLocks {
  tryLock(connectionId: string): Release | null;
}

export const createAskLocks = (): AskLocks => {
  const held = new Set<string>();
  return {
    tryLock(connectionId) {
      if (held.has(connectionId)) {
        return null;
      }
      held.add(connectionId);
      return () => {
        held.delete(connectionId);
      };
    },
  };
};
