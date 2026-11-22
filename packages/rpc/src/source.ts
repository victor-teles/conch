import type { DialectType } from "@conch/core/client";

import {
  collectParamRefs,
  parsePathTemplate,
  parseSelectPath,
  pathParamRefs,
} from "@conch/core/client";
import { z } from "zod";

export const Ident = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);

export const DIALECTS = [
  "postgresql",
  "mysql",
  "sqlite",
  "clickhouse",
  "duckdb",
  "tsql",
  "snowflake",
  "bigquery",
  "redshift",
  "oracle",
] as const satisfies readonly DialectType[];
export const Dialect = z.enum(DIALECTS);

export const SOURCE_KINDS = ["sql", "mcp", "http"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const MAX_ARG_DEPTH = 6;
export const MAX_ARG_KEYS = 64;
export const MAX_ARG_BYTES = 16_384;
export const MAX_QUERY_KEYS = 20;

export const ParamRef = z
  .object({ $param: Ident, part: z.enum(["from", "to"]).optional() })
  .strict();
export type ParamRef = z.infer<typeof ParamRef>;

export type ArgTemplate =
  | string
  | number
  | boolean
  | null
  | ParamRef
  | ArgTemplate[]
  | { [key: string]: ArgTemplate };

const ArgKey = z.string().max(64);

const ArgNode: z.ZodType<ArgTemplate> = z.lazy(() =>
  z.union([
    z.string().max(4000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    ParamRef,
    z.array(ArgNode).max(200),
    z.record(ArgKey, ArgNode),
  ])
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const shapeProblem = (value: unknown, depth: number): string | null => {
  if (depth > MAX_ARG_DEPTH) {
    return `Nest arguments at most ${MAX_ARG_DEPTH} levels deep.`;
  }
  let children: unknown[] = [];
  if (Array.isArray(value)) {
    children = value;
  } else if (isRecord(value)) {
    children = Object.values(value);
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length > MAX_ARG_KEYS) {
      return `Keep each object under ${MAX_ARG_KEYS} keys.`;
    }
    if ("$param" in value && ParamRef.safeParse(value).success === false) {
      return 'A {"$param": …} reference takes only "$param" and "part".';
    }
  }
  for (const child of children) {
    const problem = shapeProblem(child, depth + 1);
    if (problem) {
      return problem;
    }
  }
  return null;
};

const argsProblem = (value: unknown): string | null =>
  JSON.stringify(value).length > MAX_ARG_BYTES
    ? "Keep the arguments under 16 KB."
    : shapeProblem(value, 0);

const withArgLimits = <T>(schema: z.ZodType<T>) =>
  schema.superRefine((value, ctx) => {
    const problem = argsProblem(value);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });

export const ArgTemplate = withArgLimits(ArgNode);
export const McpArgs = withArgLimits(z.record(ArgKey, ArgNode));
export type McpArgs = z.infer<typeof McpArgs>;

export const QueryLeaf = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  ParamRef,
]);
export type QueryLeaf = z.infer<typeof QueryLeaf>;

export const PathTemplate = z
  .string()
  .max(500)
  .regex(/^\/[^?#\s]*$/, "Start the path with / and leave out ? and #.")
  .superRefine((path, ctx) => {
    const parsed = parsePathTemplate(path);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.error });
    }
  });

export const SelectPath = z
  .string()
  .max(200)
  .superRefine((path, ctx) => {
    const parsed = parseSelectPath(path);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.error });
    }
  });

export const SqlSource = z.object({
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  dialect: Dialect,
  kind: z.literal("sql"),
  sqlTemplate: z.string().min(1).max(20_000),
});
export type SqlSource = z.infer<typeof SqlSource>;

export const McpSource = z.object({
  args: McpArgs,
  kind: z.literal("mcp"),
  select: SelectPath,
  serverId: z.string().min(1).max(100),
  tool: z.string().min(1).max(128),
});
export type McpSource = z.infer<typeof McpSource>;

export const HttpSource = z.object({
  endpointId: z.string().min(1).max(100),
  kind: z.literal("http"),
  method: z.literal("GET"),
  path: PathTemplate,
  query: z
    .record(z.string().min(1).max(64), QueryLeaf)
    .refine((query) => Object.keys(query).length <= MAX_QUERY_KEYS, {
      message: `Use at most ${MAX_QUERY_KEYS} query values.`,
    }),
  select: SelectPath,
});
export type HttpSource = z.infer<typeof HttpSource>;

export const Source = z.discriminatedUnion("kind", [
  SqlSource,
  McpSource,
  HttpSource,
]);
export type Source = z.infer<typeof Source>;

export const ExternalSource = z.discriminatedUnion("kind", [
  McpSource,
  HttpSource,
]);
export type ExternalSource = z.infer<typeof ExternalSource>;

export type CompiledSource =
  | { kind: "sql"; sql: string }
  | { kind: "mcp"; server: string; tool: string; args: unknown }
  | { kind: "http"; endpoint: string; url: string };

export const sourceParamRefs = (source: Source): ParamRef[] => {
  switch (source.kind) {
    case "sql": {
      return [];
    }
    case "mcp": {
      return collectParamRefs(source.args);
    }
    case "http": {
      return [...pathParamRefs(source.path), ...collectParamRefs(source.query)];
    }
    default: {
      throw new Error(`Unknown source ${source satisfies never}`);
    }
  }
};

export const compiledText = (compiled: CompiledSource): string => {
  switch (compiled.kind) {
    case "sql": {
      return compiled.sql;
    }
    case "mcp": {
      return `${compiled.tool} ${JSON.stringify(compiled.args, null, 2)}`;
    }
    case "http": {
      return compiled.url;
    }
    default: {
      throw new Error(`Unknown source ${compiled satisfies never}`);
    }
  }
};

export const COPY_LABELS: Record<SourceKind, string> = {
  http: "Copy URL",
  mcp: "Copy Call",
  sql: "Copy SQL",
};

export const sqlSourceOf = (owner: { source: Source }): SqlSource | null =>
  owner.source.kind === "sql" ? owner.source : null;

export const connectionIdOf = (owner: { source: Source }): string | null =>
  sqlSourceOf(owner)?.connectionId ?? null;
