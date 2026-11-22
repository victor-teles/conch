import { staggered } from "@/lib/chart";
import { COLOR, FONT, MONO_FEATURES, TYPE } from "@/theme";

interface RowsTableProps {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  shown: number;
}

const COLUMNS = "40px 1fr 120px";

const cellStyle = (column: number, total: number): React.CSSProperties => {
  if (column === total - 1) {
    return {
      fontFamily: FONT.mono,
      fontFeatureSettings: MONO_FEATURES,
      fontSize: 12,
      textAlign: "right",
    };
  }
  return column === 0 ? { color: COLOR.muted } : {};
};

interface CellsProps {
  columns: readonly string[];
  cells: readonly string[];
}

function Cells({ columns, cells }: CellsProps) {
  const named = columns.map((name, column) => ({
    name,
    style: cellStyle(column, columns.length),
    value: cells[column] ?? "",
  }));
  return (
    <>
      {named.map((cell) => (
        <span key={cell.name} style={cell.style}>
          {cell.value}
        </span>
      ))}
    </>
  );
}

export function RowsTable({ columns, rows, shown }: RowsTableProps) {
  return (
    <div style={{ ...TYPE.body, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          ...TYPE.micro,
          color: COLOR.muted,
          display: "grid",
          gridTemplateColumns: COLUMNS,
          padding: "0 10px 8px",
        }}
      >
        <Cells cells={columns} columns={columns} />
      </div>
      {rows.map((row, index) => {
        const reveal = staggered(shown, index, rows.length);
        return (
          <div
            key={row[0]}
            style={{
              alignItems: "center",
              background: index === 0 ? COLOR.rowActive : undefined,
              borderRadius: 8,
              borderTop:
                index === 0 ? undefined : `1px solid ${COLOR.panelBorder}`,
              display: "grid",
              gridTemplateColumns: COLUMNS,
              height: 36,
              opacity: reveal,
              padding: "0 10px",
              transform: `translateY(${(1 - reveal) * 6}px)`,
            }}
          >
            <Cells cells={row} columns={columns} />
          </div>
        );
      })}
    </div>
  );
}
