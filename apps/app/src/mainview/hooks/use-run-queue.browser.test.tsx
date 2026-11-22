import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-hook";

import { useRunQueue } from "./use-run-queue";

const setup = () => {
  const pending = new Map<string, () => void>();
  const current = new Map<string, () => boolean>();
  const start = vi.fn(
    (
      key: string,
      runId: string,
      _payload: string,
      isCurrent: () => boolean
    ) => {
      const { promise, resolve } = Promise.withResolvers<void>();
      pending.set(runId, resolve);
      current.set(key, isCurrent);
      return promise;
    }
  );
  const cancel = vi.fn();
  const hook = renderHook(() => useRunQueue({ cancel, max: 4, start }));
  return { cancel, current, hook, pending, start };
};

describe("useRunQueue", () => {
  it("runs at most four keys and starts the next as one settles", async () => {
    const { hook, pending, start } = setup();
    hook.result.current.enqueue(["a", "b", "c", "d", "e"], "p");
    expect(start).toHaveBeenCalledTimes(4);
    expect(hook.result.current.isBusy("e")).toBeTruthy();
    const [first] = pending.values();
    first?.();
    await expect.poll(() => start.mock.calls.length).toBe(5);
    expect(start.mock.calls.at(-1)?.[0]).toBe("e");
  });

  it("cancels a running key that is queued again and keeps only the newest current", () => {
    const { cancel, current, hook, start } = setup();
    hook.result.current.enqueue(["a"], "first");
    const firstRun = String(start.mock.calls[0]?.[1]);
    const stale = current.get("a");
    hook.result.current.enqueue(["a"], "second");
    expect(cancel).toHaveBeenCalledWith(firstRun);
    expect(stale?.()).toBeFalsy();
    expect(current.get("a")?.()).toBeTruthy();
  });

  it("drops queued keys it is told to keep out", () => {
    const { hook, start } = setup();
    hook.result.current.enqueue(["a", "b", "c", "d", "e"], "p");
    hook.result.current.keepOnly(["a"]);
    expect(hook.result.current.isBusy("e")).toBeFalsy();
    expect(start).toHaveBeenCalledTimes(4);
  });

  it("cancels every run in flight on unmount", () => {
    const { cancel, hook } = setup();
    hook.result.current.enqueue(["a", "b"], "p");
    hook.unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
