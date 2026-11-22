import { rowsPhrase } from "@conch/rpc";

import type { ActionReview } from "@/lib/ipc";

function Amber({ children }: { children: string }) {
  return <strong className="font-medium text-warning-ink">{children}</strong>;
}

function EnvironmentBadge({ environment }: { environment: string | null }) {
  if (!environment) {
    return null;
  }
  return (
    <span className="rounded-[5px] border border-warning-ink/40 px-1.5 py-px type-micro text-warning-ink uppercase">
      {environment}
    </span>
  );
}

const hostPath = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}${parsed.search}`;
};

// Names exactly what will change, with the target in amber every time.
export function TargetLine({ review }: { review: ActionReview }) {
  const { compiled, target, limits } = review;
  switch (compiled.kind) {
    case "sql": {
      return (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 type-body text-foreground">
          <span>Writes to</span>
          <Amber>{target.name}</Amber>
          <EnvironmentBadge environment={target.environment} />
          <span className="text-panel-muted">
            · at most {rowsPhrase(limits.maxAffectedRows ?? 1)}
          </span>
        </p>
      );
    }
    case "mcp": {
      return (
        <p className="type-body text-foreground">
          Calls{" "}
          <strong className="font-mono font-medium">{compiled.tool}</strong> on{" "}
          <Amber>{target.name}</Amber>
        </p>
      );
    }
    case "http": {
      return (
        <p className="flex flex-wrap items-center gap-x-1.5 type-body text-foreground">
          <strong className="font-mono font-medium">{compiled.method}</strong>
          <span className="font-mono break-all">{hostPath(compiled.url)}</span>
          <span className="text-panel-muted">on</span>
          <Amber>{target.name}</Amber>
        </p>
      );
    }
    case "open-url": {
      return (
        <p className="type-body text-foreground">
          Opens <span className="font-mono break-all">{compiled.url}</span>
        </p>
      );
    }
    case "copy": {
      return <p className="type-body text-foreground">Copies text</p>;
    }
    default: {
      throw new Error(`Unknown call ${compiled satisfies never}`);
    }
  }
}
