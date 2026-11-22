import type { Source } from "@/lib/ipc";

import { SOURCE_KIND_LABELS, sourceText } from "./review-draft";

export function ReviewSources({
  sources,
}: {
  sources: Readonly<Record<string, Source>>;
}) {
  const entries = Object.entries(sources);
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Sources" className="flex flex-col gap-1.5">
      {entries.map(([name, source]) => (
        <li className="flex flex-col gap-1" key={name}>
          <span className="flex items-center gap-2 type-meta text-foreground">
            {name}
            <span className="rounded-[5px] border border-panel-border px-1.5 type-micro text-panel-muted">
              {SOURCE_KIND_LABELS[source.kind]}
            </span>
          </span>
          <pre className="max-h-20 overflow-auto rounded-[8px] bg-row-hover px-2 py-1.5 font-mono type-micro whitespace-pre-wrap text-panel-muted">
            {sourceText(source)}
          </pre>
        </li>
      ))}
    </ul>
  );
}
