import { TOP_ACCOUNTS } from "@/data/board";
import { COLOR, TYPE } from "@/theme";

interface KpiProps {
  value: string;
  delta: string;
}

export function Kpi({ value, delta }: KpiProps) {
  return (
    <div style={{ alignItems: "baseline", display: "flex", gap: 10 }}>
      <span
        style={{
          fontSize: 30,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span style={{ ...TYPE.meta, color: COLOR.success }}>{delta}</span>
    </div>
  );
}

export function AccountsTable() {
  return (
    <table
      style={{
        ...TYPE.body,
        borderCollapse: "collapse",
        fontVariantNumeric: "tabular-nums",
        width: "100%",
      }}
    >
      <tbody>
        {TOP_ACCOUNTS.map((row) => (
          <tr
            key={row.account}
            style={{ borderTop: `1px solid ${COLOR.panelBorder}` }}
          >
            <td style={{ padding: "5px 0" }}>{row.account}</td>
            <td style={{ color: COLOR.muted }}>{row.plan}</td>
            <td style={{ textAlign: "right" }}>{row.mrr}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
