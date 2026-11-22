import { useCallback, useEffect, useEffectEvent, useRef } from "react";

interface Queued<P> {
  key: string;
  payload: P;
}

export interface RunQueueOptions<P> {
  max: number;
  start: (
    key: string,
    runId: string,
    payload: P,
    isCurrent: () => boolean
  ) => Promise<void>;
  cancel: (runId: string) => void;
}

// Runs keyed jobs with a concurrency cap. Queuing a key again supersedes it:
// a waiting copy is dropped and a running one is cancelled, so only the
// newest run of each key can report back as current.
export const useRunQueue = <P>({ max, start, cancel }: RunQueueOptions<P>) => {
  const queue = useRef<Queued<P>[]>([]);
  const inFlight = useRef(new Map<string, string>());

  const execute = useEffectEvent(async ({ key, payload }: Queued<P>) => {
    const runId = crypto.randomUUID();
    inFlight.current.set(key, runId);
    try {
      await start(
        key,
        runId,
        payload,
        () => inFlight.current.get(key) === runId
      );
    } finally {
      if (inFlight.current.get(key) === runId) {
        inFlight.current.delete(key);
      }
      pump();
    }
  });

  const pump = useEffectEvent(() => {
    while (inFlight.current.size < max && queue.current.length > 0) {
      const next = queue.current.shift();
      if (next) {
        execute(next);
      }
    }
  });

  const supersede = useEffectEvent((key: string) => {
    const running = inFlight.current.get(key);
    if (running) {
      inFlight.current.delete(key);
      cancel(running);
    }
  });

  const enqueue = useCallback((keys: readonly string[], payload: P) => {
    for (const key of keys) {
      supersede(key);
    }
    queue.current = [
      ...queue.current.filter((item) => !keys.includes(item.key)),
      ...keys.map((key) => ({ key, payload })),
    ];
    pump();
  }, []);

  const keepOnly = useCallback((keys: readonly string[]) => {
    queue.current = queue.current.filter((item) => keys.includes(item.key));
  }, []);

  const isBusy = useCallback(
    (key: string) =>
      inFlight.current.has(key) ||
      queue.current.some((item) => item.key === key),
    []
  );

  const stopAll = useEffectEvent(() => {
    queue.current = [];
    for (const runId of inFlight.current.values()) {
      cancel(runId);
    }
    inFlight.current.clear();
  });

  useEffect(() => () => stopAll(), []);

  return { enqueue, isBusy, keepOnly };
};
