import { compiledText } from "@conch/rpc";

import type { CompiledSource, Source, SourceKind } from "@/lib/ipc";

export const COPIED: Record<SourceKind, string> = {
  http: "Copied URL",
  mcp: "Copied call",
  sql: "Copied SQL",
};

const templateText = (source: Source): string => {
  switch (source.kind) {
    case "sql": {
      return source.sqlTemplate;
    }
    case "mcp": {
      return `${source.tool} ${JSON.stringify(source.args, null, 2)}`;
    }
    case "http": {
      const query = new URLSearchParams(
        Object.entries(source.query).map(([key, leaf]) => [
          key,
          typeof leaf === "object"
            ? `{{${leaf.$param}${leaf.part ? `.${leaf.part}` : ""}}}`
            : String(leaf),
        ])
      ).toString();
      return query ? `${source.path}?${query}` : source.path;
    }
    default: {
      throw new Error(`Unknown source ${source satisfies never}`);
    }
  }
};

// The last run's call when there is one, so a copy shows the bound values.
export const sourceText = (
  source: Source,
  compiled: CompiledSource | null
): string => (compiled ? compiledText(compiled) : templateText(source));
