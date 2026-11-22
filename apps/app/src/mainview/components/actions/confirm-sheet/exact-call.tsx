import type { CompiledAction } from "@/lib/ipc";

import { SqlBlock } from "@/components/ask/sql-block";

const json = (value: unknown): string => JSON.stringify(value, null, 2);

const BOX =
  "overflow-hidden rounded-[8px] border border-panel-border bg-row-hover";

// The call exactly as bun will run it; SQL keeps its bind markers.
export function ExactCall({ compiled }: { compiled: CompiledAction }) {
  switch (compiled.kind) {
    case "sql": {
      return (
        <div className={BOX}>
          <SqlBlock
            label="Statement"
            sql={compiled.statement}
            state="settled"
          />
        </div>
      );
    }
    case "mcp": {
      return (
        <div className={BOX}>
          <SqlBlock
            kind="mongodb"
            label="Arguments"
            sql={json(compiled.args)}
            state="settled"
          />
        </div>
      );
    }
    case "http": {
      return compiled.body === null ? null : (
        <div className={BOX}>
          <SqlBlock
            kind="mongodb"
            label="Body"
            sql={json(compiled.body)}
            state="settled"
          />
        </div>
      );
    }
    case "copy": {
      return (
        <p className={`${BOX} px-3 py-2 font-mono text-[12px] break-words`}>
          {compiled.text}
        </p>
      );
    }
    case "open-url": {
      return null;
    }
    default: {
      throw new Error(`Unknown call ${compiled satisfies never}`);
    }
  }
}
