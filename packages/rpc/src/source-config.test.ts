import { describe, expect, it } from "vitest";

import {
  HeaderName,
  HttpEndpointConfig,
  isReadEligible,
  McpServerConfig,
  McpServerInput,
  redactSecret,
  SafeServiceUrl,
  SecretValue,
} from "./source-config.ts";

describe("safeServiceUrl", () => {
  it.each([
    ["https://api.stripe.com/v1", true],
    ["http://localhost:8787/mcp", true],
    ["http://127.0.0.1:3000", true],
    ["http://[::1]:3000/x", true],
    ["http://api.example.com", false],
    ["http://localhost.evil.com", false],
    ["https://user:pass@api.example.com", false],
    ["https://token@api.example.com", false],
    ["https://api.example.com/#frag", false],
    ["ftp://files.example.com", false],
    ["file:///etc/passwd", false],
    ["not a url", false],
  ])("%s → %s", (url, ok) => {
    expect(SafeServiceUrl.safeParse(url).success).toBe(ok);
  });
});

describe("headerName", () => {
  it.each([
    ["Authorization", true],
    ["X-Api-Key", true],
    ["Host", false],
    ["content-length", false],
    ["Transfer-Encoding", false],
    ["Connection", false],
    ["Bad Header", false],
    ["X:Y", false],
    ["", false],
  ])("%s → %s", (name, ok) => {
    expect(HeaderName.safeParse(name).success).toBe(ok);
  });

  it("rejects line breaks in secret values", () => {
    expect(SecretValue.safeParse("Bearer abc").success).toBeTruthy();
    expect(SecretValue.safeParse("abc\r\nX-Evil: 1").success).toBeFalsy();
  });
});

describe("source configs", () => {
  const stdio = {
    args: ["--read-only"],
    command: "/opt/homebrew/bin/stripe-mcp",
    createdAt: "2026-11-20T00:00:00.000Z",
    env: { STRIPE_KEY: "sk_test_123456789" },
    id: "s1",
    name: "Stripe",
    readTools: [],
    transport: "stdio",
    updatedAt: "2026-11-20T00:00:00.000Z",
  };

  it("parses stdio servers with absolute commands only", () => {
    expect(McpServerConfig.safeParse(stdio).success).toBeTruthy();
    expect(
      McpServerConfig.safeParse({ ...stdio, command: "stripe-mcp" }).success
    ).toBeFalsy();
    expect(
      McpServerConfig.safeParse({ ...stdio, env: { "BAD-NAME": "x" } }).success
    ).toBeFalsy();
  });

  it("parses remote servers and endpoints with safe URLs", () => {
    const remote = {
      ...stdio,
      headers: { Authorization: "Bearer x" },
      transport: "http",
      url: "https://mcp.linear.app/mcp",
    };
    expect(McpServerConfig.safeParse(remote).success).toBeTruthy();
    expect(
      McpServerConfig.safeParse({ ...remote, url: "http://mcp.linear.app" })
        .success
    ).toBeFalsy();
    expect(
      HttpEndpointConfig.safeParse({
        auth: { kind: "header", name: "Host", value: "x" },
        baseUrl: "https://status.example.com",
        createdAt: "",
        id: "e1",
        name: "Status",
        updatedAt: "",
      }).success
    ).toBeFalsy();
  });

  it("accepts inputs that keep a stored secret", () => {
    const input = McpServerInput.parse({
      args: [],
      command: "npx",
      env: [{ name: "STRIPE_KEY" }],
      name: "Stripe",
      transport: "stdio",
    });
    expect(input).toMatchObject({
      env: [{ name: "STRIPE_KEY" }],
      transport: "stdio",
    });
    expect(input).not.toHaveProperty("env.0.value");
  });
});

describe("redaction and eligibility", () => {
  it("hints only long secrets", () => {
    expect(redactSecret("KEY", "sk_live_abcdefgh1234")).toStrictEqual({
      hasValue: true,
      hint: "1234",
      name: "KEY",
    });
    expect(redactSecret("KEY", "short")).toStrictEqual({
      hasValue: true,
      hint: null,
      name: "KEY",
    });
    expect(redactSecret("KEY", "").hasValue).toBeFalsy();
  });

  it("treats a tool as read only when the server says so or the user marked it", () => {
    const server = { readTools: ["search"] };
    expect(
      isReadEligible(
        { annotations: { readOnlyHint: true }, name: "list" },
        server
      )
    ).toBeTruthy();
    expect(isReadEligible({ name: "search" }, server)).toBeTruthy();
    expect(
      isReadEligible(
        { annotations: { readOnlyHint: false }, name: "refund" },
        server
      )
    ).toBeFalsy();
    expect(
      isReadEligible({ annotations: null, name: "refund" }, server)
    ).toBeFalsy();
  });
});
