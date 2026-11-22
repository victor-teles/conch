import { z } from "zod";

export const MAX_SECRETS = 20;
export const MAX_READ_TOOLS = 200;
export const MIN_SECRET_LENGTH_FOR_HINT = 12;
const HINT_LENGTH = 4;

const ConfigId = z.string().min(1).max(100);
const ConfigName = z.string().trim().min(1).max(60);
const Stamp = z.string().max(40);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isSafeServiceUrl = (value: string): boolean => {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  if (url.username || url.password || value.includes("#")) {
    return false;
  }
  if (url.protocol === "https:") {
    return true;
  }
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
};

export const SafeServiceUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeServiceUrl, {
    message:
      "Use an https:// URL without a username or #, or http:// on localhost.",
  });

const FORBIDDEN_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
]);

export const HeaderName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, "Use a valid header name.")
  .refine((name) => !FORBIDDEN_HEADERS.has(name.toLowerCase()), {
    message: "Conch sets this header itself.",
  });

export const EnvName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/, "Use a valid variable name.");

export const SecretValue = z
  .string()
  .max(4000)
  .refine(
    (value) => !["\r", "\n", "\u0000"].some((bad) => value.includes(bad)),
    {
      message: "A secret can't contain line breaks.",
    }
  );

const secretMap = (key: z.ZodType<string>) =>
  z
    .record(key, SecretValue)
    .refine((map) => Object.keys(map).length <= MAX_SECRETS, {
      message: `Use at most ${MAX_SECRETS} values.`,
    });

export const AbsolutePath = z
  .string()
  .max(1000)
  .regex(/^\/\S/, "Use an absolute path.");

const ReadTools = z.array(z.string().min(1).max(128)).max(MAX_READ_TOOLS);

export const StdioServerConfig = z.object({
  args: z.array(z.string().max(1000)).max(32),
  command: AbsolutePath,
  createdAt: Stamp,
  env: secretMap(EnvName),
  id: ConfigId,
  name: ConfigName,
  readTools: ReadTools,
  transport: z.literal("stdio"),
  updatedAt: Stamp,
});

export const HttpServerConfig = z.object({
  createdAt: Stamp,
  headers: secretMap(HeaderName),
  id: ConfigId,
  name: ConfigName,
  readTools: ReadTools,
  transport: z.literal("http"),
  updatedAt: Stamp,
  url: SafeServiceUrl,
});

export const McpServerConfig = z.discriminatedUnion("transport", [
  StdioServerConfig,
  HttpServerConfig,
]);
export type McpServerConfig = z.infer<typeof McpServerConfig>;

export const HttpAuth = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("header"), name: HeaderName, value: SecretValue }),
]);

export const HttpEndpointConfig = z.object({
  auth: HttpAuth,
  baseUrl: SafeServiceUrl,
  createdAt: Stamp,
  id: ConfigId,
  name: ConfigName,
  updatedAt: Stamp,
});
export type HttpEndpointConfig = z.infer<typeof HttpEndpointConfig>;

export const SecretInput = <T extends z.ZodType<string>>(name: T) =>
  z.object({ name, value: SecretValue.optional() });

const secretInputs = <T extends z.ZodType<string>>(name: T) =>
  z.array(SecretInput(name)).max(MAX_SECRETS);

export const McpServerInput = z.discriminatedUnion("transport", [
  z.object({
    args: z.array(z.string().max(1000)).max(32),
    command: z.string().trim().min(1).max(1000),
    env: secretInputs(EnvName),
    id: ConfigId.optional(),
    name: ConfigName,
    transport: z.literal("stdio"),
  }),
  z.object({
    headers: secretInputs(HeaderName),
    id: ConfigId.optional(),
    name: ConfigName,
    transport: z.literal("http"),
    url: SafeServiceUrl,
  }),
]);
export type McpServerInput = z.infer<typeof McpServerInput>;

export const HttpEndpointInput = z.object({
  auth: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({
      kind: z.literal("header"),
      name: HeaderName,
      value: SecretValue.optional(),
    }),
  ]),
  baseUrl: SafeServiceUrl,
  id: ConfigId.optional(),
  name: ConfigName,
});
export type HttpEndpointInput = z.infer<typeof HttpEndpointInput>;

export const SetMcpToolReadRequest = z.object({
  read: z.boolean(),
  serverId: ConfigId,
  tool: z.string().min(1).max(128),
});
export type SetMcpToolReadRequest = z.infer<typeof SetMcpToolReadRequest>;

export interface RedactedSecret {
  name: string;
  hasValue: boolean;
  hint: string | null;
}

export interface SourceTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  toolCount?: number;
  readToolCount?: number;
}

interface RedactedServerBase {
  id: string;
  name: string;
  readTools: string[];
  createdAt: string;
  updatedAt: string;
  lastTest: SourceTestResult | null;
}

export type RedactedMcpServer =
  | (RedactedServerBase & {
      transport: "stdio";
      command: string;
      args: string[];
      env: RedactedSecret[];
    })
  | (RedactedServerBase & {
      transport: "http";
      url: string;
      headers: RedactedSecret[];
    });

export interface RedactedHttpEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  auth:
    | { kind: "none" }
    | { kind: "header"; name: string; hasValue: boolean; hint: string | null };
  createdAt: string;
  updatedAt: string;
  lastTest: SourceTestResult | null;
}

export interface McpToolSummary {
  name: string;
  title: string | null;
  description: string;
  readOnlyHint: boolean | null;
  markedRead: boolean;
  readEligible: boolean;
  inputSchema: unknown;
}

export const SourceTarget = z.object({
  id: ConfigId,
  type: z.enum(["mcp", "http"]),
});
export type SourceTarget = z.infer<typeof SourceTarget>;

export const secretHint = (value: string): string | null =>
  value.length >= MIN_SECRET_LENGTH_FOR_HINT ? value.slice(-HINT_LENGTH) : null;

export const redactSecret = (name: string, value: string): RedactedSecret => ({
  hasValue: value.length > 0,
  hint: secretHint(value),
  name,
});

export const isReadEligible = (
  tool: { name: string; annotations?: { readOnlyHint?: boolean } | null },
  server: { readTools: readonly string[] }
): boolean =>
  tool.annotations?.readOnlyHint === true ||
  server.readTools.includes(tool.name);
