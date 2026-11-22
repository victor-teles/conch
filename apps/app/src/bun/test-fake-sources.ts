import type { HttpEndpointConfig, McpServerConfig } from "@conch/rpc";

import { createMcpClientManager } from "./mcp-clients.ts";
import { createFixtureMcp, STRIPE_SERVER } from "./test-mcp-fixture.ts";

export const STATUS_ENDPOINT: HttpEndpointConfig = {
  auth: {
    kind: "header",
    name: "Authorization",
    value: "Bearer status_secret_4242",
  },
  baseUrl: "https://status.example.com/api",
  createdAt: "2026-11-20T00:00:00.000Z",
  id: "status",
  name: "Status API",
  updatedAt: "2026-11-20T00:00:00.000Z",
};

export interface FakeSourceOptions {
  servers?: McpServerConfig[];
  endpoints?: HttpEndpointConfig[];
  respond?: (url: URL) => unknown;
}

const memoryStore = <T extends { id: string }>(initial: readonly T[]) => {
  const items = new Map(initial.map((item) => [item.id, item]));
  return {
    get: (id: string) => {
      const settled = items.get(id) ?? null;
      return Promise.resolve(settled);
    },
    items,
    list: () => {
      const settled = [...items.values()];
      return Promise.resolve(settled);
    },
    remove: (id: string) => {
      items.delete(id);
      return Promise.resolve();
    },
    save: (item: T) => {
      items.set(item.id, item);
      return Promise.resolve(item);
    },
  };
};

export const fakeSources = (options: FakeSourceOptions = {}) => {
  const clock = { now: 0 };
  const fixture = createFixtureMcp();
  const servers = memoryStore(options.servers ?? [STRIPE_SERVER]);
  const endpoints = memoryStore(options.endpoints ?? [STATUS_ENDPOINT]);
  const requests: { url: string; endpoint: string }[] = [];
  const mcp = createMcpClientManager({
    clearTimer: clearTimeout,
    connect: fixture.connect,
    now: () => clock.now,
    servers,
    setTimer: (run, ms) => {
      const handle = setTimeout(run, ms);
      handle.unref();
      return handle;
    },
  });
  const fetchJson = (endpoint: HttpEndpointConfig, url: URL) => {
    requests.push({ endpoint: endpoint.name, url: url.toString() });
    return Promise.resolve(
      options.respond?.(url) ?? { incidents: [{ id: 1, state: "open" }] }
    );
  };
  return { clock, endpoints, fetchJson, fixture, mcp, requests, servers };
};
