import { describe, expect, it } from "vitest";

import { createAskLocks, createClientLimits } from "./limits.ts";

describe("createClientLimits", () => {
  it("allows two calls at once and frees a slot on release", () => {
    const limits = createClientLimits(() => 0);
    const first = limits.acquire();
    const second = limits.acquire();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(limits.acquire()).toBeNull();
    first?.();
    first?.();
    expect(limits.acquire()).not.toBeNull();
    expect(limits.acquire()).toBeNull();
  });

  it("allows thirty calls in a sliding minute", () => {
    let now = 0;
    const limits = createClientLimits(() => now, { concurrent: 100 });
    for (let call = 0; call < 30; call += 1) {
      now = call * 1000;
      limits.acquire()?.();
    }
    expect(limits.acquire()).toBeNull();
    now = 60_000;
    expect(limits.acquire()).not.toBeNull();
    expect(limits.acquire()).toBeNull();
  });
});

describe("createAskLocks", () => {
  it("runs one agent ask per connection", () => {
    const locks = createAskLocks();
    const release = locks.tryLock("c1");
    expect(release).not.toBeNull();
    expect(locks.tryLock("c1")).toBeNull();
    expect(locks.tryLock("c2")).not.toBeNull();
    release?.();
    expect(locks.tryLock("c1")).not.toBeNull();
  });
});
