import type { ContrastEntry, ThemeTokenName, ThemeTokens } from "@conch/rpc";

import { THEME_TOKEN_GROUPS } from "@conch/rpc";

import { noteFor } from "./contrast-notes";
import { ThemeTokenRow } from "./theme-token-row";

interface ThemeTokenListProps {
  tokens: ThemeTokens;
  report: readonly ContrastEntry[];
  onToken: (name: ThemeTokenName, value: string) => void;
}

export function ThemeTokenList({
  tokens,
  report,
  onToken,
}: ThemeTokenListProps) {
  return THEME_TOKEN_GROUPS.map((group) => (
    <section aria-label={group.label} key={group.id}>
      <h2 className="px-4 pt-3 pb-1 type-micro text-panel-muted">
        {group.label}
      </h2>
      {group.tokens.map((info) => (
        <ThemeTokenRow
          info={info}
          key={info.name}
          note={noteFor(report, info.name)}
          onChange={onToken}
          value={tokens[info.name]}
        />
      ))}
    </section>
  ));
}
