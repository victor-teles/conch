import type { SqlTokenKind } from "@/lib/sql-tokens";

import { tokenizeSqlLine } from "@/lib/sql-tokens";
import { COLOR, FONT, MONO_FEATURES } from "@/theme";

export const SQL_LINE_HEIGHT = 19;

export const sqlBlockHeight = (lines: number): number =>
  lines * SQL_LINE_HEIGHT + 22;

const TOKEN_STYLE: Record<SqlTokenKind, React.CSSProperties> = {
  comment: { color: COLOR.muted, fontStyle: "italic" },
  function: { color: COLOR.chart4 },
  keyword: { color: COLOR.chart1 },
  number: { color: COLOR.chart2 },
  plain: { color: COLOR.foreground },
  punctuation: { color: COLOR.muted },
  string: { color: COLOR.chart5 },
};

interface SqlBlockProps {
  sql: string;
  lines: number;
}

export function SqlBlock({ sql, lines }: SqlBlockProps) {
  const shown = sql
    .split("\n")
    .map((text, index) => ({ number: index + 1, text }));
  return (
    <div
      style={{
        background: "oklch(1 0 0 / 0.025)",
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: 10,
        fontFamily: FONT.mono,
        fontFeatureSettings: MONO_FEATURES,
        fontSize: 12,
        height: sqlBlockHeight(lines) - 2,
        lineHeight: `${SQL_LINE_HEIGHT}px`,
        margin: "0 16px",
        overflow: "hidden",
        padding: "10px 0",
        whiteSpace: "pre",
      }}
    >
      {shown.map((line) => (
        <div
          key={line.number}
          style={{ display: "flex", gap: 14, paddingLeft: 12 }}
        >
          <span
            style={{
              color: COLOR.muted,
              opacity: 0.45,
              textAlign: "right",
              width: 16,
            }}
          >
            {line.number}
          </span>
          <span>
            {tokenizeSqlLine(line.text).map((token) => (
              <span key={token.start} style={TOKEN_STYLE[token.kind]}>
                {token.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
