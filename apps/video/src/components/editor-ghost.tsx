import { COLOR, FONT, MONO_FEATURES } from "@/theme";

const CODE = [
  "export async function settleInvoices(batch: Invoice[]) {",
  "  const ledger = await openLedger({ readOnly: false });",
  "  for (const invoice of batch) {",
  '    if (invoice.status !== "due") continue;',
  "    const total = sumLines(invoice.lines);",
  "    await ledger.post({",
  "      account: invoice.accountId,",
  "      amountCents: total,",
  "      memo: invoice.number,",
  "    });",
  "  }",
  "  return ledger.commit();",
  "}",
  "",
  "function sumLines(lines: InvoiceLine[]) {",
  "  return lines.reduce((sum, line) => sum + line.cents, 0);",
  "}",
];

const FILES = [
  "billing",
  "  invoices.ts",
  "  ledger.ts",
  "  settle.ts",
  "accounts",
  "regions",
];

const CODE_LINES = CODE.map((text, index) => ({ number: index + 1, text }));

const ACTIVE_LINE = 5;

export function EditorGhost({ dim }: { dim: number }) {
  return (
    <div
      style={{
        background: COLOR.ink,
        border: `1px solid ${COLOR.panelBorder}`,
        borderRadius: 18,
        boxShadow: "0 40px 120px -30px oklch(0 0 0 / 0.7)",
        display: "flex",
        flexDirection: "column",
        height: 880,
        left: 150,
        opacity: 1 - dim * 0.45,
        overflow: "hidden",
        position: "absolute",
        top: 100,
        width: 1620,
      }}
    >
      <div
        style={{
          alignItems: "center",
          borderBottom: `1px solid ${COLOR.panelBorder}`,
          display: "flex",
          gap: 10,
          height: 52,
          padding: "0 22px",
        }}
      >
        {["clay", "honey", "moss"].map((tone) => (
          <span
            key={tone}
            style={{
              background: "oklch(1 0 0 / 0.12)",
              borderRadius: 999,
              height: 14,
              width: 14,
            }}
          />
        ))}
        <span
          style={{
            color: COLOR.muted,
            fontFamily: FONT.sans,
            fontSize: 18,
            marginLeft: 18,
            opacity: 0.7,
          }}
        >
          settle.ts
        </span>
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        <div
          style={{
            borderRight: `1px solid ${COLOR.panelBorder}`,
            color: COLOR.muted,
            fontFamily: FONT.sans,
            fontSize: 18,
            lineHeight: "36px",
            opacity: 0.55,
            padding: "20px 24px",
            whiteSpace: "pre",
            width: 260,
          }}
        >
          {FILES.join("\n")}
        </div>
        <div
          style={{
            color: COLOR.foreground,
            fontFamily: FONT.mono,
            fontFeatureSettings: MONO_FEATURES,
            fontSize: 21,
            lineHeight: "40px",
            opacity: 0.5,
            padding: "20px 0",
            whiteSpace: "pre",
          }}
        >
          {CODE_LINES.map((line) => (
            <div
              key={line.number}
              style={{
                background:
                  line.number === ACTIVE_LINE
                    ? "oklch(1 0 0 / 0.04)"
                    : undefined,
                display: "flex",
                gap: 28,
                paddingLeft: 28,
                width: 1360,
              }}
            >
              <span style={{ color: COLOR.muted, opacity: 0.5, width: 30 }}>
                {line.number}
              </span>
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
