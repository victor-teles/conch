import type { HttpEndpointConfig } from "@conch/rpc";

import { DbError } from "@conch/core";

import { MAX_SOURCE_BYTES } from "./mcp-clients.ts";

export const HTTP_TIMEOUT_MS = 30_000;
const MAX_ERROR_CHARS = 300;
const JSON_TYPE = /^application\/(?:[\w.-]+\+)?json\s*(?:;|$)/i;

export type FetchLike = (
  url: URL,
  init: RequestInit & { redirect: "manual" }
) => Promise<Response>;

export const ACTION_RESPONSE_BYTES = 1024 * 1024;

const failed = (message: string): DbError =>
  new DbError("SOURCE_FAILED", message);

const clip = (text: string): string =>
  text.length > MAX_ERROR_CHARS
    ? `${text.slice(0, MAX_ERROR_CHARS - 1)}…`
    : text;

const authHeaders = (endpoint: HttpEndpointConfig): Record<string, string> =>
  endpoint.auth.kind === "header"
    ? { [endpoint.auth.name]: endpoint.auth.value }
    : {};

// Some APIs echo the request back, in errors and in successful replies.
const withoutSecret = (text: string, endpoint: HttpEndpointConfig): string =>
  endpoint.auth.kind === "header" && endpoint.auth.value.length > 0
    ? text.replaceAll(endpoint.auth.value, "•••")
    : text;

const sizeLabel = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${bytes / 1024} KB`;

const tooLarge = (maxBytes: number): DbError =>
  new DbError(
    "SOURCE_TOO_LARGE",
    `The response is larger than ${sizeLabel(maxBytes)}.`
  );

const readCapped = async (
  response: Response,
  maxBytes: number
): Promise<string> => {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw tooLarge(maxBytes);
  }
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooLarge(maxBytes);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
};

const redirectTarget = (response: Response, url: URL): string => {
  const location = response.headers.get("location");
  if (!(location && URL.canParse(location, url))) {
    return "another address";
  }
  return new URL(location, url).origin;
};

export interface JsonRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: URL;
  body: unknown;
}

export interface JsonReply {
  status: number;
  body: unknown;
}

interface RequestLimits {
  maxBytes: number;
  requireJson: boolean;
}

const requestHeaders = (
  endpoint: HttpEndpointConfig,
  hasBody: boolean
): Record<string, string> => ({
  ...authHeaders(endpoint),
  Accept: "application/json",
  ...(hasBody ? { "Content-Type": "application/json" } : {}),
});

// No redirects (the auth header must never follow one), JSON in and out.
// Widget sources only ever send GET; actions may send the other methods.
export const requestJson = async (
  endpoint: HttpEndpointConfig,
  { method, url, body }: JsonRequest,
  signal: AbortSignal,
  { maxBytes, requireJson }: RequestLimits,
  doFetch: FetchLike = fetch
): Promise<JsonReply> => {
  const hasBody = body !== null && body !== undefined && method !== "GET";
  const response = await doFetch(url, {
    body: hasBody ? JSON.stringify(body) : undefined,
    headers: requestHeaders(endpoint, hasBody),
    method,
    redirect: "manual",
    signal: AbortSignal.any([signal, AbortSignal.timeout(HTTP_TIMEOUT_MS)]),
  });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw failed(
      `${endpoint.name} redirected to ${redirectTarget(response, url)}. Update the endpoint's base URL instead.`
    );
  }
  if (response.status >= 400) {
    const text = await readCapped(response, maxBytes).catch(() => "");
    throw failed(
      clip(
        `${endpoint.name} answered ${response.status}: ${withoutSecret(text.trim(), endpoint)}`
      )
    );
  }
  const type = response.headers.get("content-type") ?? "";
  if (!JSON_TYPE.test(type)) {
    if (requireJson) {
      await response.body?.cancel();
      throw new DbError(
        "SOURCE_NOT_DATA",
        `${endpoint.name} answered with ${type.split(";")[0] || "no content type"}, not JSON.`
      );
    }
    const text = withoutSecret(await readCapped(response, maxBytes), endpoint);
    return { body: text.length > 0 ? text : null, status: response.status };
  }
  const text = withoutSecret(await readCapped(response, maxBytes), endpoint);
  if (!requireJson && text.trim() === "") {
    return { body: null, status: response.status };
  }
  try {
    return { body: JSON.parse(text), status: response.status };
  } catch {
    throw new DbError("SOURCE_NOT_DATA", `${endpoint.name} sent invalid JSON.`);
  }
};

export const fetchJson = async (
  endpoint: HttpEndpointConfig,
  url: URL,
  signal: AbortSignal,
  doFetch: FetchLike = fetch
): Promise<unknown> => {
  const reply = await requestJson(
    endpoint,
    { body: null, method: "GET", url },
    signal,
    { maxBytes: MAX_SOURCE_BYTES, requireJson: true },
    doFetch
  );
  return reply.body;
};

export const probeHttp = async (
  endpoint: HttpEndpointConfig,
  signal: AbortSignal,
  doFetch: FetchLike = fetch
): Promise<number> => {
  const response = await doFetch(new URL(endpoint.baseUrl), {
    headers: { ...authHeaders(endpoint), Accept: "application/json" },
    method: "GET",
    redirect: "manual",
    signal,
  });
  await response.body?.cancel();
  return response.status;
};
