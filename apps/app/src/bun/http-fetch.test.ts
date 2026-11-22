// @vitest-environment node
import type { HttpEndpointConfig } from "@conch/rpc";

import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACTION_RESPONSE_BYTES,
  fetchJson,
  probeHttp,
  requestJson,
} from "./http-fetch.ts";

const SECRET = "Bearer fixture-secret-7777";
const seen: {
  path: string;
  method: string;
  headers: Record<string, unknown>;
  body: string;
}[] = [];

const server = createServer(async (request, response) => {
  const path = request.url ?? "/";
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
  }
  seen.push({
    body,
    headers: request.headers,
    method: request.method ?? "",
    path,
  });
  if (path === "/api/refunds") {
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "re_1", received: JSON.parse(body) }));
  } else if (path === "/api/echo") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ seen: String(request.headers.authorization) })
    );
  } else if (path === "/api/echo-text") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(`you sent ${String(request.headers.authorization)}`);
  } else if (path === "/api/empty") {
    response.writeHead(204);
    response.end();
  } else if (path === "/api/text") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("queued");
  } else if (path.startsWith("/api/ok")) {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ data: [{ id: 1 }] }));
  } else if (path === "/api/vnd") {
    response.writeHead(200, { "content-type": "application/vnd.api+json" });
    response.end('{"data":[]}');
  } else if (path === "/api/redirect") {
    response.writeHead(302, { location: "https://evil.example.com/steal" });
    response.end();
  } else if (path === "/api/fail") {
    response.writeHead(500, { "content-type": "text/plain" });
    response.end(
      `boom; you sent ${String(request.headers.authorization)} ${"x".repeat(400)}`
    );
  } else if (path === "/api/html") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html></html>");
  } else if (path === "/api/declared-huge") {
    response.writeHead(200, {
      "content-length": String(6 * 1024 * 1024),
      "content-type": "application/json",
    });
    response.end();
  } else if (path === "/api/streamed-huge") {
    response.writeHead(200, { "content-type": "application/json" });
    const chunk = "x".repeat(1024 * 1024);
    for (let index = 0; index < 6; index += 1) {
      response.write(chunk);
    }
    response.end();
  } else if (path === "/api/bad-json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{nope");
  } else if (path === "/api/slow") {
    setTimeout(() => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    }, 2000);
  } else {
    response.writeHead(404);
    response.end();
  }
});

const fixture = { base: "" };

const endpoint = (): HttpEndpointConfig => ({
  auth: { kind: "header", name: "Authorization", value: SECRET },
  baseUrl: `${fixture.base}/api`,
  createdAt: "",
  id: "e1",
  name: "Status API",
  updatedAt: "",
});

const get = (path: string, signal = new AbortController().signal) =>
  fetchJson(endpoint(), new URL(`${fixture.base}/api/${path}`), signal);

describe("http fetch", () => {
  beforeAll(async () => {
    const listening = Promise.withResolvers<void>();
    server.listen(0, "127.0.0.1", listening.resolve);
    await listening.promise;
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("The fixture server has no port.");
    }
    fixture.base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    const closed = Promise.withResolvers<void>();
    server.close(() => closed.resolve());
    await closed.promise;
  });

  describe("fetchJson", () => {
    it("sends a GET with the auth header and Accept, and parses JSON", async () => {
      await expect(get("ok?limit=2")).resolves.toStrictEqual({
        data: [{ id: 1 }],
      });
      expect(seen.at(-1)).toMatchObject({
        headers: { accept: "application/json", authorization: SECRET },
        path: "/api/ok?limit=2",
      });
      await expect(get("vnd")).resolves.toStrictEqual({ data: [] });
    });

    it("never follows a redirect and names the target origin", async () => {
      await expect(get("redirect")).rejects.toMatchObject({
        code: "SOURCE_FAILED",
        message:
          "Status API redirected to https://evil.example.com. Update the endpoint's base URL instead.",
      });
      expect(seen.filter((item) => item.path.includes("steal"))).toHaveLength(
        0
      );
    });

    it("reports server errors with the status, the body clipped and the secret scrubbed", async () => {
      await expect(get("fail")).rejects.toMatchObject({
        code: "SOURCE_FAILED",
        message: expect.stringMatching(
          /^Status API answered 500: boom; you sent ••• x{200,}…$/
        ),
      });
    });

    it.each([
      [
        "html",
        "SOURCE_NOT_DATA",
        "Status API answered with text/html, not JSON.",
      ],
      ["bad-json", "SOURCE_NOT_DATA", "Status API sent invalid JSON."],
      [
        "declared-huge",
        "SOURCE_TOO_LARGE",
        "The response is larger than 5 MB.",
      ],
      [
        "streamed-huge",
        "SOURCE_TOO_LARGE",
        "The response is larger than 5 MB.",
      ],
    ])("refuses %s", async (path, code, message) => {
      await expect(get(path)).rejects.toMatchObject({ code, message });
    });

    it("stops a slow response when cancelled", async () => {
      const controller = new AbortController();
      const pending = get("slow", controller.signal);
      setTimeout(() => controller.abort(), 50);
      await expect(pending).rejects.toThrow(/abort/i);
    });
  });

  describe("requestJson", () => {
    const send = (
      method: "POST" | "DELETE",
      path: string,
      body: unknown = null
    ) =>
      requestJson(
        endpoint(),
        { body, method, url: new URL(`${fixture.base}/api/${path}`) },
        new AbortController().signal,
        { maxBytes: ACTION_RESPONSE_BYTES, requireJson: false }
      );

    it("sends a JSON body with the method and auth header", async () => {
      await expect(
        send("POST", "refunds", { charge: "ch_1" })
      ).resolves.toStrictEqual({
        body: { id: "re_1", received: { charge: "ch_1" } },
        status: 201,
      });
      expect(seen.at(-1)).toMatchObject({
        body: '{"charge":"ch_1"}',
        headers: {
          authorization: SECRET,
          "content-type": "application/json",
        },
        method: "POST",
      });
    });

    it("scrubs the auth header from a successful reply", async () => {
      await expect(send("POST", "echo", { a: 1 })).resolves.toStrictEqual({
        body: { seen: "•••" },
        status: 200,
      });
      await expect(send("POST", "echo-text")).resolves.toStrictEqual({
        body: "you sent •••",
        status: 200,
      });
    });

    it("accepts an empty or plain-text reply", async () => {
      await expect(send("DELETE", "empty")).resolves.toStrictEqual({
        body: null,
        status: 204,
      });
      await expect(send("POST", "text")).resolves.toStrictEqual({
        body: "queued",
        status: 200,
      });
    });

    it("never follows a redirect for a write either", async () => {
      await expect(send("POST", "redirect", { a: 1 })).rejects.toMatchObject({
        code: "SOURCE_FAILED",
      });
      expect(seen.filter((item) => item.path.includes("steal"))).toHaveLength(
        0
      );
    });

    it("caps the reply at 1 MB", async () => {
      await expect(send("POST", "streamed-huge")).rejects.toMatchObject({
        code: "SOURCE_TOO_LARGE",
        message: "The response is larger than 1 MB.",
      });
    });
  });

  describe("probeHttp", () => {
    it("returns the base URL's status without following redirects", async () => {
      await expect(
        probeHttp(endpoint(), new AbortController().signal)
      ).resolves.toBe(404);
      await expect(
        probeHttp(
          { ...endpoint(), baseUrl: `${fixture.base}/api/redirect` },
          new AbortController().signal
        )
      ).resolves.toBe(302);
    });
  });
});
